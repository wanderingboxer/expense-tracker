import { prisma } from "@/lib/prisma";
import { createTestUser, cleanupTestUser } from "./helpers/db";
import { categorizeTransaction, learnFromUserChoice } from "@/lib/categorizer";
import { findOrCreateMerchant } from "@/lib/merchant-normalizer";

describe("categorizeTransaction — learned rule matching with raw (unnormalized) names", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser("categorizer-learn");
    userId = user.id;
  });

  afterEach(async () => {
    await cleanupTestUser(userId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("applies a learned rule on a later transaction whose raw merchant string still has a transaction prefix stripped by normalization", async () => {
    const category = await prisma.category.create({
      data: { userId, name: "Food & Dining" },
    });

    // First transaction: merchant created via findOrCreateMerchant (as
    // ingestion.ts does), from a raw string with a transaction prefix.
    const merchant = await findOrCreateMerchant(userId, "POS-Swiggy");
    await learnFromUserChoice(userId, merchant.id, category.id);

    // A later email's raw merchant string differs (no "POS-" prefix, or a
    // different prefix) but normalizes to the same merchant.
    const result = await categorizeTransaction(
      userId,
      "UPI-Swiggy",
      "order",
      "EXPENSE",
      250
    );

    expect(result.categoryId).toBe(category.id);
    expect(result.source).toBe("learned_rule");
  });

  it("applies a USER-source rule the same way", async () => {
    const category = await prisma.category.create({
      data: { userId, name: "Transportation" },
    });
    const merchant = await findOrCreateMerchant(userId, "Uber Technologies Pvt Ltd");
    await prisma.categoryRule.create({
      data: {
        userId,
        merchantId: merchant.id,
        categoryId: category.id,
        source: "USER",
      },
    });

    const result = await categorizeTransaction(
      userId,
      "Uber Technologies",
      "ride",
      "EXPENSE",
      150
    );

    expect(result.categoryId).toBe(category.id);
    expect(result.source).toBe("user_rule");
  });
});
