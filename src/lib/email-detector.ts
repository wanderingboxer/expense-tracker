export const KNOWN_FINANCIAL_DOMAINS = [
  "hdfcbank.net",
  "icicibank.com",
  "sbi.co.in",
  "axisbank.com",
  "kotak.com",
  "yesbank.in",
  "idfcfirstbank.com",
  "indusind.com",
  "rbl.co.in",
  "federal-bank.com",
  "paytm.com",
  "phonepe.com",
  "razorpay.com",
  "paypal.com",
  "stripe.com",
  "amazonpay.in",
  "gpay.in",
  "cred.club",
  "simpl.co",
  "lazypay.in",
  "bajajfinserv.in",
  "hdfcergo.com",
  "policybazaar.com",
  "groww.in",
  "zerodha.com",
  "swiggy.com",
  "zomato.com",
  "flipkart.com",
  "amazon.in",
  "uber.com",
  "ola.com",
];

export const FINANCIAL_SUBJECT_KEYWORDS = [
  "transaction",
  "payment",
  "credited",
  "debited",
  "transfer",
  "receipt",
  "invoice",
  "statement",
  "bill",
  "emi",
  "refund",
  "purchase",
  "withdrawal",
  "deposit",
  "salary",
  "upi",
  "neft",
  "imps",
  "rtgs",
  "mandate",
  "autopay",
  "subscription",
  "cashback",
  "reward",
];

export const NEGATIVE_KEYWORDS = [
  "promotional",
  "marketing",
  "newsletter",
  "unsubscribe",
  "offer valid",
  "limited time",
  "exclusive deal",
  "win a",
  "congratulations you have won",
  "click here to claim",
  "pre-approved",
  "apply now",
  "upgrade your",
];

const CURRENCY_PATTERN =
  /(?:₹|Rs\.?|INR|USD|\$)\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*(?:₹|Rs\.?|INR|USD)/i;

const PAYMENT_METHOD_KEYWORDS = [
  "upi",
  "neft",
  "imps",
  "rtgs",
  "credit card",
  "debit card",
  "net banking",
  "wallet",
  "ach",
];

const REFERENCE_PATTERNS = [
  /UTR[\s:]*[A-Z0-9]+/i,
  /ref(?:erence)?[\s:#]*[A-Z0-9]+/i,
  /transaction\s*(?:id|no|number)[\s:#]*[A-Z0-9]+/i,
  /order\s*(?:id|no|number)[\s:#]*[A-Z0-9]+/i,
];

interface EmailForScoring {
  sender: string;
  senderDomain: string;
  subject: string;
  bodyText: string;
}

export function calculateRelevanceScore(email: EmailForScoring): number {
  let score = 0;
  const domain = email.senderDomain.toLowerCase();
  const subject = email.subject.toLowerCase();
  const body = email.bodyText.toLowerCase();
  const combined = `${subject} ${body}`;

  // Known financial domains: +30
  if (KNOWN_FINANCIAL_DOMAINS.some((d) => domain.includes(d))) {
    score += 30;
  }

  // Financial subject keywords: +20
  if (FINANCIAL_SUBJECT_KEYWORDS.some((kw) => subject.includes(kw))) {
    score += 20;
  }

  // Currency/amount patterns: +20
  if (CURRENCY_PATTERN.test(combined)) {
    score += 20;
  }

  // Payment method keywords: +15
  if (PAYMENT_METHOD_KEYWORDS.some((kw) => combined.includes(kw))) {
    score += 15;
  }

  // Reference/ID patterns: +15
  if (REFERENCE_PATTERNS.some((p) => p.test(combined))) {
    score += 15;
  }

  // Negative signals: -20
  if (NEGATIVE_KEYWORDS.some((kw) => combined.includes(kw))) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

export function isFinancialEmail(score: number, threshold = 40): boolean {
  return score >= threshold;
}
