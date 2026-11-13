import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RentalRoom } from "./types";
import { signInWithUsername } from "./usernameLogin";
import { requestSignupVerificationCode, verifySignupEmailCode } from "./emailVerification";

type RoomRow = {
  id: number;
  owner_id: string;
  room_number: string;
  tenant_name: string;
  phone: string;
  rent_amount: number | string;
  water_rate: number | string;
  electric_rate: number | string;
  status: RentalRoom["status"];
  created_at: string;
  updated_at: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseRoomsConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ก่อนเชื่อมต่อ Supabase");
  }
  client ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

/** Reuse the single configured Supabase client for account-wide data operations. */
export function getSupabaseClient(): SupabaseClient {
  return getClient();
}

async function requireUserId() {
  const { data, error } = await getClient().auth.getUser();
  if (error || !data.user) throw new Error("กรุณาเข้าสู่ระบบ Supabase ก่อนจัดการข้อมูลห้อง");
  return data.user.id;
}

/** Require an authenticated user before accessing account-owned data. */
export async function requireSupabaseUserId(): Promise<string> {
  return requireUserId();
}

function toRoom(row: RoomRow): RentalRoom {
  return {
    id: Number(row.id),
    roomNumber: row.room_number,
    tenantName: row.tenant_name,
    phone: row.phone,
    rentAmount: Number(row.rent_amount),
    waterRate: Number(row.water_rate),
    electricRate: Number(row.electric_rate),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(room: RentalRoom, ownerId: string) {
  return {
    id: room.id,
    owner_id: ownerId,
    room_number: room.roomNumber.trim(),
    tenant_name: room.tenantName.trim(),
    phone: room.phone.trim(),
    rent_amount: room.rentAmount,
    water_rate: room.waterRate,
    electric_rate: room.electricRate,
    status: room.status,
    created_at: room.createdAt,
    updated_at: new Date().toISOString(),
  };
}

/** Get the active Supabase session user; null means signed out. */
export async function getSupabaseRoomUser() {
  if (!isSupabaseRoomsConfigured) return null;
  const { data, error } = await getClient().auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return data.user ?? null;
}

export function onSupabaseRoomAuthChange(callback: (signedIn: boolean) => void) {
  const { data } = getClient().auth.onAuthStateChange((_event, session) => callback(Boolean(session?.user)));
  return () => data.subscription.unsubscribe();
}

export async function signInToSupabaseRooms(username: string, password: string) {
  return signInWithUsername(getClient(), username, password);
}

export async function resendSupabaseSignupConfirmation(email: string) {
  await requestSignupVerificationCode(getClient(), email);
}

export async function verifySupabaseSignupOtp(email: string, token: string) {
  return verifySignupEmailCode(getClient(), email, token);
}

export async function signUpForSupabaseRooms(email: string, password: string) {
  const { data, error } = await getClient().auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  return { user: data.user, needsEmailConfirmation: !data.session };
}

export async function signOutFromSupabaseRooms() {
  const { error } = await getClient().auth.signOut();
  if (error) throw error;
}

/** Read only rooms owned by the current authenticated Supabase user (also enforced by RLS). */
export async function fetchSupabaseRooms(): Promise<RentalRoom[]> {
  await requireUserId();
  const { data, error } = await getClient()
    .from("rental_rooms")
    .select("id, owner_id, room_number, tenant_name, phone, rent_amount, water_rate, electric_rate, status, created_at, updated_at")
    .order("room_number", { ascending: true });
  if (error) throw error;
  return (data as RoomRow[]).map(toRoom);
}

/** Insert a room; Supabase assigns its primary key and RLS assigns/checks its owner. */
export async function createSupabaseRoom(room: Omit<RentalRoom, "id">): Promise<RentalRoom> {
  const ownerId = await requireUserId();
  const payload = {
    owner_id: ownerId,
    room_number: room.roomNumber.trim(),
    tenant_name: room.tenantName.trim(),
    phone: room.phone.trim(),
    rent_amount: room.rentAmount,
    water_rate: room.waterRate,
    electric_rate: room.electricRate,
    status: room.status,
    created_at: room.createdAt,
    updated_at: room.updatedAt,
  };
  const { data, error } = await getClient()
    .from("rental_rooms")
    .insert(payload)
    .select("id, owner_id, room_number, tenant_name, phone, rent_amount, water_rate, electric_rate, status, created_at, updated_at")
    .single();
  if (error) throw error;
  return toRoom(data as RoomRow);
}

/** Insert a batch in one Postgres statement; useful for an explicit first-time migration. */
export async function createSupabaseRooms(rooms: Array<Omit<RentalRoom, "id">>): Promise<RentalRoom[]> {
  if (!rooms.length) return [];
  const ownerId = await requireUserId();
  const payload = rooms.map(room => ({
    owner_id: ownerId,
    room_number: room.roomNumber.trim(),
    tenant_name: room.tenantName.trim(),
    phone: room.phone.trim(),
    rent_amount: room.rentAmount,
    water_rate: room.waterRate,
    electric_rate: room.electricRate,
    status: room.status,
    created_at: room.createdAt,
    updated_at: room.updatedAt,
  }));
  const { data, error } = await getClient()
    .from("rental_rooms")
    .insert(payload)
    .select("id, owner_id, room_number, tenant_name, phone, rent_amount, water_rate, electric_rate, status, created_at, updated_at");
  if (error) throw error;
  return (data as RoomRow[]).map(toRoom);
}

/** Update a room by ID. The RLS policy limits the update to the signed-in owner. */
export async function updateSupabaseRoom(room: RentalRoom): Promise<RentalRoom> {
  const ownerId = await requireUserId();
  const { data, error } = await getClient()
    .from("rental_rooms")
    .update(toRow(room, ownerId))
    .eq("id", room.id)
    .eq("owner_id", ownerId)
    .select("id, owner_id, room_number, tenant_name, phone, rent_amount, water_rate, electric_rate, status, created_at, updated_at")
    .single();
  if (error) throw error;
  return toRoom(data as RoomRow);
}
