/**
 * Integration tests for the sync orchestration in ingestion.ts, against a
 * real database with the Gmail API layer mocked (we can't call real Gmail
 * from a test). Covers: lock acquisition, pagination resume, history-expiry
 * fallback, and partial-failure stats — the pieces that are hardest to get
 * right and easiest to silently break.
 */
import { prisma } from "@/lib/prisma";
import { createTestUser, cleanupTestUser } from "./helpers/db";
import { HistoryExpiredError, type ParsedMessage } from "@/lib/gmail";

jest.mock("@/lib/gmail", () => {
  const actual = jest.requireActual("@/lib/gmail");
  return {
    ...actual,
    getGmailClient: jest.fn(),
    getUpdatedAccessToken: jest.fn(),
    searchFinancialEmails: jest.fn(),
    getMessage: jest.fn(),
    getHistoryChanges: jest.fn(),
  };
});

import {
  getGmailClient,
  getUpdatedAccessToken,
  searchFinancialEmails,
  getMessage,
  getHistoryChanges,
} from "@/lib/gmail";
import {
  processGmailImport,
  processIncrementalSync,
  SyncInProgressError,
} from "@/lib/ingestion";

const REAL_HDFC_BODY = (amount: string, ref: string) =>
  `Dear Customer, Rs.${amount} is debited from your account ending 4781 towards VPA test@ybl (Test Merchant) on 26-09-26. UPI transaction reference no.: ${ref}.`;

function fakeMessage(id: string, amount: string, ref: string): ParsedMessage {
  return {
    id,
    threadId: id,
    from: "HDFC Bank <alerts@hdfcbank.bank.in>",
    subject: "Transaction alert",
    date: new Date().toISOString(),
    bodyText: REAL_HDFC_BODY(amount, ref),
    bodyHtml: "",
    snippet: "",
  };
}

function fakeGmailHandle() {
  return {
    users: {
      getProfile: jest.fn().mockResolvedValue({ data: { historyId: "1000" } }),
    },
  };
}

