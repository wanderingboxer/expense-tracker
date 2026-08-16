import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ReviewStatus } from "@/generated/prisma/enums";

const resolveSchema = z.object({
  reviewItemId: z.string().uuid(),
  action: z.enum(["accept_merge", "keep_separate", "accept_category", "choose_category", "dismiss"]),
  categoryId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.reviewItem.findMany({
      where: { userId: session.user.id, status: ReviewStatus.PENDING },
      include: {
        transaction: { include: { merchant: true, category: true } },
        relatedTransaction: { include: { merchant: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/review error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json();
    const { reviewItemId, action, categoryId } = resolveSchema.parse(body);

    const item = await prisma.reviewItem.findFirst({
      where: { id: reviewItemId, userId },
      include: { transaction: true },
    });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    switch (action) {
      case "accept_merge": {
        if (item.transactionId && item.relatedTransactionId) {
          await prisma.transaction.update({
            where: { id: item.relatedTransactionId },
            data: { isExcluded: true, linkedTransactionId: item.transactionId },
          });
        }
        break;
      }
      case "keep_separate":
        // No data changes needed
        break;
      case "accept_category": {
        const suggested = item.suggestedAction as Record<string, unknown> | null;
        if (item.transactionId && suggested?.categoryId) {
          await prisma.transaction.update({
            where: { id: item.transactionId },
            data: { categoryId: suggested.categoryId as string, isReviewed: true },
          });
        }
        break;
      }
      case "choose_category": {
        if (item.transactionId && categoryId) {
          await prisma.transaction.update({
            where: { id: item.transactionId },
            data: { categoryId, isReviewed: true },
          });
        }
        break;
      }
      case "dismiss":
        break;
    }

    const updated = await prisma.reviewItem.update({
      where: { id: reviewItemId },
      data: {
        status: action === "dismiss" ? ReviewStatus.DISMISSED : ReviewStatus.RESOLVED,
        resolvedAt: new Date(),
        userAction: { action, categoryId },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
    console.error("POST /api/review error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
