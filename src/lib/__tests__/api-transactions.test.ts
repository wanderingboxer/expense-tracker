/**
 * Integration test against a real local Postgres database (see
 * jest.setup.ts / .env.test) — verifies PATCH /api/transactions/[id]
 * actually calls learnFromUserChoice when a category correction is saved,
 * by checking the resulting CategoryRule row, not by mocking the learning
 * function itself.
 */
import { prisma } from "@/lib/prisma";
import { createTestUser, cleanupTestUser } from "./helpers/db";
import { RuleSource } from "@/generated/prisma/enums";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/lib/auth";
import { PATCH } from "@/app/api/transactions/[id]/route";
import { NextRequest } from "next/server";

describe("PATCH /api/transactions/[id] — category learning", () => {
  let userId: string;
  let merchantId: string;
  let categoryAId: string;
  let categoryBId: string;
  let transactionId: string;

  beforeEach(async () => {
    const user = await createTestUser("txn-learn");
    userId = user.id;

    (auth as jest.Mock).mockResolvedValue({ user: { id: userId } });

    const merchant = await prisma.merchant.create({
      data: { userId, name: "Vipin Kumar", normalizedName: "vipin kumar" },
    });
    merchantId = merchant.id;

    const categoryA = await prisma.category.create({
      data: { userId, name: "Other" },
    });
    categoryAId = categoryA.id;

    const categoryB = await prisma.category.create({
      data: { userId, name: "Food & Dining" },
    });
    categoryBId = categoryB.id;

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount: 60,
        merchantId,
        categoryId: categoryAId,
        transactionDate: new Date(),
        type: "EXPENSE",
      },
    });
    transactionId = transaction.id;
  });

  afterEach(async () => {
    await cleanupTestUser(userId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a LEARNED CategoryRule when a category correction is saved", async () => {
    const req = new NextRequest(
      `http://localhost/api/transactions/${transactionId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ categoryId: categoryBId }),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: transactionId }) });
    expect(res.status).toBe(200);

    const rule = await prisma.categoryRule.findFirst({
      where: { userId, merchantId, source: RuleSource.LEARNED },
    });

    expect(rule).not.toBeNull();
    expect(rule?.categoryId).toBe(categoryBId);
  });

  it("does not create a rule when the category is unchanged", async () => {
    const req = new NextRequest(
      `http://localhost/api/transactions/${transactionId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ categoryId: categoryAId }),
      }
    );

    await PATCH(req, { params: Promise.resolve({ id: transactionId }) });

    const rule = await prisma.categoryRule.findFirst({
      where: { userId, merchantId, source: RuleSource.LEARNED },
    });
    expect(rule).toBeNull();
  });

  it("does not create a rule when the transaction has no merchant", async () => {
    const noMerchantTxn = await prisma.transaction.create({
      data: {
        userId,
        amount: 20,
        categoryId: categoryAId,
        transactionDate: new Date(),
        type: "EXPENSE",
      },
    });

    const req = new NextRequest(
      `http://localhost/api/transactions/${noMerchantTxn.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ categoryId: categoryBId }),
      }
    );

    await PATCH(req, { params: Promise.resolve({ id: noMerchantTxn.id }) });

    const rule = await prisma.categoryRule.findFirst({
      where: { userId, source: RuleSource.LEARNED },
    });
    expect(rule).toBeNull();
  });
});
