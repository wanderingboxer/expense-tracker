import { TransactionType, PaymentMethod } from "@/generated/prisma/enums";

export interface ExtractedAmount {
  amount: number;
  currency: string;
}

export interface ExtractedDate {
  date: Date;
  raw: string;
}

export interface TransactionCandidateData {
  amount: number;
  currency: string;
  merchantRaw: string | null;
  transactionDate: Date | null;
  transactionTime: string | null;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  accountLast4: string | null;
  cardLast4: string | null;
  upiId: string | null;
  referenceNumber: string | null;
  utr: string | null;
  description: string | null;
  confidence: number;
}

export function extractAmounts(text: string): ExtractedAmount[] {
  const results: ExtractedAmount[] = [];
  const patterns = [
    { regex: /₹\s*([\d,]+(?:\.\d{1,2})?)/g, currency: "INR" },
    { regex: /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/gi, currency: "INR" },
    { regex: /INR\s*([\d,]+(?:\.\d{1,2})?)/gi, currency: "INR" },
    { regex: /([\d,]+(?:\.\d{1,2})?)\s*INR/gi, currency: "INR" },
    { regex: /\$\s*([\d,]+(?:\.\d{1,2})?)/g, currency: "USD" },
    { regex: /USD\s*([\d,]+(?:\.\d{1,2})?)/gi, currency: "USD" },
  ];

  for (const { regex, currency } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[1].replace(/,/g, "");
      const amount = parseFloat(raw);
      if (!isNaN(amount) && amount > 0) {
        results.push({ amount, currency });
      }
    }
  }

  return results;
}

export function extractDates(text: string): ExtractedDate[] {
  const results: ExtractedDate[] = [];
  const patterns: { regex: RegExp; parse: (m: RegExpExecArray) => Date | null }[] = [
    {
      regex: /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g,
      parse: (m) => {
        const d = new Date(`${m[3]}-${m[2]}-${m[1]}`);
        return isNaN(d.getTime()) ? null : d;
      },
    },
    {
      regex: /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/g,
      parse: (m) => {
        const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
        return isNaN(d.getTime()) ? null : d;
      },
    },
    {
      regex: /(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})/gi,
      parse: (m) => {
        const d = new Date(`${m[2]} ${m[1]}, ${m[3]}`);
        return isNaN(d.getTime()) ? null : d;
      },
    },
    {
      regex: /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})/gi,
      parse: (m) => {
        const d = new Date(`${m[1]} ${m[2]}, ${m[3]}`);
        return isNaN(d.getTime()) ? null : d;
      },
    },
  ];

  for (const { regex, parse } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const date = parse(match);
      if (date) {
        results.push({ date, raw: match[0] });
      }
    }
  }

  return results;
}

export function extractTime(text: string): string | null {
  // 24h format
  const match24 = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:hrs?|hours?)?\b/i);
  if (match24) {
    const h = parseInt(match24[1]);
    if (h >= 0 && h <= 23) return match24[0].trim();
  }

  // 12h format
  const match12 = text.match(
    /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])\b/
  );
  if (match12) return match12[0].trim();

  return null;
}

