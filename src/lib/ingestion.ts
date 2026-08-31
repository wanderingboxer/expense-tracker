import { prisma } from "@/lib/prisma";
import { SyncStatus, CandidateStatus, TransactionType } from "@/generated/prisma/enums";
import {
  getGmailClient,
  getUpdatedAccessToken,
  buildFinancialSearchQuery,
  searchFinancialEmails,
  getMessage,
  getHistoryChanges,
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
  AUTO_MERGE_THRESHOLD,
  REVIEW_THRESHOLD,
} from "@/lib/deduplication";
import { categorizeTransaction } from "@/lib/categorizer";

interface ImportStats {
  totalScanned: number;
  financialFound: number;
  candidatesCreated: number;
  duplicatesMerged: number;
  reviewItems: number;
}

export async function processGmailImport(
  userId: string
): Promise<ImportStats> {
  const stats: ImportStats = {
    totalScanned: 0,
    financialFound: 0,
    candidatesCreated: 0,
    duplicatesMerged: 0,
    reviewItems: 0,
  };

  const connection = await prisma.gmailConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    throw new Error("Gmail connection not found for user");
  }

  await prisma.gmailConnection.update({
    where: { id: connection.id },
    data: { syncStatus: SyncStatus.SYNCING, errorMessage: null },
  });

  try {
    const { gmail, auth } = getGmailClient(connection.accessToken, connection.refreshToken);
    const MAX_PAGES = 3;
    let pageToken: string | undefined;
    let pageCount = 0;

    do {
      const { messageIds, nextPageToken } = await searchFinancialEmails(
        gmail,
        buildFinancialSearchQuery(90),
        pageToken
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
          console.error(`Error processing message ${messageId}:`, err);
        }
      }

      pageToken = nextPageToken;
      pageCount++;
    } while (pageToken && pageCount < MAX_PAGES);

    // Get current profile for historyId
    const profile = await gmail.users.getProfile({ userId: "me" });

    // Persist refreshed access token if it changed
    const updatedToken = getUpdatedAccessToken(auth);
    const tokenUpdate = updatedToken && updatedToken !== connection.accessToken
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
        ...tokenUpdate,
      },
    });
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

  return stats;
}

export async function processIncrementalSync(
  userId: string
): Promise<ImportStats> {
  const stats: ImportStats = {
    totalScanned: 0,
    financialFound: 0,
    candidatesCreated: 0,
    duplicatesMerged: 0,
    reviewItems: 0,
  };

  const connection = await prisma.gmailConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    throw new Error("Gmail connection not found for user");
  }

  if (!connection.historyId) {
    // No historyId, do full import instead
    return processGmailImport(userId);
  }

  await prisma.gmailConnection.update({
    where: { id: connection.id },
    data: { syncStatus: SyncStatus.SYNCING, errorMessage: null },
  });

  try {
    const { gmail, auth } = getGmailClient(connection.accessToken, connection.refreshToken);
    const { addedMessageIds } = await getHistoryChanges(
      gmail,
      connection.historyId.toString()
    );

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
        console.error(`Error processing message ${messageId}:`, err);
      }
    }

    const profile = await gmail.users.getProfile({ userId: "me" });

    // Persist refreshed access token if it changed
    const updatedToken = getUpdatedAccessToken(auth);
    const tokenUpdate = updatedToken && updatedToken !== connection.accessToken
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

  const emailData = {
    sender: messageData.from,
    senderDomain,
    subject: messageData.subject,
    bodyText: messageData.bodyText,
  };

  const relevanceScore = calculateRelevanceScore(emailData);
  const financial = isFinancialEmail(relevanceScore);

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
      bodyText: messageData.bodyText,
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

  if (match && match.score >= AUTO_MERGE_THRESHOLD) {
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
