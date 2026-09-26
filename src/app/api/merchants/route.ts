import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** List/search the user's merchants — used by the "reassign to an existing
 * merchant" picker on the transaction detail page. */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim();

    const merchants = await prisma.merchant.findMany({
      where: {
        userId: session.user.id,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
      take: 50,
    });

    return NextResponse.json(merchants);
  } catch (error) {
    console.error("GET /api/merchants error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
