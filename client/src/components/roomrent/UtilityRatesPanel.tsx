import { useEffect, useState } from "react";
import { Check, Droplets, Info, Zap } from "lucide-react";
import type { UtilityRates } from "./types";

export function UtilityRatesPanel({ rates, onSave }: { rates: UtilityRates; onSave: (rates: UtilityRates) => void }) {
  const [water, setWater] = useState(String(rates.waterPerUnit));
  const [electric, setElectric] = useState(String(rates.electricPerUnit));
  const [error, setError] = useState("");

  useEffect(() => {
    setWater(String(rates.waterPerUnit));
    setElectric(String(rates.electricPerUnit));
  }, [rates]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { waterPerUnit: Number(water), electricPerUnit: Number(electric) };
    if (!Object.values(next).every(value => Number.isFinite(value) && value >= 0)) {
      setError("กรุณากรอกอัตราเป็นตัวเลขศูนย์หรือมากกว่า");
      return;
    }
    setError("");
    onSave(next);
  }

  return (
    <div className="utility-rates-view">
      <section className="section-intro">
        <div>
          <span className="eyebrow">ตั้งค่ากลางของระบบ</span>
          <h2>มาสเตอร์ค่าน้ำ–ค่าไฟ</h2>
          <p>กำหนดอัตราต่อหน่วยเพื่อใช้เป็นค่าเริ่มต้นในการเพิ่มห้องและออกบิลใหม่</p>
        </div>
      </section>
      <div className="utility-rates-layout">
        <form className="panel utility-rates-form" onSubmit={submit}>
          <div className="panel-heading"><div><span className="eyebrow">อัตราปัจจุบัน</span><h3>อัตราค่าสาธารณูปโภค</h3></div><span className="utility-rates-saved"><Check size={14} />บันทึกอัตโนมัติเมื่อกดยืนยัน</span></div>
          <div className="utility-rate-fields">
            <label className="utility-rate-card water-rate-card">
              <span className="utility-rate-icon"><Droplets size={21} /></span>
              <span className="field"><span>ค่าน้ำประปา / หน่วย</span><span className="input-suffix"><input aria-label="ค่าน้ำประปาต่อหน่วย" type="number" min="0" step="0.001" value={water} onChange={event => setWater(event.target.value)} /><b>บาท</b></span></span>
            </label>
            <label className="utility-rate-card electric-rate-card">
              <span className="utility-rate-icon"><Zap size={21} /></span>
              <span className="field"><span>ค่าไฟฟ้า / หน่วย</span><span className="input-suffix"><input aria-label="ค่าไฟฟ้าต่อหน่วย" type="number" min="0" step="0.001" value={electric} onChange={event => setElectric(event.target.value)} /><b>บาท</b></span></span>
            </label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-footer utility-rates-footer"><span>ตัวอย่าง: ใช้น้ำ 12 หน่วย × อัตราค่าน้ำ = ค่าน้ำที่เรียกเก็บ</span><button className="button button-primary" type="submit">บันทึก Master</button></div>
        </form>
        <aside className="panel utility-rates-guide">
          <div className="utility-guide-icon"><Info size={19} /></div>
          <div><h3>วิธีใช้งาน</h3><p>เมื่อเพิ่มห้องใหม่ ระบบจะเติมอัตราจาก Master ให้ทันที จากนั้นอัตราจะถูกใช้คำนวณจากเลขมิเตอร์:</p><div className="utility-formula"><strong>หน่วยที่ใช้</strong><span>=</span><strong>เลขปัจจุบัน − เลขครั้งก่อน</strong></div><div className="utility-formula"><strong>ยอดเรียกเก็บ</strong><span>=</span><strong>หน่วยที่ใช้ × อัตราต่อหน่วย</strong></div><small>ห้องเดิมและบิลที่ออกแล้วจะคงอัตราเดิม ไม่เปลี่ยนยอดย้อนหลัง</small></div>
        </aside>
      </div>
    </div>
  );
}
