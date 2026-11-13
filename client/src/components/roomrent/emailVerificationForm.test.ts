import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmailVerificationForm } from "./EmailVerificationForm";
import { SupabaseAccountPanel } from "./SupabaseAccountPanel";
import { emptyLocalDatabase } from "./types";

function renderForm(overrides = {}) {
  return renderToStaticMarkup(createElement(EmailVerificationForm, {
    initialEmail: "owner@example.invalid", busy: false, resendCooldown: 0,
    onStartCooldown: vi.fn(), onResend: vi.fn(), onVerify: vi.fn(), onBack: vi.fn(),
    ...overrides,
  }));
}

describe("Email OTP form — server rendering only, synthetic email, no Auth/network", () => {
  it("has a separate accessible email/code form without username or password", () => {
    const html = renderForm();
    expect(html).toContain('aria-label="ยืนยันอีเมลด้วยรหัส OTP"');
    expect(html).toContain('type="email"');
    expect(html).toContain('type="text"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('autoComplete="one-time-code"');
    expect(html).toContain('pattern="[0-9]{6}"');
    expect(html).toContain('maxLength="6"');
    expect(html).toContain('for="roomrent-verification-otp"');
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain('name="token"');
    expect((html.match(/<form/g) ?? []).length).toBe(1);
  });

  it("disables all controls during a pending action", () => {
    const html = renderForm({ busy: true });
    expect(html).toContain('aria-busy="true"');
    expect((html.match(/disabled=""/g) ?? []).length).toBe(5);
  });

  it("displays cooldown and disables resend while preserving ability to fill/verify code", () => {
    const html = renderForm({ resendCooldown: 48 });
    expect(html).toContain("ขอรหัสใหม่ได้ใน 48 วินาที");
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2); // empty-code submit + resend
    expect(html).not.toContain('aria-busy="true"');
  });

  it("exposes an OTP entry button alongside normal username login", () => {
    const html = renderToStaticMarkup(createElement(SupabaseAccountPanel, {
      configured: true, loading: false, ready: false, hasCloudData: false,
      sourceData: emptyLocalDatabase(), error: "", busy: false,
      onSignIn: vi.fn(), onSignUp: vi.fn(), onResendVerification: vi.fn(), onVerifyEmailOtp: vi.fn(),
      onSignOut: vi.fn(), onDownloadBackup: vi.fn(), onMigrateLocalData: vi.fn(), onInitializeEmpty: vi.fn(),
    }));
    expect(html).toContain("ยืนยันอีเมลด้วยรหัส OTP");
    expect(html).toContain("ชื่อผู้ใช้");
    expect(html).toContain('autoComplete="current-password"');
    expect((html.match(/<form/g) ?? []).length).toBe(1);
  });
});
