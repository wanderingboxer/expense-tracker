import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { RuleSource } from "@/generated/prisma/enums";
import { normalizeMerchantName } from "@/lib/merchant-normalizer";

const mergeSchema = z
  .object({
    sourceMerchantId: z.string().uuid(),
    targetMerchantId: z.string().uuid().optional(),
    newMerchantName: z.string().trim().min(1).max(200).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    applyToAllPastTransactions: z.boolean().default(true),
  })
  .refine(
    (data) => Boolean(data.targetMerchantId) !== Boolean(data.newMerchantName),
    {
      message: "Provide exactly one of targetMerchantId or newMerchantName",
    }
  );

/**
 * Corrects a raw, unhelpful merchant name (e.g. a UPI payee's personal name
 * like "Vipin Kumar") by aliasing it onto an existing or newly created
 * merchant (e.g. "Uber"), reassigning every transaction that currently
 * points at the source merchant, and re-pointing any learned category rules
 * so they don't silently orphan. Runs as one atomic transaction so a
 * concurrent read never sees a partial reassignment.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json();
    const data = mergeSchema.parse(body);

    if (data.targetMerchantId === data.sourceMerchantId) {
      return NextResponse.json(
        { error: "sourceMerchantId and targetMerchantId must differ" },
        { status: 400 }
      );
    }

    const sourceMerchant = await prisma.merchant.findFirst({
      where: { id: data.sourceMerchantId, userId },
    });
    if (!sourceMerchant) {
      return NextResponse.json({ error: "Source merchant not found" }, { status: 404 });
    }

    if (data.targetMerchantId) {
      const targetExists = await prisma.merchant.findFirst({
        where: { id: data.targetMerchantId, userId },
      });
      if (!targetExists) {
        return NextResponse.json({ error: "Target merchant not found" }, { status: 404 });
      }
    }

    if (data.categoryId) {
      const categoryExists = await prisma.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!categoryExists) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const targetMerchant = data.targetMerchantId
        ? await tx.merchant.findUniqueOrThrow({ where: { id: data.targetMerchantId } })
        : await tx.merchant.create({
            data: {
              userId,
              name: data.newMerchantName!,
              normalizedName: normalizeMerchantName(data.newMerchantName!).toLowerCase(),
            },
          });

      let reassignedCount = 0;
      if (data.applyToAllPastTransactions) {
        const updateResult = await tx.transaction.updateMany({
          where: { userId, merchantId: sourceMerchant.id },
          data: {
            merchantId: targetMerchant.id,
            ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
          },
        });
        reassignedCount = updateResult.count;
      }

      // Re-point learned/user category rules so they don't orphan on the
      // now-unused source merchant.
      await tx.categoryRule.updateMany({
        where: { userId, merchantId: sourceMerchant.id },
        data: { merchantId: targetMerchant.id },
      });

      // Alias the source merchant's raw name onto the target, so future
      // synced emails with the same raw merchant text route directly to
      // the target merchant (findOrCreateMerchant checks aliases first).
      await tx.merchantAlias.create({
        data: {
          merchantId: targetMerchant.id,
          alias: sourceMerchant.name,
          normalizedAlias: sourceMerchant.normalizedName,
          source: RuleSource.USER,
        },
      });

      // The source merchant now has no transactions pointing at it (if
      // applyToAllPastTransactions was true) — remove it so it doesn't
      // dangle as an orphaned duplicate. Its own aliases cascade-delete.
      if (data.applyToAllPastTransactions) {
        await tx.merchant.delete({ where: { id: sourceMerchant.id } });
      }

      return { targetMerchant, reassignedCount };
    });

    return NextResponse.json({
      success: true,
      targetMerchant: result.targetMerchant,
      reassignedTransactionCount: result.reassignedCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("POST /api/merchants/merge-and-alias error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
