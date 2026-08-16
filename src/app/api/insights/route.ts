import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai-provider";
import { TransactionType } from "@/generated/prisma/enums";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const insights = await prisma.insight.findMany({
      where: { userId: session.user.id, isRead: false, isDismissed: false },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(insights);
  } catch (error) {
    console.error("GET /api/insights error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [spentAgg, incomeAgg, txCount, categoryGroups] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, isExcluded: false, type: TransactionType.EXPENSE, transactionDate: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, isExcluded: false, type: TransactionType.INCOME, transactionDate: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: { userId, isExcluded: false, transactionDate: { gte: monthStart, lte: monthEnd } },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId, isExcluded: false, type: TransactionType.EXPENSE, transactionDate: { gte: monthStart, lte: monthEnd }, categoryId: { not: null } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
    ]);

    const catIds = categoryGroups.map((g) => g.categoryId).filter(Boolean) as string[];
    const cats = await prisma.category.findMany({ where: { id: { in: catIds } } });
    const catMap = new Map(cats.map((c) => [c.id, c.name]));

    const topCategories = categoryGroups.map((g) => ({
      name: catMap.get(g.categoryId!) ?? "Unknown",
      amount: Number(g._sum.amount ?? 0),
    }));

    const ai = getAIProvider();
    const insightsData = await ai.generateInsights({
      totalIncome: Number(incomeAgg._sum.amount ?? 0),
      totalExpenses: Number(spentAgg._sum.amount ?? 0),
      topCategories,
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      transactionCount: txCount,
    });

    const created = await Promise.all(
      insightsData.map((ins) =>
        prisma.insight.create({
          data: {
            userId,
            type: ins.type,
            title: ins.title,
            description: ins.description,
            priority: ins.priority,
          },
        })
      )
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/insights error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
