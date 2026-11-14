import { useState } from "react";
import { QrCode, X } from "lucide-react";
import type { PromptPaySettings } from "./types";
import { isValidPromptPayId, normalizePromptPayId } from "./promptpay";
import { getPromptPayStorageDisclosure } from "./storageCopy";

type Props = {
  isSharedDataset: boolean;
  settings?: PromptPaySettings;
  onClose: () => void;
  onSave: (settings: PromptPaySettings) => void;
};

export function PromptPaySettingsDialog({ isSharedDataset, settings, onClose, onSave }: Props) {
  const storageDisclosure = getPromptPayStorageDisclosure(isSharedDataset);
  const [id, setId] = useState(settings?.id ?? "");
  const [recipientName, setRecipientName] = useState(settings?.recipientName ?? "");
  const [error, setError] = useState("");

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedId = normalizePromptPayId(id);
    const normalizedName = recipientName.trim();
    if (!isValidPromptPayId(normalizedId)) {
      setError("กรุณาตรวจสอบ ID: เบอร์มือถือ 10 หลักที่ขึ้นต้นด้วย 0, เลขบัตร/ผู้เสียภาษี 13 หลัก หรือ e-Wallet 15 หลัก");
      return;
    }
    if (!normalizedName) {
      setError("กรุณาระบุชื่อผู้รับเงินเพื่อให้ผู้เช่าตรวจสอบก่อนชำระ");
      return;
    }
    if (normalizedName.length > 80) {
      setError("ชื่อผู้รับเงินต้องไม่เกิน 80 ตัวอักษร");
      return;
    }
    onSave({ id: normalizedId, recipientName: normalizedName });
  }

  return (
    <div className="dialog-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="dialog-panel payment-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="promptpay-settings-title">
        <header className="dialog-header">
          <div>
            <span className="eyebrow">ตั้งค่ารับชำระ</span>
            <h2 id="promptpay-settings-title"><QrCode size={20} />PromptPay QR</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="ปิด"><X size={19} /></button>
        </header>
        <form className="dialog-form payment-settings-form" onSubmit={save}>
          <div className="payment-settings-notice">
            <strong>{storageDisclosure.title}</strong>
            <span>{storageDisclosure.description}</span>
          </div>
          <label className="field">
            <span>PromptPay ID *</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              value={id}
              onChange={event => { setId(event.target.value); setError(""); }}
              placeholder="เบอร์มือถือ / เลขบัตรหรือผู้เสียภาษี / e-Wallet"
              aria-invalid={Boolean(error)}
            />
          </label>
          <p className="payment-settings-help">รองรับเบอร์มือถือ 10 หลักที่ขึ้นต้นด้วย 0, เลขบัตรประชาชนหรือเลขผู้เสียภาษี 13 หลัก และ e-Wallet 15 หลัก พิมพ์ขีดหรือเว้นวรรคได้</p>
          <label className="field">
            <span>ชื่อผู้รับเงินที่ต้องการให้แสดงบนบิล *</span>
            <input
              type="text"
              maxLength={80}
              autoComplete="name"
              value={recipientName}
              onChange={event => { setRecipientName(event.target.value); setError(""); }}
              placeholder="ชื่อบัญชีหรือชื่อผู้รับเงิน"
            />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="dialog-footer">
            <button className="button button-quiet" type="button" onClick={onClose}>ยกเลิก</button>
            <button className="button button-primary" type="submit">บันทึก PromptPay</button>
          </div>
        </form>
      </section>
    </div>
  );
}
