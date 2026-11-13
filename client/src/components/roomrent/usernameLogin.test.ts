import { describe, expect, it, vi } from "vitest";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  getUsernameLoginErrorMessage,
  RoomRentLoginError,
  signInWithUsername,
} from "./usernameLogin";

function fixture() {
  // All responses and credentials in this file are synthetic; no network is used.
  const user = { id: "synthetic-test-user", email: "owner@example.invalid" };
  const invoke = vi.fn().mockResolvedValue({
    data: { access_token: "synthetic-access-token", refresh_token: "synthetic-refresh-token" },
    error: null,
  });
  const setSession = vi.fn().mockResolvedValue({
    data: { user, session: { user } }, error: null,
  });
  const from = vi.fn(() => { throw new Error("Client must not query login_names"); });
  const client = { functions: { invoke }, auth: { setSession }, from };
  return {
    client: client as unknown as Pick<SupabaseClient, "functions" | "auth">,
    invoke, setSession, from, user,
  };
}

describe("RoomRent username login through Edge Function", () => {
  it("normalizes username, preserves password, sets session and never queries a table", async () => {
    const f = fixture();
    const user = await signInWithUsername(f.client, "  DEMO_OWNER  ", "  synthetic-password  ");
    expect(f.invoke).toHaveBeenCalledTimes(1);
    expect(f.invoke).toHaveBeenCalledWith("login-with-username", {
      body: { username: "demo_owner", password: "  synthetic-password  " }, timeout: 15_000,
    });
    expect(f.setSession).toHaveBeenCalledTimes(1);
    expect(f.setSession).toHaveBeenCalledWith({
      access_token: "synthetic-access-token", refresh_token: "synthetic-refresh-token",
    });
    expect(user).toEqual(f.user);
    expect(f.from).not.toHaveBeenCalled();
  });

  it.each(["", "ab", "not an alias", "email@example.invalid", "a".repeat(33)])(
    "rejects an invalid username before sending credentials (%s)", async username => {
      const f = fixture();
      await expect(signInWithUsername(f.client, username, "synthetic-password"))
        .rejects.toMatchObject({ code: "invalid_username" });
      expect(f.invoke).not.toHaveBeenCalled();
    },
  );

  it.each(["", "x".repeat(257)])("rejects empty or oversized passwords locally", async password => {
    const f = fixture();
    await expect(signInWithUsername(f.client, "demo_owner", password))
      .rejects.toMatchObject({ code: "invalid_credentials" });
    expect(f.invoke).not.toHaveBeenCalled();
  });

  it("lets Supabase Auth validate existing passwords without enforcing signup rules", async () => {
    const f = fixture();
    await signInWithUsername(f.client, "demo_owner", "abc123");
    expect(f.invoke).toHaveBeenCalledWith("login-with-username", expect.objectContaining({
      body: { username: "demo_owner", password: "abc123" },
    }));
  });

  it.each([
    [400, "invalid_credentials"], [401, "invalid_credentials"],
    [403, "forbidden"], [404, "not_ready"],
    [429, "rate_limited"], [503, "unavailable"],
  ])("maps HTTP %s to a safe message without reading the response body", async (status, code) => {
    const f = fixture();
    const json = vi.fn().mockResolvedValue({ error: "private server detail" });
    f.invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError({ status, json }) });
    await expect(signInWithUsername(f.client, "demo_owner", "synthetic-password"))
      .rejects.toMatchObject({ code });
    expect(json).not.toHaveBeenCalled();
    expect(f.setSession).not.toHaveBeenCalled();
    expect(f.from).not.toHaveBeenCalled();
  });

  it("classifies fetch/timeout errors without propagating their details", async () => {
    const f = fixture();
    f.invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError("private detail") });
    await expect(signInWithUsername(f.client, "demo_owner", "synthetic-password"))
      .rejects.toMatchObject({ code: "network" });
  });

  it("classifies relay errors as unavailable setup", async () => {
    const f = fixture();
    f.invoke.mockResolvedValue({ data: null, error: new FunctionsRelayError("private detail") });
    await expect(signInWithUsername(f.client, "demo_owner", "synthetic-password"))
      .rejects.toMatchObject({ code: "not_ready" });
  });

  it.each([
    null, {}, { error: "private detail" },
    { access_token: 123, refresh_token: "test" },
    { access_token: "test", refresh_token: " " },
  ])("does not set a session from an invalid success payload", async data => {
    const f = fixture();
    f.invoke.mockResolvedValue({ data, error: null });
    await expect(signInWithUsername(f.client, "demo_owner", "synthetic-password"))
      .rejects.toMatchObject({ code: "unavailable" });
    expect(f.setSession).not.toHaveBeenCalled();
  });

  it("does not report success if Supabase rejects the session", async () => {
    const f = fixture();
    f.setSession.mockResolvedValue({ data: { user: null, session: null }, error: new Error("private") });
    await expect(signInWithUsername(f.client, "demo_owner", "synthetic-password"))
      .rejects.toMatchObject({ code: "session" });
  });

  it("sanitizes unexpected thrown exceptions", async () => {
    const f = fixture();
    f.invoke.mockRejectedValue(new Error("private server detail"));
    await expect(signInWithUsername(f.client, "demo_owner", "synthetic-password"))
      .rejects.toMatchObject({ code: "unavailable" });
  });

  it("renders only fixed client-owned error text, not arbitrary error messages", () => {
    expect(getUsernameLoginErrorMessage(new RoomRentLoginError("invalid_credentials")))
      .toBe("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    expect(getUsernameLoginErrorMessage(new Error("private server detail")))
      .not.toContain("private server detail");
    expect(getUsernameLoginErrorMessage(new RoomRentLoginError("not_ready")))
      .toContain("Edge Function");
  });
});
