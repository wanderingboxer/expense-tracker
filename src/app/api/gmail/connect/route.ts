import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const account = await prisma.account.findFirst({
      where: { userId, provider: "google" },
    });

    if (!account?.access_token || !account?.refresh_token) {
      return NextResponse.json(
        { error: "Google account not linked or missing tokens" },
        { status: 400 }
      );
    }

    await prisma.gmailConnection.upsert({
      where: { userId },
      create: {
        userId,
        email: session.user.email,
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
      },
      update: {
        email: session.user.email,
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/gmail/connect error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
