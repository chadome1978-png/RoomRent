import { describe, expect, it } from "vitest";
import { createPromptPayPayload, isValidPromptPayId, normalizePromptPayId } from "./promptpay";

describe("PromptPay QR payload", () => {
  it("normalizes a mobile ID and validates supported lengths", () => {
    expect(normalizePromptPayId("0-000 0000 00")).toBe("0000000000");
    expect(isValidPromptPayId("0000000000")).toBe(true);
    expect(isValidPromptPayId("0000000000000")).toBe(true);
    expect(isValidPromptPayId("000000000000000")).toBe(true);
    expect(isValidPromptPayId("1000000000")).toBe(false);
    expect(isValidPromptPayId("000000000")).toBe(false);
  });

  it("embeds the rounded invoice amount in the PromptPay payload", () => {
    const payload = createPromptPayPayload("0-000-0000-00", 5790);
    expect(payload).toContain("54075790.00");
    expect(payload).toContain("5303764");
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
  });

  it("rejects invalid identifiers and non-positive amounts", () => {
    expect(() => createPromptPayPayload("123", 100)).toThrow("PromptPay ID");
    expect(() => createPromptPayPayload("0000000000", 0)).toThrow("มากกว่า 0");
  });
});
