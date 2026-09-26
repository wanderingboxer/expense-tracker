import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { timingSafeEqual } from "crypto";

/**
 * TEMPORARY, ONE-TIME-USE endpoint. Marks the baseline Prisma migration as
 * already applied against a production database whose schema was created
 * by the old raw-SQL /api/setup endpoint (removed) rather than by Prisma
 * Migrate — so `prisma migrate deploy` doesn't try to re-run
 * CREATE TABLE statements for tables that already exist.
 *
 * Delete this route (and this file) immediately after using it once.
 * Gated by NEXTAUTH_SECRET, timing-safe compared, same secret you'd use to
 * access the app's own auth — not a new credential.
 */

const MIGRATION_NAME = "20260926093545_init";
// Precomputed by applying this exact migration.sql to a fresh empty
// database and reading back the checksum Prisma Migrate recorded —
// guaranteed to match what `prisma migrate deploy` expects to see.
const MIGRATION_CHECKSUM =
  "26fb641b8ebac3858781748088416881af06c19885b2ba02e2c8d5581cbb72c0";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function handle(secret: string | null) {
  if (!process.env.NEXTAUTH_SECRET || !secret || !safeEqual(secret, process.env.NEXTAUTH_SECRET)) {
    return NextResponse.json(
      { error: "Unauthorized. Pass ?secret=<your NEXTAUTH_SECRET value>" },
      { status: 401 }
    );
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY NOT NULL,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );
    `);

    const existing: { count: bigint }[] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::bigint AS count FROM "_prisma_migrations" WHERE migration_name = $1`,
      MIGRATION_NAME
    );

    if (existing[0]?.count && Number(existing[0].count) > 0) {
      return NextResponse.json({
        success: true,
        message: "Already resolved — nothing to do.",
      });
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations"
         (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
       VALUES ($1, $2, $3, now(), now(), 1)`,
      randomUUID(),
      MIGRATION_CHECKSUM,
      MIGRATION_NAME
    );

    return NextResponse.json({
      success: true,
      message: `Marked ${MIGRATION_NAME} as applied. prisma migrate deploy will now no-op on it. Delete this endpoint now.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request.nextUrl.searchParams.get("secret"));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return handle(body.secret ?? request.nextUrl.searchParams.get("secret"));
}
