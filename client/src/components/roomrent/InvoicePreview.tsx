import { Check, Copy, FileText, Pencil, Printer, QrCode, Settings2, Share2, X } from "lucide-react";
import { useState } from "react";
import { PromptPayQr } from "./PromptPayQr";
import { formatMoney, formatPeriod, formatThaiDate, type PromptPaySettings, type RentalInvoice } from "./types";

type Props = {
  invoice: RentalInvoice;
  onClose: () => void;
  onSetPaid: (invoice: RentalInvoice) => void;
  onEdit: (invoice: RentalInvoice) => void;
  onConfigurePromptPay: () => void;
  promptPaySettings?: PromptPaySettings;
  busy?: boolean;
};

function invoiceMessage(invoice: RentalInvoice) {
  const extras = (invoice.extras || []).map(item => `• ${item.label}: ${formatMoney(item.amount)}`).join("\n");
  return [
    `บิลค่าเช่าห้อง ${invoice.roomNumber} · รอบ ${formatPeriod(invoice.period)}`,
    `ผู้เช่า: ${invoice.tenantName}`,
    "",
    `ค่าเช่า ${formatMoney(invoice.rentAmount)}`,
    `ค่าน้ำ ${Number(invoice.waterUnits).toLocaleString("th-TH")} หน่วย × ${formatMoney(invoice.waterRate)} = ${formatMoney(invoice.waterAmount)}`,
    `ค่าไฟ ${Number(invoice.electricUnits).toLocaleString("th-TH")} หน่วย × ${formatMoney(invoice.electricRate)} = ${formatMoney(invoice.electricAmount)}`,
    extras,
    "",
    `ยอดรวม ${formatMoney(invoice.totalAmount)}`,
    `ครบกำหนด ${formatThaiDate(invoice.dueDate)}`,
    invoice.note ? `หมายเหตุ: ${invoice.note}` : "",
    "ขอบคุณค่ะ/ครับ",
  ].filter(Boolean).join("\n");
}

