import { calculateMatchScore } from "@/lib/deduplication";
import type { TransactionCandidateData } from "@/lib/parser";

function makeCandidate(overrides: Partial<TransactionCandidateData> = {}): TransactionCandidateData {
  return {
    amount: 500,
    currency: "INR",
    merchantRaw: null,
    transactionDate: null,
    transactionTime: null,
    type: "EXPENSE",
    paymentMethod: "UPI",
    accountLast4: null,
    cardLast4: null,
    upiId: null,
    referenceNumber: null,
    utr: null,
    description: null,
    confidence: 0.5,
    ...overrides,
  };
}

describe("calculateMatchScore", () => {
  it("same UTR -> score >= 50", () => {
    const a = makeCandidate({ utr: "HDFC1234567890" });
    const b = makeCandidate({ utr: "HDFC1234567890" });
    const { score } = calculateMatchScore(a, b);
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it("same amount + merchant + date -> score >= 45", () => {
    const date = new Date("2026-08-16");
    const a = makeCandidate({ amount: 1000, merchantRaw: "Swiggy", transactionDate: date });
    const b = makeCandidate({ amount: 1000, merchantRaw: "Swiggy", transactionDate: date });
    const { score } = calculateMatchScore(a, b);
    expect(score).toBeGreaterThanOrEqual(45);
  });

  it("same amount + different merchant -> score ~20", () => {
    const a = makeCandidate({ amount: 1000, merchantRaw: "Swiggy" });
    const b = makeCandidate({ amount: 1000, merchantRaw: "Zomato" });
    const { score } = calculateMatchScore(a, b);
    expect(score).toBeGreaterThanOrEqual(15);
    expect(score).toBeLessThanOrEqual(30);
  });

  it("completely different transactions -> score < 15", () => {
    const a = makeCandidate({ amount: 100, merchantRaw: "Swiggy" });
    const b = makeCandidate({ amount: 999, merchantRaw: "Uber" });
    const { score } = calculateMatchScore(a, b);
    expect(score).toBeLessThan(15);
  });

  it("same UTR + amount + merchant -> score >= 85 (auto-merge)", () => {
    const date = new Date("2026-08-16");
    const a = makeCandidate({
      utr: "HDFC1234567890",
      amount: 1000,
      merchantRaw: "Swiggy",
      transactionDate: date,
      transactionTime: "14:30",
      cardLast4: "1234",
    });
    const b = makeCandidate({
      utr: "HDFC1234567890",
      amount: 1000,
      merchantRaw: "Swiggy",
      transactionDate: date,
      transactionTime: "14:32",
      cardLast4: "1234",
    });
    const { score } = calculateMatchScore(a, b);
    expect(score).toBeGreaterThanOrEqual(85);
  });
});
