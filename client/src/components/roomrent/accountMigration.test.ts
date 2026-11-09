import { describe, expect, it } from "vitest";
import { emptyLocalDatabase, type RentalInvoice, type RentalRoom } from "./types";
import { getMigrationPreview, mergeMigrationData } from "./accountMigration";

function room(id: number, roomNumber = "A-01"): RentalRoom {
  return { id, roomNumber, tenantName: "ผู้เช่าทดสอบ", phone: "", rentAmount: 4500, waterRate: 18, electricRate: 8, status: "occupied", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
}

function invoice(id: number, roomId: number): RentalInvoice {
  return { id, roomId, roomNumber: "A-01", tenantName: "ผู้เช่าทดสอบ", phone: "", period: "2026-01", dueDate: "2026-01-05", rentAmount: 4500, waterPrevious: 0, waterCurrent: 0, waterUnits: 0, waterRate: 18, waterAmount: 0, electricPrevious: 0, electricCurrent: 0, electricUnits: 0, electricRate: 8, electricAmount: 0, extras: [], totalAmount: 4500, note: "", status: "unpaid", issuedAt: "2026-01-01T00:00:00.000Z" };
}

describe("RoomRent account-data migration", () => {
  it("maps legacy room IDs to an equivalent existing cloud room and marks the migration", () => {
    const current = { ...emptyLocalDatabase(), rooms: [room(5)] };
    const local = { ...emptyLocalDatabase(), invoices: [invoice(20, 7)] };
    const merged = mergeMigrationData(current, local, [room(7)]);

    expect(merged.rooms).toHaveLength(1);
    expect(merged.invoices[0].roomId).toBe(5);
    expect(merged.legacyRoomsImported).toBe(true);
  });

  it("stops instead of replacing a room with conflicting data under the same room number", () => {
    const current = { ...emptyLocalDatabase(), rooms: [room(5)] };
    const conflicting = { ...room(7), tenantName: "ข้อมูลที่แตกต่าง" };
    expect(() => mergeMigrationData(current, emptyLocalDatabase(), [conflicting])).toThrow(/ห้องซ้ำ/);
  });

  it("stops when two different bills target the same room and billing period", () => {
    const current = { ...emptyLocalDatabase(), rooms: [room(5)], invoices: [invoice(20, 5)] };
    const changed = { ...invoice(21, 7), status: "paid" as const };
    expect(() => mergeMigrationData(current, { ...emptyLocalDatabase(), invoices: [changed] }, [room(7)])).toThrow(/บิลซ้ำ/);
  });

  it("deduplicates an identical bill while preserving unique expenses and local settings", () => {
    const current = { ...emptyLocalDatabase(), rooms: [room(5)], invoices: [invoice(20, 5)] };
    const local = { ...emptyLocalDatabase(), invoices: [invoice(20, 5)], expenses: [{ id: 30, date: "2026-01-02", category: "maintenance" as const, description: "ค่าซ่อมทดสอบ", amount: 100, note: "", createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" }], promptPay: { id: "0812345678", recipientName: "เจ้าของทดสอบ" } };
    const merged = mergeMigrationData(current, local, []);

    expect(merged.invoices).toHaveLength(1);
    expect(merged.expenses).toHaveLength(1);
    expect(merged.promptPay).toEqual(local.promptPay);
  });

  it("stops when Cloud and device PromptPay settings disagree", () => {
    const current = { ...emptyLocalDatabase(), promptPay: { id: "0812345678", recipientName: "เจ้าของทดสอบ" } };
    const local = { ...emptyLocalDatabase(), promptPay: { id: "1234567890123", recipientName: "เจ้าของอีกคน" } };
    expect(() => mergeMigrationData(current, local, [])).toThrow(/PromptPay/);
  });

  it("includes old room rows in the backup preview before the migration is accepted", () => {
    const preview = getMigrationPreview(emptyLocalDatabase(), emptyLocalDatabase(), [room(7)]);
    expect(preview.rooms).toHaveLength(1);
    expect(preview.rooms[0].id).toBe(7);
  });
});
