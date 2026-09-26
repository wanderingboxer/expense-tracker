import { prisma } from "@/lib/prisma";
import { SyncStatus, CandidateStatus, TransactionType } from "@/generated/prisma/enums";
import type { gmail_v1 } from "googleapis";
import {
  getGmailClient,
  getUpdatedAccessToken,
  buildFinancialSearchQuery,
  buildFinancialSearchQueryAfterDate,
  searchFinancialEmails,
  getMessage,
  getHistoryChanges,
  HistoryExpiredError,
  HDFC_SENDER_ADDRESS,
  type ParsedMessage,
} from "@/lib/gmail";
import {
  calculateRelevanceScore,
  isFinancialEmail,
} from "@/lib/email-detector";
import { parseTransactionFromEmail } from "@/lib/parser";
import { findOrCreateMerchant } from "@/lib/merchant-normalizer";
import {
  findMatchingTransaction,
  mergeIntoTransaction,
  REVIEW_THRESHOLD,
} from "@/lib/deduplication";
import { categorizeTransaction } from "@/lib/categorizer";
import { detectSubscriptions } from "@/lib/subscription-detector";

function stripHtmlBasic(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8377;/gi, "₹")
    .replace(/\s+/g, " ")
    .trim();
}

interface ImportStats {
  totalScanned: number;
  financialFound: number;
  candidatesCreated: number;
  duplicatesMerged: number;
  reviewItems: number;
  failedMessages: number;
  firstErrorMessage?: string;
  partial: boolean;
}

function emptyStats(): ImportStats {
  return {
    totalScanned: 0,
    financialFound: 0,
    candidatesCreated: 0,
    duplicatesMerged: 0,
    reviewItems: 0,
    failedMessages: 0,
    partial: false,
  };
}

/** Thrown when a sync is already running for this account (manual sync and
 * cron sync raced, or a prior invocation is still in flight). Callers should
 * treat this as "try again shortly," not a hard failure. */
export class SyncInProgressError extends Error {
  constructor() {
    super("A sync is already in progress for this account");
    this.name = "SyncInProgressError";
  }
}

const DEFAULT_LOOKBACK_DAYS = 180;
// Bounds how many pages a single invocation processes, so a Vercel-timeout
// limited run yields control (saving resume state) instead of restarting
// from scratch next time. Each message costs its own Gmail API round trip
// (getMessage) plus DB writes, so even 100 messages (1 page) can approach
// a 60s budget — kept low deliberately; the resume mechanism picks up the
// rest across however many invocations it takes.
const MAX_PAGES_PER_RUN = 1;

// Gmail's default page size (100) is itself too many messages for one
// invocation's budget — a single page timed out in production even with
// MAX_PAGES_PER_RUN=1, killing the function before it could save resume
// state or release the lock. Request small pages instead so one run always
// fits comfortably inside the platform's execution-time limit.
const MESSAGES_PAGE_SIZE = 15;

interface ResumeState {
  query: string;
  pageToken?: string;
}

// If a serverless function is killed mid-request (hits its platform
// execution-time limit), no application code runs afterward — including
// whatever would normally release the lock — so syncStatus can get stuck
// at SYNCING forever, permanently rejecting every future sync attempt.
// Treat a SYNCING lock older than this as abandoned and reclaimable.
const STALE_LOCK_MINUTES = 10;

/** Atomically claims the sync lock. Returns false if another run already
 * holds it (`syncStatus === SYNCING` and recently updated), so callers
 * never run concurrently — but a lock left behind by a killed/crashed
 * invocation doesn't block sync forever. */
async function acquireSyncLock(connectionId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000);
  const result = await prisma.gmailConnection.updateMany({
    where: {
      id: connectionId,
      OR: [
        { syncStatus: { not: SyncStatus.SYNCING } },
        { syncStatus: SyncStatus.SYNCING, updatedAt: { lt: staleBefore } },
      ],
    },
    data: { syncStatus: SyncStatus.SYNCING, errorMessage: null },
  });
  return result.count > 0;
}

