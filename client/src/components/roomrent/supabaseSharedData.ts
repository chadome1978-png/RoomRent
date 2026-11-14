import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";
import { parseLocalDatabase, type LocalDatabase } from "./types";

export const ROOMRENT_SHARED_ROW_ID = "shared";
const SHARED_TABLE = "roomrent_shared_data";
const MAX_DOCUMENT_BYTES = 1024 * 1024;

type SharedDataRow = {
  id: string;
  revision: number | string;
  document: unknown;
};

function parseRevision(value: unknown): number {
  const revision = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("ข้อมูล shared มี revision ไม่ถูกต้อง");
  }
  return revision;
}

function parseDocument(value: unknown): LocalDatabase {
  const document = parseLocalDatabase(value);
  if (!document) throw new Error("ข้อมูล shared ใน Supabase มีรูปแบบไม่ถูกต้อง");
  return document;
}

function documentSize(document: LocalDatabase): number {
  return new TextEncoder().encode(JSON.stringify(document)).byteLength;
}

/** Repository for the one intentionally public RoomRent dataset. No Auth session is required. */
export function createSupabaseSharedDataRepository(client: Pick<SupabaseClient, "from" | "rpc">) {
  return {
    async fetch(): Promise<{ document: LocalDatabase | null; revision: number }> {
      const { data, error } = await client
        .from(SHARED_TABLE)
        .select("id, revision, document")
        .eq("id", ROOMRENT_SHARED_ROW_ID)
        .maybeSingle();
      if (error) throw new Error("โหลดข้อมูล RoomRent shared จาก Supabase ไม่สำเร็จ");
      if (data === null) return { document: null, revision: 0 };

      const row = data as SharedDataRow;
      if (row.id !== ROOMRENT_SHARED_ROW_ID) throw new Error("พบแถว shared ที่ไม่ถูกต้อง");
      return { document: parseDocument(row.document), revision: parseRevision(row.revision) };
    },

    async save(document: LocalDatabase, expectedRevision: number): Promise<number> {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw new Error("revision ที่ใช้บันทึกไม่ถูกต้อง");
      }
      const parsed = parseDocument(document);
      if (documentSize(parsed) > MAX_DOCUMENT_BYTES) {
        throw new Error("ข้อมูล RoomRent เกินขนาดสูงสุด 1 MiB");
      }

      const { data, error } = await client.rpc("save_roomrent_shared_data", {
        p_expected_revision: expectedRevision,
        p_document: parsed,
      });
      if (error) throw new Error("บันทึกข้อมูล RoomRent shared ไม่สำเร็จ หรือมีการแก้ไขจากผู้ใช้อื่น");
      return parseRevision(data);
    },
  };
}

export async function fetchSupabaseSharedData() {
  return createSupabaseSharedDataRepository(getSupabaseClient()).fetch();
}

export async function saveSupabaseSharedData(document: LocalDatabase, expectedRevision: number) {
  return createSupabaseSharedDataRepository(getSupabaseClient()).save(document, expectedRevision);
}
