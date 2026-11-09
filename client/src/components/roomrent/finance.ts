import { shiftPeriod } from "./types";
import type { ExpenseCategory, RentalExpense, RentalInvoice } from "./types";

export const EXPENSE_CATEGORIES: Array<{ id: ExpenseCategory; label: string; color: string }> = [
  { id: "maintenance", label: "ซ่อมบำรุง", color: "#64c8a8" },
  { id: "utilities", label: "ค่าน้ำ/ไฟส่วนกลาง", color: "#73a9df" },
  { id: "cleaning", label: "ทำความสะอาด", color: "#b58be0" },
  { id: "staff", label: "ค่าจ้าง/พนักงาน", color: "#e0ad5e" },
  { id: "supplies", label: "วัสดุและของใช้", color: "#e08370" },
  { id: "tax", label: "ภาษี/ค่าธรรมเนียม", color: "#7fbd78" },
  { id: "other", label: "อื่น ๆ", color: "#98a79e" },
];

export type InvoiceFinanceRecord = Pick<RentalInvoice, "period" | "status" | "totalAmount">;
export type ExpenseFinanceRecord = Pick<RentalExpense, "date" | "amount" | "category">;

export type MonthlyFinanceSummary = {
  income: number;
  pending: number;
  expenses: number;
  net: number;
  paidInvoiceCount: number;
  pendingInvoiceCount: number;
  expenseCount: number;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sumAmounts(records: Array<{ amount: number }>) {
  return roundMoney(records.reduce((sum, record) => sum + record.amount, 0));
}

export function getMonthlyFinanceSummary(
  period: string,
  invoices: readonly InvoiceFinanceRecord[],
  expenses: readonly ExpenseFinanceRecord[],
): MonthlyFinanceSummary {
  const monthInvoices = invoices.filter(invoice => invoice.period === period);
  const paidInvoices = monthInvoices.filter(invoice => invoice.status === "paid");
  const pendingInvoices = monthInvoices.filter(invoice => invoice.status === "unpaid");
  const monthExpenses = expenses.filter(expense => expense.date.slice(0, 7) === period);
  const income = sumAmounts(paidInvoices.map(invoice => ({ amount: invoice.totalAmount })));
  const expenseTotal = sumAmounts(monthExpenses.map(expense => ({ amount: expense.amount })));
  return {
    income,
    pending: sumAmounts(pendingInvoices.map(invoice => ({ amount: invoice.totalAmount }))),
    expenses: expenseTotal,
    net: roundMoney(income - expenseTotal),
    paidInvoiceCount: paidInvoices.length,
    pendingInvoiceCount: pendingInvoices.length,
    expenseCount: monthExpenses.length,
  };
}

export function getExpenseCategoryTotals(expenses: readonly ExpenseFinanceRecord[]) {
  const totals = new Map<ExpenseCategory, number>();
  for (const expense of expenses) {
    totals.set(expense.category, roundMoney((totals.get(expense.category) ?? 0) + expense.amount));
  }
  const all = sumAmounts([...totals.values()].map(amount => ({ amount })));
  return EXPENSE_CATEGORIES
    .map(category => {
      const amount = totals.get(category.id) ?? 0;
      return {
        ...category,
        amount,
        count: expenses.filter(expense => expense.category === category.id).length,
        sharePercent: all > 0 ? Math.round((amount / all) * 100) : 0,
      };
    })
    .filter(category => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function getSixMonthCashFlow(
  endPeriod: string,
  invoices: readonly InvoiceFinanceRecord[],
  expenses: readonly ExpenseFinanceRecord[],
) {
  return Array.from({ length: 6 }, (_, index) => {
    const period = shiftPeriod(endPeriod, index - 5);
    const [year, month] = period.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
    const summary = getMonthlyFinanceSummary(period, invoices, expenses);
    return { period, label, income: summary.income, expenses: summary.expenses };
  });
}

export function getExpensesForMonth(period: string, expenses: readonly RentalExpense[]) {
  return expenses.filter(expense => expense.date.slice(0, 7) === period);
}

export function getPaidInvoicesForMonth(period: string, invoices: readonly RentalInvoice[]) {
  return invoices.filter(invoice => invoice.period === period && invoice.status === "paid");
}

export function getPendingInvoicesForMonth(period: string, invoices: readonly RentalInvoice[]) {
  return invoices.filter(invoice => invoice.period === period && invoice.status === "unpaid");
}
