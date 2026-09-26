import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  processIncrementalSync,
  processGmailImport,
  SyncInProgressError,
} from "@/lib/ingestion";

// Same reasoning as /api/gmail/sync: a Gmail API round trip per message, and
// this route loops over every connected account in one request.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Don't pre-filter on syncStatus here — acquireSyncLock in ingestion.ts is
  // the actual source of truth and does the atomic check-and-set. Filtering
  // here too would just be a second, race-prone check.
  const connections = await prisma.gmailConnection.findMany({
    select: { userId: true, lastSyncAt: true },
  });

  const results: { userId: string; success: boolean; skipped?: boolean; error?: string }[] = [];

  for (const conn of connections) {
    try {
      await (conn.lastSyncAt
        ? processIncrementalSync(conn.userId)
        : processGmailImport(conn.userId));
      results.push({ userId: conn.userId, success: true });
    } catch (error) {
      if (error instanceof SyncInProgressError) {
        results.push({ userId: conn.userId, success: false, skipped: true });
        continue;
      }
      results.push({
        userId: conn.userId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
