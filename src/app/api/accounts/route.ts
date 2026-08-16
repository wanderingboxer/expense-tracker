import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { AccountType } from "@/generated/prisma/enums";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(AccountType),
  institutionName: z.string().optional(),
  last4: z.string().max(4).optional(),
  isOwn: z.boolean().default(true),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await prisma.financialAccount.findMany({
      where: { userId: session.user.id, isArchived: false },
      include: {
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute totals per account
    const result = await Promise.all(
      accounts.map(async (acc) => {
        const agg = await prisma.transaction.aggregate({
          where: { financialAccountId: acc.id, isExcluded: false },
          _sum: { amount: true },
        });
        return {
          ...acc,
          transactionTotal: Number(agg._sum.amount ?? 0),
        };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/accounts error:", error);
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

    const account = await prisma.financialAccount.create({
      data: { ...data, userId: session.user.id },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    console.error("POST /api/accounts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