export function InvoicePreview({ invoice, onClose, onSetPaid, onEdit, onConfigurePromptPay, promptPaySettings, busy }: Props) {
  const [copied, setCopied] = useState(false);
  const totalExtras = (invoice.extras || []).reduce((sum, item) => sum + Number(item.amount), 0);

  async function copyText() {
    const text = invoiceMessage(invoice);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  function shareLine() {
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(invoiceMessage(invoice))}`;
    window.open(lineUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="dialog-scrim invoice-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="invoice-dialog" role="dialog" aria-modal="true" aria-labelledby="invoice-title">
        <header className="invoice-toolbar">
          <div className="invoice-toolbar-title"><div className="mini-icon"><FileText size={17} /></div><div><span className="eyebrow">ตัวอย่างบิล</span><h2 id="invoice-title">ห้อง {invoice.roomNumber} · {formatPeriod(invoice.period)}</h2></div></div>
          <button className="icon-button" onClick={onClose} aria-label="ปิด"><X size={19} /></button>
        </header>
        <div className="invoice-scroll">
          <article className="printable-invoice">
            <div className="invoice-paper-heading">
              <div className="invoice-brand-symbol">R</div>
              <div><strong>ROOMRENT</strong><span>ใบแจ้งค่าเช่าห้องพักรายเดือน</span></div>
              <div className={`payment-stamp ${invoice.status === "paid" ? "is-paid" : "is-unpaid"}`}>{invoice.status === "paid" ? "ชำระแล้ว" : "รอชำระ"}</div>
            </div>
            <div className="invoice-paper-meta">
              <div><span>ผู้เช่า</span><strong>{invoice.tenantName}</strong><small>ห้อง {invoice.roomNumber}{invoice.phone ? ` · ${invoice.phone}` : ""}</small></div>
              <div className="meta-dates"><span>รอบบิล</span><strong>{formatPeriod(invoice.period)}</strong><small>ครบกำหนด {formatThaiDate(invoice.dueDate)}</small></div>
            </div>
            <div className="invoice-lines">
              <div className="invoice-line invoice-line-head"><span>รายการ</span><span>รายละเอียด</span><span>จำนวนเงิน</span></div>
              <div className="invoice-line"><span>ค่าเช่าห้อง</span><span>ค่าเช่ารายเดือน</span><strong>{formatMoney(invoice.rentAmount)}</strong></div>
              <div className="invoice-line"><span>ค่าน้ำ</span><span>{Number(invoice.waterCurrent).toLocaleString("th-TH")} − {Number(invoice.waterPrevious).toLocaleString("th-TH")} = {Number(invoice.waterUnits).toLocaleString("th-TH")} หน่วย × {formatMoney(invoice.waterRate)}</span><strong>{formatMoney(invoice.waterAmount)}</strong></div>
              <div className="invoice-line"><span>ค่าไฟ</span><span>{Number(invoice.electricCurrent).toLocaleString("th-TH")} − {Number(invoice.electricPrevious).toLocaleString("th-TH")} = {Number(invoice.electricUnits).toLocaleString("th-TH")} หน่วย × {formatMoney(invoice.electricRate)}</span><strong>{formatMoney(invoice.electricAmount)}</strong></div>
              {(invoice.extras || []).map((item, index) => <div className="invoice-line" key={`${item.label}-${index}`}><span>{item.label}</span><span>รายการเพิ่มเติม</span><strong>{formatMoney(item.amount)}</strong></div>)}
              {totalExtras === 0 && <div className="invoice-line invoice-line-muted"><span>ยอดค่าใช้จ่ายเพิ่มเติม</span><span>—</span><strong>{formatMoney(0)}</strong></div>}
            </div>
            <div className="invoice-total"><span>ยอดรวมสุทธิ</span><strong>{formatMoney(invoice.totalAmount)}</strong></div>
            {invoice.note && <div className="invoice-note"><span>หมายเหตุ</span><p>{invoice.note}</p></div>}
            {invoice.status === "unpaid" ? (
              <section className="invoice-payment" aria-label="QR PromptPay สำหรับชำระบิล">
                <div className="invoice-payment-heading">
                  <div><span>ชำระผ่าน PromptPay</span><strong>{promptPaySettings?.recipientName ?? "ยังไม่ได้ตั้งค่าผู้รับเงิน"}</strong></div>
                  <button className="text-button no-print" onClick={onConfigurePromptPay}><Settings2 size={14} />{promptPaySettings ? "แก้ไขข้อมูลรับเงิน" : "ตั้งค่า PromptPay"}</button>
                </div>
                {promptPaySettings
                  ? <PromptPayQr settings={promptPaySettings} amount={invoice.totalAmount} />
                  : <div className="promptpay-not-configured"><QrCode size={24} /><span>ตั้งค่า PromptPay ID เพื่อสร้าง QR ที่ระบุยอดบิลนี้</span></div>}
              </section>
            ) : (
              <div className="invoice-payment-paid">บิลนี้ชำระแล้ว · ซ่อน QR เพื่อป้องกันการชำระซ้ำ</div>
            )}
            <footer className="invoice-paper-footer"><span>ออกบิล {formatThaiDate(invoice.issuedAt)}</span><span>ขอบคุณที่ใช้บริการ</span></footer>
          </article>
        </div>
        <footer className="invoice-actions">
          {invoice.status === "unpaid" && <button className="button button-outline" onClick={() => onEdit(invoice)}><Pencil size={16} />แก้ไขบิล</button>}
          <button className="button button-quiet" onClick={copyText}><Copy size={16} />{copied ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}</button>
          <button className="button line-button" onClick={shareLine}><Share2 size={16} />ส่งทาง LINE</button>
          <button className="button button-outline print-button" onClick={() => window.print()}><Printer size={16} />พิมพ์ / บันทึก PDF</button>
          <button className={`button ${invoice.status === "paid" ? "button-quiet" : "button-primary"}`} disabled={busy} onClick={() => onSetPaid(invoice)}><Check size={16} />{invoice.status === "paid" ? "ยกเลิกชำระ" : "บันทึกว่าชำระแล้ว"}</button>
        </footer>
      </section>
    </div>
  );
}
