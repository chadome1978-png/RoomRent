import { useRef, useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import {
  EMAIL_VERIFICATION_COOLDOWN,
  EmailVerificationError,
  getEmailVerificationErrorMessage,
  isVerificationEmail,
} from "./emailVerification";

type Props = {
  initialEmail: string;
  busy: boolean;
  resendCooldown: number;
  onStartCooldown(seconds: number): void;
  onResend(email: string): Promise<void>;
  onVerify(email: string, token: string): Promise<void>;
  onBack(): void;
};

export function EmailVerificationForm({ initialEmail, busy, resendCooldown, onStartCooldown, onResend, onVerify, onBack }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [action, setAction] = useState<"resend" | "verify" | null>(null);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const disabled = busy || action !== null;

  async function requestCode() {
    if (disabled || inFlight.current || resendCooldown > 0) return;
    if (!isVerificationEmail(email)) {
      setMessage("");
      setError(getEmailVerificationErrorMessage(new EmailVerificationError("email")));
      return;
    }
    inFlight.current = true;
    setAction("resend");
    setError("");
    setMessage("");
    setOtp("");
    onStartCooldown(EMAIL_VERIFICATION_COOLDOWN);
    try {
      await onResend(email.trim());
      setMessage("หากอีเมลนี้มีบัญชีที่ยังไม่ยืนยัน ระบบจะส่งอีเมลให้ โปรดใช้รหัส OTP จากฉบับล่าสุดและตรวจ Spam/Junk ด้วย");
    } catch (error) {
      setError(getEmailVerificationErrorMessage(error));
    } finally {
      inFlight.current = false;
      setAction(null);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || inFlight.current) return;
    setError("");
    setMessage("");
    if (!isVerificationEmail(email) || !/^[0-9]{6}$/.test(otp.trim())) {
      setError(getEmailVerificationErrorMessage(new EmailVerificationError(!isVerificationEmail(email) ? "email" : "format")));
      return;
    }
    const code = otp.trim();
    inFlight.current = true;
    setAction("verify");
    setOtp("");
    try {
      await onVerify(email.trim(), code);
      setMessage("ยืนยันอีเมลสำเร็จแล้ว กำลังโหลดบัญชี Cloud; ข้อมูลเดิมจะไม่ถูกอัปโหลดโดยอัตโนมัติ");
    } catch (error) {
      setError(getEmailVerificationErrorMessage(error));
    } finally {
      inFlight.current = false;
      setAction(null);
    }
  }

  return (
    <form className="supabase-login-form email-verification-form" onSubmit={event => void verifyCode(event)} aria-label="ยืนยันอีเมลด้วยรหัส OTP" aria-busy={disabled}>
      <p className="email-verification-intro">กรอกอีเมลที่ใช้สมัครและรหัสจากอีเมลฉบับล่าสุด ขั้นตอนนี้ยืนยันอีเมล ไม่ได้สร้างชื่อผู้ใช้ใหม่หรือย้ายข้อมูลขึ้น Cloud</p>
      <label htmlFor="roomrent-verification-email">
        <span>อีเมลที่ใช้สมัคร</span>
        <input id="roomrent-verification-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} disabled={disabled} value={email} onChange={event => { setEmail(event.target.value); setOtp(""); setError(""); setMessage(""); }} />
      </label>
      <label htmlFor="roomrent-verification-otp">
        <span>รหัส OTP 6 หลัก</span>
        <input id="roomrent-verification-otp" className="email-verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} required pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="กรอกรหัส 6 หลัก" disabled={disabled} value={otp} onChange={event => { setOtp(event.target.value); setError(""); setMessage(""); }} aria-describedby="roomrent-verification-hint" />
      </label>
      <p id="roomrent-verification-hint" className="email-verification-hint">ไม่ต้องกรอกรหัสผ่าน รหัส OTP ใช้ครั้งเดียวและมีวันหมดอายุตามการตั้งค่า Supabase; อย่าส่งรหัสให้ผู้อื่น</p>
      <div className="supabase-panel-actions">
        <button type="submit" className="button button-primary button-sm" disabled={disabled || !isVerificationEmail(email) || !/^[0-9]{6}$/.test(otp.trim())}><ShieldCheck size={15} />{action === "verify" ? "กำลังยืนยัน…" : "ยืนยันรหัส OTP"}</button>
        <button type="button" className="button button-outline button-sm" disabled={disabled || !isVerificationEmail(email) || resendCooldown > 0} onClick={() => void requestCode()}><Mail size={15} />{action === "resend" ? "กำลังส่งคำขอ…" : resendCooldown > 0 ? `ขอรหัสใหม่ได้ใน ${resendCooldown} วินาที` : "ส่งอีเมลยืนยัน / ขอรหัสใหม่"}</button>
        <button type="button" className="button button-quiet button-sm" disabled={disabled} onClick={() => { setOtp(""); onBack(); }}>กลับไปเข้าสู่ระบบ</button>
      </div>
      {error && <p className="supabase-panel-error" role="alert">{error}</p>}
      {message && <p className="supabase-panel-message" role="status" aria-live="polite">{message}</p>}
    </form>
  );
}