describe("ingestion.ts sync orchestration (mocked Gmail client, real database)", () => {
  let userId: string;
  let connectionId: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    const user = await createTestUser("ingestion");
    userId = user.id;

    const connection = await prisma.gmailConnection.create({
      data: {
        userId,
        email: "test@example.com",
        accessToken: "token-a",
        refreshToken: "refresh-a",
      },
    });
    connectionId = connection.id;

    (getGmailClient as jest.Mock).mockReturnValue({
      gmail: fakeGmailHandle(),
      auth: {},
    });
    (getUpdatedAccessToken as jest.Mock).mockReturnValue(null);
  });

  afterEach(async () => {
    await cleanupTestUser(userId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("full import: creates transactions and marks the connection fully synced", async () => {
    (searchFinancialEmails as jest.Mock).mockResolvedValue({
      messageIds: ["m1", "m2"],
      nextPageToken: undefined,
    });
    (getMessage as jest.Mock).mockImplementation(async (_gmail, id: string) =>
      fakeMessage(id, "100.00", `REF${id}00000000`)
    );

    const stats = await processGmailImport(userId);

    expect(stats.partial).toBe(false);
    expect(stats.totalScanned).toBe(2);

    const connection = await prisma.gmailConnection.findUnique({ where: { id: connectionId } });
    expect(connection?.syncStatus).toBe("IDLE");
    expect(connection?.lastSyncAt).not.toBeNull();
    expect(connection?.nextPageToken).toBeNull();

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions.length).toBeGreaterThan(0);
  });

  it("saves resume state on a partial run (more pages than one invocation processes) and resumes it on the next call", async () => {
    // Mocked calls resolve instantly, so the real 45s production time
    // budget would make this test loop for 45 real seconds before ever
    // seeing pageToken=undefined. Shrink it so the run instead exhausts
    // its budget quickly, the same way a slow real Gmail API would.
    process.env.SYNC_TIME_BUDGET_MS = "50";
    (searchFinancialEmails as jest.Mock).mockImplementation(
      async (_gmail, _query, pageToken) => ({
        messageIds: [],
        nextPageToken: pageToken ? `${pageToken}-next` : "page-1",
      })
    );

    const stats = await processGmailImport(userId);
    delete process.env.SYNC_TIME_BUDGET_MS;
    expect(stats.partial).toBe(true);

    const connection = await prisma.gmailConnection.findUnique({ where: { id: connectionId } });
    expect(connection?.lastSyncAt).toBeNull();
    expect(connection?.nextPageToken).not.toBeNull();
    const resumeState = JSON.parse(connection!.nextPageToken!);
    expect(resumeState.pageToken).toBeDefined();

    // Next invocation should resume from the stored pageToken, not restart.
    const callArgsBeforeResume = (searchFinancialEmails as jest.Mock).mock.calls.length;
    (searchFinancialEmails as jest.Mock).mockImplementation(
      async (_gmail, _query, _pageToken) => ({
        messageIds: [],
        nextPageToken: undefined, // completes this time
      })
    );

    const stats2 = await processGmailImport(userId);
    expect(stats2.partial).toBe(false);

    const firstResumeCallArgs = (searchFinancialEmails as jest.Mock).mock.calls[callArgsBeforeResume];
    expect(firstResumeCallArgs[2]).toBe(resumeState.pageToken);

    const finalConnection = await prisma.gmailConnection.findUnique({ where: { id: connectionId } });
    expect(finalConnection?.nextPageToken).toBeNull();
    expect(finalConnection?.lastSyncAt).not.toBeNull();
  });

  it("refuses to run a second sync concurrently for the same account", async () => {
    await prisma.gmailConnection.update({
      where: { id: connectionId },
      data: { syncStatus: "SYNCING" },
    });

    await expect(processGmailImport(userId)).rejects.toBeInstanceOf(SyncInProgressError);
    expect(searchFinancialEmails).not.toHaveBeenCalled();
  });

  it("reclaims a SYNCING lock left behind by a killed invocation instead of blocking forever", async () => {
    // A serverless function killed at its execution-time limit never runs
    // its own cleanup code, so syncStatus can get stuck at SYNCING with no
    // process left to release it. A lock this old must be treated as
    // abandoned, not as a sync genuinely still in progress.
    const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000);
    await prisma.gmailConnection.update({
      where: { id: connectionId },
      data: { syncStatus: "SYNCING", updatedAt: elevenMinutesAgo },
    });

    (searchFinancialEmails as jest.Mock).mockResolvedValue({
      messageIds: [],
      nextPageToken: undefined,
    });

    await expect(processGmailImport(userId)).resolves.toBeDefined();

    const connection = await prisma.gmailConnection.findUnique({ where: { id: connectionId } });
    expect(connection?.syncStatus).toBe("IDLE");
  });

  it("falls back to a bounded full resync when Gmail reports history expired", async () => {
    await prisma.gmailConnection.update({
      where: { id: connectionId },
      data: { historyId: BigInt(500), lastSyncAt: new Date("2026-08-01") },
    });

    (getHistoryChanges as jest.Mock).mockRejectedValue(new HistoryExpiredError());
    (searchFinancialEmails as jest.Mock).mockResolvedValue({
      messageIds: ["m1"],
      nextPageToken: undefined,
    });
    (getMessage as jest.Mock).mockResolvedValue(fakeMessage("m1", "50.00", "REFHISTEXP0000"));

    const stats = await processIncrementalSync(userId);

    expect(stats.partial).toBe(false);
    expect(stats.firstErrorMessage).toMatch(/history expired/i);

    const connection = await prisma.gmailConnection.findUnique({ where: { id: connectionId } });
    expect(connection?.syncStatus).toBe("IDLE");
    expect(connection?.lastSyncAt).not.toBeNull();
  });

  it("tracks partial-message failures without failing the whole sync", async () => {
    (searchFinancialEmails as jest.Mock).mockResolvedValue({
      messageIds: ["ok-1", "bad-1", "ok-2"],
      nextPageToken: undefined,
    });
    (getMessage as jest.Mock).mockImplementation(async (_gmail, id: string) => {
      if (id === "bad-1") throw new Error("Gmail API 500");
      return fakeMessage(id, "75.00", `REF${id}0000000000`);
    });

    const stats = await processGmailImport(userId);

    expect(stats.failedMessages).toBe(1);
    expect(stats.firstErrorMessage).toMatch(/Gmail API 500/);

    const connection = await prisma.gmailConnection.findUnique({ where: { id: connectionId } });
    expect(connection?.lastSyncErrorCount).toBe(1);
    expect(connection?.errorMessage).toMatch(/Gmail API 500/);
    // The sync as a whole still completed successfully despite one failure.
    expect(connection?.syncStatus).toBe("IDLE");
    expect(connection?.lastSyncAt).not.toBeNull();
  });

  it("ignores non-HDFC senders surfaced by incremental sync's mailbox-wide history scan", async () => {
    // Regression guard for a real production bug: getHistoryChanges (used
    // by incremental sync) lists every new message in the whole mailbox —
    // Gmail's History API has no sender filter — so a referral/newsletter
    // email unrelated to HDFC can still reach the classifier. A subject
    // like "Refer Now & Unlock Exclusive Rewards" matches the loose
    // reference-number pattern, and body copy mentioning a reward amount
    // satisfies the currency check, so content-based scoring alone let it
    // through and created a fake "transaction". The sender must be a hard
    // gate, independent of content.
    await prisma.gmailConnection.update({
      where: { id: connectionId },
      data: { historyId: BigInt(500), lastSyncAt: new Date("2026-09-20") },
    });

    (getHistoryChanges as jest.Mock).mockResolvedValue({
      addedMessageIds: ["spam-1"],
    });
    (getMessage as jest.Mock).mockResolvedValue({
      id: "spam-1",
      threadId: "spam-1",
      from: "AECC India <student.india@aeccglobal.com>",
      subject: "Aditya, Refer Now & Unlock Exclusive Rewards",
      date: new Date().toISOString(),
      bodyText: "Refer a friend and earn a reward of Rs.5,000 when they enroll.",
      bodyHtml: "",
      snippet: "",
    });

    await processIncrementalSync(userId);

    const financialEmail = await prisma.financialEmail.findUnique({
      where: { gmailMessageId: "spam-1" },
    });
    expect(financialEmail).not.toBeNull();
    expect(financialEmail?.isFinancial).toBe(false);

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions).toHaveLength(0);
  });
});
