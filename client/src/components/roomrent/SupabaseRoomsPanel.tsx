import { useState } from "react";
import { Cloud, CloudOff, LoaderCircle, LogIn, LogOut, ShieldCheck, UploadCloud } from "lucide-react";

type Props = {
  configured: boolean;
  loading: boolean;
  email?: string;
  roomCount: number;
  localRoomCount: number;
  error: string;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<boolean>;
  onSignOut: () => Promise<void>;
  onImportLocalRooms: () => Promise<void>;
};

export function SupabaseRoomsPanel({ configured, loading, email, roomCount, localRoomCount, error, onSignIn, onSignUp, onSignOut, onImportLocalRooms }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    setMessage("");
    try {
      if (mode === "signin") await onSignIn(emailInput, password);
      else {
        const confirmationRequired = await onSignUp(emailInput, password);
        if (confirmationRequired) setMessage("สมัครแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
      }
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "เชื่อมต่อ Supabase ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setFormError("");
    setMessage("");
    try { await action(); }
    catch (reason) { setFormError(reason instanceof Error ? reason.message : "ดำเนินการไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  if (!configured) return (
    <section className="supabase-rooms-panel" aria-labelledby="supabase-room-title">
      <div className="supabase-panel-icon"><CloudOff size={19} /></div>
      <div className="supabase-panel-copy"><strong id="supabase-room-title">ยังไม่ได้ตั้งค่า Supabase</strong><span>เพิ่ม VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ใน environment ของ build แล้วเปิดแอปใหม่ ข้อมูลห้องเดิมจะไม่ถูกส่งขึ้นโดยอัตโนมัติ</span></div>
      <span className="supabase-panel-note">ดูคู่มือในไฟล์ docs/supabase-room-storage.md ก่อน build</span>
    </section>
  );

  if (loading) return <section className="supabase-rooms-panel" aria-live="polite"><LoaderCircle className="supabase-spinner" size={18} /><div className="supabase-panel-copy"><strong>กำลังตรวจสอบบัญชีและโหลดห้อง</strong><span>กำลังเชื่อมต่อ Supabase</span></div></section>;

  if (email) return (
    <section className="supabase-rooms-panel is-connected" aria-labelledby="supabase-room-title">
      <div className="supabase-panel-icon"><ShieldCheck size={19} /></div>
      <div className="supabase-panel-copy"><strong id="supabase-room-title">ห้องพักจัดเก็บใน Supabase</strong><span>{email} · โหลดแล้ว {roomCount} ห้อง · จำกัดข้อมูลตามบัญชีที่เข้าสู่ระบบ</span></div>
      <div className="supabase-panel-actions">
        {localRoomCount > 0 && <button className="button button-outline button-sm" disabled={busy || Boolean(error) || roomCount > 0} onClick={() => void runAction(onImportLocalRooms)}><UploadCloud size={15} />นำเข้าห้องเดิม ({localRoomCount})</button>}
        <button className="button button-quiet button-sm" disabled={busy} onClick={() => void runAction(onSignOut)}><LogOut size={15} />ออกจากระบบ</button>
      </div>
      {roomCount > 0 && localRoomCount > 0 && <small className="supabase-panel-note">มีข้อมูลห้องทั้งบน Supabase และในอุปกรณ์ จึงปิดการนำเข้าอัตโนมัติเพื่อป้องกันข้อมูลซ้ำ</small>}
      {(error || formError) && <p className="supabase-panel-error" role="alert">{formError || error}</p>}
      {message && <p className="supabase-panel-message" role="status">{message}</p>}
    </section>
  );

  return (
    <section className="supabase-rooms-panel supabase-login-panel" aria-labelledby="supabase-room-title">
      <div className="supabase-panel-icon"><Cloud size={19} /></div>
      <div className="supabase-panel-copy"><strong id="supabase-room-title">เข้าสู่ระบบเพื่ออ่านและบันทึกห้องใน Supabase</strong><span>บิล รายจ่าย และ PromptPay ยังจัดเก็บในอุปกรณ์นี้</span></div>
      <form className="supabase-login-form" onSubmit={event => void submit(event)}>
        <label><span>อีเมล</span><input type="email" autoComplete="email" required value={emailInput} onChange={event => setEmailInput(event.target.value)} /></label>
        <label><span>รหัสผ่าน</span><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label>
        <div className="supabase-panel-actions"><button className="button button-primary button-sm" disabled={busy}><LogIn size={15} />{busy ? "กำลังเชื่อมต่อ…" : mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}</button><button type="button" className="button button-quiet button-sm" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setFormError(""); setMessage(""); }}>{mode === "signin" ? "สมัครบัญชีใหม่" : "มีบัญชีแล้ว · เข้าสู่ระบบ"}</button></div>
      </form>
      <small className="supabase-panel-note">ต้องตั้งค่า Auth และเปิด RLS ตามคู่มือก่อนใช้งาน · ข้อมูลห้องในเครื่องจะไม่ถูกอัปโหลดจนกว่าจะกด “นำเข้าห้องเดิม”</small>
      {(error || formError) && <p className="supabase-panel-error" role="alert">{formError || error}</p>}
      {message && <p className="supabase-panel-message" role="status">{message}</p>}
    </section>
  );
}
