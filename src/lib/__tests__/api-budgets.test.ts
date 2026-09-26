import { prisma } from "@/lib/prisma";
import { createTestUser, cleanupTestUser } from "./helpers/db";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/lib/auth";
import { GET as getBudgets } from "@/app/api/budgets/route";

describe("GET /api/budgets — period range regression", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser("budget-period");
    userId = user.id;
    (auth as jest.Mock).mockResolvedValue({ user: { id: userId } });
  });

  afterEach(async () => {
    await cleanupTestUser(userId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("counts spend only within the startDate-anchored monthly window, not the calendar month", async () => {
    // Fixed "now" via a transaction date close to the real clock isn't
    // possible for the route itself (it uses `new Date()` internally), so
    // this test uses dates relative to the actual current time, anchored on
    // "today minus a few days" as the budget start — guaranteed to still be
    // within the current cycle regardless of when this test runs.
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 3); // cycle started 3 days ago

    const budget = await prisma.budget.create({
      data: {
        userId,
        name: "Test Monthly",
        amount: 10000,
        period: "MONTHLY",
        startDate,
      },
    });

    // In-cycle transaction (today, 3 days after start).
    await prisma.transaction.create({
      data: {
        userId,
        amount: 500,
        transactionDate: now,
        type: "EXPENSE",
      },
    });

    // Out-of-cycle transaction: before this cycle started (would have been
    // wrongly included by the old calendar-month bug if the previous
    // calendar month bled into "now"'s month, or wrongly excluded/included
    // depending on where in the month "now" falls — the anchored version
    // must exclude it since it's before startDate).
    const beforeCycle = new Date(startDate);
    beforeCycle.setDate(beforeCycle.getDate() - 1);
    await prisma.transaction.create({
      data: {
        userId,
        amount: 9000,
        transactionDate: beforeCycle,
        type: "EXPENSE",
      },
    });

    const res = await getBudgets();
    expect(res.status).toBe(200);
    const json = await res.json();
    const result = json.find((b: { id: string }) => b.id === budget.id);

    expect(result.spent).toBe(500);
    expect(new Date(result.periodFrom).getTime()).toBe(startDate.getTime());
  });
});
