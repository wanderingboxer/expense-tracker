import { prisma } from "@/lib/prisma";

/** Creates a throwaway user for a test, with a cleanup function that removes
 * everything cascaded from it. Tests run against a real local Postgres
 * database (see .env.test / jest.setup.ts) rather than mocks, so route
 * handlers and Prisma queries are exercised for real. */
export async function createTestUser(emailPrefix: string) {
  const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const user = await prisma.user.create({
    data: { email, name: "Test User" },
  });
  return user;
}

export async function cleanupTestUser(userId: string) {
  // Deleting the user cascades to everything FK'd with onDelete: Cascade
  // (transactions, merchants, categories, budgets, etc. per schema.prisma).
  await prisma.user.delete({ where: { id: userId } }).catch(() => {
    // Already deleted by an earlier cleanup step in the same test — fine.
  });
}
