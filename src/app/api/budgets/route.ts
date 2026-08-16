import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { BudgetPeriod, TransactionType } from "@/generated/prisma/enums";

const createSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  period: z.nativeEnum(BudgetPeriod),
  categoryId: z.string().uuid().optional(),
  startDate: z.string().transform((s) => new Date(s)),
});

function getPeriodRange(period: string, startDate: Date): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  switch (period) {
    case "WEEKLY": {
      const day = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - day);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59);
      return { from: weekStart, to: weekEnd };
    }
    case "QUARTERLY": {
      const q = Math.floor(now.getMonth() / 3);
      return {
        from: new Date(now.getFullYear(), q * 3, 1),
        to: new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59),
      };
    }
    case "YEARLY":
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: new Date(now.getFullYear(), 11, 31, 23, 59, 59),
      };
    default:
      return { from, to };
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const budgets = await prisma.budget.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    const result = await Promise.all(
      budgets.map(async (b) => {
        const { from, to } = getPeriodRange(b.period, b.startDate);
        const where: Record<string, unknown> = {
          userId,
          isExcluded: false,
          type: TransactionType.EXPENSE,
          transactionDate: { gte: from, lte: to },
        };
        if (b.categoryId) where.categoryId = b.categoryId;

        const agg = await prisma.transaction.aggregate({
          where,
          _sum: { amount: true },
        });

        const spent = Number(agg._sum.amount ?? 0);
        return {
          ...b,
          amount: Number(b.amount),
          spent,
          remaining: Number(b.amount) - spent,
          percentUsed: Math.round((spent / Number(b.amount)) * 10000) / 100,
          periodFrom: from,
          periodTo: to,
        };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/budgets error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createSchema.parse(body);

    const budget = await prisma.budget.create({
      data: { ...data, userId: session.user.id },
      include: { category: true },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("POST /api/budgets error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
