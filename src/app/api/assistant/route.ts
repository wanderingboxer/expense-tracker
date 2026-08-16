import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai-provider";
import { TransactionType } from "@/generated/prisma/enums";
import { z } from "zod";

const querySchema = z.object({
  query: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json();
    const { query } = querySchema.parse(body);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [recentTx, categoryGroups, budgets] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, isExcluded: false },
        include: { merchant: true, category: true },
        orderBy: { transactionDate: "desc" },
        take: 30,
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId, isExcluded: false, type: TransactionType.EXPENSE, transactionDate: { gte: monthStart }, categoryId: { not: null } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),
      prisma.budget.findMany({
        where: { userId, isActive: true },
        take: 1,
      }),
    ]);

    const catIds = categoryGroups.map((g) => g.categoryId).filter(Boolean) as string[];
    const cats = await prisma.category.findMany({ where: { id: { in: catIds } } });
    const catMap = new Map(cats.map((c) => [c.id, c.name]));

    const ai = getAIProvider();
    const answer = await ai.answerFinancialQuery(query, {
      recentTransactions: recentTx.map((tx) => ({
        amount: Number(tx.amount),
        merchant: tx.merchant?.name ?? "Unknown",
        category: tx.category?.name ?? "Uncategorized",
        date: tx.transactionDate.toISOString().split("T")[0],
      })),
      monthlyBudget: budgets.length > 0 ? Number(budgets[0].amount) : undefined,
      topCategories: categoryGroups.map((g) => ({
        name: catMap.get(g.categoryId!) ?? "Unknown",
        total: Number(g._sum.amount ?? 0),
      })),
    });

    return NextResponse.json({ answer });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    console.error("POST /api/assistant error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
