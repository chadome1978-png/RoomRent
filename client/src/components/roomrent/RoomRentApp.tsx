import { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  Download,
  FileClock,
  FilePlus2,
  FileText,
  Home,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  QrCode,
  Search,
  SlidersHorizontal,
  Upload,
  UsersRound,
  Wallet,
  Droplets,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ExpenseDialog } from "./ExpenseDialog";
import { FinanceDashboard } from "./FinanceDashboard";
import { InvoicePreview } from "./InvoicePreview";
import { PromptPaySettingsDialog } from "./PromptPaySettingsDialog";
import { RoomDialog } from "./RoomDialog";
import { RoomRentMark } from "./RoomRentMark";
import { SupabaseAccountPanel } from "./SupabaseAccountPanel";
import { getMigrationPreview, mergeMigrationData } from "./accountMigration";
import { fetchSupabaseAccountData, saveSupabaseAccountData } from "./supabaseAccountData";
import {
  getSupabaseRoomUser,
  isSupabaseRoomsConfigured,
  onSupabaseRoomAuthChange,
  fetchSupabaseRooms,
  resendSupabaseSignupConfirmation,
  signInToSupabaseRooms,
  signOutFromSupabaseRooms,
  signUpForSupabaseRooms,
  verifySupabaseSignupOtp,
} from "./supabaseRooms";
import {
  currentPeriod,
  emptyLocalDatabase,
  formatMoney,
  formatPeriod,
  formatThaiDate,
  initials,
  LOCAL_DATA_KEY,
  parseLocalDatabase,
  readLocalDatabase,
  shiftPeriod,
  type ExpenseDraft,
  type LocalDatabase,
  type PromptPaySettings,
  type RentalExpense,
  type RentalInvoice,
  type RentalRoom,
} from "./types";

type View = "overview" | "rooms" | "bills" | "finance";
type InvoiceDraft = {
  roomId: number; period: string; dueDate: string;
  rentAmount: number; waterRate: number; electricRate: number;
  waterPrevious: number; waterCurrent: number; electricPrevious: number; electricCurrent: number;
  extras: Array<{ label: string; amount: number }>; note: string;
};

function Icon({ children }: { children: React.ReactNode }) { return <span className="nav-icon">{children}</span>; }
function moneyInput(value: string) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function dayDueDate(period: string) { return `${period}-05`; }
function monthLabel(period: string) { return formatPeriod(period); }
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function createLocalId(records: Array<{ id: number }>) {
  let id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  while (records.some(record => record.id === id)) id += 1;
  return id;
}

async function fetchLegacyRooms(): Promise<RentalRoom[]> {
  try {
    return await fetchSupabaseRooms();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = String(error.code);
      if (code === "PGRST205" || code === "42P01") return [];
    }
    throw error;
  }
}

function BillStatus({ status }: { status: "paid" | "unpaid" }) {
  return <span className={`bill-status ${status === "paid" ? "bill-paid" : "bill-unpaid"}`}><i />{status === "paid" ? "ชำระแล้ว" : "รอชำระ"}</span>;
}

