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
    const params = req.nextUrl.searchParams;

    const now = new Date();
    const dateFrom = params.get("dateFrom")
      ? new Date(params.get("dateFrom")!)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const dateTo = params.get("dateTo")
      ? new Date(params.get("dateTo")!)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const baseWhere = {
      userId,
      isExcluded: false,
      transactionDate: { gte: dateFrom, lte: dateTo },
    };

    const [spentAgg, incomeAgg, transactionCount, topCategoryData, topMerchantData] =
      await Promise.all([
        prisma.transaction.aggregate({
          where: { ...baseWhere, type: { in: [TransactionType.EXPENSE, TransactionType.FEE] } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { ...baseWhere, type: { in: [TransactionType.INCOME, TransactionType.CASHBACK, TransactionType.REFUND] } },
          _sum: { amount: true },
        }),
        prisma.transaction.count({ where: baseWhere }),
        prisma.transaction.groupBy({
          by: ["categoryId"],
          where: { ...baseWhere, type: TransactionType.EXPENSE, categoryId: { not: null } },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
          take: 1,
        }),
        prisma.transaction.groupBy({
          by: ["merchantId"],
          where: { ...baseWhere, type: TransactionType.EXPENSE, merchantId: { not: null } },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
          take: 1,
        }),
      ]);

    const totalSpent = Number(spentAgg._sum.amount ?? 0);
    const totalIncome = Number(incomeAgg._sum.amount ?? 0);
    const netCashFlow = totalIncome - totalSpent;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome) * 100 : 0;

    // Previous period comparison
    const periodMs = dateTo.getTime() - dateFrom.getTime();
    const prevFrom = new Date(dateFrom.getTime() - periodMs);
    const prevTo = new Date(dateFrom.getTime() - 1);

    const prevSpent = await prisma.transaction.aggregate({
      where: {
        userId,
        isExcluded: false,
        transactionDate: { gte: prevFrom, lte: prevTo },
        type: { in: [TransactionType.EXPENSE, TransactionType.FEE] },
      },
      _sum: { amount: true },
    });
    const prevTotal = Number(prevSpent._sum.amount ?? 0);
    const spendingChange = prevTotal > 0 ? ((totalSpent - prevTotal) / prevTotal) * 100 : 0;

    // Resolve top category/merchant names
    let topCategory = null;
    if (topCategoryData.length > 0 && topCategoryData[0].categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: topCategoryData[0].categoryId } });
      topCategory = { id: cat?.id, name: cat?.name, total: Number(topCategoryData[0]._sum.amount) };
    }

    let topMerchant = null;
    if (topMerchantData.length > 0 && topMerchantData[0].merchantId) {
      const m = await prisma.merchant.findUnique({ where: { id: topMerchantData[0].merchantId } });
      topMerchant = { id: m?.id, name: m?.name, total: Number(topMerchantData[0]._sum.amount) };
    }

    return NextResponse.json({
      totalSpent,
      totalIncome,
      netCashFlow,
      savingsRate: Math.round(savingsRate * 100) / 100,
      transactionCount,
      topCategory,
      topMerchant,
      previousPeriod: { totalSpent: prevTotal, spendingChange: Math.round(spendingChange * 100) / 100 },
    });
  } catch (error) {
    console.error("GET /api/analytics/overview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
