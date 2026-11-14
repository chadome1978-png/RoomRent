# RoomRent: shared dataset แบบไม่ต้อง Login

## ผลและความเสี่ยงของโหมดนี้

โหมดนี้ใช้ข้อมูลชุดเดียวร่วมกัน ทุกคนที่เปิดแอปหรือเรียก Supabase Data API ด้วย publishable/anon key สามารถ **อ่าน เพิ่ม แก้ไข และลบรายการ รวมถึงแทนที่หรือล้าง shared document ทั้งชุดผ่าน RPC** ได้ Revision check ช่วยตรวจการแก้ไขชนกัน แต่ไม่ป้องกันผู้ไม่หวังดีที่เรียก API ได้ ข้อมูลที่เกี่ยวข้องเมื่อถูกเพิ่มรวมถึงชื่อและเบอร์ผู้เช่า บิล/สถานะชำระ รายจ่าย และ PromptPay ID ถือว่าเปิดเผยต่อสาธารณะ แอปแสดงคำเตือนก่อนใช้งาน แต่คำเตือนไม่ได้จำกัดสิทธิ์ผู้เรียก API

ตาราง `roomrent_account_data` และ snapshot ส่วนตัวเดิมยังคง owner-scoped; SQL ใหม่นี้เพิ่ม `roomrent_shared_data` แยกต่างหาก และไม่แก้หรือลบบัญชีอื่น แอป no-login ไม่เรียก Supabase Auth

## สถานะ Production ณ 14 พ.ย. 2026

- ผู้ใช้เลือกเริ่มด้วยชุดข้อมูลว่าง หลัง metadata-only preflight พบว่า snapshot ที่ระบุและตาราง legacy ว่าง; ไม่มี snapshot ถูกคัดลอก
- ติดตั้ง private staging schema แล้ว และรัน `roomrent_shared_data_enable_public.sql` สำเร็จ
- ตรวจ role metadata แล้ว: `anon` มี SELECT และ EXECUTE เฉพาะ save RPC; direct INSERT/UPDATE/DELETE และ EXECUTE ของ privileged preview/copy ถูกปฏิเสธ
- บัญชี Auth, private snapshots และข้อมูลต้นทางไม่ได้ถูกแก้ไข
- Frontend no-login ยังไม่ได้ push/deploy; Production website ยังคงเป็นเวอร์ชันเดิมจนกว่าจะปล่อย source ที่ตรวจแล้ว
- Auto Publish ของ bound Webdev project รายงานว่าเปิดอยู่; ห้าม push/checkpoint/deploy จนกว่าผู้ใช้ปิดสวิตช์ผ่าน Dashboard

## ไฟล์ SQL

- `supabase/roomrent_shared_data.sql` สร้าง private staging table, validator, revision RPC และ privileged preview/copy functions; ยังไม่ให้ anon อ่านหรือบันทึก
- `supabase/roomrent_shared_data_enable_public.sql` เป็น final gate ให้ `anon` อ่าน shared document และเรียก save RPC ได้ แต่ไม่ให้ direct `INSERT/UPDATE/DELETE` ที่ตาราง
- `preview_roomrent_account_snapshot` ส่งกลับเฉพาะ UUID, revision, จำนวนห้อง/บิล/รายจ่าย และสถานะ PromptPay ไม่ส่ง JSON ของผู้เช่า
- `copy_roomrent_account_snapshot_to_shared` ใช้เฉพาะเมื่อผู้ใช้ต้องการย้าย snapshot ที่ไม่ว่าง; ต้องระบุ UUID/revision ที่คาดหวัง, backup confirmation และ public consent; ปฏิเสธถ้า shared dataset ไม่ว่างหรือ revision เปลี่ยน; ส่งกลับเฉพาะ revision/counts

## เปิด public access สำหรับการเริ่มด้วยข้อมูลว่างที่อนุมัติ

ก่อนรัน final gate ตรวจยืนยันว่าแถว `shared` มีเพียง document ว่าง และผู้ใช้ยังยืนยันว่าต้องการให้ public API อ่าน/เขียน/ลบ/แทนที่เอกสารได้:

```sql
select
  revision,
  jsonb_array_length(document -> 'rooms') as rooms,
  jsonb_array_length(document -> 'invoices') as invoices,
  jsonb_array_length(document -> 'expenses') as expenses,
  (document ? 'promptPay') as prompt_pay_configured
from public.roomrent_shared_data
where id = 'shared';
```

ผลที่คาดสำหรับเส้นทางนี้คือ revision `1`, counts เป็น `0` และ `prompt_pay_configured` เป็น `false`. ห้ามดึงคอลัมน์ `document` ออกมาใน log/ประวัติที่แชร์ได้ จากนั้นรัน `supabase/roomrent_shared_data_enable_public.sql` ใน Supabase SQL Editor เพื่อเปิด anon SELECT และ save RPC เท่านั้น; direct table writes และ privileged preview/copy ยังคงถูกปฏิเสธ

## ย้ายข้อมูลในอนาคต (ถ้าต้องการ)

หากต้องการนำ snapshot อื่นเข้ามาภายหลัง ให้หยุดการใช้งาน shared dataset และอย่าเขียนทับข้อมูลปัจจุบันโดยตรง:

1. ดาวน์โหลด JSON backup จากต้นทางและเก็บไว้อย่างปลอดภัย; ตรวจจำนวนข้อมูลที่คาดไว้
2. ระบุ Auth UUID ของบัญชีต้นทางจาก Supabase Dashboard โดยไม่ใส่ UUID หรือ JSON ใน client code
3. เรียก `preview_roomrent_account_snapshot('<SOURCE_AUTH_USER_UUID>')` ใน SQL Editor; ตรวจเฉพาะ UUID/revision/counts และสถานะ PromptPay ไม่อ่าน `document`
4. ยืนยันบัญชีต้นทาง, backup และความเสี่ยงการเปิดเผยทั้งชุด แล้วเรียก `copy_roomrent_account_snapshot_to_shared(...)` พร้อม source/shared revision ที่ตรวจไว้
5. ตรวจ counts ที่ผลลัพธ์คืน หากไม่ตรงให้หยุด; ไม่เรียก copy ซ้ำแบบเดาสุ่ม

ฟังก์ชัน copy คง snapshot ต้นทางไว้ และไม่เปิด private snapshots ของบัญชีอื่น

## การทำงานของแอปและการเผยแพร่

- แอปอ่าน shared singleton ผ่าน Supabase JS client โดยไม่เรียก Auth และบันทึกผ่าน RPC ที่ตรวจ expected revision
- ใช้เฉพาะ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY`/publishable key ใน frontend; ห้ามใส่ service-role key ใน `VITE_*`, source, workflow logs หรือ bundle
- ถ้าตาราง/RLS/RPC ยังไม่พร้อม แอปแสดง error และไม่ยืนยันว่าบันทึกสำเร็จ
- ข้อมูลเดิมใน `localStorage` ไม่ถูกอัปโหลดอัตโนมัติ; ก่อน import ให้ export backup, แสดงจำนวนข้อมูล และให้ผู้ใช้ยืนยันซ้ำว่ากำลังเผยแพร่เข้า shared public dataset
- ใช้ static build `dist/public`; ไม่เพิ่ม container หรือ server-side credential
- ห้าม push/checkpoint ขณะ Auto Publish เปิดอยู่; ต้องตรวจสถานะจริงอีกครั้งก่อนส่ง source ไป `main`
