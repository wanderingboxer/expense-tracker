/**
 * Integration tests against a real local Postgres database — verifies the
 * merchant rename and merge-and-alias endpoints against actual DB state.
 */
import { prisma } from "@/lib/prisma";
import { createTestUser, cleanupTestUser } from "./helpers/db";
import { RuleSource } from "@/generated/prisma/enums";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/lib/auth";
import { PATCH as patchMerchant } from "@/app/api/merchants/[id]/route";
import { POST as mergeAndAlias } from "@/app/api/merchants/merge-and-alias/route";

describe("PATCH /api/merchants/[id] — rename", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser("merchant-rename");
    userId = user.id;
    (auth as jest.Mock).mockResolvedValue({ user: { id: userId } });
  });

  afterEach(async () => {
    await cleanupTestUser(userId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("renames the merchant without touching normalizedName", async () => {
    const merchant = await prisma.merchant.create({
      data: { userId, name: "Vipin Kumar", normalizedName: "vipin kumar" },
    });

    const req = new NextRequest(`http://localhost/api/merchants/${merchant.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Uber" }),
    });
    const res = await patchMerchant(req, { params: Promise.resolve({ id: merchant.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.merchant.findUnique({ where: { id: merchant.id } });
    expect(updated?.name).toBe("Uber");
    // normalizedName is deliberately unchanged — it's what incoming email
    // matching keys off, and shouldn't shift just because the display name did.
    expect(updated?.normalizedName).toBe("vipin kumar");
  });
});

describe("POST /api/merchants/merge-and-alias", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser("merchant-merge");
    userId = user.id;
    (auth as jest.Mock).mockResolvedValue({ user: { id: userId } });
  });

  afterEach(async () => {
    await cleanupTestUser(userId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("merges an existing target merchant: reassigns transactions, re-points rules, aliases, deletes source", async () => {
    const source = await prisma.merchant.create({
      data: { userId, name: "Vipin Kumar", normalizedName: "vipin kumar" },
    });
    const target = await prisma.merchant.create({
      data: { userId, name: "Uber", normalizedName: "uber" },
    });
    const category = await prisma.category.create({
      data: { userId, name: "Transportation" },
    });
    const oldCategory = await prisma.category.create({
      data: { userId, name: "Other" },
    });

    const txn1 = await prisma.transaction.create({
      data: {
        userId,
        amount: 60,
        merchantId: source.id,
        categoryId: oldCategory.id,
        transactionDate: new Date(),
        type: "EXPENSE",
      },
    });
    const txn2 = await prisma.transaction.create({
      data: {
        userId,
        amount: 45,
        merchantId: source.id,
        categoryId: oldCategory.id,
        transactionDate: new Date(),
        type: "EXPENSE",
      },
    });
    const rule = await prisma.categoryRule.create({
      data: {
        userId,
        merchantId: source.id,
        categoryId: oldCategory.id,
        source: RuleSource.LEARNED,
      },
    });

    const req = new NextRequest("http://localhost/api/merchants/merge-and-alias", {
      method: "POST",
      body: JSON.stringify({
        sourceMerchantId: source.id,
        targetMerchantId: target.id,
        categoryId: category.id,
        applyToAllPastTransactions: true,
      }),
    });

    const res = await mergeAndAlias(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reassignedTransactionCount).toBe(2);

    const updatedTxn1 = await prisma.transaction.findUnique({ where: { id: txn1.id } });
    const updatedTxn2 = await prisma.transaction.findUnique({ where: { id: txn2.id } });
    expect(updatedTxn1?.merchantId).toBe(target.id);
    expect(updatedTxn1?.categoryId).toBe(category.id);
    expect(updatedTxn2?.merchantId).toBe(target.id);
    expect(updatedTxn2?.categoryId).toBe(category.id);

    const updatedRule = await prisma.categoryRule.findUnique({ where: { id: rule.id } });
    expect(updatedRule?.merchantId).toBe(target.id);

    const alias = await prisma.merchantAlias.findFirst({
      where: { merchantId: target.id, normalizedAlias: "vipin kumar" },
    });
    expect(alias).not.toBeNull();

    const deletedSource = await prisma.merchant.findUnique({ where: { id: source.id } });
    expect(deletedSource).toBeNull();
  });

  it("creates a new merchant when newMerchantName is given instead of a target id", async () => {
    const source = await prisma.merchant.create({
      data: { userId, name: "Random Payee", normalizedName: "random payee" },
    });
    await prisma.transaction.create({
      data: {
        userId,
        amount: 100,
        merchantId: source.id,
        transactionDate: new Date(),
        type: "EXPENSE",
      },
    });

    const req = new NextRequest("http://localhost/api/merchants/merge-and-alias", {
      method: "POST",
      body: JSON.stringify({
        sourceMerchantId: source.id,
        newMerchantName: "Local Cafe",
        applyToAllPastTransactions: true,
      }),
    });

    const res = await mergeAndAlias(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.targetMerchant.name).toBe("Local Cafe");

    const newMerchant = await prisma.merchant.findFirst({
      where: { userId, name: "Local Cafe" },
    });
    expect(newMerchant).not.toBeNull();
  });

  it("rejects sourceMerchantId === targetMerchantId", async () => {
    const merchant = await prisma.merchant.create({
      data: { userId, name: "Solo", normalizedName: "solo" },
    });

    const req = new NextRequest("http://localhost/api/merchants/merge-and-alias", {
      method: "POST",
      body: JSON.stringify({
        sourceMerchantId: merchant.id,
        targetMerchantId: merchant.id,
      }),
    });

    const res = await mergeAndAlias(req);
    expect(res.status).toBe(400);
  });

  it("does not reassign transactions when applyToAllPastTransactions is false, but still aliases for future syncs", async () => {
    const source = await prisma.merchant.create({
      data: { userId, name: "Vipin Kumar", normalizedName: "vipin kumar" },
    });
    const target = await prisma.merchant.create({
      data: { userId, name: "Uber", normalizedName: "uber" },
    });
    const txn = await prisma.transaction.create({
      data: {
        userId,
        amount: 60,
        merchantId: source.id,
        transactionDate: new Date(),
        type: "EXPENSE",
      },
    });

    const req = new NextRequest("http://localhost/api/merchants/merge-and-alias", {
      method: "POST",
      body: JSON.stringify({
        sourceMerchantId: source.id,
        targetMerchantId: target.id,
        applyToAllPastTransactions: false,
      }),
    });

    const res = await mergeAndAlias(req);
    expect(res.status).toBe(200);

    const unchangedTxn = await prisma.transaction.findUnique({ where: { id: txn.id } });
    expect(unchangedTxn?.merchantId).toBe(source.id);

    const alias = await prisma.merchantAlias.findFirst({
      where: { merchantId: target.id, normalizedAlias: "vipin kumar" },
    });
    expect(alias).not.toBeNull();

    // Source merchant is left in place since we didn't migrate its transactions.
    const sourceStillExists = await prisma.merchant.findUnique({ where: { id: source.id } });
    expect(sourceStillExists).not.toBeNull();
  });
});
