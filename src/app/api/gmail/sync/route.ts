import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processGmailImport, processIncrementalSync } from "@/lib/ingestion";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const connection = await prisma.gmailConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });
    }

    const stats = connection.lastSyncAt
      ? await processIncrementalSync(userId)
      : await processGmailImport(userId);

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("POST /api/gmail/sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await prisma.gmailConnection.findUnique({
      where: { userId: session.user.id },
      select: { lastSyncAt: true, syncStatus: true, historyId: true, errorMessage: true },
    });

    if (!connection) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      lastSyncAt: connection.lastSyncAt,
      syncStatus: connection.syncStatus,
      historyId: connection.historyId?.toString() ?? null,
      errorMessage: connection.errorMessage,
    });
  } catch (error) {
    console.error("GET /api/gmail/sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
