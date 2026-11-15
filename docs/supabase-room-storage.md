# RoomRent: Supabase Cloud storage แบบ Public shared

เมื่อ build มี `VITE_SUPABASE_URL` และ publishable/anon key แอปจะเปิดใช้งานโดยไม่บังคับ Login และอ่าน/เขียนข้อมูลชุดเดียวกันผ่าน `roomrent_shared_data` ข้อมูลห้อง ผู้เช่า บิล รายจ่าย อัตราค่าน้ำค่าไฟ และ PromptPay จึงเป็นข้อมูลสาธารณะสำหรับผู้ที่เข้าถึงแอปหรือ Supabase API ได้

> คำเตือน: Public mode ไม่เหมาะกับข้อมูลผู้เช่าจริงหรือข้อมูลส่วนบุคคล ทุกคนที่มี URL/API สามารถอ่าน แก้ไข แทนที่ หรือล้าง shared dataset ได้ ระบบใช้ revision-checked RPC เพื่อป้องกันการเขียนชนกันเท่านั้น ไม่ใช่ระบบแยกสิทธิ์ผู้ใช้

## 1. ตั้งค่า Supabase Database

1. เปิดโปรเจกต์ Supabase ที่จะใช้กับ RoomRent และตรวจว่า Project URL กับ publishable/anon key เป็นของโปรเจกต์เดียวกัน
2. รัน [`../supabase/roomrent_shared_data.sql`](../supabase/roomrent_shared_data.sql) เพื่อสร้าง/ยืนยัน shared table และ validation RPC
3. รัน [`../supabase/public_mode.sql`](../supabase/public_mode.sql) เป็นขั้นตอนสุดท้ายเพื่อเปิดสิทธิ์อ่านให้ `anon`/`authenticated` และสิทธิ์เรียก `save_roomrent_shared_data`
4. ไม่ต้องเปิดหรือใช้ Supabase Auth สำหรับการเข้า RoomRent
5. ตาราง `roomrent_account_data` ยังคงปิดสิทธิ์ browser role และไม่ถูกนำมาแสดงใน Public mode

## 2. Build-time values

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

ห้ามใช้ `service_role` หรือ `sb_secret_...` ใน browser, `VITE_*`, GitHub Variables หรือไฟล์ build ควรใช้ publishable/anon key เท่านั้น

## 3. การทำงานของ Public mode

- แอปโหลดข้อมูลจากแถว `id = 'shared'` ใน `roomrent_shared_data` โดยไม่ต้องมี session
- การบันทึกใช้ `save_roomrent_shared_data(p_expected_revision, p_document)` ซึ่งตรวจ schema, ขนาดสูงสุด 1 MiB และ expected revision
- ทุกคนเห็นข้อมูล shared ชุดเดียวกัน และการแก้ไขจากผู้ใช้คนหนึ่งอาจทำให้ผู้ใช้อื่นเห็นข้อมูลใหม่
- ข้อมูลจาก localStorage ไม่ถูกอัปโหลดอัตโนมัติ ผู้ใช้ต้องสั่งนำเข้า/กู้คืนเอง
- ปุ่มลบบิลแสดงเฉพาะบิลที่ยังไม่ชำระ แต่ Public mode ไม่สามารถป้องกันผู้ใช้ที่มี API access จากการแทนที่ JSON ทั้งชุดได้

## 4. สำรองและกู้คืน

ก่อนเปิด Public mode หรือย้ายข้อมูล ให้ดาวน์โหลด backup JSON และตรวจสอบว่าไม่มีข้อมูลส่วนบุคคลที่ไม่ต้องการเผยแพร่ การนำเข้า/กู้คืนจะรวมข้อมูลผ่าน shared RPC และผู้เข้าถึงแอปทุกคนอาจเห็นข้อมูลนั้น

หากต้องการความเป็นส่วนตัว ให้เปลี่ยนกลับเป็น Auth/RLS mode ด้วย `p0_auth_rls.sql` และ deploy frontend ที่ใช้ account adapter แทน shared adapter

## 5. ทดสอบ

1. รัน `pnpm check`, `pnpm test`, `pnpm build:static` และ `node --check client/public/sw.js`
2. เปิด Production โดยไม่ Login และตรวจว่าข้อมูล shared โหลดได้
3. สร้างข้อมูลทดสอบ แก้ไขจากอีก browser และตรวจว่า revision conflict ถูกจัดการ
4. ตรวจ anonymous REST ว่าอ่าน `roomrent_shared_data` ได้ตามที่ตั้งใจ และ `roomrent_account_data` ยังอ่านไม่ได้
5. ห้ามใช้ข้อมูลผู้เช่าจริงใน fixture, test, log หรือ screenshot ของ Public mode

## อ้างอิงไฟล์

- [`../supabase/roomrent_shared_data.sql`](../supabase/roomrent_shared_data.sql) — shared table, validation และ revision-checked save RPC
- [`../supabase/public_mode.sql`](../supabase/public_mode.sql) — เปิด Public read/RPC grants
- [`../supabase/p0_auth_rls.sql`](../supabase/p0_auth_rls.sql) — migration สำหรับย้อนกลับไปใช้ Auth/RLS mode
- `client/src/components/roomrent/supabaseSharedData.ts` — shared repository ที่ไม่ต้องใช้ Auth
