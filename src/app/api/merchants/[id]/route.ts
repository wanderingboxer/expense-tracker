import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const renameSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

type Params = { params: Promise<{ id: string }> };

/** Rename a merchant's display name. Deliberately does NOT touch
 * `normalizedName` (used for incoming-email matching in
 * merchant-normalizer.ts) — renaming "Vipin Kumar" to "Uber" shouldn't
 * change what raw text future emails need to match to land on this
 * merchant. Use POST /api/merchants/merge-and-alias to actually reroute a
 * different raw merchant string onto an existing merchant. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const existing = await prisma.merchant.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name } = renameSchema.parse(body);

    const merchant = await prisma.merchant.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json(merchant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("PATCH /api/merchants/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