export function RoomRentApp() {
  const [data, setData] = useState<LocalDatabase>(() => readLocalDatabase());
  const dataRef = useRef(data);
  const backupInput = useRef<HTMLInputElement>(null);
  const [remoteRooms, setRemoteRooms] = useState<RentalRoom[]>([]);
  const [legacyRooms, setLegacyRooms] = useState<RentalRoom[]>([]);
  const [supabaseUser, setSupabaseUser] = useState<{ id: string; email?: string } | null>(null);
  const [supabaseLoading, setSupabaseLoading] = useState(isSupabaseRoomsConfigured);
  const [supabaseError, setSupabaseError] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const cloudRevision = useRef(0);
  const cloudEpoch = useRef(0);
  const confirmedCloudData = useRef(data);
  const cloudWriteBlocked = useRef(false);
  const cloudWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const [roomBusy, setRoomBusy] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [view, setView] = useState<View>("overview");
  const [period, setPeriod] = useState(currentPeriod());
  const [financePeriod, setFinancePeriod] = useState(currentPeriod());
  const [roomDialog, setRoomDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RentalRoom | null>(null);
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<RentalInvoice | null>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RentalExpense | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<RentalInvoice | null>(null);
  const [roomSearch, setRoomSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceRoomFilter, setInvoiceRoomFilter] = useState("all");
  const [invoicePeriodFilter, setInvoicePeriodFilter] = useState("all");
  const [dataToolsOpen, setDataToolsOpen] = useState(false);
  const [promptPaySettingsOpen, setPromptPaySettingsOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseRoomsConfigured) return;
    let active = true;
    async function refreshSessionAndAccount() {
      setSupabaseLoading(true);
      setSupabaseError("");
      try {
        const user = await getSupabaseRoomUser();
        if (!active) return;
        setSupabaseUser(user ? { id: user.id, email: user.email } : null);
        if (!user) {
          setLegacyRooms([]);
          setAccountData(emptyLocalDatabase(), 0, false);
          return;
        }
        const account = await fetchSupabaseAccountData();
        const previousRooms = account.document?.legacyRoomsImported ? [] : await fetchLegacyRooms();
        if (active) {
          setLegacyRooms(previousRooms);
          const local = readLocalDatabase();
          const hasLocalData = local.rooms.length + local.invoices.length + local.expenses.length > 0 || Boolean(local.promptPay);
          const needsExplicitMigration = hasLocalData || previousRooms.length > 0;
          setAccountData(account.document ?? emptyLocalDatabase(), account.revision, Boolean(account.document) && !needsExplicitMigration);
          if (needsExplicitMigration) setSupabaseError("พบข้อมูลเดิมในอุปกรณ์หรือในตารางห้องแบบเก่า ข้อมูลยังไม่ถูกรวมขึ้น Cloud โปรดดาวน์โหลดไฟล์สำรองและยืนยันก่อนดำเนินการ");
        }
      } catch {
        if (active) setSupabaseError("โหลดข้อมูลจาก Supabase ไม่สำเร็จ กรุณาตรวจ schema, RLS และการเชื่อมต่อ");
      } finally {
        if (active) setSupabaseLoading(false);
      }
    }
    void refreshSessionAndAccount();
    const unsubscribe = onSupabaseRoomAuthChange(signedIn => {
      if (!signedIn) {
        setSupabaseUser(null);
        setLegacyRooms([]);
        setAccountData(emptyLocalDatabase(), 0, false);
        return;
      }
      window.setTimeout(() => { if (active) void refreshSessionAndAccount(); }, 0);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  function setAccountData(nextData: LocalDatabase, revision: number, ready: boolean) {
    cloudEpoch.current += 1;
    dataRef.current = nextData;
    setData(nextData);
    setRemoteRooms(nextData.rooms);
    confirmedCloudData.current = nextData;
    cloudRevision.current = revision;
    cloudWriteBlocked.current = false;
    setCloudReady(ready);
  }

  async function updateData(transform: (current: LocalDatabase) => LocalDatabase): Promise<boolean> {
    if (isSupabaseRoomsConfigured && (!supabaseUser || !cloudReady)) {
      toast.error("กรุณาเข้าสู่ระบบและเตรียมบัญชี Cloud ก่อนบันทึกข้อมูล");
      return false;
    }
    const next = transform(dataRef.current);
    if (!isSupabaseRoomsConfigured) {
      dataRef.current = next;
      setData(next);
      try {
        window.localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(next));
        setStorageError("");
      } catch {
        setStorageError("พื้นที่จัดเก็บในอุปกรณ์ไม่พร้อม กรุณาส่งออกข้อมูลสำรองก่อนปิดหน้านี้");
      }
      return true;
    }
    dataRef.current = next;
    setData(next);
    setRemoteRooms(next.rooms);
    const writeEpoch = cloudEpoch.current;
    const operation = cloudWriteQueue.current.then(async () => {
      if (writeEpoch !== cloudEpoch.current) throw new Error("Supabase account changed before save");
      if (cloudWriteBlocked.current) throw new Error("Cloud writes paused after a previous failure");
      const revision = await saveSupabaseAccountData(next, cloudRevision.current);
      if (writeEpoch !== cloudEpoch.current) throw new Error("Supabase account changed during save");
      cloudRevision.current = revision;
      confirmedCloudData.current = next;
    });
    cloudWriteQueue.current = operation.catch(() => {
      if (writeEpoch !== cloudEpoch.current) return;
      cloudWriteBlocked.current = true;
      const confirmed = confirmedCloudData.current;
      dataRef.current = confirmed;
      setData(confirmed);
      setRemoteRooms(confirmed.rooms);
      setSupabaseError("บันทึกข้อมูล Cloud ไม่สำเร็จหรือมีการแก้ไขจากอุปกรณ์อื่น กรุณาโหลดบัญชีใหม่ก่อนลองอีกครั้ง");
    });
    try {
      await operation;
      setSupabaseError("");
      return true;
    } catch {
      toast.error("บันทึกข้อมูล Cloud ไม่สำเร็จ ข้อมูลเดิมยังไม่ถูกแทนที่");
      return false;
    }
  }

  const rooms = remoteRooms;
  const invoices = data.invoices;
  const expenses = data.expenses;
  const activeRooms = rooms.filter(room => room.status !== "archived");
  const occupiedRooms = rooms.filter(room => room.status === "occupied");
  const monthInvoices = invoices.filter(invoice => invoice.period === period);
  const totalBilled = roundMoney(monthInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
  const totalPaid = roundMoney(monthInvoices.filter(invoice => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.totalAmount, 0));
  const summary = {
    roomCount: activeRooms.length,
    occupiedCount: occupiedRooms.length,
    vacantCount: rooms.filter(room => room.status === "vacant").length,
    rentExpected: roundMoney(occupiedRooms.reduce((sum, room) => sum + room.rentAmount, 0)),
    billed: totalBilled,
    paid: totalPaid,
    unpaid: roundMoney(totalBilled - totalPaid),
    invoiceCount: monthInvoices.length,
    invoices: monthInvoices,
  };
  const roomDraftQuery = roomSearch.trim().toLocaleLowerCase("th-TH");
  const filteredRooms = activeRooms.filter(room => `${room.roomNumber} ${room.tenantName} ${room.phone}`.toLocaleLowerCase("th-TH").includes(roomDraftQuery));
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = `${invoice.roomNumber} ${invoice.tenantName} ${invoice.period}`.toLocaleLowerCase("th-TH").includes(invoiceSearch.trim().toLocaleLowerCase("th-TH"));
    const matchesRoom = invoiceRoomFilter === "all" || String(invoice.roomId) === invoiceRoomFilter;
    const matchesPeriod = invoicePeriodFilter === "all" || invoice.period === invoicePeriodFilter;
    return matchesSearch && matchesRoom && matchesPeriod;
  });
  const activePeriodInvoices = monthInvoices;
  const occupiedPercent = summary.roomCount ? Math.round((summary.occupiedCount / summary.roomCount) * 100) : 0;
  const isCurrentMonth = period === currentPeriod();

  async function saveRoom(values: { roomNumber: string; tenantName: string; phone: string; rentAmount: number; waterRate: number; electricRate: number; status: "occupied" | "vacant" | "archived" }) {
    if (!isSupabaseRoomsConfigured) { toast.error("ตั้งค่า Supabase ใน build environment ก่อนจัดการข้อมูล"); return; }
    const roomNumberKey = values.roomNumber.trim().toLocaleLowerCase("th-TH");
    const duplicate = remoteRooms.some(room => room.roomNumber.trim().toLocaleLowerCase("th-TH") === roomNumberKey && room.id !== editingRoom?.id);
    if (duplicate) {
      toast.error("มีเลขห้องนี้อยู่แล้ว");
      return;
    }
    if (!supabaseUser || !cloudReady) { toast.error("กรุณาเข้าสู่ระบบและเตรียมบัญชี Cloud ก่อนบันทึกห้อง"); return; }
    const now = new Date().toISOString();
    const room: RentalRoom = {
      ...values,
      id: editingRoom?.id ?? createLocalId(remoteRooms),
      rentAmount: roundMoney(values.rentAmount),
      createdAt: editingRoom?.createdAt ?? now,
      updatedAt: now,
    };
    const saved = await updateData(current => ({
      ...current,
      rooms: editingRoom ? current.rooms.map(item => item.id === room.id ? room : item) : [...current.rooms, room],
    }));
    if (!saved) return;
    toast.success(editingRoom ? "บันทึกการแก้ไขห้องใน Cloud แล้ว" : "เพิ่มห้องใน Cloud แล้ว");
    setRoomDialog(false);
    setEditingRoom(null);
  }

  async function setRoomOccupancy(room: RentalRoom) {
    if (room.status === "vacant" && !room.tenantName.trim()) {
      toast.error("กรุณาเพิ่มชื่อผู้เช่าก่อนเปลี่ยนสถานะห้อง");
      setEditingRoom(room);
      setRoomDialog(true);
      return;
    }
    if (!isSupabaseRoomsConfigured || !supabaseUser || !cloudReady) { toast.error("กรุณาเข้าสู่ระบบและเตรียมบัญชี Cloud ก่อนแก้ไขห้อง"); return; }
    const status: RentalRoom["status"] = room.status === "occupied" ? "vacant" : "occupied";
    const updated: RentalRoom = { ...room, status, updatedAt: new Date().toISOString() };
    if (await updateData(current => ({ ...current, rooms: current.rooms.map(item => item.id === room.id ? updated : item) }))) {
      toast.success(status === "vacant" ? `เปลี่ยนห้อง ${room.roomNumber} เป็นห้องว่างแล้ว` : `เปลี่ยนห้อง ${room.roomNumber} เป็นมีผู้เช่าแล้ว`);
    }
  }

  async function signInSupabase(username: string, password: string) {
    const user = await signInToSupabaseRooms(username, password);
    setSupabaseUser(user ? { id: user.id, email: user.email } : null);
    try {
      const account = await fetchSupabaseAccountData();
      const previousRooms = account.document?.legacyRoomsImported ? [] : await fetchLegacyRooms();
      setLegacyRooms(previousRooms);
      const local = readLocalDatabase();
      const needsExplicitMigration = local.rooms.length + local.invoices.length + local.expenses.length > 0 || Boolean(local.promptPay) || previousRooms.length > 0;
      setAccountData(account.document ?? emptyLocalDatabase(), account.revision, Boolean(account.document) && !needsExplicitMigration);
      setSupabaseError(needsExplicitMigration ? "พบข้อมูลเดิมในอุปกรณ์หรือตารางห้องแบบเก่า โปรดสำรองและยืนยันการรวมก่อนใช้งานต่อ" : "");
    } catch {
      setAccountData(emptyLocalDatabase(), 0, false);
      setSupabaseError("ยังโหลดข้อมูลไม่ได้ โปรดตรวจว่าติดตั้ง SQL schema และ RLS ของ RoomRent แล้ว");
    }
  }

  async function signUpSupabase(email: string, password: string) {
    const result = await signUpForSupabaseRooms(email, password);
    if (result.user && !result.needsEmailConfirmation) {
      setSupabaseUser({ id: result.user.id, email: result.user.email });
      try {
      const account = await fetchSupabaseAccountData();
        const previousRooms = account.document?.legacyRoomsImported ? [] : await fetchLegacyRooms();
        setLegacyRooms(previousRooms);
        const local = readLocalDatabase();
        const needsExplicitMigration = local.rooms.length + local.invoices.length + local.expenses.length > 0 || Boolean(local.promptPay) || previousRooms.length > 0;
        setAccountData(account.document ?? emptyLocalDatabase(), account.revision, Boolean(account.document) && !needsExplicitMigration);
        setSupabaseError(needsExplicitMigration ? "พบข้อมูลเดิมในอุปกรณ์หรือตารางห้องแบบเก่า โปรดสำรองและยืนยันการรวมก่อนใช้งานต่อ" : "");
      } catch {
        setAccountData(emptyLocalDatabase(), 0, false);
        setSupabaseError("ยังโหลดข้อมูลไม่ได้ โปรดตรวจว่าติดตั้ง SQL schema และ RLS ของ RoomRent แล้ว");
      }
    }
    return result.needsEmailConfirmation;
  }

  async function signOutSupabase() {
    await signOutFromSupabaseRooms();
    setSupabaseUser(null);
    setLegacyRooms([]);
    setAccountData(emptyLocalDatabase(), 0, false);
  }

  async function verifySupabaseEmail(email: string, token: string) {
    await verifySupabaseSignupOtp(email, token);
    // verifyOtp publishes SIGNED_IN on the shared client. The existing listener
    // loads only this owner's data and keeps the explicit backup/migration gate.
    toast.success("ยืนยันอีเมลสำเร็จแล้ว กำลังโหลดบัญชี Cloud");
  }

  async function saveBill(values: InvoiceDraft) {
    const currentData = dataRef.current;
    const existingInvoice = editingInvoice
      ? currentData.invoices.find(item => item.id === editingInvoice.id)
      : undefined;
    if (editingInvoice && (!existingInvoice || existingInvoice.status !== "unpaid")) {
      toast.error("แก้ไขได้เฉพาะบิลที่ยังไม่ชำระ");
      setInvoiceDialog(false);
      setEditingInvoice(null);
      return;
    }
    const storedRoom = currentData.rooms.find(item => item.id === values.roomId);
    if (!storedRoom || (!existingInvoice && storedRoom.status !== "occupied")) {
      toast.error("ไม่พบห้องที่มีผู้เช่า กรุณาตรวจสอบข้อมูลห้องอีกครั้ง");
      return;
    }
    if (currentData.invoices.some(invoice => invoice.id !== existingInvoice?.id && invoice.roomId === storedRoom.id && invoice.period === values.period)) {
      toast.error("ห้องนี้มีบิลในรอบดังกล่าวแล้ว");
      return;
    }
    if (![values.rentAmount, values.waterRate, values.electricRate].every(value => Number.isFinite(value) && value >= 0)) {
      toast.error("ค่าเช่าและอัตราค่าน้ำค่าไฟต้องเป็นตัวเลขศูนย์หรือมากกว่า");
      return;
    }
    if (values.waterCurrent < values.waterPrevious || values.electricCurrent < values.electricPrevious) {
      toast.error("เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าเลขครั้งก่อน");
      return;
    }
    const room = {
      ...storedRoom,
      ...(existingInvoice && existingInvoice.roomId === storedRoom.id ? {
        roomNumber: existingInvoice.roomNumber,
        tenantName: existingInvoice.tenantName,
        phone: existingInvoice.phone,
      } : {}),
      rentAmount: roundMoney(values.rentAmount),
      waterRate: roundMoney(values.waterRate),
      electricRate: roundMoney(values.electricRate),
    };
    const waterUnits = roundMoney(values.waterCurrent - values.waterPrevious);
    const electricUnits = roundMoney(values.electricCurrent - values.electricPrevious);
    const waterAmount = roundMoney(waterUnits * room.waterRate);
    const electricAmount = roundMoney(electricUnits * room.electricRate);
    const extras = values.extras.map(item => ({ label: item.label.trim(), amount: roundMoney(item.amount) }));
    const totalAmount = roundMoney(room.rentAmount + waterAmount + electricAmount + extras.reduce((sum, item) => sum + item.amount, 0));
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      toast.error("ยอดรวมบิลต้องไม่น้อยกว่าศูนย์");
      return;
    }
    const invoice: RentalInvoice = {
      id: existingInvoice?.id ?? createLocalId(currentData.invoices),
      roomId: room.id,
      roomNumber: room.roomNumber,
      tenantName: room.tenantName,
      phone: room.phone,
      period: values.period,
      dueDate: values.dueDate,
      rentAmount: room.rentAmount,
      waterPrevious: values.waterPrevious,
      waterCurrent: values.waterCurrent,
      waterUnits,
      waterRate: room.waterRate,
      waterAmount,
      electricPrevious: values.electricPrevious,
      electricCurrent: values.electricCurrent,
      electricUnits,
      electricRate: room.electricRate,
      electricAmount,
      extras,
      totalAmount,
      note: values.note.trim(),
      status: "unpaid",
      issuedAt: existingInvoice?.issuedAt ?? new Date().toISOString(),
    };
    const saved = await updateData(current => ({
      ...current,
      invoices: existingInvoice
        ? current.invoices.map(item => item.id === existingInvoice.id ? invoice : item)
        : [...current.invoices, invoice],
    }));
    if (!saved) return;
    setInvoiceDialog(false);
    setEditingInvoice(null);
    setSelectedInvoice(invoice);
    toast.success(`${existingInvoice ? "แก้ไขบิลแล้ว" : "ออกบิลแล้ว"} ยอดรวม ${formatMoney(totalAmount)}`);
  }

  async function togglePayment(invoice: RentalInvoice) {
    const status = invoice.status === "paid" ? "unpaid" : "paid";
    const saved = await updateData(current => ({
      ...current,
      invoices: current.invoices.map(item => item.id === invoice.id ? { ...item, status } : item),
    }));
    if (!saved) return;
    setSelectedInvoice(current => current ? { ...current, status } : null);
    toast.success(status === "paid" ? "บันทึกการชำระเงินแล้ว" : "เปลี่ยนสถานะเป็นรอชำระแล้ว");
  }

  async function savePromptPaySettings(settings: PromptPaySettings) {
    if (!await updateData(current => ({ ...current, promptPay: settings }))) return;
    setPromptPaySettingsOpen(false);
    toast.success(isSupabaseRoomsConfigured ? "บันทึกการตั้งค่า PromptPay ใน Cloud แล้ว" : "บันทึกข้อมูล PromptPay ในอุปกรณ์นี้แล้ว");
  }

  function openExpenseDialog(expense?: RentalExpense) {
    setEditingExpense(expense ?? null);
    setExpenseDialogOpen(true);
  }

  async function saveExpense(values: ExpenseDraft) {
    const currentData = dataRef.current;
    const existing = editingExpense ? currentData.expenses.find(item => item.id === editingExpense.id) : undefined;
    const now = new Date().toISOString();
    const expense: RentalExpense = {
      id: existing?.id ?? createLocalId(currentData.expenses),
      ...values,
      description: values.description.trim(),
      amount: roundMoney(values.amount),
      note: values.note.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const saved = await updateData(current => ({
      ...current,
      expenses: existing
        ? current.expenses.map(item => item.id === existing.id ? expense : item)
        : [...current.expenses, expense],
    }));
    if (!saved) return;
    setExpenseDialogOpen(false);
    setEditingExpense(null);
    toast.success(existing ? "แก้ไขรายจ่ายแล้ว" : "บันทึกรายจ่ายแล้ว");
  }

  async function deleteExpense(expense: RentalExpense) {
    if (!window.confirm(`ลบรายการ “${expense.description}” จำนวน ${formatMoney(expense.amount)} หรือไม่`)) return;
    if (await updateData(current => ({ ...current, expenses: current.expenses.filter(item => item.id !== expense.id) }))) toast.success("ลบรายการรายจ่ายแล้ว");
  }

  function migrationPreview(): LocalDatabase {
    return getMigrationPreview(dataRef.current, readLocalDatabase(), legacyRooms);
  }

  function exportBackup() {
    const backupData = isSupabaseRoomsConfigured && supabaseUser && !cloudReady
      ? migrationPreview()
      : isSupabaseRoomsConfigured && (!supabaseUser || !cloudReady)
        ? readLocalDatabase()
        : dataRef.current;
    const backup = {
      app: "RoomRent",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      data: backupData,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `roomrent-backup-${currentPeriod()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("เตรียมไฟล์สำรองข้อมูลแล้ว");
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseLocalDatabase(JSON.parse(await file.text()));
      if (!imported) throw new Error("รูปแบบไฟล์ไม่ถูกต้องหรือไม่ใช่ไฟล์สำรอง RoomRent");
      if (isSupabaseRoomsConfigured && (!supabaseUser || !cloudReady)) throw new Error("เข้าสู่ระบบและเตรียมบัญชี Cloud ก่อนกู้คืนข้อมูล");
      if (isSupabaseRoomsConfigured && !window.confirm(`รวมข้อมูลจากไฟล์สำรองเข้ากับข้อมูล Cloud ของ ${supabaseUser?.email ?? "บัญชีนี้"} หรือไม่? ระบบจะเก็บรายการเดิมที่ไม่ซ้ำไว้ และไม่ลบข้อมูลที่มีอยู่ แนะนำให้ส่งออก Cloud backup ล่าสุดก่อนดำเนินการ`)) return;
      const saved = await updateData(current => {
        const roomMap = new Map(current.rooms.map(room => [room.id, room]));
        const invoiceMap = new Map(current.invoices.map(invoice => [invoice.id, invoice]));
        const expenseMap = new Map(current.expenses.map(expense => [expense.id, expense]));
        imported.rooms.forEach(room => roomMap.set(room.id, room));
        imported.invoices.forEach(invoice => invoiceMap.set(invoice.id, invoice));
        imported.expenses.forEach(expense => expenseMap.set(expense.id, expense));
        return {
          ...current,
          version: 1,
          rooms: [...roomMap.values()],
          invoices: [...invoiceMap.values()],
          expenses: [...expenseMap.values()],
          ...(imported.promptPay ? { promptPay: imported.promptPay } : {}),
        };
      });
      if (!saved) return;
      setDataToolsOpen(false);
      toast.success(`รวมข้อมูลจากไฟล์แล้ว (${imported.rooms.length} ห้อง, ${imported.invoices.length} บิล, ${imported.expenses.length} รายจ่าย)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "อ่านไฟล์สำรองไม่สำเร็จ");
    } finally {
      event.target.value = "";
    }
  }

  async function migrateLocalDataToCloud() {
    if (!supabaseUser || cloudReady) return;
    let localData: LocalDatabase;
    try {
      localData = mergeMigrationData(dataRef.current, readLocalDatabase(), legacyRooms);
    } catch (error) {
      setSupabaseError(error instanceof Error ? error.message : "ข้อมูลเดิมมีรายการขัดแย้ง กรุณาตรวจสอบก่อนย้าย");
      return;
    }
    const count = localData.rooms.length + localData.invoices.length + localData.expenses.length;
    if (!count && !localData.promptPay) {
      toast.error("ไม่มีข้อมูลเดิมให้ย้าย เลือกเริ่มบัญชี Cloud เปล่าแทน");
      return;
    }
    const details = `${localData.rooms.length} ห้อง, ${localData.invoices.length} บิล, ${localData.expenses.length} รายจ่าย${localData.promptPay ? " และการตั้งค่า PromptPay" : ""}`;
    if (!window.confirm(`ยืนยันรวมข้อมูลเดิมทั้งหมด (${details}) เข้าบัญชี Cloud ${supabaseUser.email ?? "นี้"} หรือไม่? ระบบจะเก็บข้อมูล Cloud ปัจจุบันและรวมรายการที่ไม่ซ้ำ; หากพบรายการขัดแย้งจะหยุดโดยไม่เขียนทับ`)) return;
    setRoomBusy(true);
    setSupabaseError("");
    try {
      const revision = await saveSupabaseAccountData(localData, cloudRevision.current);
      setAccountData(localData, revision, true);
      setLegacyRooms([]);
      try { window.localStorage.removeItem(LOCAL_DATA_KEY); } catch { /* The downloaded backup remains the user's recovery copy. */ }
      toast.success(`ย้ายข้อมูล ${details} ขึ้น Cloud สำเร็จแล้ว`);
    } catch (error) {
      setSupabaseError(error instanceof Error ? error.message : "ย้ายข้อมูลไม่สำเร็จ; ข้อมูลเดิมในอุปกรณ์ยังคงอยู่");
    } finally {
      setRoomBusy(false);
    }
  }

  async function initializeEmptyCloud() {
    if (!supabaseUser || cloudReady) return;
    const existing = migrationPreview();
    if (cloudRevision.current > 0 || existing.rooms.length + existing.invoices.length + existing.expenses.length > 0 || existing.promptPay) {
      setSupabaseError("พบข้อมูล Cloud หรือข้อมูลเดิมในอุปกรณ์ โปรดสำรองและเลือกย้าย/รวมข้อมูลแทนการเริ่มบัญชีเปล่า");
      return;
    }
    if (!window.confirm(`เริ่มบัญชี Cloud เปล่าสำหรับ ${supabaseUser.email ?? "บัญชีนี้"} โดยไม่ย้ายข้อมูลในอุปกรณ์หรือไม่?`)) return;
    setRoomBusy(true);
    setSupabaseError("");
    try {
      const initialData = emptyLocalDatabase();
      const revision = await saveSupabaseAccountData(initialData, 0);
      setAccountData(initialData, revision, true);
      toast.success("เริ่มใช้บัญชี Cloud เปล่าแล้ว");
    } catch {
      setSupabaseError("เริ่มบัญชี Cloud ไม่สำเร็จ บัญชีนี้อาจมีข้อมูลอยู่แล้วหรือยังไม่ได้ติดตั้ง schema");
    } finally {
      setRoomBusy(false);
    }
  }

  function renderAccountPanel() {
    return <SupabaseAccountPanel
      configured={isSupabaseRoomsConfigured}
      loading={supabaseLoading}
      email={supabaseUser?.email}
      ready={cloudReady}
      hasCloudData={cloudRevision.current > 0}
      sourceData={migrationPreview()}
      error={supabaseError}
      busy={roomBusy}
      onSignIn={signInSupabase}
      onSignUp={signUpSupabase}
      onResendVerification={resendSupabaseSignupConfirmation}
      onVerifyEmailOtp={verifySupabaseEmail}
      onSignOut={signOutSupabase}
      onDownloadBackup={exportBackup}
      onMigrateLocalData={migrateLocalDataToCloud}
      onInitializeEmpty={initializeEmptyCloud}
    />;
  }

  if (isSupabaseRoomsConfigured && (!supabaseUser || !cloudReady || supabaseLoading)) {
    return (
      <div className="app-shell cloud-account-shell">
        <main className="cloud-account-main">
          <header className="cloud-account-brand"><RoomRentMark /><span>ข้อมูลส่วนตัว · เข้าถึงได้เฉพาะบัญชีที่เข้าสู่ระบบ</span></header>
          <div className="cloud-account-content"><h1>เชื่อมต่อข้อมูล RoomRent</h1><p>ข้อมูลห้อง บิล รายจ่าย และการตั้งค่า PromptPay จะโหลดจากบัญชี Supabase หลังเข้าสู่ระบบ</p>{renderAccountPanel()}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><RoomRentMark /></div>
        <div className="nav-caption">เมนูหลัก</div>
        <nav className="main-nav" aria-label="เมนูหลัก">
          <button className={`nav-item${view === "overview" ? " is-active" : ""}`} onClick={() => setView("overview")}><Icon><LayoutDashboard size={18} /></Icon><span>ภาพรวม</span></button>
          <button className={`nav-item${view === "rooms" ? " is-active" : ""}`} onClick={() => setView("rooms")}><Icon><Home size={18} /></Icon><span>ห้องพัก</span><span className="nav-count">{activeRooms.length}</span></button>
          <button className={`nav-item${view === "bills" ? " is-active" : ""}`} onClick={() => setView("bills")}><Icon><FileText size={18} /></Icon><span>บิลค่าเช่า</span></button>
          <button className={`nav-item${view === "finance" ? " is-active" : ""}`} onClick={() => setView("finance")}><Icon><BarChart3 size={18} /></Icon><span>รายรับ-รายจ่าย</span></button>
        </nav>
        <div className="sidebar-lower">
          <div className="sidebar-tip"><div className="tip-icon"><CircleHelp size={16} /></div><strong>{isSupabaseRoomsConfigured ? "ข้อมูลทั้งหมดอยู่ใน Cloud" : "จัดเก็บในอุปกรณ์นี้"}</strong><span>{isSupabaseRoomsConfigured ? "ข้อมูลบัญชีนี้ sync ผ่าน Supabase เมื่อออนไลน์" : "ข้อมูลอยู่ในอุปกรณ์นี้ · สำรองไฟล์ไว้เป็นประจำ"}</span><button className="local-backup-link" onClick={() => setDataToolsOpen(true)}><Download size={14} />สำรอง / กู้คืนข้อมูล</button><button className="local-backup-link" onClick={() => setPromptPaySettingsOpen(true)}><QrCode size={14} />ตั้งค่า QR PromptPay</button></div>
          <div className="account-row"><div className="avatar"><Database size={17} /></div><div className="account-info"><strong>{isSupabaseRoomsConfigured ? (supabaseUser?.email ?? "บัญชี Cloud") : "ข้อมูลในอุปกรณ์"}</strong><span>{rooms.length} ห้อง · {invoices.length} บิล · {expenses.length} รายจ่าย</span></div></div>
        </div>
      </aside>

      <div className="mobile-topbar"><RoomRentMark /><div className="mobile-top-actions"><span className="local-device-badge"><Database size={14} />{isSupabaseRoomsConfigured ? "Supabase" : "ในเครื่อง"}</span><button className="icon-button" aria-label="ตั้งค่า QR PromptPay" title="ตั้งค่า QR PromptPay" onClick={() => setPromptPaySettingsOpen(true)}><QrCode size={17} /></button><button className="icon-button" aria-label="สำรองหรือกู้คืนข้อมูล" onClick={() => setDataToolsOpen(true)}><Download size={17} /></button></div></div>
      <main className="main-area">
        <header className="page-header">
          <div className="page-title-wrap"><span className="eyebrow">ศูนย์จัดการห้องเช่า · {isSupabaseRoomsConfigured ? "บัญชี Cloud ส่วนตัว" : "ข้อมูลในอุปกรณ์นี้"}</span><h1>{view === "overview" ? "ภาพรวม" : view === "rooms" ? "ห้องพักทั้งหมด" : view === "finance" ? "รายรับ-รายจ่าย" : "บิลค่าเช่า"}</h1></div>
          <div className="page-actions">
            {view === "overview" && <div className="period-control"><button className="icon-button" onClick={() => setPeriod(current => shiftPeriod(current, -1))} aria-label="เดือนก่อนหน้า"><ChevronLeft size={17} /></button><span>{monthLabel(period)}</span><button className="icon-button" onClick={() => setPeriod(current => shiftPeriod(current, 1))} aria-label="เดือนถัดไป" disabled={isCurrentMonth}><ChevronRight size={17} /></button></div>}
            <button className="button button-primary header-cta" onClick={() => setInvoiceDialog(true)} disabled={!occupiedRooms.length}><FilePlus2 size={17} /><span>ออกบิลใหม่</span></button>
          </div>
        </header>

        <div className="page-content">
          <div className="local-storage-strip"><Database size={15} /><span>{isSupabaseRoomsConfigured ? "ห้อง บิล รายจ่าย และ PromptPay บันทึกใน Cloud · ขณะออฟไลน์เปิดได้เฉพาะ app shell" : "ข้อมูลเก็บในอุปกรณ์นี้ · ส่งออกไฟล์สำรองเพื่อป้องกันข้อมูลสูญหาย"}</span><button onClick={() => setDataToolsOpen(true)}>สำรองข้อมูล</button></div>
          {storageError && <div className="inline-warning storage-warning"><Bell size={15} />{storageError}</div>}
          {view === "overview" ? (
            <>
              <section className="welcome-row"><div><h2>สวัสดี <span>ครับ/ค่ะ</span></h2><p>นี่คือสรุปการจัดการห้องพัก ประจำ{monthLabel(period)}</p></div><div className="welcome-note"><span className="note-mark"><Check size={15} /></span><span>{summary.vacantCount ? `มีห้องว่าง ${summary.vacantCount} ห้อง` : "ห้องพักพร้อมให้จัดการ"}</span></div></section>
              <section className="stats-strip" aria-label="สรุปยอดประจำเดือน">
                <article className="stat-card stat-featured"><div className="stat-topline"><span>ยอดเรียกเก็บรอบนี้</span><div className="stat-icon stat-icon-teal"><Wallet size={18} /></div></div><strong className="stat-value">{formatMoney(summary.billed)}</strong><div className="stat-foot"><span className="stat-dot teal-dot" />{summary.invoiceCount} บิลที่ออกแล้ว</div></article>
                <article className="stat-card"><div className="stat-topline"><span>รับชำระแล้ว</span><div className="stat-icon stat-icon-green"><ArrowDownRight size={18} /></div></div><strong className="stat-value">{formatMoney(summary.paid)}</strong><div className="stat-foot"><span className="stat-dot green-dot" />{summary.billed ? `${Math.round((summary.paid / summary.billed) * 100)}% ของยอดเรียกเก็บ` : "ยังไม่มีการชำระ"}</div></article>
                <article className="stat-card"><div className="stat-topline"><span>ยอดค้างชำระ</span><div className="stat-icon stat-icon-amber"><ArrowUpRight size={18} /></div></div><strong className="stat-value">{formatMoney(summary.unpaid)}</strong><div className="stat-foot"><span className="stat-dot amber-dot" />{activePeriodInvoices.filter(invoice => invoice.status === "unpaid").length} บิลรอชำระ</div></article>
                <article className="stat-card"><div className="stat-topline"><span>ห้องมีผู้เช่า</span><div className="stat-icon stat-icon-blue"><UsersRound size={18} /></div></div><strong className="stat-value">{summary.occupiedCount}<small> / {summary.roomCount} ห้อง</small></strong><div className="occupancy-track"><span style={{ width: `${occupiedPercent}%` }} /></div><div className="stat-foot">อัตราการเข้าพัก {occupiedPercent}%</div></article>
              </section>
              <section className="overview-columns">
                <div className="panel recent-panel">
                  <div className="panel-heading"><div><span className="eyebrow">ติดตามความเคลื่อนไหว</span><h3>บิลประจำรอบ</h3></div><button className="text-button" onClick={() => setView("bills")}>ดูบิลทั้งหมด <ArrowRight size={15} /></button></div>
                  {monthInvoices.length ? <div className="compact-table"><div className="table-head"><span>ห้อง / ผู้เช่า</span><span>วันครบกำหนด</span><span>ยอดรวม</span><span>สถานะ</span><span /></div>{monthInvoices.slice(0, 6).map(invoice => <button className="table-row" key={invoice.id} onClick={() => setSelectedInvoice(invoice)}><span className="room-cell"><b className="room-chip">{invoice.roomNumber}</b><span><strong>{invoice.tenantName}</strong><small>รอบ {formatPeriod(invoice.period)}</small></span></span><span className="table-date">{formatThaiDate(invoice.dueDate)}</span><strong className="table-amount">{formatMoney(invoice.totalAmount)}</strong><BillStatus status={invoice.status} /><MoreHorizontal className="row-more" size={18} /></button>)}</div> : <EmptyState icon={<FileClock size={21} />} title="ยังไม่มีบิลในรอบนี้" description="เริ่มจากออกบิลเพื่อบันทึกมิเตอร์และแจ้งยอดค่าเช่า" action={<button className="button button-primary button-sm" onClick={() => setInvoiceDialog(true)} disabled={!occupiedRooms.length}><Plus size={15} />ออกบิลแรก</button>} />}
                </div>
                <aside className="panel side-summary">
                  <div className="panel-heading"><div><span className="eyebrow">ภาพรวมห้องพัก</span><h3>สถานะห้อง</h3></div><button className="icon-button" aria-label="ดูห้องพัก" onClick={() => setView("rooms")}><ArrowRight size={17} /></button></div>
                  <div className="room-status-overview"><div className="status-donut" style={{ "--occupancy": `${occupiedPercent}%` } as React.CSSProperties}><div><strong>{summary.occupiedCount}</strong><small>ห้อง</small></div></div><div className="status-legend"><div><i className="legend-dot dot-occupied" /><span>มีผู้เช่า</span><strong>{summary.occupiedCount}</strong></div><div><i className="legend-dot dot-vacant" /><span>ห้องว่าง</span><strong>{summary.vacantCount}</strong></div></div></div>
                  <div className="side-divider" /><div className="expected-rent"><div><span>ค่าเช่าฐาน / เดือน</span><small>เฉพาะห้องที่มีผู้เช่า</small></div><strong>{formatMoney(summary.rentExpected)}</strong></div>
                  <button className="wide-text-button" onClick={() => setView("rooms")}>จัดการข้อมูลห้องพัก <ArrowRight size={15} /></button>
                </aside>
              </section>
              <section className="utility-callout"><div className="callout-icon"><SlidersHorizontal size={18} /></div><div><strong>ก่อนปิดรอบบิล</strong><span>ตรวจเลขมิเตอร์ปัจจุบันและอัตราต่อหน่วยให้ครบถ้วนก่อนออกบิล</span></div><button onClick={() => setInvoiceDialog(true)} disabled={!occupiedRooms.length}>เริ่มออกบิล <ArrowRight size={15} /></button></section>
            </>
          ) : view === "rooms" ? (
            <>
              {renderAccountPanel()}
              <section className="section-intro"><div><h2>ดูแลข้อมูลผู้เช่าและอัตราค่าใช้จ่าย</h2><p>{isSupabaseRoomsConfigured ? "ข้อมูลห้องและรายการอื่นจะบันทึกในบัญชี Cloud นี้" : "ข้อมูลนี้ใช้เป็นค่าเริ่มต้นเมื่อคำนวณบิลประจำเดือน"}</p></div><button className="button button-primary" disabled={isSupabaseRoomsConfigured && (!supabaseUser || !cloudReady || supabaseLoading)} onClick={() => { setEditingRoom(null); setRoomDialog(true); }}><Plus size={17} />เพิ่มห้องพัก</button></section>
              <div className="filter-bar"><label className="search-field"><Search size={17} /><input value={roomSearch} onChange={event => setRoomSearch(event.target.value)} placeholder="ค้นหาเลขห้อง ชื่อ หรือเบอร์โทร" /></label><span className="filter-count">{filteredRooms.length} จาก {activeRooms.length} ห้อง</span></div>
              <section className="rooms-grid">{filteredRooms.map(room => <RoomCard key={room.id} room={room} hasBill={invoices.some(invoice => invoice.roomId === room.id && invoice.period === period)} onEdit={() => { setEditingRoom(room); setRoomDialog(true); }} onToggle={() => setRoomOccupancy(room)} onCreateInvoice={() => setInvoiceDialog(true)} />)}{!filteredRooms.length && <div className="full-span"><EmptyState icon={<Home size={21} />} title={activeRooms.length ? "ไม่พบห้องที่ค้นหา" : "เริ่มต้นด้วยการเพิ่มห้องพัก"} description={activeRooms.length ? "ลองเปลี่ยนคำค้นหาอีกครั้ง" : "เพิ่มรายละเอียดห้องและผู้เช่า เพื่อเริ่มออกบิลและติดตามค่าเช่ารายเดือนได้เลย"} action={!activeRooms.length ? <button className="button button-primary button-sm" onClick={() => setRoomDialog(true)}><Plus size={15} />เพิ่มห้องแรก</button> : undefined} /></div>}</section>
            </>
          ) : view === "finance" ? (
            <FinanceDashboard
              period={financePeriod}
              invoices={invoices}
              expenses={expenses}
              onPeriodChange={setFinancePeriod}
              onAddExpense={() => openExpenseDialog()}
              onEditExpense={openExpenseDialog}
              onDeleteExpense={deleteExpense}
              onOpenInvoice={setSelectedInvoice}
              onViewUnpaid={() => { setInvoicePeriodFilter(financePeriod); setInvoiceRoomFilter("all"); setInvoiceSearch(""); setView("bills"); }}
            />
          ) : (
            <>
              <section className="section-intro"><div><h2>บิลที่ออกให้ผู้เช่า</h2><p>ค้นย้อนหลังตามห้องและรอบเดือน แล้วเปิดดูเพื่อพิมพ์หรือส่งต่อ</p></div><button className="button button-primary" onClick={() => setInvoiceDialog(true)} disabled={!occupiedRooms.length}><FilePlus2 size={17} />ออกบิลใหม่</button></section>
              <div className="filter-bar invoice-filters"><label className="search-field"><Search size={17} /><input value={invoiceSearch} onChange={event => setInvoiceSearch(event.target.value)} placeholder="ค้นหาเลขห้อง ผู้เช่า หรือรอบบิล" /></label><label className="select-filter"><span>ห้อง</span><select value={invoiceRoomFilter} onChange={event => setInvoiceRoomFilter(event.target.value)}><option value="all">ทุกห้อง</option>{rooms.filter(room => room.status !== "archived").map(room => <option key={room.id} value={String(room.id)}>{room.roomNumber}</option>)}</select><ChevronDown size={14} /></label><label className="select-filter"><span>รอบเดือน</span><select value={invoicePeriodFilter} onChange={event => setInvoicePeriodFilter(event.target.value)}><option value="all">ทั้งหมด</option>{Array.from(new Set(invoices.map(invoice => invoice.period))).sort((a, b) => b.localeCompare(a)).map(item => <option value={item} key={item}>{formatPeriod(item)}</option>)}</select><ChevronDown size={14} /></label></div>
              <section className="panel history-panel">{filteredInvoices.length ? <div className="history-list"><div className="history-list-head"><span>ห้องพัก / ผู้เช่า</span><span>รอบบิล</span><span>วันครบกำหนด</span><span>ยอดสุทธิ</span><span>สถานะ</span><span /></div>{filteredInvoices.map(invoice => <button className="history-row" key={invoice.id} onClick={() => setSelectedInvoice(invoice)}><span className="room-cell"><b className="room-chip">{invoice.roomNumber}</b><span><strong>{invoice.tenantName}</strong><small>{invoice.phone || "ไม่มีเบอร์ติดต่อ"}</small></span></span><span className="history-period">{formatPeriod(invoice.period)}</span><span className="table-date">{formatThaiDate(invoice.dueDate)}</span><strong className="table-amount">{formatMoney(invoice.totalAmount)}</strong><BillStatus status={invoice.status} /><ArrowRight className="row-arrow" size={16} /></button>)}</div> : <EmptyState icon={<FileText size={21} />} title="ยังไม่มีบิลที่ตรงกับรายการนี้" description="ลองเปลี่ยนตัวกรอง หรือออกบิลใหม่จากห้องที่มีผู้เช่า" action={!invoices.length ? <button className="button button-primary button-sm" disabled={!occupiedRooms.length} onClick={() => setInvoiceDialog(true)}><Plus size={15} />ออกบิลใหม่</button> : undefined} />}</section>
              <div className="history-footnote"><FileClock size={15} />{isSupabaseRoomsConfigured ? "ข้อมูลบิลอยู่ในบัญชี Cloud นี้ · ส่งออกไฟล์สำรองก่อนย้ายหรือกู้คืน" : "ข้อมูลบิลอยู่ในอุปกรณ์นี้ · ส่งออกไฟล์สำรองเพื่อย้ายหรือกู้คืน"}</div>
            </>
          )}
        </div>
        <footer className="app-footer"><span>RoomRent <i>·</i> ดูแลค่าเช่าอย่างเป็นระบบ</span><span>{isSupabaseRoomsConfigured ? "ข้อมูลทั้งหมดจัดเก็บใน Supabase · ใช้งานข้อมูลเมื่อออนไลน์" : "ข้อมูลจัดเก็บในอุปกรณ์นี้ · สำรองไฟล์เป็นประจำ"}</span></footer>
      </main>
      <nav className="mobile-nav" aria-label="เมนูหลัก"><button className={view === "overview" ? "is-active" : ""} onClick={() => setView("overview")}><LayoutDashboard size={19} /><span>ภาพรวม</span></button><button className={view === "rooms" ? "is-active" : ""} onClick={() => setView("rooms")}><Home size={19} /><span>ห้องพัก</span></button><button className={view === "bills" ? "is-active" : ""} onClick={() => setView("bills")}><FileText size={19} /><span>บิล</span></button><button className={view === "finance" ? "is-active" : ""} onClick={() => setView("finance")}><BarChart3 size={19} /><span>การเงิน</span></button><button className="mobile-add" onClick={() => setInvoiceDialog(true)} disabled={!occupiedRooms.length}><Plus size={21} /><span>ออกบิล</span></button></nav>

      {roomDialog && <RoomDialog room={editingRoom} busy={roomBusy} onClose={() => { setRoomDialog(false); setEditingRoom(null); }} onSave={saveRoom} />}
      {invoiceDialog && <InvoiceComposer rooms={editingInvoice ? rooms.filter(room => room.status === "occupied" || room.id === editingInvoice.roomId) : occupiedRooms} invoices={invoices} period={editingInvoice?.period ?? period} editingInvoice={editingInvoice ?? undefined} onClose={() => { setInvoiceDialog(false); setEditingInvoice(null); }} onSave={saveBill} />}
      {selectedInvoice && <InvoicePreview invoice={selectedInvoice} promptPaySettings={data.promptPay} onConfigurePromptPay={() => setPromptPaySettingsOpen(true)} onClose={() => setSelectedInvoice(null)} onSetPaid={togglePayment} onEdit={invoice => { setSelectedInvoice(null); setEditingInvoice(invoice); setInvoiceDialog(true); }} busy={false} />}
      {expenseDialogOpen && <ExpenseDialog expense={editingExpense ?? undefined} onClose={() => { setExpenseDialogOpen(false); setEditingExpense(null); }} onSave={saveExpense} />}
      {dataToolsOpen && <div className="dialog-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && setDataToolsOpen(false)}><section className="dialog-panel data-tools-dialog" role="dialog" aria-modal="true" aria-labelledby="data-tools-title"><header className="dialog-header"><div><span className="eyebrow">ข้อมูลส่วนตัวของคุณ</span><h2 id="data-tools-title">สำรองและกู้คืน</h2></div><button className="icon-button" onClick={() => setDataToolsOpen(false)} aria-label="ปิด"><ChevronLeft size={19} /></button></header><div className="data-tools-body"><div className="data-local-summary"><Database size={19} /><div><strong>{isSupabaseRoomsConfigured ? "ข้อมูลของบัญชี Cloud" : "ข้อมูลในอุปกรณ์นี้"}</strong><span>{rooms.length} ห้อง · {invoices.length} บิล · {expenses.length} รายจ่าย</span></div></div><p>ไฟล์สำรองรวมข้อมูลที่โหลดได้ รวมถึง PromptPay ID ซึ่งเป็นข้อมูลส่วนตัว เก็บไฟล์ในที่ปลอดภัย; การกู้คืนจะรวมรายการตามรหัสและต้องยืนยันก่อนเขียนข้อมูลลงบัญชีนี้ โดยไม่ลบรายการเดิม</p><button className="button button-outline data-tool-button" onClick={() => { setDataToolsOpen(false); setPromptPaySettingsOpen(true); }}><QrCode size={17} />ตั้งค่า PromptPay QR</button><button className="button button-primary data-tool-button" onClick={exportBackup}><Download size={17} />ส่งออกไฟล์สำรอง (.json)</button><button className="button button-outline data-tool-button" onClick={() => backupInput.current?.click()}><Upload size={17} />นำเข้า / กู้คืนจากไฟล์สำรอง</button><input ref={backupInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={event => void importBackup(event)} /><div className="dialog-footer"><button className="button button-quiet" onClick={() => setDataToolsOpen(false)}>ปิด</button></div></div></section></div>}
      {promptPaySettingsOpen && <PromptPaySettingsDialog settings={data.promptPay} onClose={() => setPromptPaySettingsOpen(false)} onSave={savePromptPaySettings} />}
    </div>
  );
}

function RoomCard({ room, hasBill, onEdit, onToggle, onCreateInvoice }: { room: RentalRoom; hasBill: boolean; onEdit: () => void; onToggle: () => void; onCreateInvoice: () => void }) {
  return (
    <article className={`room-card${room.status === "vacant" ? " is-vacant" : ""}`}>
      <div className="room-card-top"><div className="room-identity"><b className="room-chip room-chip-large">{room.roomNumber}</b><span className={`room-state ${room.status === "occupied" ? "state-occupied" : "state-vacant"}`}><i />{room.status === "occupied" ? "มีผู้เช่า" : "ห้องว่าง"}</span></div><button className="icon-button room-edit" onClick={onEdit} aria-label={`แก้ไขห้อง ${room.roomNumber}`}><MoreHorizontal size={19} /></button></div>
      <div className="room-tenant"><div className="tenant-avatar">{room.tenantName ? initials(room.tenantName) : "ว"}</div><div><strong>{room.tenantName || "ยังไม่มีผู้เช่า"}</strong><small>{room.phone || "ไม่ได้ระบุเบอร์โทร"}</small></div></div>
      <div className="room-card-rule" />
      <div className="room-rent-row"><span>ค่าเช่ารายเดือน</span><strong>{formatMoney(room.rentAmount)}</strong></div>
      <div className="room-utilities"><span><Droplets size={14} />น้ำ {formatMoney(room.waterRate)}<small>/หน่วย</small></span><span><Zap size={14} />ไฟ {formatMoney(room.electricRate)}<small>/หน่วย</small></span></div>
      <footer className="room-card-footer"><span className={`bill-mini${hasBill ? " is-billed" : ""}`}><i />{hasBill ? "ออกบิลแล้ว" : "ยังไม่ออกบิล"}</span><button className="room-action" onClick={room.status === "occupied" && !hasBill ? onCreateInvoice : onToggle}>{room.status === "occupied" && !hasBill ? "ออกบิล" : room.status === "occupied" ? "ทำเครื่องหมายว่าง" : "ทำเครื่องหมายมีผู้เช่า"}<ArrowRight size={14} /></button></footer>
    </article>
  );
}

function InvoiceComposer({ rooms, invoices, period: initialPeriod, editingInvoice, onClose, onSave }: {
  rooms: RentalRoom[]; invoices: RentalInvoice[]; period: string; editingInvoice?: RentalInvoice; onClose: () => void;
  onSave: (values: InvoiceDraft) => void;
}) {
  const initialRoomId = editingInvoice ? String(editingInvoice.roomId) : String(rooms[0]?.id ?? "");
  const initialRoom = rooms.find(item => String(item.id) === initialRoomId);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [period, setPeriod] = useState(editingInvoice?.period ?? initialPeriod);
  const [dueDate, setDueDate] = useState(editingInvoice?.dueDate ?? dayDueDate(initialPeriod));
  const [rentAmount, setRentAmount] = useState(String(editingInvoice?.rentAmount ?? initialRoom?.rentAmount ?? 0));
  const [waterRate, setWaterRate] = useState(String(editingInvoice?.waterRate ?? initialRoom?.waterRate ?? 0));
  const [electricRate, setElectricRate] = useState(String(editingInvoice?.electricRate ?? initialRoom?.electricRate ?? 0));
  const selectedRoom = rooms.find(item => String(item.id) === roomId);
  const room = selectedRoom
    ? {
      ...selectedRoom,
      ...(editingInvoice?.roomId === selectedRoom.id ? {
        roomNumber: editingInvoice.roomNumber,
        tenantName: editingInvoice.tenantName,
        phone: editingInvoice.phone,
      } : {}),
      rentAmount: moneyInput(rentAmount),
      waterRate: moneyInput(waterRate),
      electricRate: moneyInput(electricRate),
    }
    : undefined;
  const previous = room ? invoices.filter(invoice => invoice.id !== editingInvoice?.id && invoice.roomId === room.id && invoice.period < period).sort((a, b) => b.period.localeCompare(a.period))[0] : undefined;
  const [waterPrevious, setWaterPrevious] = useState(editingInvoice ? String(editingInvoice.waterPrevious) : previous ? String(previous.waterCurrent) : "0");
  const [waterCurrent, setWaterCurrent] = useState(editingInvoice ? String(editingInvoice.waterCurrent) : "");
  const [electricPrevious, setElectricPrevious] = useState(editingInvoice ? String(editingInvoice.electricPrevious) : previous ? String(previous.electricCurrent) : "0");
  const [electricCurrent, setElectricCurrent] = useState(editingInvoice ? String(editingInvoice.electricCurrent) : "");
  const [extras, setExtras] = useState<Array<{ label: string; amount: string }>>(editingInvoice ? editingInvoice.extras.map(item => ({ label: item.label, amount: String(item.amount) })) : []);
  const [note, setNote] = useState(editingInvoice?.note ?? "");
  const [error, setError] = useState("");
  const waterUnits = Math.max(0, moneyInput(waterCurrent) - moneyInput(waterPrevious));
  const electricUnits = Math.max(0, moneyInput(electricCurrent) - moneyInput(electricPrevious));
  const waterTotal = roundMoney(waterUnits * Number(room?.waterRate ?? 0));
  const electricTotal = roundMoney(electricUnits * Number(room?.electricRate ?? 0));
  const extraTotal = extras.reduce((sum, item) => sum + moneyInput(item.amount), 0);
  const rawTotal = Number(room?.rentAmount ?? 0) + waterTotal + electricTotal + extraTotal;
  const invoiceTotal = Math.max(0, roundMoney(rawTotal));
  const duplicate = room ? invoices.some(invoice => invoice.id !== editingInvoice?.id && invoice.roomId === room.id && invoice.period === period) : false;

  function onPeriodChange(next: string) {
    setPeriod(next);
    setDueDate(dayDueDate(next));
    setWaterCurrent("");
    setElectricCurrent("");
    const last = room ? invoices.filter(invoice => invoice.id !== editingInvoice?.id && invoice.roomId === room.id && invoice.period < next).sort((a, b) => b.period.localeCompare(a.period))[0] : undefined;
    setWaterPrevious(last ? String(last.waterCurrent) : "0");
    setElectricPrevious(last ? String(last.electricCurrent) : "0");
  }
  function onRoomChange(next: string) {
    setRoomId(next);
    setWaterCurrent("");
    setElectricCurrent("");
    const nextRoom = rooms.find(item => String(item.id) === next);
    setRentAmount(String(editingInvoice && editingInvoice.roomId === Number(next) ? editingInvoice.rentAmount : nextRoom?.rentAmount ?? 0));
    setWaterRate(String(editingInvoice && editingInvoice.roomId === Number(next) ? editingInvoice.waterRate : nextRoom?.waterRate ?? 0));
    setElectricRate(String(editingInvoice && editingInvoice.roomId === Number(next) ? editingInvoice.electricRate : nextRoom?.electricRate ?? 0));
    const last = invoices.filter(invoice => invoice.id !== editingInvoice?.id && invoice.roomId === Number(next) && invoice.period < period).sort((a, b) => b.period.localeCompare(a.period))[0];
    setWaterPrevious(last ? String(last.waterCurrent) : "0");
    setElectricPrevious(last ? String(last.electricCurrent) : "0");
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const waterNow = Number(waterCurrent), waterBefore = Number(waterPrevious), electricNow = Number(electricCurrent), electricBefore = Number(electricPrevious);
    if (!room || !dueDate) { setError("กรุณาเลือกห้องและวันครบกำหนด"); return; }
    if (duplicate) { setError("ห้องนี้มีบิลในรอบที่เลือกแล้ว"); return; }
    if (![rentAmount, waterRate, electricRate].every(value => Number.isFinite(Number(value)) && Number(value) >= 0)) { setError("กรุณากรอกค่าเช่าและอัตราค่าน้ำค่าไฟเป็นศูนย์หรือมากกว่า"); return; }
    if (![waterNow, waterBefore, electricNow, electricBefore].every(value => Number.isFinite(value) && value >= 0)) { setError("กรุณากรอกเลขมิเตอร์ให้ถูกต้อง"); return; }
    if (waterNow < waterBefore || electricNow < electricBefore) { setError("เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าเลขครั้งก่อน"); return; }
    if (extras.some(item => !item.label.trim() || !Number.isFinite(Number(item.amount)))) { setError("กรุณากรอกชื่อและจำนวนเงินของรายการเพิ่มเติม"); return; }
    if (roundMoney(rawTotal) < 0) { setError("ยอดรวมบิลต้องไม่น้อยกว่าศูนย์"); return; }
    const [year, month, day] = dueDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) { setError("กรุณาตรวจสอบวันครบกำหนด"); return; }
    onSave({ roomId: room.id, period, dueDate, rentAmount: moneyInput(rentAmount), waterRate: moneyInput(waterRate), electricRate: moneyInput(electricRate), waterPrevious: waterBefore, waterCurrent: waterNow, electricPrevious: electricBefore, electricCurrent: electricNow, extras: extras.filter(item => item.label.trim()).map(item => ({ label: item.label.trim(), amount: roundMoney(Number(item.amount)) })), note: note.trim() });
  }

  return (
    <div className="dialog-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="dialog-panel bill-composer" role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <header className="dialog-header"><div><span className="eyebrow">{editingInvoice ? "แก้ไขบิลที่ยังไม่ชำระ" : "แจ้งยอดค่าเช่าประจำเดือน"}</span><h2 id="composer-title">{editingInvoice ? "แก้ไขบิล" : "ออกบิลใหม่"}</h2></div><button className="icon-button" onClick={onClose} aria-label="ปิด"><ChevronLeft size={19} /></button></header>
        <form className="composer-body" onSubmit={submit}>
          <div className="form-grid two-col"><label className="field"><span>ห้องพัก <i>*</i></span><div className="select-wrap"><select value={roomId} onChange={event => onRoomChange(event.target.value)} required><option value="" disabled>เลือกห้อง</option>{rooms.map(item => <option key={item.id} value={String(item.id)}>{item.roomNumber} · {item.tenantName}</option>)}</select><ChevronDown size={15} /></div></label><label className="field"><span>รอบบิล <i>*</i></span><input type="month" value={period} onChange={event => onPeriodChange(event.target.value)} required /></label></div>
          {room && <div className="selected-room-note"><div className="tenant-avatar">{initials(room.tenantName)}</div><span><strong>{room.tenantName}</strong><small>ค่าเช่าฐาน {formatMoney(room.rentAmount)}</small></span><b className="room-chip">{room.roomNumber}</b></div>}
          {editingInvoice && <><div className="form-grid three-col"><label className="field"><span>ค่าเช่าห้อง (บาท)</span><input type="number" min="0" step="0.01" value={rentAmount} onChange={event => setRentAmount(event.target.value)} required /></label><label className="field"><span>ค่าน้ำ / หน่วย</span><input type="number" min="0" step="0.01" value={waterRate} onChange={event => setWaterRate(event.target.value)} required /></label><label className="field"><span>ค่าไฟ / หน่วย</span><input type="number" min="0" step="0.01" value={electricRate} onChange={event => setElectricRate(event.target.value)} required /></label></div><p className="history-footnote">ค่าเช่าและอัตราที่ปรับมีผลกับบิลนี้เท่านั้น ไม่เปลี่ยนข้อมูลตั้งต้นของห้อง</p></>}
          {duplicate && <div className="inline-warning"><Bell size={15} />บิลของห้องนี้ในรอบ {formatPeriod(period)} มีอยู่แล้ว กรุณาเลือกเดือนอื่น</div>}
          <div className="meter-block"><div className="section-label"><div><strong>บันทึกมิเตอร์</strong><span>กรอกเลขครั้งก่อนและเลขปัจจุบัน</span></div><span className="meter-unit-label">หน่วย</span></div><MeterRow icon={<Droplets size={16} />} label="น้ำประปา" previous={waterPrevious} setPrevious={setWaterPrevious} current={waterCurrent} setCurrent={setWaterCurrent} rate={Number(room?.waterRate ?? 0)} total={waterTotal} units={waterUnits} /><MeterRow icon={<Zap size={16} />} label="ไฟฟ้า" previous={electricPrevious} setPrevious={setElectricPrevious} current={electricCurrent} setCurrent={setElectricCurrent} rate={Number(room?.electricRate ?? 0)} total={electricTotal} units={electricUnits} /></div>
          <div className="extra-block"><div className="section-label"><div><strong>ค่าใช้จ่ายเพิ่มเติม</strong><span>ค่าขยะ ค่าจอดรถ หรือส่วนลด</span></div><button type="button" className="add-link" onClick={() => setExtras(current => [...current, { label: "", amount: "" }])}><Plus size={14} />เพิ่มรายการ</button></div>{!extras.length ? <p className="no-extra">ไม่มีรายการเพิ่มเติมในบิลนี้</p> : extras.map((item, index) => <div className="extra-line" key={index}><input aria-label="ชื่อรายการเพิ่มเติม" maxLength={80} placeholder="ชื่อรายการ" value={item.label} onChange={event => setExtras(current => current.map((line, i) => i === index ? { ...line, label: event.target.value } : line))} /><div className="input-suffix"><input aria-label="จำนวนเงิน" type="number" step="0.01" placeholder="0" value={item.amount} onChange={event => setExtras(current => current.map((line, i) => i === index ? { ...line, amount: event.target.value } : line))} /><b>บาท</b></div><button type="button" className="remove-extra" aria-label="ลบรายการ" onClick={() => setExtras(current => current.filter((_, i) => i !== index))}>×</button></div>)}</div>
          <div className="form-grid two-col composer-lower"><label className="field"><span>วันครบกำหนด <i>*</i></span><input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} required /></label><label className="field"><span>หมายเหตุ</span><input maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" /></label></div>
          <div className="bill-calculation"><div><span>ค่าเช่า</span><strong>{formatMoney(room?.rentAmount ?? 0)}</strong></div><div><span>ค่าน้ำ · {waterUnits.toLocaleString("th-TH")} หน่วย</span><strong>{formatMoney(waterTotal)}</strong></div><div><span>ค่าไฟ · {electricUnits.toLocaleString("th-TH")} หน่วย</span><strong>{formatMoney(electricTotal)}</strong></div>{extras.length > 0 && <div><span>รายการเพิ่มเติม</span><strong>{formatMoney(extraTotal)}</strong></div>}<div className="calculation-total"><span>ยอดรวมบิล</span><strong>{formatMoney(invoiceTotal)}</strong></div></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-footer composer-footer"><button type="button" className="button button-quiet" onClick={onClose}>ยกเลิก</button><button type="submit" className="button button-primary" disabled={!room || duplicate}>{editingInvoice ? "บันทึกการแก้ไข" : "ตรวจยอดและออกบิล"}<ArrowRight size={16} /></button></div>
        </form>
      </section>
    </div>
  );
}

function MeterRow({ icon, label, previous, setPrevious, current, setCurrent, rate, total, units }: { icon: React.ReactNode; label: string; previous: string; setPrevious: (value: string) => void; current: string; setCurrent: (value: string) => void; rate: number; total: number; units: number }) {
  return <div className="meter-row"><div className="meter-name"><span className="meter-icon">{icon}</span><strong>{label}</strong><small>{formatMoney(rate)} / หน่วย</small></div><label><span className="mobile-field-label">ครั้งก่อน</span><input type="number" min="0" step="0.001" placeholder="เลขเดิม" value={previous} onChange={event => setPrevious(event.target.value)} aria-label={`${label}เลขครั้งก่อน`} /></label><ArrowRight className="meter-arrow" size={15} /><label><span className="mobile-field-label">ปัจจุบัน</span><input type="number" min="0" step="0.001" placeholder="เลขใหม่" value={current} onChange={event => setCurrent(event.target.value)} aria-label={`${label}เลขปัจจุบัน`} /></label><div className="meter-calc"><span>{units.toLocaleString("th-TH")} หน่วย</span><strong>{formatMoney(total)}</strong></div></div>;
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
