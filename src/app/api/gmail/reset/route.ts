import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    await prisma.reviewItem.deleteMany({ where: { userId } });
    await prisma.transactionEvidence.deleteMany({ where: { transaction: { userId } } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.transactionCandidate.deleteMany({ where: { financialEmail: { userId } } });
    await prisma.financialEmail.deleteMany({ where: { userId } });
    await prisma.gmailConnection.updateMany({
      where: { userId },
      data: { historyId: null, lastSyncAt: null },
    });

    return NextResponse.json({ success: true, message: "All sync data cleared" });
  } catch (error) {
    console.error("POST /api/gmail/reset error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
