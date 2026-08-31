import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(new URL("/onboarding?error=no_code", request.url));
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/gmail/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      console.error("Token exchange failed:", tokens);
      return NextResponse.redirect(new URL("/onboarding?error=token_exchange", request.url));
    }

    const userId = session.user.id;

    // Update the Google account with new tokens that include Gmail scope
    await prisma.account.updateMany({
      where: { userId, provider: "google" },
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? undefined,
        expires_at: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : undefined,
        scope: tokens.scope,
      },
    });

    // Create Gmail connection
    await prisma.gmailConnection.upsert({
      where: { userId },
      create: {
        userId,
        email: session.user.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
      },
      update: {
        email: session.user.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
      },
    });

    return NextResponse.redirect(new URL("/onboarding?gmail=connected", request.url));
  } catch (error) {
    console.error("Gmail callback error:", error);
    return NextResponse.redirect(new URL("/onboarding?error=callback_failed", request.url));
  }
}