async function runPagedImport(
  userId: string,
  gmail: gmail_v1.Gmail,
  query: string,
  startPageToken: string | undefined,
  stats: ImportStats
): Promise<{ remainingPageToken?: string }> {
  let pageToken = startPageToken;
  let pageCount = 0;

  do {
    const { messageIds, nextPageToken } = await searchFinancialEmails(
      gmail,
      query,
      pageToken,
      MESSAGES_PAGE_SIZE
    );

    for (const messageId of messageIds) {
      stats.totalScanned++;

      const existing = await prisma.financialEmail.findUnique({
        where: { gmailMessageId: messageId },
      });
      if (existing) continue;

      try {
        const messageData = await getMessage(gmail, messageId);
        const result = await processSingleEmail(userId, messageId, messageData);

        if (result.isFinancial) stats.financialFound++;
        if (result.candidateCreated) stats.candidatesCreated++;
        if (result.duplicateMerged) stats.duplicatesMerged++;
        if (result.reviewCreated) stats.reviewItems++;
      } catch (err) {
        stats.failedMessages++;
        const message = err instanceof Error ? err.message : String(err);
        if (!stats.firstErrorMessage) stats.firstErrorMessage = message;
        console.error(`Error processing message ${messageId}:`, err);
      }
    }

    pageToken = nextPageToken;
    pageCount++;
  } while (pageToken && pageCount < MAX_PAGES_PER_RUN);

  return { remainingPageToken: pageToken };
}

/** Persists the outcome of a paged import run: either resume state (more
 * pages remain — sync is not "done" yet, `lastSyncAt` is not updated) or
 * completion (fetches the current Gmail `historyId` for future incremental
 * syncs and stamps `lastSyncAt`). */
async function finishImportRun(
  connection: { id: string; accessToken: string },
  gmail: gmail_v1.Gmail,
  auth: Parameters<typeof getUpdatedAccessToken>[0],
  query: string,
  remainingPageToken: string | undefined,
  stats: ImportStats
): Promise<void> {
  const updatedToken = getUpdatedAccessToken(auth);
  const tokenUpdate =
    updatedToken && updatedToken !== connection.accessToken
      ? { accessToken: updatedToken }
      : {};

  if (remainingPageToken) {
    stats.partial = true;
    await prisma.gmailConnection.update({
      where: { id: connection.id },
      data: {
        syncStatus: SyncStatus.IDLE,
        nextPageToken: JSON.stringify({
          query,
          pageToken: remainingPageToken,
        } satisfies ResumeState),
        lastSyncErrorCount: stats.failedMessages,
        errorMessage: stats.firstErrorMessage ?? null,
        ...tokenUpdate,
      },
    });
    return;
  }

  const profile = await gmail.users.getProfile({ userId: "me" });
  await prisma.gmailConnection.update({
    where: { id: connection.id },
    data: {
      syncStatus: SyncStatus.IDLE,
      lastSyncAt: new Date(),
      nextPageToken: null,
      historyId: profile.data.historyId
        ? BigInt(profile.data.historyId)
        : undefined,
      lastSyncErrorCount: stats.failedMessages,
      errorMessage: stats.firstErrorMessage ?? null,
      ...tokenUpdate,
    },
  });
}

