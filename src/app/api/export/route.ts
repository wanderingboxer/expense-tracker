import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const params = req.nextUrl.searchParams;

    const where: Record<string, unknown> = { userId, isExcluded: false };
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    if (dateFrom || dateTo) {
      where.transactionDate = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { merchant: true, category: true, financialAccount: true },
      orderBy: { transactionDate: "desc" },
    });

    const header = "Date,Amount,Currency,Type,Category,Merchant,Payment Method,Account,Notes,Reference\n";
    const escape = (s: string | null | undefined) => {
      if (!s) return "";
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = transactions.map((tx) =>
      [
        tx.transactionDate.toISOString().split("T")[0],
        Number(tx.amount),
        tx.currency,
        tx.type,
        escape(tx.category?.name),
        escape(tx.merchant?.name),
        tx.paymentMethod,
        escape(tx.financialAccount?.name),
        escape(tx.notes),
        tx.referenceNumber ?? "",
      ].join(",")
    );

    const csv = header + rows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transactions-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
