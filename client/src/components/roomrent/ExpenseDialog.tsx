import { Wallet, X } from "lucide-react";
import { useState } from "react";
import { EXPENSE_CATEGORIES } from "./finance";
import type { ExpenseDraft, ExpenseCategory, RentalExpense } from "./types";
import { getExpenseStorageDisclosure } from "./storageCopy";

type Props = {
  isSharedDataset: boolean;
  expense?: RentalExpense;
  onClose: () => void;
  onSave: (values: ExpenseDraft) => void;
};

function todayLocalDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function ExpenseDialog({ isSharedDataset, expense, onClose, onSave }: Props) {
  const storageDisclosure = getExpenseStorageDisclosure(isSharedDataset);
  const [date, setDate] = useState(expense?.date ?? todayLocalDate());
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "maintenance");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [note, setNote] = useState(expense?.note ?? "");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDescription = description.trim();
    const numericAmount = Number(amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError("กรุณาเลือกวันที่ให้ถูกต้อง"); return; }
    const [year, month, day] = date.split("-").map(Number);
    const parsedDate = new Date(year, month - 1, day);
    if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) { setError("วันที่นี้ไม่มีอยู่จริง"); return; }
    if (!trimmedDescription) { setError("กรุณาระบุรายละเอียดรายจ่าย"); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError("จำนวนเงินต้องมากกว่าศูนย์"); return; }
    onSave({ date, category, description: trimmedDescription, amount: Math.round((numericAmount + Number.EPSILON) * 100) / 100, note: note.trim() });
  }

  return (
    <div className="dialog-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="dialog-panel expense-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-dialog-title">
        <header className="dialog-header"><div><span className="eyebrow">{storageDisclosure.title}</span><h2 id="expense-dialog-title"><Wallet size={18} />{expense ? "แก้ไขรายจ่าย" : "บันทึกรายจ่าย"}</h2></div><button className="icon-button" onClick={onClose} aria-label="ปิด"><X size={18} /></button></header>
        <form className="dialog-form expense-form" onSubmit={submit}>
          <div className="form-grid two-col"><label className="field"><span>วันที่ <i>*</i></span><input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label><label className="field"><span>หมวดหมู่ <i>*</i></span><div className="select-wrap"><select value={category} onChange={event => setCategory(event.target.value as ExpenseCategory)}>{EXPENSE_CATEGORIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div></label></div>
          <label className="field"><span>รายละเอียด <i>*</i></span><input value={description} onChange={event => setDescription(event.target.value)} maxLength={100} placeholder="เช่น ซ่อมปั๊มน้ำ ซื้อหลอดไฟ" required /></label>
          <label className="field"><span>จำนวนเงิน (บาท) <i>*</i></span><input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" required /></label>
          <label className="field"><span>หมายเหตุ</span><textarea className="expense-note-input" value={note} onChange={event => setNote(event.target.value)} maxLength={300} rows={3} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" /></label>
          <p className="expense-local-note">{storageDisclosure.description}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-footer expense-dialog-footer"><button type="button" className="button button-quiet" onClick={onClose}>ยกเลิก</button><button type="submit" className="button button-primary">{expense ? "บันทึกการแก้ไข" : "บันทึกรายจ่าย"}</button></div>
        </form>
      </section>
    </div>
  );
}
