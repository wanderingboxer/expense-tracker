import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Frequency } from "@/generated/prisma/enums";

const createSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("INR"),
  frequency: z.nativeEnum(Frequency),
  merchantId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  nextExpectedDate: z.string().transform((s) => new Date(s)).optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { userId: session.user.id, isActive: true },
      include: { merchant: true, category: true },
      orderBy: { nextExpectedDate: "asc" },
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error("GET /api/subscriptions error:", error);
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

    const subscription = await prisma.subscription.create({
      data: { ...data, userId: session.user.id },
      include: { merchant: true, category: true },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    console.error("POST /api/subscriptions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