export async function processGmailImport(
  userId: string,
  options?: { sinceDate?: Date }
): Promise<ImportStats> {
  const stats = emptyStats();

  const connection = await prisma.gmailConnection.findUnique({
    where: { userId },
  });
  if (!connection) {
    throw new Error("Gmail connection not found for user");
  }

  const locked = await acquireSyncLock(connection.id);
  if (!locked) throw new SyncInProgressError();

  try {
    const { gmail, auth } = getGmailClient(
      connection.accessToken,
      connection.refreshToken
    );

    let query: string;
    let pageToken: string | undefined;

    if (connection.nextPageToken) {
      // Resuming a run that yielded control mid-pagination last time.
      const resume = JSON.parse(connection.nextPageToken) as ResumeState;
      query = resume.query;
      pageToken = resume.pageToken;
    } else if (options?.sinceDate) {
      query = buildFinancialSearchQueryAfterDate(options.sinceDate);
    } else {
      const lookbackDays =
        Number(process.env.SYNC_LOOKBACK_DAYS) || DEFAULT_LOOKBACK_DAYS;
      query = buildFinancialSearchQuery(lookbackDays);
    }

    const { remainingPageToken } = await runPagedImport(
      userId,
      gmail,
      query,
      pageToken,
      stats
    );

    await finishImportRun(connection, gmail, auth, query, remainingPageToken, stats);
  } catch (error) {
    await prisma.gmailConnection.update({
      where: { id: connection.id },
      data: {
        syncStatus: SyncStatus.ERROR,
        errorMessage:
          error instanceof Error ? error.message : "Unknown error during import",
      },
    });
    throw error;
  }

  await runSubscriptionDetectionIfComplete(userId, stats);
  return stats;
}

/** Subscription detection only makes sense once a sync run has actually
 * finished (not mid-pagination) — otherwise a partial transaction history
 * could produce false patterns. Also skipped when nothing new landed: it's
 * a full re-scan of the user's entire transaction history, so running it
 * on every routine cron tick (most of which find zero new emails) would
 * make sync cost grow with total history size regardless of how much
 * actually changed. Failures here are logged, not fatal: a detection bug
 * shouldn't turn a successful sync into a failed one. */
async function runSubscriptionDetectionIfComplete(
  userId: string,
  stats: ImportStats
): Promise<void> {
  if (stats.partial) return;
  if (stats.candidatesCreated === 0 && stats.duplicatesMerged === 0) return;
  try {
    await detectSubscriptions(userId);
  } catch (err) {
    console.error("Subscription detection failed:", err);
  }
}

export async function processIncrementalSync(
  userId: string
): Promise<ImportStats> {
  const stats = emptyStats();

  const connection = await prisma.gmailConnection.findUnique({
    where: { userId },
  });
  if (!connection) {
    throw new Error("Gmail connection not found for user");
  }

  if (!connection.historyId) {
    // No historyId yet (first-ever sync) — do a full import instead.
    return processGmailImport(userId);
  }

  const locked = await acquireSyncLock(connection.id);
  if (!locked) throw new SyncInProgressError();

  try {
    const { gmail, auth } = getGmailClient(
      connection.accessToken,
      connection.refreshToken
    );

    let addedMessageIds: string[];
    try {
      const result = await getHistoryChanges(
        gmail,
        connection.historyId.toString()
      );
      addedMessageIds = result.addedMessageIds;
    } catch (error) {
      if (error instanceof HistoryExpiredError) {
        // Gmail expires history after ~7 days. Fall back to a bounded full
        // resync since the last successful sync (not the full lookback
        // window) — we already hold the lock, so this reuses the same
        // paged-import path directly instead of re-entering
        // processGmailImport (which would try to acquire the lock again).
        //
        // If a prior run of this same fallback already saved resume state
        // (its own bounded resync needed more than one invocation's page
        // budget), continue from there instead of restarting at page 1.
        let query: string;
        let startPageToken: string | undefined;
        if (connection.nextPageToken) {
          const resume = JSON.parse(connection.nextPageToken) as ResumeState;
          query = resume.query;
          startPageToken = resume.pageToken;
        } else {
          const sinceDate =
            connection.lastSyncAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          query = buildFinancialSearchQueryAfterDate(sinceDate);
        }
        stats.firstErrorMessage = "Gmail history expired; ran a bounded full resync instead";

        const { remainingPageToken } = await runPagedImport(
          userId,
          gmail,
          query,
          startPageToken,
          stats
        );
        await finishImportRun(connection, gmail, auth, query, remainingPageToken, stats);
        await runSubscriptionDetectionIfComplete(userId, stats);
        return stats;
      }
      throw error;
    }

    for (const messageId of addedMessageIds) {
      stats.totalScanned++;

      const existing = await prisma.financialEmail.findUnique({
        where: { gmailMessageId: messageId },
      });
      if (existing) continue;

      try {
        const messageData = await getMessage(gmail, messageId);
        const result = await processSingleEmail(userId, messageId, messageData);

        if (result.isFinancial) stats.financialFound++;
        if (result.candidateCreated) stats.candidatesCreated++;
        if (result.duplicateMerged) stats.duplicatesMerged++;
        if (result.reviewCreated) stats.reviewItems++;
      } catch (err) {
        stats.failedMessages++;
        const message = err instanceof Error ? err.message : String(err);
        if (!stats.firstErrorMessage) stats.firstErrorMessage = message;
        console.error(`Error processing message ${messageId}:`, err);
      }
    }

    const profile = await gmail.users.getProfile({ userId: "me" });
    const updatedToken = getUpdatedAccessToken(auth);
    const tokenUpdate =
      updatedToken && updatedToken !== connection.accessToken
        ? { accessToken: updatedToken }
        : {};

    await prisma.gmailConnection.update({
      where: { id: connection.id },
      data: {
        syncStatus: SyncStatus.IDLE,
        lastSyncAt: new Date(),
        historyId: profile.data.historyId
          ? BigInt(profile.data.historyId)
          : undefined,
        lastSyncErrorCount: stats.failedMessages,
        errorMessage: stats.firstErrorMessage ?? null,
        ...tokenUpdate,
      },
    });
  } catch (error) {
    await prisma.gmailConnection.update({
      where: { id: connection.id },
      data: {
        syncStatus: SyncStatus.ERROR,
        errorMessage:
          error instanceof Error ? error.message : "Unknown error during sync",
      },
    });
    throw error;
  }

  await runSubscriptionDetectionIfComplete(userId, stats);
  return stats;
}

