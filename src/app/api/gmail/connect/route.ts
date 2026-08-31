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
      const authUrl = buildGmailAuthUrl();
      return NextResponse.json(
        { error: "Gmail authorization required", url: authUrl },
        { status: 400 }
      );
    }

    // Test if the token has Gmail scope by trying a simple Gmail API call
    const testRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${account.access_token}` } }
    );

    if (testRes.status === 403 || testRes.status === 401) {
      const authUrl = buildGmailAuthUrl();
      return NextResponse.json(
        { error: "Gmail scope not granted, re-authorization required", url: authUrl },
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

function buildGmailAuthUrl() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/gmail/callback`,
    response_type: "code",
    scope: "openid profile email https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
    state: "gmail_connect",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
