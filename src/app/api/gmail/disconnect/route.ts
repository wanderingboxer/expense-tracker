import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json().catch(() => ({}));
    const deleteData = body.deleteImportedData === true;

    if (deleteData) {
      // Delete all imported data in order
      await prisma.transactionEvidence.deleteMany({
        where: { transaction: { userId, isManual: false } },
      });
      await prisma.reviewItem.deleteMany({ where: { userId } });
      await prisma.transactionCandidate.deleteMany({
        where: { financialEmail: { userId } },
      });
      await prisma.transaction.deleteMany({ where: { userId, isManual: false } });
      await prisma.financialEmail.deleteMany({ where: { userId } });
    }

    await prisma.gmailConnection.delete({ where: { userId } }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/gmail/disconnect error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
