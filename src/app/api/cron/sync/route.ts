import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processIncrementalSync, processGmailImport } from "@/lib/ingestion";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await prisma.gmailConnection.findMany({
    where: { syncStatus: { not: "SYNCING" } },
    select: { userId: true, lastSyncAt: true },
  });

  const results: { userId: string; success: boolean; error?: string }[] = [];

  for (const conn of connections) {
    try {
      const stats = conn.lastSyncAt
        ? await processIncrementalSync(conn.userId)
        : await processGmailImport(conn.userId);
      results.push({ userId: conn.userId, success: true });
    } catch (error) {
      results.push({
        userId: conn.userId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
