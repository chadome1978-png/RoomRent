# RoomRent: Supabase Cloud storage สำหรับข้อมูลทั้งบัญชี

เมื่อ build มี `VITE_SUPABASE_URL` และ publishable/anon key แอปจะให้เจ้าของเข้าสู่ระบบด้วย Supabase Auth ก่อนอ่านหรือแก้ไขข้อมูล Cloud ข้อมูลห้อง/ผู้เช่า บิลและสถานะชำระ รายจ่าย และการตั้งค่า PromptPay จะอยู่ใน account snapshot ของผู้ใช้คนเดียว ข้อมูลจากอุปกรณ์และตาราง `rental_rooms` รุ่นก่อนจะไม่ถูกส่งหรือรวมขึ้น Cloud เอง ต้องดาวน์โหลดไฟล์สำรองและยืนยันการย้าย/รวมก่อนทุกครั้ง

## 1. ตั้งค่า Supabase Database และ Auth

1. เปิดโปรเจกต์ Supabase ที่จะใช้กับ RoomRent และตรวจว่า Project URL กับ publishable key เป็นของโปรเจกต์เดียวกัน
2. ใน **SQL Editor** รัน [`../supabase/rental_rooms.sql`](../supabase/rental_rooms.sql) หากต้องอ่านข้อมูลห้องจากระบบ Supabase รุ่นเดิม จากนั้นรัน [`../supabase/roomrent_account_data.sql`](../supabase/roomrent_account_data.sql) เพื่อสร้าง snapshot table, RLS และ RPC สำหรับบันทึกแบบ revision-checked
3. ตรวจว่า RLS เปิดอยู่บน `roomrent_account_data`; ไม่มี policy สำหรับ `anon` หรือ `public`; ผู้ใช้ `authenticated` อ่านได้เฉพาะแถวที่ `owner_id = auth.uid()` และเขียนข้อมูลผ่าน `save_roomrent_account_data` RPC เท่านั้น
4. ใน **Authentication → Providers** เปิด email/password sign-in และตัดสินใจว่าจะต้องยืนยันอีเมลหรือไม่
5. ใน **Authentication → URL Configuration** ตั้ง Site URL เป็น production `https://roomrent-local-pwa.pages.dev` และเพิ่มเฉพาะ development/Preview URLs ที่ใช้งานจริงใน Redirect URLs; อย่าใช้ wildcard กว้างเกินจำเป็น

`roomrent_account_data` เป็น JSONB snapshot หนึ่งแถวต่อเจ้าของ; ตาราง `rental_rooms` เป็นตาราง legacy ที่อ่านได้ระหว่าง migration เท่านั้น ระบบใหม่ไม่ลบหรือแก้ไขแถว legacy อัตโนมัติ ข้อมูลทั้งหมดใน snapshot ถูกคุ้มครองด้วย RLS; direct `INSERT`/`UPDATE`/`DELETE` ถูกเพิกถอนจาก `authenticated`; RPC จะตรวจ `auth.uid()`, รูปแบบ document, ขนาดสูงสุด 1 MiB และ expected revision เพื่อป้องกันการเขียนชนกัน

## 2. กำหนด build-time values

ใช้เฉพาะ Project URL และ **publishable key** (`sb_publishable_...`) หรือ legacy anon key จาก **Project Settings → API**:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

ห้ามใช้ `service_role` หรือ `sb_secret_...` ใน browser, `VITE_*`, GitHub Variables หรือไฟล์ build เพราะค่าที่ขึ้นต้นด้วย `VITE_` จะถูกใส่ใน JavaScript ที่ผู้ใช้ดาวน์โหลดได้ ความปลอดภัยมาจาก Auth/RLS ไม่ใช่การซ่อน publishable key

สำหรับ build ในเครื่อง ให้คัดลอก `.env.example` เป็น `.env` ที่ root ของโปรเจกต์ ใส่ค่าจริง แล้วรัน `pnpm build:static`; `.env` ถูก ignore และห้าม commit

สำหรับ GitHub Actions ให้ตั้ง repository **Settings → Secrets and variables → Actions → Variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

workflow นำค่าเหล่านี้มาใช้เฉพาะในขั้น build ก่อน Direct Upload ไป Cloudflare Pages ตัวแปรใน Cloudflare Pages Dashboard อย่างเดียวจะไม่เปลี่ยน bundle ที่สร้างมาแล้ว เพราะ Direct Upload รับ static files สำเร็จรูป ไม่ได้รัน Vite build ซ้ำหลังอัปโหลด

## 3. การเข้าสู่ระบบและแหล่งข้อมูล

หลัง deploy build ที่มีค่าตั้ง Supabase แอปจะแสดงหน้าเชื่อมต่อบัญชีและไม่แสดงข้อมูล local/Cloud จนกว่าจะยืนยัน session และโหลด account snapshot สำเร็จ ผู้ใช้ใหม่สามารถสมัคร email/password ได้ โดยการยืนยันอีเมลขึ้นกับค่า Auth Provider

เมื่อเข้าสู่ระบบ:

