import { prisma } from "@/lib/prisma";
import { RuleSource } from "@/generated/prisma/enums";

const LEGAL_SUFFIXES = [
  /\s*(?:pvt\.?\s*)?ltd\.?$/i,
  /\s*(?:private\s+)?limited$/i,
  /\s*inc\.?$/i,
  /\s*incorporated$/i,
  /\s*llc\.?$/i,
  /\s*llp\.?$/i,
  /\s*corp\.?$/i,
  /\s*corporation$/i,
  /\s*(?:co\.?|company)$/i,
  /\s*enterprises?$/i,
  /\s*(?:solutions?|services?|technologies|tech)$/i,
];

const TRANSACTION_PREFIXES = [
  /^\*+\s*/,
  /^(?:pos|ecom|online|iw|ib|mb|upi)-?\s*/i,
  /^(?:payu|razorpay|stripe|cashfree|paytm)-?\s*/i,
];

export function normalizeMerchantName(raw: string): string {
  let name = raw.trim();

  // Remove asterisks and transaction prefixes
  for (const prefix of TRANSACTION_PREFIXES) {
    name = name.replace(prefix, "");
  }

  // Remove legal suffixes
  for (const suffix of LEGAL_SUFFIXES) {
    name = name.replace(suffix, "");
  }

  // Remove special characters but keep spaces, ampersands, apostrophes
  name = name.replace(/[^a-zA-Z0-9\s&'.-]/g, "");

  // Normalize whitespace
  name = name.replace(/\s+/g, " ").trim();

  // Title case
  name = name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return name;
}

export function calculateMerchantSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();

  if (s1 === s2) return 1;

  const len = Math.max(s1.length, s2.length);
  if (len === 0) return 1;

  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / len;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

export async function findOrCreateMerchant(
  userId: string,
  rawName: string
): Promise<{ id: string; name: string; normalizedName: string }> {
  const normalized = normalizeMerchantName(rawName);

  // Check existing aliases first
  const existingAlias = await prisma.merchantAlias.findFirst({
    where: {
      normalizedAlias: normalized.toLowerCase(),
      merchant: { userId },
    },
    include: { merchant: true },
  });

  if (existingAlias) {
    return {
      id: existingAlias.merchant.id,
      name: existingAlias.merchant.name,
      normalizedName: existingAlias.merchant.normalizedName,
    };
  }

  // Check by normalized name
  const existingMerchant = await prisma.merchant.findFirst({
    where: {
      userId,
      normalizedName: normalized.toLowerCase(),
    },
  });

  if (existingMerchant) {
    return {
      id: existingMerchant.id,
      name: existingMerchant.name,
      normalizedName: existingMerchant.normalizedName,
    };
  }

  // Check similarity with existing merchants
  const userMerchants = await prisma.merchant.findMany({
    where: { userId },
    select: { id: true, name: true, normalizedName: true },
  });

  for (const merchant of userMerchants) {
    const similarity = calculateMerchantSimilarity(
      normalized,
      merchant.normalizedName
    );
    if (similarity >= 0.85) {
      // Create alias for the match
      await prisma.merchantAlias.create({
        data: {
          merchantId: merchant.id,
          alias: rawName,
          normalizedAlias: normalized.toLowerCase(),
          source: RuleSource.SYSTEM,
        },
      });
      return {
        id: merchant.id,
        name: merchant.name,
        normalizedName: merchant.normalizedName,
      };
    }
  }

  // Create new merchant + alias
  const newMerchant = await prisma.merchant.create({
    data: {
      userId,
      name: normalized,
      normalizedName: normalized.toLowerCase(),
      aliases: {
        create: {
          alias: rawName,
          normalizedAlias: normalized.toLowerCase(),
          source: RuleSource.SYSTEM,
        },
      },
    },
  });

  return {
    id: newMerchant.id,
    name: newMerchant.name,
    normalizedName: newMerchant.normalizedName,
  };
}
