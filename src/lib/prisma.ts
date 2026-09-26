import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Picks the first candidate that is actually a non-empty string, not just
// non-undefined — an unused Postgres integration's env vars can be present
// but set to "", which `??` alone would not skip.
function firstNonEmpty(...candidates: (string | undefined)[]): string {
  const found = candidates.find((c) => typeof c === "string" && c.length > 0);
  if (!found) throw new Error("No database connection string found in environment");
  return found;
}

function createPrismaClient() {
  const connectionString = firstNonEmpty(
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_PRISMA_DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL_NON_POOLING
  );
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
