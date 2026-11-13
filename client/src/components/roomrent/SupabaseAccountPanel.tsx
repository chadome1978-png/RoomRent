import { useEffect, useState } from "react";
import { Cloud, CloudOff, Database, LoaderCircle, LogIn, LogOut, ShieldCheck, UploadCloud } from "lucide-react";
import type { LocalDatabase } from "./types";
import { getUsernameLoginErrorMessage } from "./usernameLogin";
import { EmailVerificationForm } from "./EmailVerificationForm";
import { EMAIL_VERIFICATION_COOLDOWN } from "./emailVerification";

type Props = {
  configured: boolean;
  loading: boolean;
  email?: string;
  ready: boolean;
  hasCloudData: boolean;
  sourceData: LocalDatabase;
  error: string;
  busy: boolean;
  onSignIn(username: string, password: string): Promise<void>;
  onSignUp(email: string, password: string): Promise<boolean>;
  onResendVerification(email: string): Promise<void>;
  onVerifyEmailOtp(email: string, token: string): Promise<void>;
  onSignOut(): Promise<void>;
  onDownloadBackup(): void;
  onMigrateLocalData(): Promise<void>;
  onInitializeEmpty(): Promise<void>;
};

export function SupabaseAccountPanel({ configured, loading, email, ready, hasCloudData, sourceData, error, busy, onSignIn, onSignUp, onResendVerification, onVerifyEmailOtp, onSignOut, onDownloadBackup, onMigrateLocalData, onInitializeEmpty }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [emailInput, setEmailInput] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [password, setPassword] = useState("");
  const [backupChecked, setBackupChecked] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const hasSourceContent = sourceData.rooms.length + sourceData.invoices.length + sourceData.expenses.length > 0 || Boolean(sourceData.promptPay);
  const displayError = formError || error;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || actionBusy) return;
    setActionBusy(true);
    setFormError("");
    setMessage("");
    try {
      if (mode === "signin") await onSignIn(emailInput, password);
      else if (await onSignUp(emailInput, password)) {
        setVerificationEmail(emailInput.trim());
        setPassword("");
        setShowVerification(true);
        setResendCooldown(EMAIL_VERIFICATION_COOLDOWN);
        setMessage("ส่งคำขอสมัครแล้ว โปรดใช้รหัส OTP จากอีเมลฉบับล่าสุดเพื่อยืนยันบัญชี");
      }
    } catch (error) {
      setFormError(mode === "signin" ? getUsernameLoginErrorMessage(error) : "สร้างบัญชีไม่สำเร็จ โปรดลองอีกครั้ง");
    } finally {
      setActionBusy(false);
    }
  }

  function openVerification() {
    setVerificationEmail(mode === "signup" ? emailInput.trim() : "");
    setPassword("");
    setFormError("");
    setMessage("");
    setShowVerification(true);
  }

  async function runAction(action: () => Promise<void>) {
    setActionBusy(true);
    setFormError("");
    setMessage("");
    try { await action(); }
    catch { setFormError("ดำเนินการไม่สำเร็จ โปรดลองอีกครั้ง"); }
    finally { setActionBusy(false); }
  }

  if (!configured) return (
    <section className="supabase-rooms-panel" aria-labelledby="supabase-account-title">
      <div className="supabase-panel-icon"><CloudOff size={19} /></div>
      <div className="supabase-panel-copy"><strong id="supabase-account-title">ยังไม่ได้ตั้งค่า Supabase</strong><span>ไม่พบตัวแปรสำหรับเชื่อมต่อ Supabase ใน build นี้ โปรดตั้งค่าในระบบ build แล้วเปิดแอปใหม่</span></div>
    </section>
  );

  if (loading) return (
    <section className="supabase-rooms-panel" aria-live="polite" role="status">
      <LoaderCircle className="supabase-spinner" size={18} /><div className="supabase-panel-copy"><strong>กำลังตรวจสอบบัญชี</strong><span>โปรดรอสักครู่</span></div>
    </section>
  );

  if (email && ready) return (
    <section className="supabase-rooms-panel is-connected" aria-labelledby="supabase-account-title">
      <div className="supabase-panel-icon"><ShieldCheck size={19} /></div>
      <div className="supabase-panel-copy"><strong id="supabase-account-title">ข้อมูลจัดเก็บใน Cloud แล้ว</strong><span>{email}</span><span>ห้อง บิล รายจ่าย และการตั้งค่า PromptPay จัดเก็บใน Cloud ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อใช้งาน</span></div>
      <div className="supabase-panel-actions"><button type="button" className="button button-quiet button-sm" disabled={busy || actionBusy} onClick={() => void runAction(onSignOut)}><LogOut size={15} />ออกจากระบบ</button></div>
      {displayError && <p className="supabase-panel-error" role="alert">{displayError}</p>}
    </section>
  );

  if (email) {
    const canMigrate = hasSourceContent && backupDownloaded && backupChecked && !busy && !actionBusy;
    const canInitialize = !hasSourceContent && !hasCloudData && !busy && !actionBusy;
    return (
      <section className="supabase-rooms-panel" aria-labelledby="supabase-account-title">
        <div className="supabase-panel-icon"><Database size={19} /></div>
        <div className="supabase-panel-copy"><strong id="supabase-account-title">เตรียมบัญชี Cloud · {email}</strong><span>{hasCloudData ? "พบข้อมูล Cloud ที่ต้องสำรองและยืนยันการรวมก่อนเปิดใช้งาน" : "ยังไม่มีข้อมูลพร้อมใช้งานใน Cloud บัญชีนี้ โปรดเลือกวิธีเริ่มต้น"}</span></div>
        <div className="supabase-panel-copy" aria-label="สรุปข้อมูลเดิมที่รอรวม">
          <strong>ข้อมูลเดิมที่รอรวม</strong>
          <span>{sourceData.rooms.length} ห้อง · {sourceData.invoices.length} บิล · {sourceData.expenses.length} รายจ่าย · PromptPay{sourceData.promptPay ? " ตั้งค่าแล้ว" : " ยังไม่ตั้งค่า"}</span>
          <span>จำนวนนี้รวมข้อมูลจากทุกแหล่งก่อนตรวจรายการซ้ำ</span>
          <span>ข้อมูลจากอุปกรณ์และตารางห้องแบบเดิมยังไม่ถูกส่งขึ้นหรือรวมโดยอัตโนมัติ</span>
        </div>
        {hasSourceContent && <div className="supabase-panel-copy">
          <button type="button" className="button button-outline button-sm" disabled={busy || actionBusy} onClick={() => { onDownloadBackup(); setBackupDownloaded(true); setBackupChecked(false); }}><UploadCloud size={15} />ดาวน์โหลดไฟล์สำรองในเครื่อง (JSON)</button>
          <label><input type="checkbox" checked={backupChecked} disabled={!backupDownloaded || busy || actionBusy} onChange={event => setBackupChecked(event.target.checked)} /> ฉันดาวน์โหลดและเก็บไฟล์สำรองไว้แล้ว</label>
          <button type="button" className="button button-primary button-sm" disabled={!canMigrate} onClick={() => void runAction(onMigrateLocalData)}><UploadCloud size={15} />สำรองและย้าย/รวมข้อมูล ({sourceData.rooms.length} ห้อง · {sourceData.invoices.length} บิล · {sourceData.expenses.length} รายจ่าย{sourceData.promptPay ? " · PromptPay" : ""})</button>
        </div>}
        <div className="supabase-panel-copy">
          <strong>หรือเริ่มบัญชี Cloud เปล่า</strong>
          {(hasSourceContent || hasCloudData) && <span>ปิดตัวเลือกนี้ไว้เพื่อป้องกันการทิ้งหรือเขียนทับข้อมูลเดิม โปรดสำรองและรวมข้อมูลก่อน</span>}
          <button type="button" className="button button-outline button-sm" disabled={!canInitialize || hasSourceContent || hasCloudData} onClick={() => void runAction(onInitializeEmpty)}><Database size={15} />เริ่มบัญชี Cloud เปล่า</button>
        </div>
        {displayError && <p className="supabase-panel-error" role="alert">{displayError}</p>}
        {message && <p className="supabase-panel-message" role="status">{message}</p>}
      </section>
    );
  }

  return (
    <section className="supabase-rooms-panel supabase-login-panel" aria-labelledby="supabase-account-title">
      <div className="supabase-panel-icon"><Cloud size={19} /></div>
      <div className="supabase-panel-copy"><strong id="supabase-account-title">{showVerification ? "ยืนยันอีเมลด้วยรหัส OTP" : mode === "signin" ? "เข้าสู่ระบบ Supabase" : "สร้างบัญชี Supabase"}</strong><span>ข้อมูลในอุปกรณ์จะไม่ถูกอัปโหลดโดยอัตโนมัติ</span></div>
      {showVerification ? (
        <EmailVerificationForm
          initialEmail={verificationEmail}
          busy={busy || actionBusy}
          resendCooldown={resendCooldown}
          onStartCooldown={setResendCooldown}
          onResend={onResendVerification}
          onVerify={onVerifyEmailOtp}
          onBack={() => { setShowVerification(false); setVerificationEmail(""); setMode("signin"); setEmailInput(""); setPassword(""); setFormError(""); setMessage(""); }}
        />
      ) : (
        <form className="supabase-login-form" onSubmit={event => void submit(event)}>
          <label><span>{mode === "signin" ? "ชื่อผู้ใช้" : "อีเมล"}</span><input type={mode === "signin" ? "text" : "email"} autoComplete={mode === "signin" ? "username" : "email"} autoCapitalize="none" spellCheck={false} placeholder={mode === "signin" ? "เช่น bnkhouse" : undefined} required disabled={busy || actionBusy} value={emailInput} onChange={event => setEmailInput(event.target.value)} /></label>
          <label><span>{mode === "signin" ? "รหัสผ่าน" : "รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"}</span><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined} required disabled={busy || actionBusy} value={password} onChange={event => setPassword(event.target.value)} /></label>
          <div className="supabase-panel-actions"><button type="submit" className="button button-primary button-sm" disabled={busy || actionBusy}><LogIn size={15} />{actionBusy ? "กำลังดำเนินการ…" : mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}</button><button type="button" className="button button-quiet button-sm" disabled={busy || actionBusy} onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setEmailInput(""); setPassword(""); setFormError(""); setMessage(""); }}>{mode === "signin" ? "สมัครบัญชีใหม่" : "มีบัญชีแล้ว · เข้าสู่ระบบ"}</button></div>
          <div className="supabase-panel-actions"><button type="button" className="button button-outline button-sm" disabled={busy || actionBusy} onClick={openVerification}>ยืนยันอีเมลด้วยรหัส OTP</button></div>
        </form>
      )}
      {displayError && <p className="supabase-panel-error" role="alert">{displayError}</p>}
      {message && <p className="supabase-panel-message" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
