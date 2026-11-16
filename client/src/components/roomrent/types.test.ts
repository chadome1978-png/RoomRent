import { describe, expect, it } from "vitest";
import { parseLocalDatabase } from "./types";

describe("utility rates in local database", () => {
  const base = { version: 1, rooms: [], invoices: [], expenses: [] };

  it("accepts non-negative water and electric rates", () => {
    const parsed = parseLocalDatabase({ ...base, utilityRates: { waterPerUnit: 7.5, electricPerUnit: 8.25 } });
    expect(parsed?.utilityRates).toEqual({ waterPerUnit: 7.5, electricPerUnit: 8.25 });
  });

  it("rejects negative or non-finite rates", () => {
    expect(parseLocalDatabase({ ...base, utilityRates: { waterPerUnit: -1, electricPerUnit: 8 } })).toBeNull();
    expect(parseLocalDatabase({ ...base, utilityRates: { waterPerUnit: Number.NaN, electricPerUnit: 8 } })).toBeNull();
  });

  it("keeps legacy backups valid without utility rates", () => {
    expect(parseLocalDatabase(base)?.utilityRates).toBeUndefined();
  });
});

describe("invoice payment fields", () => {
  const invoice = {
    id: 1, roomId: 1, roomNumber: "SYN-01", tenantName: "ผู้เช่าทดสอบ", phone: "",
    period: "2026-01", dueDate: "2026-01-05", rentAmount: 1000,
    waterPrevious: 0, waterCurrent: 0, waterUnits: 0, waterRate: 0, waterAmount: 0,
    electricPrevious: 0, electricCurrent: 0, electricUnits: 0, electricRate: 0, electricAmount: 0,
    extras: [], totalAmount: 1000, note: "", issuedAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts a persisted partial payment with a matching balance", () => {
    const parsed = parseLocalDatabase({ version: 1, rooms: [], expenses: [], invoices: [{ ...invoice, status: "partial", paidAmount: 300, balanceAmount: 700 }] });
    expect(parsed?.invoices[0]).toMatchObject({ status: "partial", paidAmount: 300, balanceAmount: 700 });
  });

  it("keeps legacy paid and unpaid invoices valid without payment fields", () => {
    expect(parseLocalDatabase({ version: 1, rooms: [], expenses: [], invoices: [{ ...invoice, status: "unpaid" }] })).not.toBeNull();
    expect(parseLocalDatabase({ version: 1, rooms: [], expenses: [], invoices: [{ ...invoice, status: "paid" }] })).not.toBeNull();
  });

  it("rejects inconsistent payment fields", () => {
    expect(parseLocalDatabase({ version: 1, rooms: [], expenses: [], invoices: [{ ...invoice, status: "partial", paidAmount: 0, balanceAmount: 1000 }] })).toBeNull();
    expect(parseLocalDatabase({ version: 1, rooms: [], expenses: [], invoices: [{ ...invoice, status: "partial", paidAmount: 300, balanceAmount: 600 }] })).toBeNull();
    expect(parseLocalDatabase({ version: 1, rooms: [], expenses: [], invoices: [{ ...invoice, status: "partial", paidAmount: 300 }] })).toBeNull();
  });
});