- ถ้ามี snapshot อยู่แล้วและไม่มีข้อมูลเก่าที่ต้องยืนยัน แอปโหลดข้อมูลของบัญชีนั้นและบันทึกการเปลี่ยนแปลงทั้งหมดกลับ Cloud
- ถ้ายังไม่มี snapshot, พบข้อมูลใน `localStorage`, หรือพบห้องใน `rental_rooms` รุ่นเดิม แอปจะแสดงหน้ากั้นการย้ายข้อมูล; ไม่มีการอัปโหลดอัตโนมัติ
- การบันทึกทำผ่าน `save_roomrent_account_data` RPC โดยส่ง expected revision; เมื่อเกิด network error หรือข้อมูลถูกแก้จากอุปกรณ์อื่น การบันทึกถูกปฏิเสธและ UI คืนข้อมูลเดิมแทนการแสดงว่าสำเร็จ
- ข้อมูล Cloud ไม่ถูกเก็บใน service-worker cache; app shell ใช้ออฟไลน์ได้ แต่ข้อมูล Cloud ต้องใช้อินเทอร์เน็ต

## 4. สำรองและย้าย/รวมข้อมูลเดิม

ก่อนกดย้าย ผู้ใช้ต้องกด **ดาวน์โหลดไฟล์สำรอง (JSON)** และติ๊กยืนยันว่าเก็บไฟล์ไว้แล้ว จากนั้นตรวจจำนวนห้อง บิล รายจ่าย และสถานะ PromptPay กับอีเมลบัญชี Supabase ปลายทาง แล้วจึงยืนยันการย้ายอีกครั้ง

ไฟล์ก่อน migration รวมข้อมูล local, snapshot ปัจจุบันที่อ่านได้ และห้องจากตาราง `rental_rooms` รุ่นเก่าเมื่ออ่านได้ แอปจะรวมรายการที่ไม่ซ้ำโดยเก็บข้อมูลเดิมไว้; หากพบเลขห้องหรือรอบบิลชนกันแต่รายละเอียดต่างกัน, PromptPay settings ขัดแย้ง, หรือ revision เปลี่ยนระหว่าง migration ระบบหยุดโดยไม่เขียนทับ ข้อมูลในอุปกรณ์และไฟล์ backup จะไม่ถูกลบเมื่อ migration ล้มเหลว

หลัง RPC บันทึกสำเร็จเท่านั้น แอปจึงเปิดหน้าหลัก Cloud และลบสำเนา local data ที่ย้ายแล้วจาก `localStorage`; snapshot จะบันทึก marker เพื่อไม่อ่าน/นำเข้าห้อง legacy ซ้ำ ทั้งนี้แอปไม่ลบตาราง `rental_rooms` เก่า ผู้ใช้สามารถดาวน์โหลด backup จาก Cloud ได้ภายหลังจากเมนู **สำรอง / กู้คืนข้อมูล**

การกู้คืนไฟล์ JSON ตรวจ schema ก่อนเขียน และแสดงการยืนยันก่อนรวมรายการตาม ID; หากเป็นบัญชี Cloud ให้ส่งออก backup ล่าสุดก่อน restore ระบบจะไม่กู้คืนหรือ merge โดยอัตโนมัติ

## 5. ทดสอบ

1. รัน `pnpm check`, `pnpm test`, `pnpm build:static` และ `node --check client/public/sw.js`
2. ใน Preview/production สมัครหรือเข้าสู่ระบบด้วยบัญชีทดสอบ แล้วตรวจว่าบัญชีที่ไม่มีข้อมูลแสดงตัวเลือกเริ่ม Cloud เปล่า หรือย้ายข้อมูลหลังดาวน์โหลด backup
3. สร้างห้อง บิล รายจ่าย และ PromptPay settings ด้วยข้อมูลสมมติ; รีโหลดหน้าและลงชื่อเข้าใช้อีกครั้งเพื่อยืนยันว่าทุกหมวดอยู่ใน Cloud
4. ตรวจว่า logout/บัญชีอื่นไม่เห็นข้อมูลเดิม และ SQL/RLS ไม่ให้ `anon` อ่านข้อมูล; ห้ามนำข้อมูลผู้เช่าจริงมาใช้เป็น fixture หรือใส่ใน test/log/screenshot
5. ปิดเครือข่ายระหว่างบันทึกและยืนยันว่าแอปแสดง error และไม่อ้างว่าบันทึกสำเร็จ

อย่าทดสอบ migration กับบัญชี production ที่มีข้อมูลจริงก่อนส่งออก backup และยืนยันว่า SQL/RLS พร้อมใช้งาน

## อ้างอิงไฟล์

- [`../supabase/rental_rooms.sql`](../supabase/rental_rooms.sql) — schema/RLS ของตารางห้องรุ่นเดิม
- [`../supabase/roomrent_account_data.sql`](../supabase/roomrent_account_data.sql) — account snapshot table, RLS และ revision-checked save RPC
- `client/src/components/roomrent/supabaseRooms.ts` — Supabase client, Auth และ legacy rooms read
- `client/src/components/roomrent/supabaseAccountData.ts` — อ่าน/บันทึก account snapshot
- `client/src/components/roomrent/accountMigration.ts` — ตรวจซ้ำ, map room references และ merge migration
- `client/src/components/roomrent/SupabaseAccountPanel.tsx` — Auth, backup confirmation และ migration UI
