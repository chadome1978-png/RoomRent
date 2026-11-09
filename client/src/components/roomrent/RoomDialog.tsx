import { useState } from "react";
import { X } from "lucide-react";
import type { RentalRoom } from "./types";

type RoomFormValue = {
  roomNumber: string;
  tenantName: string;
  phone: string;
  rentAmount: number;
  waterRate: number;
  electricRate: number;
  status: "occupied" | "vacant" | "archived";
};

type Props = {
  room?: RentalRoom | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (values: RoomFormValue) => void;
};

export function RoomDialog({ room, busy, onClose, onSave }: Props) {
  const [roomNumber, setRoomNumber] = useState(room?.roomNumber ?? "");
  const [tenantName, setTenantName] = useState(room?.tenantName ?? "");
  const [phone, setPhone] = useState(room?.phone ?? "");
  const [rentAmount, setRentAmount] = useState(room ? String(room.rentAmount) : "");
  const [waterRate, setWaterRate] = useState(room ? String(room.waterRate) : "");
  const [electricRate, setElectricRate] = useState(room ? String(room.electricRate) : "");
  const [status, setStatus] = useState<RoomFormValue["status"]>(room?.status ?? "occupied");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomNumber.trim() || (status === "occupied" && !tenantName.trim())) {
      setError("กรุณากรอกเลขห้อง และระบุชื่อผู้เช่าสำหรับห้องที่มีผู้เช่า");
      return;
    }
    const rent = Number(rentAmount);
    const water = Number(waterRate || 0);
    const electric = Number(electricRate || 0);
    if (![rent, water, electric].every(value => Number.isFinite(value) && value >= 0)) {
      setError("กรุณาตรวจสอบจำนวนเงินและอัตราค่าสาธารณูปโภค");
      return;
    }
    onSave({ roomNumber: roomNumber.trim(), tenantName: tenantName.trim(), phone: phone.trim(), rentAmount: rent, waterRate: water, electricRate: electric, status });
  }

  return (
    <div className="dialog-scrim" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="dialog-panel room-dialog" role="dialog" aria-modal="true" aria-labelledby="room-dialog-title">
        <header className="dialog-header">
          <div>
            <span className="eyebrow">ข้อมูลห้องพัก</span>
            <h2 id="room-dialog-title">{room ? "แก้ไขห้องพัก" : "เพิ่มห้องใหม่"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="ปิดหน้าต่าง"><X size={19} /></button>
        </header>
        <form onSubmit={submit} className="dialog-form">
          <div className="form-grid two-col">
            <label className="field">
              <span>เลขห้อง <i>*</i></span>
              <input autoFocus maxLength={40} value={roomNumber} onChange={event => setRoomNumber(event.target.value)} placeholder="เช่น A-101" />
            </label>
            <label className="field">
              <span>สถานะห้อง</span>
              <select value={status} onChange={event => setStatus(event.target.value as RoomFormValue["status"])}>
                <option value="occupied">มีผู้เช่า</option>
                <option value="vacant">ว่าง</option>
              </select>
            </label>
          </div>
          <label className="field">
              <span>ชื่อผู้เช่า{status === "occupied" && <i> *</i>}</span>
              <input maxLength={160} value={tenantName} onChange={event => setTenantName(event.target.value)} placeholder={status === "vacant" ? "ยังไม่มีผู้เช่า" : "ชื่อ–นามสกุล"} />
          </label>
          <label className="field">
            <span>เบอร์โทรศัพท์</span>
            <input type="tel" maxLength={32} value={phone} onChange={event => setPhone(event.target.value)} placeholder="08X-XXX-XXXX" />
          </label>
          <div className="form-grid three-col">
            <label className="field">
              <span>ค่าเช่ารายเดือน <i>*</i></span>
              <div className="input-suffix"><input required type="number" min="0" step="0.01" value={rentAmount} onChange={event => setRentAmount(event.target.value)} placeholder="0" /><b>บาท</b></div>
            </label>
            <label className="field">
              <span>ค่าน้ำ / หน่วย</span>
              <div className="input-suffix"><input type="number" min="0" step="0.001" value={waterRate} onChange={event => setWaterRate(event.target.value)} placeholder="0" /><b>บาท</b></div>
            </label>
            <label className="field">
              <span>ค่าไฟ / หน่วย</span>
              <div className="input-suffix"><input type="number" min="0" step="0.001" value={electricRate} onChange={event => setElectricRate(event.target.value)} placeholder="0" /><b>บาท</b></div>
            </label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-footer">
            <button type="button" className="button button-quiet" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="button button-primary" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกข้อมูลห้อง"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
