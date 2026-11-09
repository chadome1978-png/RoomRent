export type RentalRoom = {
  id: number;
  roomNumber: string;
  tenantName: string;
  phone: string;
  rentAmount: number;
  waterRate: number;
  electricRate: number;
  status: "occupied" | "vacant" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type InvoiceExtra = { label: string; amount: number };

export type RentalInvoice = {
  id: number;
  roomId: number;
  roomNumber: string;
  tenantName: string;
  phone: string;
  period: string;
  dueDate: string;
  rentAmount: number;
  waterPrevious: number;
  waterCurrent: number;
  waterUnits: number;
  waterRate: number;
  waterAmount: number;
  electricPrevious: number;
  electricCurrent: number;
  electricUnits: number;
  electricRate: number;
  electricAmount: number;
  extras: InvoiceExtra[];
  totalAmount: number;
  note: string;
  status: "paid" | "unpaid";
  issuedAt: string;
};

export type PromptPaySettings = {
  id: string;
  recipientName: string;
};

export type ExpenseCategory = "maintenance" | "utilities" | "cleaning" | "staff" | "supplies" | "tax" | "other";

export type RentalExpense = {
  id: number;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseDraft = Pick<RentalExpense, "date" | "category" | "description" | "amount" | "note">;

export type LocalDatabase = {
  version: 1;
  rooms: RentalRoom[];
  invoices: RentalInvoice[];
  expenses: RentalExpense[];
  promptPay?: PromptPaySettings;
  /** Cloud migration marker for the former Supabase rental_rooms table. */
  legacyRoomsImported?: boolean;
};

export const LOCAL_DATA_KEY = "roomrent-local-data-v1";

export function emptyLocalDatabase(): LocalDatabase {
  return { version: 1, rooms: [], invoices: [], expenses: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRoom(value: unknown): value is RentalRoom {
  if (!isRecord(value)) return false;
  return typeof value.id === "number"
    && Number.isFinite(value.id)
    && typeof value.roomNumber === "string"
    && typeof value.tenantName === "string"
    && typeof value.phone === "string"
    && typeof value.rentAmount === "number"
    && typeof value.waterRate === "number"
    && typeof value.electricRate === "number"
    && (value.status === "occupied" || value.status === "vacant" || value.status === "archived")
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}

function isInvoice(value: unknown): value is RentalInvoice {
  if (!isRecord(value)) return false;
  return typeof value.id === "number"
    && Number.isFinite(value.id)
    && typeof value.roomId === "number"
    && typeof value.roomNumber === "string"
    && typeof value.tenantName === "string"
    && typeof value.phone === "string"
    && typeof value.period === "string"
    && typeof value.dueDate === "string"
    && typeof value.rentAmount === "number"
    && typeof value.waterPrevious === "number"
    && typeof value.waterCurrent === "number"
    && typeof value.waterUnits === "number"
    && typeof value.waterRate === "number"
    && typeof value.waterAmount === "number"
    && typeof value.electricPrevious === "number"
    && typeof value.electricCurrent === "number"
    && typeof value.electricUnits === "number"
    && typeof value.electricRate === "number"
    && typeof value.electricAmount === "number"
    && Array.isArray(value.extras)
    && value.extras.every(item => isRecord(item) && typeof item.label === "string" && typeof item.amount === "number")
    && typeof value.totalAmount === "number"
    && typeof value.note === "string"
    && (value.status === "paid" || value.status === "unpaid")
    && typeof value.issuedAt === "string";
}

function isPromptPaySettings(value: unknown): value is PromptPaySettings {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.recipientName !== "string") return false;
  const id = value.id.replace(/\D/g, "");
  const validId = value.id === id && ((id.length === 10 && id.startsWith("0")) || id.length === 13 || id.length === 15);
  return validId && value.recipientName.trim().length > 0 && value.recipientName.length <= 80;
}

function isExpense(value: unknown): value is RentalExpense {
  if (!isRecord(value)) return false;
  const dateParts = typeof value.date === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.date) : null;
  if (!dateParts) return false;
  const [year, month, day] = dateParts.slice(1).map(Number);
  const parsedDate = new Date(year, month - 1, day);
  return typeof value.id === "number"
    && Number.isFinite(value.id)
    && parsedDate.getFullYear() === year
    && parsedDate.getMonth() === month - 1
    && parsedDate.getDate() === day
    && (value.category === "maintenance" || value.category === "utilities" || value.category === "cleaning" || value.category === "staff" || value.category === "supplies" || value.category === "tax" || value.category === "other")
    && typeof value.description === "string"
    && value.description.trim().length > 0
    && typeof value.amount === "number"
    && Number.isFinite(value.amount)
    && value.amount > 0
    && typeof value.note === "string"
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}

export function parseLocalDatabase(value: unknown): LocalDatabase | null {
  if (!isRecord(value)) return null;
  const payload = isRecord(value.data) ? value.data : value;
  if (!Array.isArray(payload.rooms) || !Array.isArray(payload.invoices)) return null;
  if (!payload.rooms.every(isRoom) || !payload.invoices.every(isInvoice)) return null;
  const expenses = payload.expenses ?? [];
  if (!Array.isArray(expenses) || !expenses.every(isExpense)) return null;
  if (payload.promptPay !== undefined && !isPromptPaySettings(payload.promptPay)) return null;
  return {
    version: 1,
    rooms: payload.rooms,
    invoices: payload.invoices,
    expenses,
    ...(payload.promptPay ? { promptPay: payload.promptPay } : {}),
    ...(payload.legacyRoomsImported === true ? { legacyRoomsImported: true } : {}),
  };
}

export function readLocalDatabase(): LocalDatabase {
  if (typeof window === "undefined") return emptyLocalDatabase();
  try {
    const raw = window.localStorage.getItem(LOCAL_DATA_KEY);
    if (!raw) return emptyLocalDatabase();
    return parseLocalDatabase(JSON.parse(raw)) ?? emptyLocalDatabase();
  } catch {
    return emptyLocalDatabase();
  }
}

export function formatMoney(value: number | string) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function currentPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftPeriod(period: string, by: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1 + by, 1);
  return currentPeriod(date);
}

export function formatPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
  });
}

export function formatThaiDate(date: string | Date) {
  if (date instanceof Date) return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsed = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function initials(name?: string | null) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "RR";
  return words.slice(0, 2).map(word => word[0]).join("").toLocaleUpperCase("th-TH");
}
