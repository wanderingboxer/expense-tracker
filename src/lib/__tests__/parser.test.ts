import {
  extractAmounts,
  extractDates,
  extractTime,
  extractReferences,
  extractCardInfo,
  extractUpiId,
  detectTransactionType,
  detectPaymentMethod,
  extractMerchantName,
} from "@/lib/parser";

describe("extractAmounts", () => {
  it("extracts ₹1,499", () => {
    const result = extractAmounts("You paid ₹1,499 at Swiggy");
    expect(result).toEqual([{ amount: 1499, currency: "INR" }]);
  });

  it("extracts Rs. 2,500", () => {
    const result = extractAmounts("Amount Rs. 2,500 debited");
    expect(result).toEqual([{ amount: 2500, currency: "INR" }]);
  });

  it("extracts INR 10,000", () => {
    const result = extractAmounts("INR 10,000 credited");
    expect(result).toEqual([{ amount: 10000, currency: "INR" }]);
  });

  it("extracts $99.99", () => {
    const result = extractAmounts("Charged $99.99");
    expect(result).toEqual([{ amount: 99.99, currency: "USD" }]);
  });

  it("extracts Rs 500 (no dot)", () => {
    const result = extractAmounts("Rs 500 paid");
    expect(result).toEqual([{ amount: 500, currency: "INR" }]);
  });

  it("extracts ₹1,23,456 (Indian numbering)", () => {
    const result = extractAmounts("₹1,23,456 transferred");
    expect(result).toEqual([{ amount: 123456, currency: "INR" }]);
  });

  it("returns empty for no amounts", () => {
    expect(extractAmounts("Hello world")).toEqual([]);
  });
});

describe("extractDates", () => {
  it("parses DD/MM/YYYY", () => {
    const result = extractDates("Date: 16/08/2026");
    expect(result).toHaveLength(1);
    expect(result[0].date.getFullYear()).toBe(2026);
    expect(result[0].date.getMonth()).toBe(7); // August
    expect(result[0].date.getDate()).toBe(16);
  });

  it("parses DD-MM-YYYY", () => {
    const result = extractDates("Date: 16-08-2026");
    expect(result).toHaveLength(1);
    expect(result[0].date.getFullYear()).toBe(2026);
  });

  it("parses YYYY-MM-DD", () => {
    const result = extractDates("Date: 2026-08-16");
    expect(result).toHaveLength(1);
    expect(result[0].date.getFullYear()).toBe(2026);
    expect(result[0].date.getMonth()).toBe(7);
  });

  it('parses "16 Aug 2026"', () => {
    const result = extractDates("on 16 Aug 2026");
    expect(result).toHaveLength(1);
    expect(result[0].date.getFullYear()).toBe(2026);
  });

  it('parses "August 16, 2026"', () => {
    const result = extractDates("on August 16, 2026");
    expect(result).toHaveLength(1);
    expect(result[0].date.getFullYear()).toBe(2026);
    expect(result[0].date.getMonth()).toBe(7);
  });
});

describe("extractTime", () => {
  it('extracts "14:32"', () => {
    expect(extractTime("at 14:32 on")).toBe("14:32");
  });

  it('extracts "2:30 PM"', () => {
    const result = extractTime("at 2:30 PM");
    expect(result).not.toBeNull();
    expect(result).toContain("2:30");
  });

  it('extracts "10:00 AM"', () => {
    const result = extractTime("at 10:00 AM");
    expect(result).not.toBeNull();
    expect(result).toContain("10:00");
  });

  it("returns null for no time", () => {
    expect(extractTime("no time here")).toBeNull();
  });
});

describe("extractReferences", () => {
  it("extracts UTR patterns", () => {
    const result = extractReferences("UTR: HDFC1234567890");
    expect(result).toContain("HDFC1234567890");
  });

  it("extracts reference numbers", () => {
    const result = extractReferences("Ref No: TXN123456");
    expect(result).toContain("TXN123456");
  });

  it("extracts transaction IDs", () => {
    const result = extractReferences("Transaction ID: ABC789012");
    expect(result).toContain("ABC789012");
  });

  it("returns empty for no references", () => {
    expect(extractReferences("Hello world")).toEqual([]);
  });
});

describe("extractCardInfo", () => {
  it('extracts "XX1234"', () => {
    expect(extractCardInfo("Card XX1234 used")).toBe("1234");
  });

  it('extracts "****5678"', () => {
    expect(extractCardInfo("Card ****5678")).toBe("5678");
  });

  it('extracts "ending 9012"', () => {
    expect(extractCardInfo("card ending 9012")).toBe("9012");
  });

  it("returns null for no card info", () => {
    expect(extractCardInfo("no card")).toBeNull();
  });
});

describe("extractUpiId", () => {
  it('extracts "user@ybl"', () => {
    expect(extractUpiId("paid to user@ybl")).toBe("user@ybl");
  });

  it('extracts phone@ybl', () => {
    expect(extractUpiId("to 9876543210@ybl")).toBe("9876543210@ybl");
  });

  it("returns null for regular email", () => {
    expect(extractUpiId("from test@gmail.com")).toBeNull();
  });
});

describe("detectTransactionType", () => {
  it("debited -> EXPENSE", () => {
    expect(detectTransactionType("amount debited", "")).toBe("EXPENSE");
  });

  it("credited -> INCOME", () => {
    expect(detectTransactionType("amount credited", "")).toBe("INCOME");
  });

  it("refund -> REFUND", () => {
    expect(detectTransactionType("refund processed", "")).toBe("REFUND");
  });

  it("transfer -> TRANSFER", () => {
    expect(detectTransactionType("transferred to account", "")).toBe("TRANSFER");
  });

  it("ATM -> CASH_WITHDRAWAL", () => {
    expect(detectTransactionType("ATM withdrawal", "")).toBe("CASH_WITHDRAWAL");
  });

  it("unknown text -> UNKNOWN", () => {
    expect(detectTransactionType("hello world", "")).toBe("UNKNOWN");
  });
});

describe("detectPaymentMethod", () => {
  it("detects UPI", () => {
    expect(detectPaymentMethod("via UPI")).toBe("UPI");
  });

  it("detects credit card", () => {
    expect(detectPaymentMethod("credit card ending 1234")).toBe("CREDIT_CARD");
  });

  it("detects debit card", () => {
    expect(detectPaymentMethod("debit card payment")).toBe("DEBIT_CARD");
  });

  it("detects NEFT", () => {
    expect(detectPaymentMethod("via NEFT transfer")).toBe("BANK_TRANSFER");
  });

  it("detects wallet", () => {
    expect(detectPaymentMethod("from wallet")).toBe("WALLET");
  });

  it("returns UNKNOWN for ambiguous text", () => {
    expect(detectPaymentMethod("some transaction")).toBe("UNKNOWN");
  });
});

describe("extractMerchantName", () => {
  it('extracts "at Swiggy"', () => {
    expect(extractMerchantName("paid at Swiggy on 16 Aug", "")).toBe("Swiggy");
  });

  it('extracts "to Amazon"', () => {
    expect(extractMerchantName("payment to Amazon on 16 Aug", "")).toBe("Amazon");
  });

  it('extracts "paid to Zomato"', () => {
    expect(extractMerchantName("paid to Zomato via UPI", "")).toBe("Zomato");
  });

  it("returns null for no merchant", () => {
    expect(extractMerchantName("amount debited", "")).toBeNull();
  });
});
