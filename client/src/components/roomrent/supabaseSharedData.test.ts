import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseSharedDataRepository, ROOMRENT_SHARED_ROW_ID } from "./supabaseSharedData";
import { emptyLocalDatabase } from "./types";

function fixture() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  const rpc = vi.fn().mockResolvedValue({ data: 2, error: null });
  const client = { from, rpc } as unknown as Pick<SupabaseClient, "from" | "rpc">;
  return { query, from, rpc, repository: createSupabaseSharedDataRepository(client) };
}

describe("RoomRent public shared data adapter", () => {
  it("reads only the singleton shared row without an Auth session", async () => {
    const f = fixture();
    const document = emptyLocalDatabase();
    f.query.maybeSingle.mockResolvedValue({ data: { id: ROOMRENT_SHARED_ROW_ID, revision: "4", document }, error: null });

    await expect(f.repository.fetch()).resolves.toEqual({ document, revision: 4 });
    expect(f.from).toHaveBeenCalledWith("roomrent_shared_data");
    expect(f.query.select).toHaveBeenCalledWith("id, revision, document");
    expect(f.query.eq).toHaveBeenCalledWith("id", ROOMRENT_SHARED_ROW_ID);
    expect(f.query.maybeSingle).toHaveBeenCalledOnce();
  });

  it("represents a not-yet-created shared row without silently writing it", async () => {
    const f = fixture();
    f.query.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(f.repository.fetch()).resolves.toEqual({ document: null, revision: 0 });
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed shared documents and revisions", async () => {
    const f = fixture();
    f.query.maybeSingle.mockResolvedValue({ data: { id: ROOMRENT_SHARED_ROW_ID, revision: 1, document: { rooms: ["bad"] } }, error: null });
    await expect(f.repository.fetch()).rejects.toThrow("รูปแบบไม่ถูกต้อง");

    f.query.maybeSingle.mockResolvedValue({ data: { id: ROOMRENT_SHARED_ROW_ID, revision: -1, document: emptyLocalDatabase() }, error: null });
    await expect(f.repository.fetch()).rejects.toThrow("revision ไม่ถูกต้อง");
  });

  it("saves through the public revision RPC only, not direct table mutation", async () => {
    const f = fixture();
    const document = { ...emptyLocalDatabase(), rooms: [{
      id: 1001, roomNumber: "SYN-01", tenantName: "ตัวอย่าง", phone: "TEST-PHONE-UNUSABLE",
      rentAmount: 4000, waterRate: 20, electricRate: 8, status: "occupied" as const,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    }] };

    await expect(f.repository.save(document, 1)).resolves.toBe(2);
    expect(f.rpc).toHaveBeenCalledWith("save_roomrent_shared_data", {
      p_expected_revision: 1,
      p_document: document,
    });
    expect(f.from).not.toHaveBeenCalled();
  });

  it("rejects invalid revisions and malformed documents before network calls", async () => {
    const f = fixture();
    await expect(f.repository.save(emptyLocalDatabase(), -1)).rejects.toThrow("revision");
    await expect(f.repository.save({ ...emptyLocalDatabase(), rooms: ["bad"] } as never, 0)).rejects.toThrow("รูปแบบไม่ถูกต้อง");
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it("maps Supabase failures to a safe Thai message without exposing raw details", async () => {
    const f = fixture();
    f.rpc.mockResolvedValue({ data: null, error: { message: "secret backend detail" } });
    await expect(f.repository.save(emptyLocalDatabase(), 1)).rejects.toThrow("บันทึกข้อมูล RoomRent shared ไม่สำเร็จ");
    await expect(f.repository.save(emptyLocalDatabase(), 1)).rejects.not.toThrow("secret backend detail");
  });
});
