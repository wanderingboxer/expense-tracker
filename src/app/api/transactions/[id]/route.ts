import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { TransactionType, PaymentMethod } from "@/generated/prisma/enums";

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  merchantId: z.string().uuid().nullable().optional(),
  transactionDate: z.string().transform((s) => new Date(s)).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  financialAccountId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  personalBusiness: z.enum(["PERSONAL", "BUSINESS", "REIMBURSABLE", "SHARED"]).optional(),
  isReviewed: z.boolean().optional(),
}).partial();

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: session.user.id },
      include: {
        merchant: true,
        category: true,
        evidence: { include: { financialEmail: true } },
        linkedTransaction: true,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(transaction);
  } catch (error) {
    console.error("GET /api/transactions/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = updateSchema.parse(body);

    const transaction = await prisma.transaction.update({
      where: { id },
      data,
      include: { merchant: true, category: true },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("PATCH /api/transactions/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.transaction.update({
      where: { id },
      data: { isExcluded: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/transactions/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
