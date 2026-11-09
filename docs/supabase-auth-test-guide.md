# คู่มือทดสอบ Supabase Login/Logout — RoomRent

คู่มือนี้ใช้ทดสอบการสมัครบัญชี, Login, การคง session, Logout และการแยกข้อมูลห้องด้วย Supabase Auth ใน RoomRent โดยไม่ใช้บัญชีหรือข้อมูลผู้เช่าจริง

> **สถานะปัจจุบัน:** source ของ RoomRent มีฟอร์ม Auth และ adapter แล้ว แต่ build environment ที่ตรวจล่าสุดยังไม่มี `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` จึงยังทดสอบการเชื่อมต่อ Supabase จริงไม่ได้ จนกว่าจะตั้งค่าแล้ว rebuild/redeploy เว็บ

## ขอบเขตที่ทดสอบ

ระบบใช้ Supabase Auth สำหรับข้อมูล **ห้องพัก** เท่านั้น เมื่อผู้ใช้ล็อกอิน แอปโหลดห้องของบัญชีนั้นผ่าน `public.rental_rooms` และ RLS; เมื่อ Logout แอปหยุดแสดงห้องจากบัญชีนั้น บิล รายจ่าย และ PromptPay ยังอยู่ใน local storage ของอุปกรณ์ จึงไม่ได้ซิงก์ข้ามอุปกรณ์

ใน source ฟังก์ชันที่เกี่ยวข้องคือ `getSupabaseRoomUser()`, `onSupabaseRoomAuthChange()`, `signInToSupabaseRooms()`, `signUpForSupabaseRooms()` และ `signOutFromSupabaseRooms()` ใน `client/src/components/roomrent/supabaseRooms.ts`; ฟอร์มและข้อความสถานะอยู่ใน `SupabaseRoomsPanel.tsx`

## เตรียมระบบก่อนทดสอบ

