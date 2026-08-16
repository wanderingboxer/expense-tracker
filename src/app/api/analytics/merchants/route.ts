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
    const limit = Math.min(50, Math.max(1, parseInt(params.get("limit") ?? "10")));

    const now = new Date();
    const dateFrom = params.get("dateFrom")
      ? new Date(params.get("dateFrom")!)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const dateTo = params.get("dateTo")
      ? new Date(params.get("dateTo")!)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const groups = await prisma.transaction.groupBy({
      by: ["merchantId"],
      where: {
        userId,
        isExcluded: false,
        type: TransactionType.EXPENSE,
        transactionDate: { gte: dateFrom, lte: dateTo },
        merchantId: { not: null },
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
      take: limit,
    });

    const merchantIds = groups.map((g) => g.merchantId).filter(Boolean) as string[];
    const merchants = await prisma.merchant.findMany({
      where: { id: { in: merchantIds } },
    });
    const mMap = new Map(merchants.map((m) => [m.id, m]));

    const result = groups.map((g) => {
      const total = Number(g._sum.amount ?? 0);
      const m = mMap.get(g.merchantId!);
      return {
        merchantId: g.merchantId,
        merchantName: m?.name ?? "Unknown",
        total,
        transactionCount: g._count,
        avgTransaction: Math.round((total / g._count) * 100) / 100,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/analytics/merchants error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
