import { calculateRelevanceScore } from "@/lib/email-detector";

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
