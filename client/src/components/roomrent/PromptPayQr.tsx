import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatMoney, type PromptPaySettings } from "./types";
import { createPromptPayPayload } from "./promptpay";

type Props = {
  settings: PromptPaySettings;
  amount: number;
};

export function PromptPayQr({ settings, amount }: Props) {
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setDataUrl("");
    setError("");

    try {
      const payload = createPromptPayPayload(settings.id, amount);
      void QRCode.toDataURL(payload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 300,
        color: { dark: "#111816", light: "#ffffff" },
      }).then(result => {
        if (current) setDataUrl(result);
      }).catch(() => {
        if (current) setError("สร้าง QR ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า PromptPay");
      });
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "สร้าง QR ไม่สำเร็จ");
    }

    return () => { current = false; };
  }, [settings.id, amount]);

  return (
    <div className="promptpay-qr-block" aria-live="polite">
      <div className="promptpay-qr-image">
        {dataUrl
          ? <img src={dataUrl} alt={`QR PromptPay ยอด ${formatMoney(amount)} รับโดย ${settings.recipientName}`} />
          : <span className={error ? "promptpay-qr-error" : "promptpay-qr-loading"}>{error || "กำลังสร้าง QR…"}</span>}
      </div>
      <div className="promptpay-qr-details">
        <span className="promptpay-qr-label">สแกนจ่ายตามยอดบิล</span>
        <strong>{formatMoney(amount)}</strong>
        <span>ผู้รับเงิน: {settings.recipientName}</span>
        <small>PromptPay ····{settings.id.slice(-4)}</small>
        <small className="promptpay-qr-hint">ตรวจสอบชื่อผู้รับและยอดในแอปธนาคารก่อนยืนยัน</small>
      </div>
    </div>
  );
}
