import { z } from "zod";

export interface ExtractedTransaction {
  amount: number;
  currency: string;
  merchant: string | null;
  date: string | null;
  type: string;
  paymentMethod: string | null;
  referenceNumber: string | null;
  description: string | null;
  confidence: number;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  topCategories: { name: string; amount: number }[];
  period: string;
  transactionCount: number;
}

export interface FinancialContext {
  recentTransactions: {
    amount: number;
    merchant: string;
    category: string;
    date: string;
  }[];
  monthlyBudget?: number;
  topCategories: { name: string; total: number }[];
}

export interface InsightData {
  type: string;
  title: string;
  description: string;
  priority: number;
}

export interface AIProvider {
  extractTransaction(emailContent: string): Promise<ExtractedTransaction>;
  categorizeTransaction(
    description: string,
    merchantName: string,
    categories: string[]
  ): Promise<{ category: string; confidence: number }>;
  generateInsights(data: FinancialSummary): Promise<InsightData[]>;
  answerFinancialQuery(
    query: string,
    context: FinancialContext
  ): Promise<string>;
}

const ExtractedTransactionSchema = z.object({
  amount: z.number(),
  currency: z.string().default("INR"),
  merchant: z.string().nullable(),
  date: z.string().nullable(),
  type: z.string(),
  paymentMethod: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  description: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const CategorizationSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
});

const InsightsSchema = z.array(
  z.object({
    type: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.number(),
  })
);

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private baseUrl =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is not set");
    this.apiKey = key;
  }

  private async callGemini(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return text;
  }

  private extractJson(text: string): string {
    // Try to extract JSON from markdown code blocks or raw text
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return jsonMatch[1].trim();
    // Try to find raw JSON
    const braceMatch = text.match(/[\[{][\s\S]*[\]}]/);
    if (braceMatch) return braceMatch[0];
    return text;
  }

  async extractTransaction(
    emailContent: string
  ): Promise<ExtractedTransaction> {
    const prompt = `Extract financial transaction details from this email. Return ONLY valid JSON with this exact schema:
{
  "amount": number,
  "currency": "INR" or "USD" etc,
  "merchant": string or null,
  "date": "YYYY-MM-DD" or null,
  "type": "EXPENSE"|"INCOME"|"TRANSFER"|"REFUND"|"CASH_WITHDRAWAL"|"CASHBACK"|"FEE"|"INTEREST"|"LOAN_PAYMENT"|"UNKNOWN",
  "paymentMethod": "UPI"|"CREDIT_CARD"|"DEBIT_CARD"|"BANK_TRANSFER"|"NET_BANKING"|"WALLET"|"CASH"|"UNKNOWN" or null,
  "referenceNumber": string or null,
  "description": string or null,
  "confidence": number between 0 and 1
}

Email content:
${emailContent.slice(0, 4000)}`;

    const text = await this.callGemini(prompt);
    const json = JSON.parse(this.extractJson(text));
    return ExtractedTransactionSchema.parse(json);
  }

  async categorizeTransaction(
    description: string,
    merchantName: string,
    categories: string[]
  ): Promise<{ category: string; confidence: number }> {
    const prompt = `Categorize this transaction. Return ONLY valid JSON: {"category": "chosen category", "confidence": 0.0-1.0}

Transaction: "${description}" at "${merchantName}"
Available categories: ${JSON.stringify(categories)}`;

    const text = await this.callGemini(prompt);
    const json = JSON.parse(this.extractJson(text));
    return CategorizationSchema.parse(json);
  }

  async generateInsights(data: FinancialSummary): Promise<InsightData[]> {
    const prompt = `Analyze this financial summary and generate actionable insights. Return ONLY a valid JSON array with objects having: {"type": string, "title": string, "description": string, "priority": 1-5}

Financial Summary:
- Period: ${data.period}
- Total Income: ${data.totalIncome}
- Total Expenses: ${data.totalExpenses}
- Transaction Count: ${data.transactionCount}
- Top Categories: ${JSON.stringify(data.topCategories)}

Generate 3-5 insights about spending patterns, savings opportunities, or budget alerts.`;

    const text = await this.callGemini(prompt);
    const json = JSON.parse(this.extractJson(text));
    return InsightsSchema.parse(json);
  }

  async answerFinancialQuery(
    query: string,
    context: FinancialContext
  ): Promise<string> {
    const prompt = `You are a personal finance assistant. Answer the user's question based on their financial data.

User's Financial Context:
- Recent Transactions: ${JSON.stringify(context.recentTransactions.slice(0, 20))}
- Monthly Budget: ${context.monthlyBudget ?? "Not set"}
- Top Spending Categories: ${JSON.stringify(context.topCategories)}

User's Question: ${query}

Provide a helpful, concise answer with specific numbers from the data when possible.`;

    return this.callGemini(prompt);
  }
}

let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = new GeminiProvider();
  }
  return providerInstance;
}
