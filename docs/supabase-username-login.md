# RoomRent: เข้าสู่ระบบด้วย Username อย่างปลอดภัย

การทำงานนี้ใช้ Supabase Auth ตรวจรหัสผ่านและออก session ตามเดิม หน้าเว็บส่ง `username` และ `password` ไปยัง Supabase Edge Function; function ค้นหา mapping ใน `login_names` ด้วย service-role key ที่อยู่ฝั่ง server เท่านั้น จากนั้นเรียก `auth.signInWithPassword()` ด้วย publishable/anon key และส่งกลับเฉพาะ access/refresh token เพื่อให้ Supabase client ตั้ง session ต่อไป

ตาราง `login_names` เก็บเพียง `user_id` และ username ที่ไม่ซ้ำ ไม่มี password และปิดสิทธิ์อ่าน/เขียนจาก `anon`/`authenticated` client. การสมัครบัญชีและส่งอีเมลยืนยันซ้ำยังใช้อีเมล Supabase Auth.

เมื่อ confirmation link ใช้งานไม่ได้ สามารถตั้ง Confirm sign up template ให้แสดงรหัส OTP และกรอกในหน้าแอปรุ่นใหม่ตาม [คู่มือ Email OTP](supabase-email-otp.md); OTP ยืนยันบัญชีเดิม ไม่สร้าง mapping username และยังไม่ได้ตั้งค่า template/เผยแพร่ frontend Production ในงานส่วนนี้

## การเชื่อมหน้า Login

`SupabaseAccountPanel.tsx` ส่ง username/password ไป `RoomRentApp.tsx` → `signInToSupabaseRooms()` → `usernameLogin.ts` ซึ่งเรียก `functions.invoke("login-with-username")` ด้วย SDK client เดียวกันที่ใช้โหลดข้อมูล Cloud. Username ถูก trim และแปลงเป็นตัวพิมพ์เล็ก ส่วน password ไม่ถูกตัดช่องว่างหรือเปลี่ยนค่า; timeout 15 วินาทีช่วยไม่ให้หน้าจอรอคำขอตลอดไป

เมื่อ function ตอบกลับ helper ตรวจว่า access/refresh token เป็น string ที่ไม่ว่างแล้วเรียก `auth.setSession()` และต้องได้ session/user ก่อนรายงานสำเร็จ. หน้าเว็บไม่อ่าน `login_names` และไม่ fallback ไปเทียบ password ในตาราง

ข้อผิดพลาดชื่อผู้ใช้ไม่มี/รหัสผ่านผิดใช้ข้อความเดียวกัน; HTTP 404 แสดงว่าระบบ Username Login ยังไม่พร้อม, HTTP 429 ให้รอก่อนลองใหม่, network/timeout แจ้งตรวจอินเทอร์เน็ต และข้อผิดพลาดอื่นแสดงข้อความไทยคงที่เท่านั้น ไม่อ่าน response body หรือพิมพ์ token/raw error. กฎรหัสผ่านอย่างน้อย 8 ตัวอักษรใน UI ใช้ตอนสมัครเท่านั้น; รหัสผ่านบัญชีเดิมตอน Login ให้ Supabase Auth ตรวจ และควรตั้งให้รัดกุม

สถานะวันที่ 12 พฤศจิกายน 2026: ติดตั้ง schema `login_names` และ rate-limit ใน Supabase project `etsguakphlytlvzotmor`; deploy Edge Function `login-with-username` แล้วโดยปิด Verify JWT; smoke test เฉพาะ CORS/HTTP method ผ่านโดยไม่ส่ง credentials; ยังไม่ผูก `bnkhouse` กับ Auth user ที่ยืนยันแล้ว และยังไม่เผยแพร่ frontend รุ่น Username Login จึงยังล็อกอินด้วย username จากหน้า Production ไม่ได้

## ตั้งค่า

