import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@/generated/prisma/enums";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const months = Math.min(36, Math.max(1, parseInt(req.nextUrl.searchParams.get("months") ?? "12")));

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        isExcluded: false,
        transactionDate: { gte: startDate },
      },
      select: { amount: true, type: true, transactionDate: true },
    });

    const monthlyMap = new Map<string, { totalSpent: number; totalIncome: number; count: number }>();

    for (const tx of transactions) {
      const d = tx.transactionDate;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key) ?? { totalSpent: 0, totalIncome: 0, count: 0 };

      const amount = Number(tx.amount);
      if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.FEE) {
        entry.totalSpent += amount;
      } else if (tx.type === TransactionType.INCOME || tx.type === TransactionType.CASHBACK || tx.type === TransactionType.REFUND) {
        entry.totalIncome += amount;
      }
      entry.count++;
      monthlyMap.set(key, entry);
    }

    const result = Array.from(monthlyMap.entries())
      .map(([key, val]) => {
        const [year, month] = key.split("-").map(Number);
        return {
          month,
          year,
          totalSpent: Math.round(val.totalSpent * 100) / 100,
          totalIncome: Math.round(val.totalIncome * 100) / 100,
          savings: Math.round((val.totalIncome - val.totalSpent) * 100) / 100,
          transactionCount: val.count,
        };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/analytics/monthly error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
