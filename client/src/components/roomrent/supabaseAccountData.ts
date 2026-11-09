import { parseLocalDatabase, type LocalDatabase } from "./types";
import { getSupabaseClient, requireSupabaseUserId } from "./supabaseRooms";

type AccountDataRow = {
  owner_id: string;
  revision: number | string;
  document: unknown;
};

function parseRevision(value: unknown): number {
  const revision = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("Supabase returned an invalid account-data revision");
  }
  return revision;
}

/** Fetch the signed-in user's complete account snapshot; no row means no cloud snapshot yet. */
export async function fetchSupabaseAccountData(): Promise<{ document: LocalDatabase | null; revision: number }> {
  const ownerId = await requireSupabaseUserId();
  const { data, error } = await getSupabaseClient()
    .from("roomrent_account_data")
    .select("owner_id, revision, document")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new Error("Unable to fetch Supabase account data");
  if (data === null) return { document: null, revision: 0 };

  const row = data as AccountDataRow;
  const document = parseLocalDatabase(row.document);
  if (row.owner_id !== ownerId || !document) {
    throw new Error("Supabase account data is invalid");
  }
  return { document, revision: parseRevision(row.revision) };
}

/** Save a complete account snapshot only if its expected revision is still current. */
export async function saveSupabaseAccountData(document: LocalDatabase, expectedRevision: number): Promise<number> {
  await requireSupabaseUserId();
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new Error("Invalid expected account-data revision");
  }
  const parsed = parseLocalDatabase(document);
  if (!parsed) throw new Error("Invalid account-data document");

  const { data, error } = await getSupabaseClient().rpc("save_roomrent_account_data", {
    p_expected_revision: expectedRevision,
    p_document: parsed,
  });
  if (error) throw new Error("Unable to save Supabase account data");
  return parseRevision(data);
}