interface ProcessResult {
  isFinancial: boolean;
  candidateCreated: boolean;
  duplicateMerged: boolean;
  reviewCreated: boolean;
}

export async function processSingleEmail(
  userId: string,
  gmailMessageId: string,
  messageData: ParsedMessage
): Promise<ProcessResult> {
  const result: ProcessResult = {
    isFinancial: false,
    candidateCreated: false,
    duplicateMerged: false,
    reviewCreated: false,
  };

  const senderMatch = messageData.from.match(/<([^>]+)>/);
  const senderEmail = senderMatch ? senderMatch[1] : messageData.from;
  const senderDomain = senderEmail.split("@")[1] ?? "";

  const bodyText = messageData.bodyText || stripHtmlBasic(messageData.bodyHtml);

  const emailData = {
    sender: messageData.from,
    senderDomain,
    subject: messageData.subject,
    bodyText,
  };

  // Incremental sync (processIncrementalSync -> getHistoryChanges) lists
  // every new message in the whole mailbox, not just HDFC ones — Gmail's
  // History API has no sender filter. The content-based classifier alone
  // isn't a safe gate for "is this an HDFC alert": a referral/newsletter
  // email can still contain a currency-looking number and incidentally
  // match a reference-number pattern (e.g. "Refer Now" itself matches the
  // loose `ref(erence)?` pattern). Require the exact configured sender
  // address as a hard prerequisite, unconditionally, before any scoring.
  const isFromConfiguredSender =
    senderEmail.toLowerCase() === HDFC_SENDER_ADDRESS.toLowerCase();

  const relevanceScore = calculateRelevanceScore(emailData);
  const financial = isFromConfiguredSender && isFinancialEmail(emailData, relevanceScore);

  // Store the email record
  const financialEmail = await prisma.financialEmail.create({
    data: {
      userId,
      gmailMessageId,
      gmailThreadId: messageData.threadId,
      sender: messageData.from,
      senderDomain,
      subject: messageData.subject,
      receivedAt: new Date(messageData.date || Date.now()),
      snippet: messageData.snippet,
      bodyText: bodyText,
      bodyHtml: messageData.bodyHtml,
      relevanceScore,
      isFinancial: financial,
      processedAt: new Date(),
      parserUsed: "rule-based",
    },
  });

  if (!financial) return result;
  result.isFinancial = true;

  // Parse transaction data
  const parsed = parseTransactionFromEmail({
    sender: messageData.from,
    senderDomain,
    subject: messageData.subject,
    bodyText: messageData.bodyText,
    bodyHtml: messageData.bodyHtml,
  });

  if (!parsed) return result;

  // Create transaction candidate
  const candidate = await prisma.transactionCandidate.create({
    data: {
      financialEmailId: financialEmail.id,
      amount: parsed.amount,
      currency: parsed.currency,
      merchantRaw: parsed.merchantRaw,
      transactionDate: parsed.transactionDate,
      transactionTime: parsed.transactionTime,
      type: parsed.type,
      paymentMethod: parsed.paymentMethod,
      accountLast4: parsed.accountLast4,
      cardLast4: parsed.cardLast4,
      upiId: parsed.upiId,
      referenceNumber: parsed.referenceNumber,
      utr: parsed.utr,
      description: parsed.description,
      confidence: parsed.confidence,
      status: CandidateStatus.PENDING,
    },
  });

  result.candidateCreated = true;

  // Deduplication check
  const match = await findMatchingTransaction(userId, parsed);

  if (match && match.qualifiesForAutoMerge) {
    // Auto-merge
    await mergeIntoTransaction(match.transactionId, financialEmail.id, match.reasons);
    await prisma.transactionCandidate.update({
      where: { id: candidate.id },
      data: { status: CandidateStatus.MATCHED },
    });
    result.duplicateMerged = true;
    return result;
  }

  if (match && match.score >= REVIEW_THRESHOLD) {
    // Create review item for manual review
    await prisma.reviewItem.create({
      data: {
        userId,
        type: "POSSIBLE_DUPLICATE",
        transactionId: match.transactionId,
        suggestedAction: {
          action: "merge",
          candidateId: candidate.id,
          score: match.score,
          reasons: match.reasons,
        },
      },
    });
    result.reviewCreated = true;
    return result;
  }

  // No duplicate - create new transaction
  let merchantId: string | null = null;
  if (parsed.merchantRaw) {
    const merchant = await findOrCreateMerchant(userId, parsed.merchantRaw);
    merchantId = merchant.id;
  }

  // Categorize
  const categorization = await categorizeTransaction(
    userId,
    parsed.merchantRaw ?? "",
    parsed.description ?? "",
    parsed.type,
    parsed.amount
  );

  // Create transaction
  const transaction = await prisma.transaction.create({
    data: {
      userId,
      amount: parsed.amount,
      currency: parsed.currency,
      merchantId,
      type: parsed.type,
      categoryId: categorization.categoryId || null,
      transactionDate: parsed.transactionDate ?? new Date(),
      transactionTime: parsed.transactionTime,
      paymentMethod: parsed.paymentMethod,
      accountLast4: parsed.accountLast4,
      cardLast4: parsed.cardLast4,
      upiId: parsed.upiId,
      referenceNumber: parsed.referenceNumber,
      utr: parsed.utr,
      confidence: parsed.confidence,
      notes: parsed.description,
      evidence: {
        create: {
          financialEmailId: financialEmail.id,
          matchConfidence: parsed.confidence,
          matchReasons: ["Initial extraction from email"],
        },
      },
    },
  });

  await prisma.transactionCandidate.update({
    where: { id: candidate.id },
    data: { status: CandidateStatus.CREATED },
  });

  // Create review items for low confidence or unknown type
  if (parsed.confidence < 0.5 || parsed.type === TransactionType.UNKNOWN) {
    await prisma.reviewItem.create({
      data: {
        userId,
        type:
          parsed.type === TransactionType.UNKNOWN
            ? "UNKNOWN_TYPE"
            : "LOW_CONFIDENCE",
        transactionId: transaction.id,
        suggestedAction: {
          candidateId: candidate.id,
          confidence: parsed.confidence,
        },
      },
    });
    result.reviewCreated = true;
  }

  return result;
}
