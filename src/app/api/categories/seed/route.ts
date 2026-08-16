import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { seedDefaultCategories } from "@/lib/categorizer";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await seedDefaultCategories(session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/categories/seed error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
