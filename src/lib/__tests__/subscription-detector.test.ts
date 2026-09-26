import { detectRecurringPattern } from "@/lib/subscription-detector";
import { Frequency } from "@/generated/prisma/enums";

function tx(id: string, amount: number, dateStr: string, categoryId: string | null = null) {
  return { id, amount, transactionDate: new Date(dateStr), categoryId };
}

describe("detectRecurringPattern", () => {
  it("detects a monthly subscription (consistent amount, ~30 day gaps)", () => {
    const result = detectRecurringPattern([
      tx("1", 199, "2026-06-15"),
      tx("2", 199, "2026-07-15"),
      tx("3", 199, "2026-08-16"),
    ]);
    expect(result).toEqual({ frequency: Frequency.MONTHLY });
  });

  it("detects a weekly subscription", () => {
    const result = detectRecurringPattern([
      tx("1", 50, "2026-08-01"),
      tx("2", 50, "2026-08-08"),
      tx("3", 51, "2026-08-15"),
    ]);
    expect(result).toEqual({ frequency: Frequency.WEEKLY });
  });

  it("detects a yearly subscription", () => {
    const result = detectRecurringPattern([
      tx("1", 999, "2024-09-01"),
      tx("2", 999, "2025-09-03"),
    ]);
    expect(result).toEqual({ frequency: Frequency.YEARLY });
  });

  it("returns null for fewer than 2 transactions", () => {
    expect(detectRecurringPattern([tx("1", 199, "2026-06-15")])).toBeNull();
    expect(detectRecurringPattern([])).toBeNull();
  });

  it("returns null when amounts vary by more than 5%", () => {
    const result = detectRecurringPattern([
      tx("1", 100, "2026-06-15"),
      tx("2", 120, "2026-07-15"), // 20% higher
    ]);
    expect(result).toBeNull();
  });

  it("returns null when gaps don't match any interval", () => {
    // 15 days: outside weekly's [4,10] and monthly's [27,33] windows.
    const result = detectRecurringPattern([
      tx("1", 100, "2026-06-15"),
      tx("2", 100, "2026-06-30"),
    ]);
    expect(result).toBeNull();
  });

  it("returns null when gaps are inconsistent (some weekly, some monthly)", () => {
    const result = detectRecurringPattern([
      tx("1", 100, "2026-06-01"),
      tx("2", 100, "2026-06-08"), // weekly gap
      tx("3", 100, "2026-07-10"), // monthly gap
    ]);
    expect(result).toBeNull();
  });

  it("does not treat two genuinely unrelated same-amount purchases with an odd gap as a subscription", () => {
    // Regression guard for the false-positive scenario the plan called out —
    // amount alone being similar isn't enough without a matching interval.
    const result = detectRecurringPattern([
      tx("1", 500, "2026-06-01"),
      tx("2", 500, "2026-06-15"),
    ]);
    expect(result).toBeNull();
  });
});
