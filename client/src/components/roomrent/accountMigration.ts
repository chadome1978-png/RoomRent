import type { LocalDatabase, RentalRoom } from "./types";

function createUniqueId(records: Array<{ id: number }>) {
  let id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  while (records.some(record => record.id === id)) id += 1;
  return id;
}

function roomEquivalent(left: RentalRoom, right: RentalRoom) {
  return left.roomNumber.trim().toLocaleLowerCase("th-TH") === right.roomNumber.trim().toLocaleLowerCase("th-TH")
    && left.tenantName === right.tenantName
    && left.phone === right.phone
    && left.rentAmount === right.rentAmount
    && left.waterRate === right.waterRate
    && left.electricRate === right.electricRate
    && left.status === right.status;
}

/** Build an opt-in merged snapshot without overwriting distinct records or ambiguous room/bill entries. */
export function mergeMigrationData(current: LocalDatabase, local: LocalDatabase, oldCloudRooms: RentalRoom[]): LocalDatabase {
  const rooms = [...current.rooms];
  const roomIdMap = new Map<number, number>();
  for (const candidate of [...oldCloudRooms, ...local.rooms]) {
    const sameId = rooms.find(room => room.id === candidate.id);
    const sameNumber = rooms.find(room => room.roomNumber.trim().toLocaleLowerCase("th-TH") === candidate.roomNumber.trim().toLocaleLowerCase("th-TH"));
    const existing = sameId ?? sameNumber;
    if (existing) {
      if (!roomEquivalent(existing, candidate)) throw new Error("พบข้อมูลห้องซ้ำแต่รายละเอียดไม่ตรงกัน กรุณาตรวจและแยกข้อมูลก่อนย้าย");
      roomIdMap.set(candidate.id, existing.id);
      continue;
    }
    const id = rooms.some(room => room.id === candidate.id) ? createUniqueId(rooms) : candidate.id;
    rooms.push({ ...candidate, id });
    roomIdMap.set(candidate.id, id);
  }

  const invoices = [...current.invoices];
  for (const source of local.invoices) {
    const candidate = { ...source, roomId: roomIdMap.get(source.roomId) ?? source.roomId };
    const sameId = invoices.find(invoice => invoice.id === candidate.id);
    const samePeriod = invoices.find(invoice => invoice.roomId === candidate.roomId && invoice.period === candidate.period);
    const existing = sameId ?? samePeriod;
    if (existing) {
      if (JSON.stringify({ ...existing, id: 0 }) !== JSON.stringify({ ...candidate, id: 0 })) throw new Error("พบข้อมูลบิลซ้ำหรือรอบบิลไม่ตรงกัน กรุณาตรวจสอบก่อนย้าย");
      continue;
    }
    const id = invoices.some(invoice => invoice.id === candidate.id) ? createUniqueId(invoices) : candidate.id;
    invoices.push({ ...candidate, id });
  }

  const expenses = [...current.expenses];
  for (const source of local.expenses) {
    const existing = expenses.find(expense => expense.id === source.id);
    if (existing && JSON.stringify({ ...existing, id: 0 }) === JSON.stringify({ ...source, id: 0 })) continue;
    const id = expenses.some(expense => expense.id === source.id) ? createUniqueId(expenses) : source.id;
    expenses.push({ ...source, id });
  }

  if (current.promptPay && local.promptPay && JSON.stringify(current.promptPay) !== JSON.stringify(local.promptPay)) {
    throw new Error("พบการตั้งค่า PromptPay ต่างกันใน Cloud และอุปกรณ์ กรุณาตัดสินใจและรวมข้อมูลด้วยตนเองก่อนย้าย");
  }
  return {
    version: 1,
    rooms,
    invoices,
    expenses,
    ...(current.promptPay ?? local.promptPay ? { promptPay: current.promptPay ?? local.promptPay } : {}),
    ...(oldCloudRooms.length || current.legacyRoomsImported ? { legacyRoomsImported: true } : {}),
  };
}

/** Non-validating view for the backup confirmation screen; exact deduplication happens before upload. */
export function getMigrationPreview(current: LocalDatabase, local: LocalDatabase, oldCloudRooms: RentalRoom[]): LocalDatabase {
  return {
    version: 1,
    rooms: [...current.rooms, ...oldCloudRooms, ...local.rooms],
    invoices: [...current.invoices, ...local.invoices],
    expenses: [...current.expenses, ...local.expenses],
    ...(current.promptPay ?? local.promptPay ? { promptPay: current.promptPay ?? local.promptPay } : {}),
    ...(current.legacyRoomsImported ? { legacyRoomsImported: true } : {}),
  };
}
