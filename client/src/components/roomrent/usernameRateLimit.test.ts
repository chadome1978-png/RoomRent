import { describe, expect, it } from "vitest";
import { firstTrustedForwardedIp, hmacRateLimitHash } from "../../../../supabase/functions/login-with-username/rateLimit";

describe("Username Edge Function rate-limit key helpers", () => {
  it("uses only the first gateway-forwarded IP and normalizes hex case", () => {
    expect(firstTrustedForwardedIp(new Request("https://example.invalid", {
      headers: { "x-forwarded-for": "2001:DB8::1, 10.0.0.1" },
    }))).toBe("2001:db8::1");
    expect(firstTrustedForwardedIp(new Request("https://example.invalid", {
      headers: { "x-forwarded-for": "192.0.2.12, 10.0.0.1" },
    }))).toBe("192.0.2.12");
  });

  it.each([null, "", "unknown", "not an ip", "127.0.0.1:1234", "x".repeat(65)])(
    "rejects missing or malformed forwarded IP (%s)", value => {
      const headers = new Headers();
      if (value !== null) headers.set("x-forwarded-for", value);
      expect(firstTrustedForwardedIp(new Request("https://example.invalid", { headers }))).toBeNull();
    },
  );

  it("produces stable, fixed-length HMACs for a bucket and hides the source identifier", async () => {
    const first = await hmacRateLimitHash("synthetic-server-secret", "ip", "192.0.2.12");
    const second = await hmacRateLimitHash("synthetic-server-secret", "ip", "192.0.2.12");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("192.0.2.12");
  });

  it("separates usernames, IPs, and secret-key rotations into distinct buckets", async () => {
    const ip = await hmacRateLimitHash("synthetic-server-secret", "ip", "192.0.2.12");
    const username = await hmacRateLimitHash("synthetic-server-secret", "username", "bnkhouse");
    const anotherSecret = await hmacRateLimitHash("rotated-synthetic-secret", "ip", "192.0.2.12");
    expect(new Set([ip, username, anotherSecret]).size).toBe(3);
  });
});
