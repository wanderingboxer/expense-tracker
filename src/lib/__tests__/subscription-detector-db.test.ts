import { prisma } from "@/lib/prisma";
import { createTestUser, cleanupTestUser } from "./helpers/db";
import { detectSubscriptions } from "@/lib/subscription-detector";
import { ReviewType, Frequency } from "@/generated/prisma/enums";

describe("detectSubscriptions (real database)", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser("sub-detect");
    userId = user.id;
  });

  afterEach(async () => {
    await cleanupTestUser(userId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a Subscription and a POSSIBLE_SUBSCRIPTION review item on first detection", async () => {
    const merchant = await prisma.merchant.create({
      data: { userId, name: "Netflix", normalizedName: "netflix" },
    });

    await prisma.transaction.create({
      data: {
        userId,
        merchantId: merchant.id,
        amount: 649,
        transactionDate: new Date("2026-06-15"),
        type: "EXPENSE",
      },
    });
    await prisma.transaction.create({
      data: {
        userId,
        merchantId: merchant.id,
        amount: 649,
        transactionDate: new Date("2026-07-15"),
        type: "EXPENSE",
      },
    });

    const results = await detectSubscriptions(userId);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      merchantId: merchant.id,
      created: true,
      frequency: Frequency.MONTHLY,
    });

    const subscription = await prisma.subscription.findFirst({ where: { userId, merchantId: merchant.id } });
    expect(subscription).not.toBeNull();
    expect(subscription?.isActive).toBe(true);

    const reviewItems = await prisma.reviewItem.findMany({
      where: { userId, type: ReviewType.POSSIBLE_SUBSCRIPTION },
    });
    expect(reviewItems).toHaveLength(1);
  });

  it("updates the existing Subscription on a later sync without creating a duplicate review item", async () => {
    const merchant = await prisma.merchant.create({
      data: { userId, name: "Spotify", normalizedName: "spotify" },
    });
    await prisma.transaction.create({
      data: { userId, merchantId: merchant.id, amount: 119, transactionDate: new Date("2026-05-01"), type: "EXPENSE" },
    });
    await prisma.transaction.create({
      data: { userId, merchantId: merchant.id, amount: 119, transactionDate: new Date("2026-06-01"), type: "EXPENSE" },
    });

    await detectSubscriptions(userId); // first detection

    // A new charge arrives on a later sync.
    await prisma.transaction.create({
      data: { userId, merchantId: merchant.id, amount: 119, transactionDate: new Date("2026-07-01"), type: "EXPENSE" },
    });

    const results = await detectSubscriptions(userId);
    expect(results[0].created).toBe(false);

    const subscriptions = await prisma.subscription.findMany({ where: { userId, merchantId: merchant.id } });
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].lastChargeDate?.toISOString().slice(0, 10)).toBe("2026-07-01");

    const reviewItems = await prisma.reviewItem.findMany({
      where: { userId, type: ReviewType.POSSIBLE_SUBSCRIPTION },
    });
    expect(reviewItems).toHaveLength(1); // still just the one from first detection
  });

  it("does not flag a merchant with irregular one-off purchases", async () => {
    const merchant = await prisma.merchant.create({
      data: { userId, name: "Amazon", normalizedName: "amazon" },
    });
    await prisma.transaction.create({
      data: { userId, merchantId: merchant.id, amount: 899, transactionDate: new Date("2026-06-02"), type: "EXPENSE" },
    });
    await prisma.transaction.create({
      data: { userId, merchantId: merchant.id, amount: 2400, transactionDate: new Date("2026-06-20"), type: "EXPENSE" },
    });

    const results = await detectSubscriptions(userId);
    expect(results).toHaveLength(0);

    const subscriptions = await prisma.subscription.findMany({ where: { userId, merchantId: merchant.id } });
    expect(subscriptions).toHaveLength(0);
  });

  it("ignores excluded transactions and non-EXPENSE types", async () => {
    const merchant = await prisma.merchant.create({
      data: { userId, name: "Gym", normalizedName: "gym" },
    });
    await prisma.transaction.create({
      data: {
        userId,
        merchantId: merchant.id,
        amount: 1500,
        transactionDate: new Date("2026-06-01"),
        type: "EXPENSE",
        isExcluded: true,
      },
    });
    await prisma.transaction.create({
      data: {
        userId,
        merchantId: merchant.id,
        amount: 1500,
        transactionDate: new Date("2026-07-01"),
        type: "INCOME",
      },
    });

    const results = await detectSubscriptions(userId);
    expect(results).toHaveLength(0);
  });
});
