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
