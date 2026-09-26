/** Picks the first candidate that is actually a non-empty string, not just
 * non-undefined. A project can have multiple Postgres integrations
 * attached (e.g. an unused add-on alongside the real database), and an
 * unused one's env vars are often present but set to "" rather than
 * genuinely unset — plain `??` chaining doesn't skip those. */
export function firstNonEmptyEnvVar(...candidates: (string | undefined)[]): string | undefined {
  return candidates.find((c) => typeof c === "string" && c.length > 0);
}

/** The same connection-string precedence used both by the app's runtime
 * Prisma client (src/lib/prisma.ts) and by prisma.config.ts for Prisma
 * Migrate — kept in one place so the two can't silently drift apart. */
export function resolveDatabaseUrl(): string | undefined {
  return firstNonEmptyEnvVar(
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_PRISMA_DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL_NON_POOLING
  );
}