1. สร้างบัญชีใน Supabase Auth โดยใช้อีเมลที่เจ้าของควบคุม และยืนยันอีเมลให้เรียบร้อยก่อน
2. เปิด SQL Editor ของ Supabase project ที่ถูกต้อง แล้วรัน `supabase/login_names.sql` เพื่อสร้างตาราง
3. เปิด `supabase/login_names_link_bnkhouse.sql` แทน `REPLACE_WITH_VERIFIED_EMAIL` ด้วยอีเมลของบัญชี Auth ที่ยืนยันแล้ว รันเฉพาะสคริปต์ link นี้หลังจากตรวจ project และ account ปลายทางให้ถูกต้อง
4. เปิด SQL Editor ของ project เดิม แล้วรัน `supabase/login_rate_limits.sql` เพื่อสร้าง private `roomrent_internal.username_login_limits` และ RPC `public.consume_roomrent_username_login_rate_limit`. ตรวจ RLS, grants และ routine signature ก่อน deploy function.
5. ติดตั้ง Supabase CLI และ login ด้วยบัญชีผู้ดูแลที่มีสิทธิ์ต่อ project ที่ถูกต้อง
6. จาก root repository deploy function:

   ```sh
   supabase functions deploy login-with-username --project-ref YOUR_PROJECT_REF --no-verify-jwt
   ```

   การปิด JWT verification จำเป็นสำหรับผู้ใช้ที่ยังไม่มี session; function ตรวจ credential ผ่าน Supabase Auth เอง และ gateway ยังคงต้องได้รับ project API key จาก SDK
7. Edge Function ใช้ injected `SUPABASE_URL`, `SUPABASE_ANON_KEY` และ `SUPABASE_SERVICE_ROLE_KEY`; ต้องมีตัวแปรเหล่านี้พร้อมก่อน deploy; ห้ามใส่ค่า service-role ใน source, `VITE_*`, GitHub Variables, logs หรือ client bundle
8. Allowlist CORS ใน `supabase/functions/login-with-username/index.ts` ให้ตรงกับ origin ที่ใช้งานจริงเท่านั้น ถ้ามี Preview host ที่ต้องทดสอบ ให้เพิ่ม origin เฉพาะของ Preview ชั่วคราวและนำออกภายหลัง
9. ก่อนเปิดใช้จริง ตรวจ Auth rate limits ของ Supabase; function บังคับ atomic 20 attempts / 5 นาทีต่อ IP และ 10 attempts / 15 นาทีต่อ username ผ่าน service-role-only RPC; เก็บเฉพาะ HMAC-SHA256 bucket keys ไว้ไม่เกิน 24 ชั่วโมง, ส่ง HTTP 429 กับ `Retry-After` และ fail closed เมื่อไม่มี IP/RPC ใช้การทดสอบแบบ synthetic/mocks เท่านั้น ไม่เก็บ username/password/token หรือ raw IP ใน logs/tables; Supabase Auth ยังคงตรวจ password และใช้ rate limits ของตนเอง; ทุกกรณีข้อมูลรับรองไม่ผ่านต้องใช้ข้อความเดียวกันเพื่อไม่เปิดเผยว่ามี username หรือไม่

## ทดสอบ

- ใช้บัญชีทดสอบและข้อมูลสังเคราะห์เท่านั้น; อย่าทดสอบกับข้อมูลผู้เช่าจริง
- ทดสอบ username ถูก/รหัสผ่านผิด, username ไม่มี, username case-insensitive (`BNKHOUSE`), user ที่ยังไม่ยืนยันอีเมล และ network/function unavailable
- ยืนยันว่า error ของ username ที่ไม่มีและ password ผิดแสดงข้อความเดียวกัน
- ตรวจ session จากนั้นอ่าน account snapshot ผ่าน RLS ด้วยผู้ใช้ที่ถูกต้อง; logout แล้วตรวจว่าไม่เห็นข้อมูล private
- ยืนยันว่า `login_names` อ่านไม่ได้ด้วย `anon` และ `authenticated`, ไม่มี password hash/value อยู่ในตาราง, และไม่มี service-role key ใน `dist/public`
- ห้ามใช้ production migration หรือ account จริงเป็น fixture; ห้ามส่งคำขอทดสอบที่ทำให้ส่งอีเมลจริง

## ข้อจำกัดของการ release

หน้าเว็บเป็น static PWA; การแก้ frontend อย่างเดียวไม่ทำให้ username login ใช้งานได้ การเปิดใช้จริงต้องติดตั้ง SQL schema, ผูก `bnkhouse` กับ Auth user ที่ยืนยันแล้ว และเตรียม rate limiting/CORS ให้เรียบร้อยก่อน deploy Edge Function จากนั้นจึง build/release frontend ที่ผู้ใช้จะได้รับ; schema ที่มีอยู่เพียงอย่างเดียวไม่สามารถยืนยันรหัสผ่านได้ หากได้รับ HTTP 404 หน้า Login รุ่นใหม่จะแจ้งว่าระบบ Username Login ยังไม่พร้อม ไม่ใช่กล่าวว่ารหัสผ่านผิด
