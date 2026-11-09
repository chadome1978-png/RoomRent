import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, FileText, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatPeriod, currentPeriod, shiftPeriod, type RentalExpense, type RentalInvoice } from "./types";
import { EXPENSE_CATEGORIES, getExpenseCategoryTotals, getExpensesForMonth, getMonthlyFinanceSummary, getPaidInvoicesForMonth, getPendingInvoicesForMonth, getSixMonthCashFlow } from "./finance";

function compactMoney(value: number) {
  const amount = Math.abs(value);
  if (amount >= 1_000_000) return `${(value / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)} ล.`;
  if (amount >= 10_000) return `${Math.round(value / 1_000)} พัน`;
  return value.toLocaleString("th-TH");
}

type Props = {
  period: string;
  invoices: RentalInvoice[];
  expenses: RentalExpense[];
  onPeriodChange: (period: string) => void;
  onAddExpense: () => void;
  onEditExpense: (expense: RentalExpense) => void;
  onDeleteExpense: (expense: RentalExpense) => void;
  onOpenInvoice: (invoice: RentalInvoice) => void;
  onViewUnpaid: () => void;
};

export function FinanceDashboard({ period, invoices, expenses, onPeriodChange, onAddExpense, onEditExpense, onDeleteExpense, onOpenInvoice, onViewUnpaid }: Props) {
  const summary = getMonthlyFinanceSummary(period, invoices, expenses);
  const chartData = getSixMonthCashFlow(period, invoices, expenses);
  const monthExpenses = getExpensesForMonth(period, expenses).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const paidInvoices = getPaidInvoicesForMonth(period, invoices).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const pendingInvoices = getPendingInvoicesForMonth(period, invoices);
  const categories = getExpenseCategoryTotals(monthExpenses);
  const today = currentPeriod();
  const chartHasData = chartData.some(item => item.income > 0 || item.expenses > 0);

  return (
    <div className="finance-view">
      <section className="section-intro finance-intro">
        <div><h2>เห็นเงินเข้า เงินออก และยอดคงเหลือในหน้าเดียว</h2><p>รายรับนับจากบิลที่ชำระแล้วตามรอบบิล ส่วนรายจ่ายนับจากวันที่บันทึก</p></div>
        <button className="button button-primary" onClick={onAddExpense}><Plus size={17} />บันทึกรายจ่าย</button>
      </section>

      <section className="finance-period-bar" aria-label="เลือกเดือนสำหรับสรุปการเงิน">
        <div className="finance-month-picker">
          <button className="icon-button" onClick={() => onPeriodChange(shiftPeriod(period, -1))} aria-label="เดือนก่อนหน้า"><ChevronLeft size={17} /></button>
          <label className="finance-month-field"><CalendarDays size={16} /><span>{formatPeriod(period)}</span><input aria-label="เลือกเดือน" type="month" value={period} max={today} onChange={event => event.target.value && onPeriodChange(event.target.value)} /></label>
          <button className="icon-button" onClick={() => onPeriodChange(shiftPeriod(period, 1))} aria-label="เดือนถัดไป" disabled={period >= today}><ChevronRight size={17} /></button>
        </div>
        <span className="finance-period-note">รายรับจัดกลุ่มตามรอบบิล ไม่ใช่วันที่โอนเงินจริง</span>
      </section>

      <section className="finance-kpis" aria-label={`สรุปรายรับรายจ่าย ${formatPeriod(period)}`}>
        <article className="finance-kpi finance-kpi-income"><div className="finance-kpi-top"><span>รายรับที่ชำระแล้ว</span><i><ArrowDownRight size={18} /></i></div><strong>{formatMoney(summary.income)}</strong><small>{summary.paidInvoiceCount} บิล · ตามรอบเดือน</small></article>
        <article className="finance-kpi finance-kpi-expense"><div className="finance-kpi-top"><span>รายจ่าย</span><i><ArrowUpRight size={18} /></i></div><strong>{formatMoney(summary.expenses)}</strong><small>{summary.expenseCount} รายการในเดือนนี้</small></article>
        <article className={`finance-kpi finance-kpi-net${summary.net < 0 ? " is-negative" : ""}`}><div className="finance-kpi-top"><span>เงินคงเหลือสุทธิ</span><i><Wallet size={18} /></i></div><strong>{formatMoney(summary.net)}</strong><small>รายรับลบรายจ่าย</small></article>
        <article className="finance-kpi finance-kpi-pending"><div className="finance-kpi-top"><span>ยอดค้างชำระ</span><i><CircleDollarSign size={18} /></i></div><strong>{formatMoney(summary.pending)}</strong><small>{summary.pendingInvoiceCount} บิลที่ยังไม่ชำระ</small>{summary.pendingInvoiceCount > 0 && <button onClick={onViewUnpaid}>ดูบิลค้าง <ArrowRight size={13} /></button>}</article>
      </section>

      <section className="panel finance-chart-panel">
        <div className="panel-heading finance-panel-heading"><div><span className="eyebrow">กระแสเงินสด 6 เดือน</span><h3>รายรับเทียบรายจ่าย</h3></div><span className="finance-chart-icon"><BarChart3 size={19} /></span></div>
        <div className="finance-chart-canvas" role="img" aria-label="กราฟเปรียบเทียบรายรับจากบิลชำระแล้วและรายจ่ายรายเดือนย้อนหลัง 6 เดือน">
          {chartHasData ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 2, bottom: 0 }} barGap={7}>
              <CartesianGrid stroke="#2b3931" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#aab7ae", fontSize: 11 }} axisLine={{ stroke: "#344239" }} tickLine={false} dy={8} />
              <YAxis tickFormatter={compactMoney} tick={{ fill: "#8f9d94", fontSize: 10 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(value: number | string) => formatMoney(Number(value))} labelFormatter={label => `เดือน ${label}`} contentStyle={{ background: "#18211d", border: "1px solid #344239", borderRadius: 10, color: "#e7efe9" }} itemStyle={{ color: "#e7efe9" }} />
              <Legend wrapperStyle={{ color: "#aab7ae", fontSize: 11, paddingTop: 12 }} />
              <Bar dataKey="income" name="รายรับชำระแล้ว" fill="#55c9b2" radius={[5, 5, 0, 0]} maxBarSize={27} />
              <Bar dataKey="expenses" name="รายจ่าย" fill="#d7a44c" radius={[5, 5, 0, 0]} maxBarSize={27} />
            </BarChart>
          </ResponsiveContainer>
          ) : <div className="finance-chart-empty"><span><BarChart3 size={20} /></span><strong>กราฟจะแสดงเมื่อมีรายการ</strong><small>ชำระบิลหรือบันทึกรายจ่าย เพื่อเริ่มดูแนวโน้ม 6 เดือน</small></div>}
        </div>
      </section>

      <div className="finance-detail-grid">
        <section className="panel finance-subpanel">
          <div className="panel-heading finance-panel-heading"><div><span className="eyebrow">เดือน {formatPeriod(period)}</span><h3>รายจ่ายแยกตามหมวด</h3></div></div>
          {categories.length ? <div className="finance-category-list">{categories.map(category => <div className="finance-category-row" key={category.id}><div className="finance-category-meta"><span><i style={{ background: category.color }} />{category.label}</span><strong>{formatMoney(category.amount)}</strong></div><div className="finance-category-track"><i style={{ width: `${category.sharePercent}%`, background: category.color }} /></div><small>{category.count} รายการ · {category.sharePercent}%</small></div>)}</div> : <div className="finance-empty"><span className="finance-empty-icon"><Wallet size={18} /></span><strong>ยังไม่มีรายจ่ายในเดือนนี้</strong><span>เพิ่มรายการเพื่อดูสัดส่วนค่าใช้จ่าย</span><button className="button button-outline button-sm" onClick={onAddExpense}><Plus size={14} />เพิ่มรายจ่าย</button></div>}
        </section>

        <section className="panel finance-subpanel">
          <div className="panel-heading finance-panel-heading"><div><span className="eyebrow">รายรับในรอบบิล</span><h3>บิลที่ชำระแล้ว</h3></div><span className="finance-count-badge">{paidInvoices.length} บิล</span></div>
          {paidInvoices.length ? <div className="finance-ledger-list">{paidInvoices.map(invoice => <button className="finance-ledger-row" key={invoice.id} onClick={() => onOpenInvoice(invoice)}><span className="finance-ledger-icon"><FileText size={16} /></span><span className="finance-ledger-copy"><strong>ห้อง {invoice.roomNumber}</strong><small>{invoice.tenantName} · {formatPeriod(invoice.period)}</small></span><b>{formatMoney(invoice.totalAmount)}</b></button>)}</div> : <div className="finance-empty compact"><span className="finance-empty-icon"><CircleDollarSign size={18} /></span><strong>ยังไม่มีบิลที่ชำระแล้ว</strong><span>บิลที่ยังค้างจะแสดงแยกในยอดค้างชำระ</span></div>}
        </section>
      </div>

      <section className="panel finance-expenses-panel">
        <div className="panel-heading finance-panel-heading"><div><span className="eyebrow">{formatPeriod(period)}</span><h3>รายการรายจ่าย</h3></div><button className="text-button" onClick={onAddExpense}><Plus size={15} />เพิ่มรายการ</button></div>
        {monthExpenses.length ? <div className="finance-expense-list"><div className="finance-expense-head"><span>วันที่</span><span>หมวด</span><span>รายละเอียด</span><span>จำนวนเงิน</span><span /></div>{monthExpenses.map(expense => <div className="finance-expense-row" key={expense.id}><span className="finance-expense-date">{new Date(`${expense.date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span><span className="finance-expense-category">{EXPENSE_CATEGORIES.find(category => category.id === expense.category)?.label ?? "อื่น ๆ"}</span><span className="finance-expense-description"><strong>{expense.description}</strong>{expense.note && <small>{expense.note}</small>}</span><strong className="finance-expense-amount">{formatMoney(expense.amount)}</strong><span className="finance-expense-actions"><button className="icon-button" aria-label={`แก้ไขรายจ่าย ${expense.description}`} onClick={() => onEditExpense(expense)}><Pencil size={14} /><span className="sr-only">แก้ไข</span></button><button className="icon-button expense-delete" aria-label={`ลบรายจ่าย ${expense.description}`} onClick={() => onDeleteExpense(expense)}><Trash2 size={14} /><span className="sr-only">ลบ</span></button></span></div>)}</div> : <div className="finance-empty finance-expense-empty"><span className="finance-empty-icon"><Wallet size={18} /></span><strong>ยังไม่มีรายการรายจ่ายในเดือนนี้</strong><span>บันทึกค่าซ่อมบำรุง ค่าสาธารณูปโภค หรือค่าใช้จ่ายอื่น ๆ</span><button className="button button-primary button-sm" onClick={onAddExpense}><Plus size={14} />บันทึกรายจ่าย</button></div>}
      </section>
    </div>
  );
}
