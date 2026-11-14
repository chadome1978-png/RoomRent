import type { SupabaseClient } from "@supabase/supabase-js";

const messages = {
  email: "กรุณากรอกอีเมลที่ถูกต้อง",
  format: "กรุณากรอกรหัส OTP เป็นตัวเลข 6 หลัก",
  invalid: "รหัส OTP ไม่ถูกต้อง หมดอายุ หรือใช้ไปแล้ว กรุณาขอรหัสใหม่และใช้รหัสจากอีเมลฉบับล่าสุด",
  rate_limited: "ส่งคำขอถี่เกินไป กรุณารอสักครู่ก่อนลองใหม่ หากยังไม่ได้ให้ลองอีกครั้งภายหลัง",
  network: "เชื่อมต่อ Supabase ไม่สำเร็จ โปรดตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
  unavailable: "ระบบยืนยันอีเมลไม่พร้อมใช้งาน โปรดลองอีกครั้งภายหลังหรือติดต่อผู้ดูแล",
  session: "ยังยืนยันบัญชีและ session ไม่สำเร็จ กรุณาลองใหม่",
} as const;

type VerificationErrorCode = keyof typeof messages;
type AuthClient = Pick<SupabaseClient, "auth">;

export const EMAIL_VERIFICATION_COOLDOWN = 60;

export class EmailVerificationError extends Error {
  constructor(readonly code: VerificationErrorCode) {
    super(messages[code]);
    this.name = "EmailVerificationError";
  }
}

export function getEmailVerificationErrorMessage(error: unknown): string {
  return error instanceof EmailVerificationError ? messages[error.code] : messages.unavailable;
}

export function isVerificationEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function errorMetadata(error: unknown): { code?: string; name?: string; status?: number } {
  if (typeof error !== "object" || error === null) return {};
  const record = error as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    name: typeof record.name === "string" ? record.name : undefined,
    status: typeof record.status === "number" ? record.status : undefined,
  };
}

function safeAuthError(error: unknown): EmailVerificationError {
  if (error instanceof EmailVerificationError) return error;
  const { code, name, status } = errorMetadata(error);
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || status === 429) {
    return new EmailVerificationError("rate_limited");
  }
  if (code === "otp_expired" || code === "invalid_credentials") {
    return new EmailVerificationError("invalid");
  }
  if (code === "request_timeout" || name === "AuthRetryableFetchError" || name === "TypeError" || name === "AbortError") {
    return new EmailVerificationError("network");
  }
  return new EmailVerificationError("unavailable");
}

/** Resend signup confirmation only. Never create a user or send a password. */
export async function requestSignupVerificationCode(client: AuthClient, emailInput: string): Promise<void> {
  const email = emailInput.trim();
  if (!isVerificationEmail(email)) throw new EmailVerificationError("email");
  try {
    const { error } = await client.auth.resend({ type: "signup", email });
    if (error) {
      // Responses must not distinguish a missing/already-registered account.
      const { code } = errorMetadata(error);
      if (["user_not_found", "user_already_exists", "email_exists", "email_not_confirmed", "invalid_credentials"].includes(code ?? "")) return;
      throw safeAuthError(error);
    }
  } catch (error) {
    throw safeAuthError(error);
  }
}

/** Request passwordless OTP for an existing account only; do not auto-create users. */
export async function requestPasswordlessSignInCode(client: AuthClient, emailInput: string): Promise<void> {
  const email = emailInput.trim();
  if (!isVerificationEmail(email)) throw new EmailVerificationError("email");
  try {
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) {
      const { code } = errorMetadata(error);
      // Keep the UI response neutral for account-state errors.
      if (["user_not_found", "user_already_exists", "email_exists", "email_not_confirmed", "invalid_credentials"].includes(code ?? "")) return;
      throw safeAuthError(error);
    }
  } catch (error) {
    throw safeAuthError(error);
  }
}

/** The SDK installs the verified signup/sign-in Auth session on this same client. */
export async function verifySignupEmailCode(client: AuthClient, emailInput: string, tokenInput: string) {
  const email = emailInput.trim();
  const token = tokenInput.trim();
  if (!isVerificationEmail(email)) throw new EmailVerificationError("email");
  // Keep this as a string: 001234 is a valid code. Reject, never silently truncate.
  if (!/^[0-9]{6}$/.test(token)) throw new EmailVerificationError("format");
  try {
    const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw safeAuthError(error);
    if (
      !data?.user || !data.session || !data.user.email_confirmed_at ||
      data.user.email?.toLowerCase() !== email.toLowerCase() ||
      data.session.user?.id !== data.user.id ||
      typeof data.session.access_token !== "string" || !data.session.access_token.trim() ||
      typeof data.session.refresh_token !== "string" || !data.session.refresh_token.trim()
    ) {
      throw new EmailVerificationError("session");
    }
    return data.user;
  } catch (error) {
    // Never propagate the raw Auth error or log email, OTP, password or tokens.
    throw safeAuthError(error);
  }
}
