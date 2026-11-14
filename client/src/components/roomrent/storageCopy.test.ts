import { describe, expect, it } from "vitest";
import { getExpenseStorageDisclosure, getPromptPayStorageDisclosure } from "./storageCopy";

describe("mode-aware storage disclosures", () => {
  it("identifies PromptPay settings as public shared data in shared mode", () => {
    const copy = getPromptPayStorageDisclosure(true);
    expect(copy.title).toContain("สาธารณะ");
    expect(copy.description).toContain("Supabase");
    expect(copy.description).toContain("ผู้เข้าถึงแอป/API");
  });

  it("retains the device-only PromptPay disclosure in local mode", () => {
    const copy = getPromptPayStorageDisclosure(false);
    expect(copy.title).toContain("อุปกรณ์นี้เท่านั้น");
    expect(copy.description).toContain("ไฟล์สำรอง");
  });

  it("identifies expenses as public shared data in shared mode", () => {
    const copy = getExpenseStorageDisclosure(true);
    expect(copy.title).toContain("สาธารณะ");
    expect(copy.description).toContain("Supabase");
    expect(copy.description).toContain("ผู้เข้าถึงแอป/API");
  });

  it("retains the device-only expense disclosure in local mode", () => {
    const copy = getExpenseStorageDisclosure(false);
    expect(copy.title).toContain("อุปกรณ์นี้");
    expect(copy.description).toContain("ไฟล์สำรอง");
  });
});
