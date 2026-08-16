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

    const groups = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        isExcluded: false,
        type: TransactionType.EXPENSE,
        transactionDate: { gte: dateFrom, lte: dateTo },
        categoryId: { not: null },
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    });

    const grandTotal = groups.reduce((s, g) => s + Number(g._sum.amount ?? 0), 0);

    const categoryIds = groups.map((g) => g.categoryId).filter(Boolean) as string[];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const result = groups.map((g) => {
      const total = Number(g._sum.amount ?? 0);
      const cat = catMap.get(g.categoryId!);
      return {
        categoryId: g.categoryId,
        categoryName: cat?.name ?? "Unknown",
        icon: cat?.icon,
        color: cat?.color,
        total,
        percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 10000) / 100 : 0,
        transactionCount: g._count,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/analytics/categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
