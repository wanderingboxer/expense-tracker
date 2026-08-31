import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const connection = await prisma.gmailConnection.findUnique({
      where: { userId },
      select: {
        email: true,
        syncStatus: true,
        lastSyncAt: true,
        historyId: true,
        errorMessage: true,
      },
    });

    const emailCount = await prisma.financialEmail.count({ where: { userId } });
    const financialCount = await prisma.financialEmail.count({
      where: { userId, isFinancial: true },
    });
    const candidateCount = await prisma.transactionCandidate.count({
      where: { financialEmail: { userId } },
    });
    const transactionCount = await prisma.transaction.count({ where: { userId } });

    const recentEmails = await prisma.financialEmail.findMany({
      where: { userId },
      orderBy: { receivedAt: "desc" },
      take: 10,
      select: {
        id: true,
        sender: true,
        senderDomain: true,
        subject: true,
        receivedAt: true,
        relevanceScore: true,
        isFinancial: true,
        processedAt: true,
      },
    });

    const recentTransactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { transactionDate: "desc" },
      take: 10,
      include: { merchant: true, category: true },
    });

    return NextResponse.json({
      connection: connection
        ? {
            ...connection,
            historyId: connection.historyId?.toString() ?? null,
          }
        : null,
      counts: {
        totalEmails: emailCount,
        financialEmails: financialCount,
        candidates: candidateCount,
        transactions: transactionCount,
      },
      recentEmails,
      recentTransactions,
    });
  } catch (error) {
    console.error("GET /api/gmail/debug error:", error);
    return NextResponse.json(
      { error: "Internal server error", detail: String(error) },
      { status: 500 }
    );
  }
}
