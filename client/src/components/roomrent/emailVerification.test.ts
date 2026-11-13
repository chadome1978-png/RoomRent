import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMAIL_VERIFICATION_COOLDOWN,
  EmailVerificationError,
  getEmailVerificationErrorMessage,
  isVerificationEmail,
  requestSignupVerificationCode,
  verifySignupEmailCode,
} from "./emailVerification";

function fixture() {
  const user = { id: "synthetic-otp-owner", email: "owner@example.invalid", email_confirmed_at: "2026-01-01T00:00:00Z" };
  const session = { user, access_token: "synthetic-access", refresh_token: "synthetic-refresh" };
  const verifyOtp = vi.fn().mockResolvedValue({ data: { user, session }, error: null });
  const resend = vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null });
  const signUp = vi.fn();
  const signInWithOtp = vi.fn();
  const from = vi.fn();
  return { user, session, verifyOtp, resend, signUp, signInWithOtp, from,
    client: { auth: { verifyOtp, resend, signUp, signInWithOtp }, from } as unknown as Pick<SupabaseClient, "auth"> };
}

describe("RoomRent signup Email OTP — mocks only, no network or real email", () => {
  it("requests signup resend without password, signup, login or table lookup", async () => {
    const f = fixture();
    await requestSignupVerificationCode(f.client, " owner@example.invalid ");
    expect(f.resend).toHaveBeenCalledTimes(1);
    expect(f.resend).toHaveBeenCalledWith({ email: "owner@example.invalid", type: "signup" });
    expect(f.signUp).not.toHaveBeenCalled();
    expect(f.signInWithOtp).not.toHaveBeenCalled();
    expect(f.verifyOtp).not.toHaveBeenCalled();
    expect(f.from).not.toHaveBeenCalled();
    expect(EMAIL_VERIFICATION_COOLDOWN).toBe(60);
  });

  it("preserves leading zeros and uses type email on the same Auth client", async () => {
    const f = fixture();
    expect(await verifySignupEmailCode(f.client, " owner@example.invalid ", " 001234 ")).toEqual(f.user);
    expect(f.verifyOtp).toHaveBeenCalledWith({ email: "owner@example.invalid", token: "001234", type: "email" });
    expect(f.resend).not.toHaveBeenCalled();
    expect(f.from).not.toHaveBeenCalled();
  });

  it.each(["", "not-email", "a@", "a b@example.invalid", "a".repeat(255) + "@example.invalid"])("rejects invalid email locally", async email => {
    const f = fixture();
    await expect(requestSignupVerificationCode(f.client, email)).rejects.toMatchObject({ code: "email" });
    await expect(verifySignupEmailCode(f.client, email, "001234")).rejects.toMatchObject({ code: "email" });
    expect(f.resend).not.toHaveBeenCalled();
    expect(f.verifyOtp).not.toHaveBeenCalled();
  });

  it.each(["", "12345", "1234567", "12 345", "abcdef", "１２３４５６", "-12345", "1e2345"])("rejects malformed OTP before network", async token => {
    const f = fixture();
    await expect(verifySignupEmailCode(f.client, "owner@example.invalid", token)).rejects.toMatchObject({ code: "format" });
    expect(f.verifyOtp).not.toHaveBeenCalled();
  });

  it.each(["otp_expired", "invalid_credentials"])("does not distinguish wrong/expired OTP: %s", async code => {
    const f = fixture();
    f.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { code, message: "private server detail" } });
    await expect(verifySignupEmailCode(f.client, "owner@example.invalid", "001234")).rejects.toMatchObject({ code: "invalid" });
  });

  it.each([
    { code: "over_request_rate_limit" }, { code: "over_email_send_rate_limit" }, { status: 429 },
  ])("handles rate limit in resend and verify without raw responses", async error => {
    const f = fixture();
    f.verifyOtp.mockResolvedValue({ data: null, error });
    f.resend.mockResolvedValue({ data: null, error });
    await expect(verifySignupEmailCode(f.client, "owner@example.invalid", "001234")).rejects.toMatchObject({ code: "rate_limited" });
    await expect(requestSignupVerificationCode(f.client, "owner@example.invalid")).rejects.toMatchObject({ code: "rate_limited" });
  });

  it.each([{ name: "AuthRetryableFetchError" }, { code: "request_timeout" }, new TypeError("private network detail")])("handles network errors safely", async error => {
    const f = fixture();
    f.verifyOtp.mockRejectedValue(error);
    await expect(verifySignupEmailCode(f.client, "owner@example.invalid", "001234")).rejects.toMatchObject({ code: "network" });
  });

  it.each(["user_not_found", "user_already_exists", "email_exists", "email_not_confirmed", "invalid_credentials"])("keeps resend account state neutral for %s", async code => {
    const f = fixture();
    f.resend.mockResolvedValue({ data: null, error: { code } });
    await expect(requestSignupVerificationCode(f.client, "owner@example.invalid")).resolves.toBeUndefined();
  });

  it.each(["email_address_not_authorized", "otp_disabled", "email_provider_disabled", "unexpected_failure"])("handles configuration/service errors without identifying account: %s", async code => {
    const f = fixture();
    f.verifyOtp.mockResolvedValue({ data: null, error: { code, message: "private detail" } });
    f.resend.mockResolvedValue({ data: null, error: { code, message: "private detail" } });
    await expect(requestSignupVerificationCode(f.client, "owner@example.invalid")).rejects.toMatchObject({ code: "unavailable" });
    await expect(verifySignupEmailCode(f.client, "owner@example.invalid", "001234")).rejects.toMatchObject({ code: "unavailable" });
  });

  it.each(["user", "session", "confirmation", "email", "owner", "access_token", "refresh_token"])("requires a verified matching session: missing/wrong %s", async field => {
    const f = fixture();
    const data: Record<string, any> = { user: { ...f.user }, session: { ...f.session } };
    if (field === "user" || field === "session") data[field] = null;
    if (field === "confirmation") data.user.email_confirmed_at = null;
    if (field === "email") data.user.email = "other@example.invalid";
    if (field === "owner") data.session.user = { ...f.user, id: "other-synthetic-owner" };
    if (field === "access_token" || field === "refresh_token") data.session[field] = " ";
    f.verifyOtp.mockResolvedValue({ data, error: null });
    await expect(verifySignupEmailCode(f.client, "owner@example.invalid", "001234")).rejects.toMatchObject({ code: "session" });
  });

  it("rejects an empty success response as a missing session", async () => {
    const f = fixture();
    f.verifyOtp.mockResolvedValue({ data: null, error: null });
    await expect(verifySignupEmailCode(f.client, "owner@example.invalid", "001234")).rejects.toMatchObject({ code: "session" });
  });

  it("does not read raw Auth error messages or expose arbitrary error text", async () => {
    const f = fixture();
    const error = { code: "otp_expired", get message() { throw new Error("must not read private raw error"); } };
    f.verifyOtp.mockResolvedValue({ data: null, error });
    await expect(verifySignupEmailCode(f.client, "owner@example.invalid", "001234")).rejects.toMatchObject({ code: "invalid" });
    expect(getEmailVerificationErrorMessage(new Error("private OTP/token"))).not.toContain("private");
    expect(getEmailVerificationErrorMessage(new EmailVerificationError("format"))).toContain("6 หลัก");
    expect(isVerificationEmail("owner@example.invalid")).toBe(true);
  });
});
