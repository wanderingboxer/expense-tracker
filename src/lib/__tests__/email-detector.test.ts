import { calculateRelevanceScore, isFinancialEmail, KNOWN_FINANCIAL_DOMAINS } from "@/lib/email-detector";
import { HDFC_SENDER_QUERY } from "@/lib/gmail";

describe("sender/domain consistency", () => {
  it("the Gmail sync sender's domain is present in KNOWN_FINANCIAL_DOMAINS", () => {
    const senderDomain = HDFC_SENDER_QUERY.split("@")[1];
    expect(senderDomain).toBeTruthy();
    expect(
      KNOWN_FINANCIAL_DOMAINS.some((d) => senderDomain?.includes(d) || d.includes(senderDomain ?? ""))
    ).toBe(true);
  });
});

describe("calculateRelevanceScore", () => {
  it("scores bank email with financial content high (>60)", () => {
    const score = calculateRelevanceScore({
      sender: "alerts@hdfcbank.net",
      senderDomain: "hdfcbank.net",
      subject: "Transaction alert: ₹1,500 debited",
      bodyText: "Your account has been debited with ₹1,500 via UPI. Ref No: TXN123456",
    });
    expect(score).toBeGreaterThan(60);
  });

  it("scores UPI confirmation high", () => {
    const score = calculateRelevanceScore({
      sender: "noreply@axisbank.com",
      senderDomain: "axisbank.com",
      subject: "UPI payment successful",
      bodyText: "UPI payment of Rs. 500 to merchant@ybl. UTR: AXIS123456789",
    });
    expect(score).toBeGreaterThan(60);
  });

  it("scores promotional email from bank medium-low", () => {
    const score = calculateRelevanceScore({
      sender: "offers@hdfcbank.net",
      senderDomain: "hdfcbank.net",
      subject: "Exclusive deal on credit cards!",
      bodyText: "Apply now for pre-approved credit card. Limited time offer valid till month end.",
    });
    // Domain gives +30, but negative keywords pull it down
    expect(score).toBeLessThanOrEqual(60);
  });

  it("scores newsletter/marketing low (<30)", () => {
    const score = calculateRelevanceScore({
      sender: "news@randomsite.com",
      senderDomain: "randomsite.com",
      subject: "Weekly newsletter - top stories",
      bodyText: "Check out our latest articles. Unsubscribe if you no longer wish to receive.",
    });
    expect(score).toBeLessThan(30);
  });

  it("scores merchant receipt with amount high", () => {
    const score = calculateRelevanceScore({
      sender: "noreply@swiggy.com",
      senderDomain: "swiggy.com",
      subject: "Payment receipt for your order",
      bodyText: "Payment of ₹450 received for order #12345. Transaction ID: SWG789012",
    });
    expect(score).toBeGreaterThan(60);
  });
});

describe("isFinancialEmail", () => {
  it("accepts a real HDFC UPI debit alert", () => {
    const email = {
      sender: "alerts@hdfcbank.bank.in",
      senderDomain: "hdfcbank.bank.in",
      subject: "Transaction alert",
      bodyText:
        "Rs.60.00 is debited from your account ending 4781 towards VPA test@ybl (Test Merchant) on 26-09-26. UPI transaction reference no.: 489172985779.",
    };
    const score = calculateRelevanceScore(email);
    expect(isFinancialEmail(email, score)).toBe(true);
  });

  it("rejects a promotional/cross-sell email from the same trusted bank domain that happens to mention a number", () => {
    // Regression guard for the exact bug reported: since the Gmail search
    // query already restricts to a known bank sender, every scanned email
    // gets the domain trust bonus regardless of content. A marketing email
    // mentioning an unrelated number (a rate, a discount, an ad headline)
    // must not be classified as a transaction just because it cleared the
    // bare score threshold on domain trust alone.
    const email = {
      sender: "offers@hdfcbank.bank.in",
      senderDomain: "hdfcbank.bank.in",
      subject: "300 Million Wix Businesses. You Have.",
      bodyText:
        "The rates published today start from just $1.00 a month. Build your business website now.",
    };
    const score = calculateRelevanceScore(email);
    expect(isFinancialEmail(email, score)).toBe(false);
  });

  it("rejects a promotional email even when the score alone would pass threshold", () => {
    const email = {
      sender: "alerts@hdfcbank.bank.in",
      senderDomain: "hdfcbank.bank.in",
      subject: "The Rates Published",
      bodyText: "New home loan rates published starting at 8.5%. Apply today.",
    };
    const score = calculateRelevanceScore(email);
    // Domain alone (+30) already clears the bare threshold (20).
    expect(score).toBeGreaterThanOrEqual(20);
    expect(isFinancialEmail(email, score)).toBe(false);
  });
});
