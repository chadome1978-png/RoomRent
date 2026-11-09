import { describe, expect, it } from "vitest";
import { getExpenseCategoryTotals, getMonthlyFinanceSummary, getSixMonthCashFlow } from "./finance";

const invoices = [
  { period: "2026-04", status: "paid" as const, totalAmount: 12000 },
  { period: "2026-04", status: "unpaid" as const, totalAmount: 3500 },
  { period: "2026-03", status: "paid" as const, totalAmount: 9000 },
];

const expenses = [
  { date: "2026-04-02", category: "maintenance" as const, amount: 1200 },
  { date: "2026-04-09", category: "utilities" as const, amount: 800 },
  { date: "2026-03-28", category: "maintenance" as const, amount: 500 },
];

describe("RoomRent monthly finance calculations", () => {
  it("counts paid bills as income by billing period and keeps unpaid bills separate", () => {
    expect(getMonthlyFinanceSummary("2026-04", invoices, expenses)).toEqual({
      income: 12000,
      pending: 3500,
      expenses: 2000,
      net: 10000,
      paidInvoiceCount: 1,
      pendingInvoiceCount: 1,
      expenseCount: 2,
    });
  });

  it("breaks only the selected month's expenses into sorted categories", () => {
    const breakdown = getExpenseCategoryTotals(expenses.filter(expense => expense.date.startsWith("2026-04")));
    expect(breakdown.map(category => [category.id, category.amount, category.sharePercent])).toEqual([
      ["maintenance", 1200, 60],
      ["utilities", 800, 40],
    ]);
  });

  it("builds six chronological months ending at the selected report month", () => {
    const flow = getSixMonthCashFlow("2026-04", invoices, expenses);
    expect(flow.map(item => item.period)).toEqual([
      "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
    ]);
    expect(flow.at(-1)).toMatchObject({ income: 12000, expenses: 2000 });
  });
});
