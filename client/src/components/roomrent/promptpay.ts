import generatePromptPayPayload from "promptpay-qr";

export function normalizePromptPayId(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidPromptPayId(value: string) {
  const id = normalizePromptPayId(value);
  return (id.length === 10 && id.startsWith("0")) || id.length === 13 || id.length === 15;
}

export function createPromptPayPayload(idValue: string, amount: number) {
  const id = normalizePromptPayId(idValue);
  if (!isValidPromptPayId(id)) {
    throw new Error("PromptPay ID ต้องเป็นเบอร์มือถือ 10 หลักที่ขึ้นต้นด้วย 0, เลข 13 หลัก หรือ e-Wallet 15 หลัก");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("ยอดชำระต้องมากกว่า 0 บาท");
  }
  const amountInBaht = Math.round((amount + Number.EPSILON) * 100) / 100;
  return generatePromptPayPayload(id, { amount: amountInBaht });
}
