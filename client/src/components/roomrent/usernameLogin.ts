import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type SupabaseClient,
} from "@supabase/supabase-js";

const messages = {
  invalid_credentials: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
  invalid_username: "ชื่อผู้ใช้ต้องมี 3–32 ตัวอักษร ใช้ตัวอักษรอังกฤษ ตัวเลข หรือ _ เท่านั้น",
  network: "เชื่อมต่อระบบเข้าสู่ระบบไม่ได้หรือหมดเวลารอ โปรดตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
  not_ready: "ระบบเข้าสู่ระบบด้วยชื่อผู้ใช้ยังไม่พร้อม โปรดติดต่อผู้ดูแลเพื่อตั้งค่า Edge Function",
  forbidden: "การเชื่อมต่อระบบเข้าสู่ระบบถูกปฏิเสธ โปรดติดต่อผู้ดูแลเพื่อตรวจการตั้งค่า",
  rate_limited: "ส่งคำขอเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  unavailable: "ระบบเข้าสู่ระบบไม่พร้อมใช้งานชั่วคราว โปรดลองอีกครั้งภายหลัง",
  session: "ยืนยัน session ไม่สำเร็จ โปรดลองเข้าสู่ระบบอีกครั้ง",
} as const;

type LoginErrorCode = keyof typeof messages;

/** Only these fixed, client-owned messages may be rendered in the login form. */
export class RoomRentLoginError extends Error {
  constructor(readonly code: LoginErrorCode) {
    super(messages[code]);
    this.name = "RoomRentLoginError";
  }
}

export function getUsernameLoginErrorMessage(error: unknown): string {
  return error instanceof RoomRentLoginError
    ? messages[error.code]
    : "เข้าสู่ระบบไม่สำเร็จ โปรดตรวจสอบข้อมูลแล้วลองอีกครั้ง";
}

function classifyFunctionError(error: unknown): RoomRentLoginError {
  if (error instanceof FunctionsFetchError) return new RoomRentLoginError("network");
  if (error instanceof FunctionsRelayError) return new RoomRentLoginError("not_ready");
  if (error instanceof FunctionsHttpError) {
    // Inspect status only, never the body or the raw server error message.
    switch (error.context?.status) {
      case 400:
      case 401:
        return new RoomRentLoginError("invalid_credentials");
      case 403:
        return new RoomRentLoginError("forbidden");
      case 404:
        return new RoomRentLoginError("not_ready");
      case 429:
        return new RoomRentLoginError("rate_limited");
    }
  }
  return new RoomRentLoginError("unavailable");
}

/** Public SDK invocation only: never read login_names or compare passwords here. */
export async function signInWithUsername(
  client: Pick<SupabaseClient, "functions" | "auth">,
  username: string,
  password: string,
) {
  const normalizedUsername = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(normalizedUsername)) {
    throw new RoomRentLoginError("invalid_username");
  }
  if (!password || password.length > 256) {
    throw new RoomRentLoginError("invalid_credentials");
  }

  try {
    const { data, error } = await client.functions.invoke<{
      access_token: string;
      refresh_token: string;
    }>("login-with-username", {
      body: { username: normalizedUsername, password },
      timeout: 15_000,
    });
    if (error) throw classifyFunctionError(error);
    if (
      !data ||
      typeof data.access_token !== "string" || !data.access_token.trim() ||
      typeof data.refresh_token !== "string" || !data.refresh_token.trim()
    ) {
      throw new RoomRentLoginError("unavailable");
    }

    const { data: sessionData, error: sessionError } = await client.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (sessionError || !sessionData.user || !sessionData.session) {
      throw new RoomRentLoginError("session");
    }
    return sessionData.user;
  } catch (error) {
    if (error instanceof RoomRentLoginError) throw error;
    // Do not propagate SDK error bodies, credentials, tokens, or tenant data.
    throw classifyFunctionError(error);
  }
}
