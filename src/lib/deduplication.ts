import { prisma } from "@/lib/prisma";
import type { TransactionCandidateData } from "@/lib/parser";
import { normalizeMerchantName } from "@/lib/merchant-normalizer";

export const AUTO_MERGE_THRESHOLD = 90;
export const REVIEW_THRESHOLD = 55;

export interface MatchResult {
  score: number;
  reasons: string[];
  hasExactRefMatch: boolean;
  sameMerchant: boolean;
  samePaymentMethod: boolean;
}

export interface TransactionMatch {
  transactionId: string;
  score: number;
  reasons: string[];
  qualifiesForAutoMerge: boolean;
}

/** Score-threshold alone isn't a safe auto-merge signal: two distinct
 * same-amount transactions from the same window can hit 90+ on
 * amount+date+time+payment-method coincidence alone. Require the
 * highest-confidence signal (an exact UTR/reference match) or a strong
 * secondary combination (same merchant AND same payment method) in
 * addition to the score. */
export function qualifiesForAutoMerge(match: MatchResult): boolean {
  if (match.score < AUTO_MERGE_THRESHOLD) return false;
  return match.hasExactRefMatch || (match.sameMerchant && match.samePaymentMethod);
}

export function calculateMatchScore(
  a: TransactionCandidateData,
  b: TransactionCandidateData
): MatchResult {
  let score = 0;
  const reasons: string[] = [];
  let hasExactRefMatch = false;
  let sameMerchant = false;
  let samePaymentMethod = false;

  // Exact UTR/reference match: +50
  if (a.utr && b.utr && a.utr === b.utr) {
    score += 50;
    reasons.push("Exact UTR match");
    hasExactRefMatch = true;
  } else if (
    a.referenceNumber &&
    b.referenceNumber &&
    a.referenceNumber === b.referenceNumber
  ) {
    score += 50;
    reasons.push("Exact reference number match");
    hasExactRefMatch = true;
  }

  // Same amount: +20
  if (a.amount === b.amount && a.currency === b.currency) {
    score += 20;
    reasons.push("Same amount and currency");
  }

  // Same merchant (normalized): +15
  if (a.merchantRaw && b.merchantRaw) {
    const normA = normalizeMerchantName(a.merchantRaw).toLowerCase();
    const normB = normalizeMerchantName(b.merchantRaw).toLowerCase();
    if (normA === normB) {
      score += 15;
      reasons.push("Same merchant");
      sameMerchant = true;
    }
  }

  // Same date: +10
  if (a.transactionDate && b.transactionDate) {
    const dateA = new Date(a.transactionDate).toDateString();
    const dateB = new Date(b.transactionDate).toDateString();
    if (dateA === dateB) {
      score += 10;
      reasons.push("Same date");
    }
  }

  // Time within 5 minutes: +10
  if (a.transactionTime && b.transactionTime) {
    const parseTime = (t: string): number => {
      const parts = t.match(/(\d{1,2}):(\d{2})/);
      if (!parts) return -1;
      return parseInt(parts[1]) * 60 + parseInt(parts[2]);
    };
    const timeA = parseTime(a.transactionTime);
    const timeB = parseTime(b.transactionTime);
    if (timeA >= 0 && timeB >= 0 && Math.abs(timeA - timeB) <= 5) {
      score += 10;
      reasons.push("Time within 5 minutes");
    }
  }

  // Same payment method: +5
  if (a.paymentMethod === b.paymentMethod && a.paymentMethod !== "UNKNOWN") {
    score += 5;
    reasons.push("Same payment method");
    samePaymentMethod = true;
  }

  // Same account/card: +5
  if (
    (a.cardLast4 && b.cardLast4 && a.cardLast4 === b.cardLast4) ||
    (a.accountLast4 && b.accountLast4 && a.accountLast4 === b.accountLast4)
  ) {
    score += 5;
    reasons.push("Same account/card");
  }

  return { score, reasons, hasExactRefMatch, sameMerchant, samePaymentMethod };
}

export async function findMatchingTransaction(
  userId: string,
  candidate: TransactionCandidateData
): Promise<TransactionMatch | null> {
  // Search for potential matches within a date window
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (candidate.transactionDate) {
    const d = new Date(candidate.transactionDate);
    dateFilter.gte = new Date(d.getTime() - 3 * 24 * 60 * 60 * 1000);
    dateFilter.lte = new Date(d.getTime() + 3 * 24 * 60 * 60 * 1000);
  }

  const existingTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      amount: candidate.amount,
      ...(Object.keys(dateFilter).length > 0 && {
        transactionDate: dateFilter,
      }),
    },
    include: { merchant: true },
    take: 50,
  });

  let bestMatch: TransactionMatch | null = null;

  for (const tx of existingTransactions) {
    const txAsCandidate: TransactionCandidateData = {
      amount: Number(tx.amount),
      currency: tx.currency,
      merchantRaw: tx.merchant?.name ?? null,
      transactionDate: tx.transactionDate,
      transactionTime: tx.transactionTime,
      type: tx.type,
      paymentMethod: tx.paymentMethod,
      accountLast4: tx.accountLast4,
      cardLast4: tx.cardLast4,
      upiId: tx.upiId,
      referenceNumber: tx.referenceNumber,
      utr: tx.utr,
      description: tx.notes,
      confidence: tx.confidence ?? 0,
    };

    const matchResult = calculateMatchScore(candidate, txAsCandidate);

    if (!bestMatch || matchResult.score > bestMatch.score) {
      bestMatch = {
        transactionId: tx.id,
        score: matchResult.score,
        reasons: matchResult.reasons,
        qualifiesForAutoMerge: qualifiesForAutoMerge(matchResult),
      };
    }
  }

  if (bestMatch && bestMatch.score >= REVIEW_THRESHOLD) {
    return bestMatch;
  }

  return null;
}

export async function mergeIntoTransaction(
  transactionId: string,
  financialEmailId: string,
  reasons: string[]
): Promise<void> {
  await prisma.transactionEvidence.create({
    data: {
      transactionId,
      financialEmailId,
      matchConfidence: 1,
      matchReasons: reasons,
    },
  });
}