1. ใน Supabase สร้าง project ทดสอบ แล้วเปิด **Authentication → Providers → Email**
2. ใน **Authentication → URL Configuration** ตั้ง Site URL เป็น URL จริงของ RoomRent เช่น `https://roomrent-local-pwa.pages.dev` และเพิ่มเฉพาะ callback/origin ที่ต้องใช้ใน Redirect URLs อย่าใช้ wildcard กว้างเกินจำเป็น
3. ใน **SQL Editor** รัน [`../supabase/rental_rooms.sql`](../supabase/rental_rooms.sql) เพื่อสร้างตารางและ RLS policies ตรวจว่าตาราง `public.rental_rooms` เปิด RLS และ policy จำกัด `owner_id` ด้วย `auth.uid()`
4. ตั้งค่า build environment โดยใช้ Supabase Project URL และ publishable/anon key:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```

   คีย์ `VITE_*` จะอยู่ใน JavaScript ที่ผู้ใช้ดาวน์โหลดได้ ใช้ได้เฉพาะ publishable/anon key เมื่อเปิด RLS ถูกต้อง **ห้ามใช้ `service_role` key หรือ secret key ในหน้าเว็บ** อย่าวางค่า key จริงในคู่มือ, Git, screenshot หรือแชต
5. Rebuild และ deploy static PWA หลังเพิ่มค่า environment แล้วเปิด URL ใหม่นั้น หากยังไม่ตั้งค่า หน้า **ห้องพัก** จะแสดง “ยังไม่ได้ตั้งค่า Supabase” แทนฟอร์ม Login
6. เตรียมอีเมลทดสอบที่ควบคุมได้ 1–2 บัญชี และใช้ project/แถวข้อมูลทดสอบที่ไม่มีข้อมูลผู้เช่าจริง

## ขั้นตอนทดสอบ

### 1) สมัครบัญชี

1. เปิด RoomRent แล้วเลือกหน้า **ห้องพัก**
2. ในแผง Supabase กด **สมัครบัญชีใหม่**
3. ใส่อีเมลทดสอบและรหัสผ่านอย่างน้อย 8 ตัวอักษร แล้วกด **สร้างบัญชี**
4. ผลที่ควรได้:
   - ถ้า Supabase บังคับยืนยันอีเมล แอปแสดง “สมัครแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ”; เปิดอีเมลและยืนยันตามลิงก์
   - ถ้าไม่บังคับยืนยัน หรือ callback ส่ง session กลับมาสำเร็จ แอปอาจเข้าสู่สถานะล็อกอินได้ทันที
   - ถ้าอีเมลซ้ำหรือข้อมูลไม่ผ่านกฎของ Supabase แอปจะแสดง error และไม่แสดงสถานะเชื่อมต่อ

### 2) Login ด้วยบัญชีทดสอบ

1. หากยังไม่ล็อกอิน ให้กรอกอีเมลและรหัสผ่านของบัญชีที่ยืนยันแล้ว
2. กด **เข้าสู่ระบบ**
3. ผลที่ควรได้: แผงแสดงอีเมลผู้ใช้พร้อมข้อความ “ห้องพักจัดเก็บใน Supabase”; แอปโหลดห้องที่ RLS อนุญาตให้ผู้ใช้นี้เห็น
4. ลองรหัสผ่านผิดหรืออีเมลที่ไม่มีบัญชี: ต้องยังอยู่ในสถานะออกจากระบบ มีข้อความผิดพลาด และไม่โหลดรายการห้องของบัญชีอื่น

### 3) ตรวจ session หลังรีเฟรช

1. ขณะล็อกอินอยู่ ให้รีเฟรชหน้าเว็บ
2. ผลที่ควรได้: Supabase client กู้ session ที่เก็บไว้ใน browser แล้ว RoomRent ตรวจผู้ใช้และโหลดห้องใหม่
3. การตรวจนี้ต้องใช้ Internet; การเก็บ session ไม่ได้ทำให้ห้องใน Supabase ใช้งาน offline ได้

### 4) Logout

1. ในแผงที่แสดงอีเมลบัญชี กด **ออกจากระบบ**
2. ผลที่ควรได้: Supabase Auth sign out สำเร็จ, แผงกลับไปแสดงฟอร์ม Login และห้อง cloud ของบัญชีเดิมถูกนำออกจาก state ที่แสดงอยู่
3. รีเฟรชอีกครั้ง: ยังควรอยู่ในสถานะออกจากระบบ
4. Logout **ไม่ลบห้อง** ออกจาก Supabase; ทดลอง Login ใหม่แล้วข้อมูลของบัญชีเดิมควรกลับมา

### 5) ตรวจว่าแยกข้อมูลตามเจ้าของจริง

ใช้บัญชีทดสอบคนละบัญชี ไม่ใช้ข้อมูลผู้เช่าจริง:

1. Login บัญชีทดสอบ A และเพิ่มห้องทดสอบ เช่น `QA-A-01`
2. Logout แล้ว Login บัญชีทดสอบ B
3. ผลที่ควรได้: บัญชี B ไม่เห็นห้อง `QA-A-01`; ห้องที่สร้างจาก B จะไม่แสดงใน A
4. เมื่อตรวจเสร็จ ให้ลบ/เก็บถาวรข้อมูล QA ด้วยบัญชีที่เป็นเจ้าของ หรือใช้ Supabase project ทดสอบแยกจาก production

## เกณฑ์ผ่าน

- สมัครบัญชีและการยืนยันอีเมลให้ผลตามการตั้งค่า Supabase Auth
- Login ถูกต้องแล้วเห็นอีเมลบัญชีและโหลดห้องที่เป็นของบัญชีนั้น
- รหัสผ่านผิดไม่ทำให้เข้าสู่ระบบหรือเห็นข้อมูลห้อง
- Session ยังคงอยู่หลัง refresh แต่หายหลัง Logout
- Logout นำข้อมูล cloud ของผู้ใช้ที่ออกจากระบบออกจากหน้าจอ โดยไม่ลบแถวในฐานข้อมูล
- บัญชีทดสอบคนละบัญชีมองไม่เห็นห้องของกันและกันด้วย RLS

## แก้ปัญหาเบื้องต้น

| อาการ | จุดตรวจ |
|---|---|
| ขึ้น “ยังไม่ได้ตั้งค่า Supabase” | ตรวจว่ามี `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน environment **ตอน build** แล้ว rebuild; การเพิ่มค่าหลัง build ไม่เปลี่ยน bundle ที่เผยแพร่อยู่ |
| `Invalid login credentials` | ตรวจอีเมล/รหัสผ่าน; ถ้าเปิดยืนยันอีเมล ให้ตรวจว่าบัญชีได้รับการยืนยันแล้ว |
| สมัครได้แต่ยังไม่เข้าสู่ระบบ | ตรวจอีเมลยืนยัน; ถ้า Supabase ไม่ส่ง session กลับ ให้กลับมา Login ด้วยตนเอง |
| ลิงก์ยืนยันอีเมลหมดอายุหรือกลับผิด URL | ตรวจ Site URL และ Redirect URLs ให้ตรงกับ origin ของเว็บที่เปิดทดสอบ; ขอส่งอีเมลยืนยันใหม่ |
| `Failed to fetch` หรือโหลดไม่สำเร็จ | ตรวจ project URL, Internet, สถานะ Supabase และ URL allowlist; ห้ามแก้ด้วยการปิด RLS |
| อ่าน/เพิ่มห้องไม่ได้ หรือได้ 401/403 | ตรวจว่า session ยัง valid, รัน SQL migration ครบ, เปิด RLS, policy ใช้ `auth.uid() = owner_id`, และผู้ใช้ล็อกอินอยู่ |
| เพิ่มเลขห้องเดิมแล้วถูกปฏิเสธ | มี unique index กันเลขห้องซ้ำแบบไม่แยกตัวพิมพ์เล็ก/ใหญ่ภายในบัญชีเดียว ตรวจข้อมูลทดสอบซ้ำก่อนลองใหม่ |

## ความปลอดภัยและขอบเขต

- ทดสอบด้วยข้อมูลสังเคราะห์ และใช้ Supabase project ทดสอบก่อน production
- อย่าบันทึกหรือแชร์รหัสผ่าน, access token, refresh token, `sb-*-auth-token`, tenant data หรือ response ที่มีข้อมูลส่วนบุคคล
- อย่าคัดลอก Supabase key จริงลงไฟล์คู่มือหรือ Git; อย่าใช้ `service_role` key ใน browser
- ห้องพักบน Supabase ต้องออนไลน์เพื่ออ่าน/บันทึก ส่วนบิล รายจ่าย และ PromptPay ยังคงเป็นข้อมูลในเครื่องและไม่รวมอยู่ในการทดสอบ sync นี้
