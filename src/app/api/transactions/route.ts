import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { TransactionType, PaymentMethod } from "@/generated/prisma/enums";

const createSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default("INR"),
  type: z.nativeEnum(TransactionType).default(TransactionType.EXPENSE),
  categoryId: z.string().uuid().optional(),
  merchantId: z.string().uuid().optional(),
  transactionDate: z.string().transform((s) => new Date(s)),
  transactionTime: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.UNKNOWN),
  financialAccountId: z.string().uuid().optional(),
  notes: z.string().optional(),
  personalBusiness: z.enum(["PERSONAL", "BUSINESS", "REIMBURSABLE", "SHARED"]).default("PERSONAL"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const params = req.nextUrl.searchParams;

    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(params.get("pageSize") ?? "20")));
    const sort = params.get("sort") ?? "transactionDate";
    const order = params.get("order") === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = { userId, isExcluded: false };

    if (params.get("category")) where.categoryId = params.get("category");
    if (params.get("type")) where.type = params.get("type");
    if (params.get("paymentMethod")) where.paymentMethod = params.get("paymentMethod");
    if (params.get("merchantId")) where.merchantId = params.get("merchantId");

    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    if (dateFrom || dateTo) {
      where.transactionDate = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const minAmount = params.get("minAmount");
    const maxAmount = params.get("maxAmount");
    if (minAmount || maxAmount) {
      where.amount = {
        ...(minAmount ? { gte: parseFloat(minAmount) } : {}),
        ...(maxAmount ? { lte: parseFloat(maxAmount) } : {}),
      };
    }

    const search = params.get("search");
    if (search) {
      where.OR = [
        { notes: { contains: search, mode: "insensitive" } },
        { merchant: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { merchant: true, category: true },
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({ transactions, total, page, pageSize });
  } catch (error) {
    console.error("GET /api/transactions error:", error);
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

    const transaction = await prisma.transaction.create({
      data: {
        ...data,
        userId: session.user.id,
        isManual: true,
      },
      include: { merchant: true, category: true },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("POST /api/transactions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