export function extractReferences(text: string): string[] {
  const refs: string[] = [];
  const patterns = [
    /UTR[\s:]*([A-Z0-9]{10,})/gi,
    /(?:ref(?:erence)?|txn|transaction)\s*(?:no|number|id|#)?[\s:]*([A-Z0-9]{6,})/gi,
    /order\s*(?:no|number|id|#)?[\s:]*([A-Z0-9]{6,})/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      refs.push(match[1]);
    }
  }

  return [...new Set(refs)];
}

export function extractCardInfo(text: string): string | null {
  const patterns = [
    /(?:XX|xx|\*{2,4})(\d{4})/,
    /(?:ending|ends?\s+(?:in|with))\s*(\d{4})/i,
    /\*{4}\s*(\d{4})/,
    /card\s*(?:no\.?)?\s*(?:XX|xx|\*+)?(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export function extractUpiId(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._-]+@[a-z]{2,}/);
  // Filter out regular emails by checking known UPI handles
  if (match) {
    const upiHandles = [
      "upi",
      "ybl",
      "okhdfcbank",
      "okaxis",
      "oksbi",
      "okicici",
      "paytm",
      "apl",
      "ibl",
      "axl",
      "sbi",
      "icici",
      "hdfc",
      "axis",
      "kotak",
      "indus",
      "federal",
      "rbl",
    ];
    const domain = match[0].split("@")[1];
    if (upiHandles.some((h) => domain.includes(h))) {
      return match[0];
    }
  }
  return null;
}

export function detectTransactionType(
  text: string,
  subject: string
): TransactionType {
  const combined = `${subject} ${text}`.toLowerCase();

  if (/\b(?:refund|reversed|reversal)\b/.test(combined))
    return TransactionType.REFUND;
  if (/\b(?:cashback|cash\s*back)\b/.test(combined))
    return TransactionType.CASHBACK;
  if (/\b(?:credited|credit|received|salary|income)\b/.test(combined))
    return TransactionType.INCOME;
  if (/\b(?:debited|debit|spent|paid|purchased|payment|charged)\b/.test(combined))
    return TransactionType.EXPENSE;
  if (/\b(?:transfer(?:red)?|sent to|moved to)\b/.test(combined))
    return TransactionType.TRANSFER;
  if (/\b(?:withdraw(?:al|n)?|atm)\b/.test(combined))
    return TransactionType.CASH_WITHDRAWAL;
  if (/\b(?:fee|charge|surcharge)\b/.test(combined))
    return TransactionType.FEE;
  if (/\b(?:interest)\b/.test(combined))
    return TransactionType.INTEREST;
  if (/\b(?:emi|loan|instalment|installment)\b/.test(combined))
    return TransactionType.LOAN_PAYMENT;

  return TransactionType.UNKNOWN;
}

export function detectPaymentMethod(text: string): PaymentMethod {
  const lower = text.toLowerCase();

  if (/\bupi\b/.test(lower)) return PaymentMethod.UPI;
  if (/\bcredit\s*card\b/.test(lower)) return PaymentMethod.CREDIT_CARD;
  if (/\bdebit\s*card\b/.test(lower)) return PaymentMethod.DEBIT_CARD;
  if (/\b(?:neft|rtgs|imps)\b/.test(lower)) return PaymentMethod.BANK_TRANSFER;
  if (/\bnet\s*banking\b/.test(lower)) return PaymentMethod.NET_BANKING;
  if (/\bwallet\b/.test(lower)) return PaymentMethod.WALLET;
  if (/\b(?:cash|atm)\b/.test(lower)) return PaymentMethod.CASH;

  return PaymentMethod.UNKNOWN;
}

export function extractMerchantName(
  text: string,
  subject: string
): string | null {
  const combined = `${subject} ${text}`;
  const patterns = [
    /(?:paid to|payment to|transferred to|sent to)\s+([A-Za-z0-9\s&'.()-]+?)(?:\s+(?:on|for|via|ref|$))/i,
    /(?:at|from)\s+([A-Za-z0-9\s&'.()-]+?)(?:\s+(?:on|for|via|ref|using|$))/i,
    /(?:purchase at|transaction at)\s+([A-Za-z0-9\s&'.()-]+?)(?:\s+(?:on|for|$))/i,
    /(?:to VPA)\s+([a-zA-Z0-9._-]+@[a-z]+)/i,
  ];

  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match) {
      const name = match[1].trim();
      if (name.length >= 2 && name.length <= 100) return name;
    }
  }

  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&#8377;/gi, "₹")
    .replace(/&rupee;/gi, "₹")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTransactionFromEmail(email: {
  sender: string;
  senderDomain: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}): TransactionCandidateData | null {
  const text = email.bodyText || (email.bodyHtml ? stripHtml(email.bodyHtml) : "") || email.subject;
  if (!text) return null;

  const amounts = extractAmounts(text);
  if (amounts.length === 0) return null;

  // Use the first (usually primary) amount
  const primaryAmount = amounts[0];

  const dates = extractDates(text);
  const time = extractTime(text);
  const refs = extractReferences(text);
  const cardLast4 = extractCardInfo(text);
  const upiId = extractUpiId(text);
  const type = detectTransactionType(text, email.subject);
  const paymentMethod = detectPaymentMethod(text);
  const merchantRaw = extractMerchantName(text, email.subject);

  // Calculate confidence based on how much data we extracted
  let confidence = 0.3; // base
  if (primaryAmount.amount > 0) confidence += 0.2;
  if (dates.length > 0) confidence += 0.15;
  if (type !== TransactionType.UNKNOWN) confidence += 0.15;
  if (merchantRaw) confidence += 0.1;
  if (refs.length > 0) confidence += 0.1;

  return {
    amount: primaryAmount.amount,
    currency: primaryAmount.currency,
    merchantRaw,
    transactionDate: dates.length > 0 ? dates[0].date : null,
    transactionTime: time,
    type,
    paymentMethod,
    accountLast4: null,
    cardLast4,
    upiId,
    referenceNumber: refs[0] ?? null,
    utr: refs.find((r) => r.length >= 12) ?? null,
    description: email.subject,
    confidence: Math.min(1, confidence),
  };
}
