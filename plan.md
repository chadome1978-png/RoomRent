# แผนพัฒนา RoomRent

## ขอบเขตและแนวทาง

RoomRent เป็นเว็บแอปภาษาไทยแบบ responsive สำหรับเจ้าของหอพักรายเดือน โดยเปิด HTTPS เป็น static PWA ไม่มี container หรือ application backend; บัญชีเดิมเข้าสู่ระบบด้วยอีเมลและ OTP 6 หลักผ่าน Supabase Auth โดยไม่กรอก username/password; การสมัครยังใช้อีเมลและรหัสผ่านพร้อมยืนยันอีเมลแยกต่างหาก **ห้องพัก/ผู้เช่า บิล รายจ่าย และการตั้งค่า PromptPay จะจัดเก็บใน Supabase** ผ่าน Supabase Auth และ owner-scoped RLS เมื่อ build มี Supabase URL กับ publishable/anon key; `localStorage` ใช้เก็บข้อมูลเดิมก่อน migration และไม่ถูกส่งขึ้น cloud เอง ต้องส่งออกไฟล์สำรองและยืนยันการย้าย/รวมข้อมูลก่อนอัปโหลด ห้ามอัปโหลดแบบเงียบหรือเขียนทับข้อมูล cloud ที่มีอยู่

เจ้าของห้องเข้าสู่ระบบก่อนอ่านหรือแก้ไขข้อมูล cloud; บัญชีเดิมขอรหัสผ่านครั้งเดียวด้วย `signInWithOtp` และ `shouldCreateUser: false`, จากนั้นจึงให้ Supabase Auth สร้าง session เมื่อ `verifyOtp` สำเร็จเท่านั้น; ฟอร์มเข้าสู่ระบบไม่รับ username/password และไม่สร้างผู้ใช้ใหม่; สมัครยังใช้อีเมล/รหัสผ่านพร้อมการยืนยัน signup OTP; hosted Supabase ต้องแยกตั้งค่า **Confirm sign up** และ **Magic link or OTP** templates ให้แสดง `{{ .Token }}` และใช้ custom SMTP เพื่อแก้เทมเพลตได้ หน้า OTP ไม่อนุญาต cloud access ก่อนมี Auth session และผ่าน account/migration gate. Legacy `login-with-username` Edge Function และ `login_names` schema ยังคงอยู่ใน Production แต่ current UI ไม่เรียกใช้; rate-limit RPC ยังจำกัด 20 attempts/IP/5 นาที และ 10 attempts/normalized username/15 นาทีแบบ atomic, บันทึก HMAC-SHA256 bucket hashes เท่านั้น ไม่เก็บ raw IP/username; schema ภายในเปิด RLS ไม่มี client grants, RPC ให้ execute เฉพาะ `service_role`, ลบ bucket ที่เก่ากว่า 24 ชั่วโมง และ fail closed เมื่อ RPC/IP ขาด. `roomrent_account_data` เก็บ snapshot JSONB หนึ่งแถวต่อ owner และใช้ RLS จำกัด SELECT ต่อ `auth.uid()` โดยห้าม anonymous/public access; mutation ทำผ่าน RPC ที่ตรวจ auth.uid() และ expected revision เท่านั้น (ไม่มี direct table INSERT/UPDATE/DELETE grants) บิลเก็บ snapshots ใน cloud; คำนวณและตรวจตัวอย่างบิลก่อนพิมพ์/PDF หรือเปิด LINE share ให้ผู้ใช้เป็นผู้ส่งเอง ประวัติบิล สถานะชำระ รายจ่าย และ PromptPay settings อยู่ใน cloud หลังลงชื่อเข้าใช้ สำรองข้อมูลออกเป็น JSON; migration จากอุปกรณ์และตาราง `rental_rooms` รุ่นเดิมต้องให้ผู้ใช้ดาวน์โหลด backup และยืนยันการรวมก่อนอัปโหลด พร้อมหยุดอย่างปลอดภัยเมื่อพบข้อมูลขัดแย้งหรือ revision เปลี่ยน

เพิ่มหน้า **รายรับ-รายจ่าย** ที่เลือกเดือนได้: รายรับคำนวณจากบิลที่ชำระแล้วตามรอบบิล (แสดงยอดค้างแยกต่างหาก ไม่รวมเป็นรายรับ), รายจ่ายจากรายการที่เจ้าของบันทึกตามวันที่ และเงินคงเหลือเท่ากับรายรับลบรายจ่าย หน้าแสดงกราฟแท่งรายรับ/รายจ่ายย้อนหลัง 6 เดือนสิ้นสุดที่เดือนที่เลือก, สัดส่วนตามหมวดรายจ่าย และรายการของเดือนนั้น ระบุวิธีจัดกลุ่มรายรับชัดเจนเพื่อไม่ให้เข้าใจว่าเป็นวันที่รับเงินโอนจริง

เจ้าของเพิ่ม/แก้ไข/ลบรายการรายจ่ายที่มีวันที่ หมวดหมู่ คำอธิบาย จำนวนเงิน และหมายเหตุได้ รายการเหล่านี้จัดเก็บใน cloud ภายใต้บัญชีที่เข้าสู่ระบบ และรวมอยู่ใน backup JSON

เพิ่มการตั้งค่า PromptPay ID และชื่อผู้รับเงินไว้ใน cloud ภายใต้บัญชีเจ้าของและไฟล์สำรอง; เมื่อมี session แล้ว บิลที่ยังรอชำระแสดง QR PromptPay แบบระบุยอดสุทธิของบิลนั้นบนตัวอย่างและใบแจ้งที่พิมพ์/บันทึก PDF ได้; บิลที่ชำระแล้วซ่อน QR เพื่อป้องกันการจ่ายซ้ำ; หากยังไม่ตั้งค่าให้มีทางลัดไปหน้าตั้งค่า การสร้าง payload และ QR ใช้ไลบรารี JavaScript ที่ bundle อยู่ใน static PWA เพื่อทำงานออฟไลน์ ไม่ส่ง PromptPay ID หรือข้อมูลบิลไปบริการ QR ภายนอก QR เป็นเพียงคำขอชำระเงินที่ผู้เช่าตรวจสอบและยืนยันในแอปธนาคาร; การสแกนไม่เปลี่ยนสถานะบิลเป็นชำระแล้วโดยอัตโนมัติ

PWA ใช้ manifest ที่แอปเป็นเจ้าของ มีไอคอนและหน้าตา standalone, service worker สำหรับ precache ไฟล์ HTML/JS/CSS/ไอคอนของ app shell และแสดง app shell เมื่อเปิดออฟไลน์; ข้อมูล cloud ทุกประเภทไม่ถูกแคชโดย service worker และอ่าน/บันทึกไม่ได้ขณะออฟไลน์ โดยต้องแสดงสถานะชัดเจนและไม่เก็บการแก้ไขที่ยัง sync ไม่สำเร็จให้ดูเหมือนบันทึกแล้ว บิลยังใช้กระดาษสีขาวเพื่ออ่านและพิมพ์ได้ชัด แม้ส่วนจัดการใช้ธีมมืด

## โครงสร้างหลัก

- `client/src/pages/Home.tsx`: เข้าสู่ RoomRent static PWA ที่หน้าหลักเพียงหน้าเดียว
- `client/src/components/roomrent/emailVerification.ts`, `EmailVerificationForm.tsx`: ขอ/ยืนยัน OTP 6 หลักสำหรับ login บัญชีเดิมและ signup แยก flow; sign-in ใช้ `shouldCreateUser: false`, shared Supabase client เดียวกัน และมี mock tests; template ที่ Hosted Supabase ต้องตั้งแยกสำหรับ **Confirm sign up** กับ **Magic link or OTP**; คู่มืออยู่ใน `docs/supabase-email-otp.md` และไฟล์ตัวอย่างอยู่ใน `supabase/templates/confirm-signup-otp.html`, `supabase/templates/magic-link-otp.html`
- `client/src/components/roomrent/RoomRentApp.tsx`: แดชบอร์ด บิล รายจ่าย สำรอง/กู้คืน และประสาน auth, loading, errors, cloud data actions กับ migration แบบ opt-in
- `client/src/components/roomrent/supabaseRooms.ts`: shared Supabase client, passwordless email OTP sign-in, email/password signup and resend, shared OTP verification, และอ่านข้อมูลห้อง legacy สำหรับ migration
- `client/src/components/roomrent/usernameLogin.ts`: legacy client adapter for the deployed `login-with-username` endpoint; retained for compatibility but not used by the current Login UI
- `supabase/functions/login-with-username/rateLimit.ts`: ตรวจ `x-forwarded-for` และสร้าง HMAC-SHA256 bucket keys โดยใช้เฉพาะ secret ฝั่ง server; helper tests ใช้ IP/identifiers สังเคราะห์
- `supabase/functions/login-with-username/index.ts`, `supabase/config.toml`, `supabase/login_names.sql`, `supabase/login_names_link_bnkhouse.sql`, `supabase/login_rate_limits.sql`: username-to-Auth lookup, function deployment configuration, mapping schema, mapping starter user และ private atomic rate-limit table/RPC ที่ไม่เปิดให้ client
- `client/src/components/roomrent/supabaseAccountData.ts`, `accountMigration.ts`, `SupabaseAccountPanel.tsx`: account snapshot fetch/save, revision-checked RPC calls, merge conflicts, backup-before-migration gate
- `supabase/rental_rooms.sql`, `supabase/roomrent_account_data.sql`, `docs/supabase-room-storage.md`, `.env.example`: legacy rooms schema, account snapshot/RLS/RPC schema, คู่มือตั้งค่า และ public build variables
- `client/src/components/roomrent/types.ts`: schema ข้อมูล local, อ่าน/ตรวจสอบ backup JSON, PromptPay settings และตัวช่วยวันที่/สกุลเงิน
- `client/src/components/roomrent/RoomDialog.tsx`, `InvoicePreview.tsx` และ `PromptPayQr.tsx`: ฟอร์มข้อมูลห้อง ตัวอย่าง/พิมพ์/แชร์บิลผ่าน LINE และสร้าง QR PromptPay ตามยอดบิล
- `client/src/components/roomrent/FinanceDashboard.tsx`, `ExpenseDialog.tsx` และ `finance.ts`: กราฟสรุปกระแสเงินสด 6 เดือน รายการค่าใช้จ่าย และการคำนวณแยกตามรอบเดือน/หมวด
- `client/src/main.tsx`, `client/index.html` และ `client/public/manifest.webmanifest`, `client/public/sw.js`, ไอคอน: app entry, metadata สำหรับ iPhone/PWA และ offline app-shell cache
- `client/src/index.css`: ธีมมืดแบบ charcoal/pine, responsive layout และ media สำหรับพิมพ์ใบแจ้งค่าเช่า
- `client/public/manus-routes.json`: ประกาศ route หน้าหลักให้ตรงกับเว็บ
- `drizzle/`, `server/` และ auth ของ starter: โค้ดเก่าที่มีอยู่ก่อนหน้า ไม่ถูกเรียกจาก client PWA; จะไม่เปิด container/API deployment สำหรับเวอร์ชัน local-only และจะไม่ลบฐานข้อมูลเดิมโดยอัตโนมัติ
- `app.config.ts`: project logo URL แบบ HTTPS literal ตามข้อกำหนดของ Webdev

## การออกแบบ

สไตล์ที่พิจารณา (ความน่าจะเป็นจากปลายหางของการกระจาย): **editorial Swiss ledger** 0.07 — **architectural quiet luxury** 0.06 — **playful neo-brutalist** 0.05

### ตัวเลือกที่เลือก: editorial Swiss ledger

- **แนวทางการออกแบบ:** บัญชีบริหารสมัยใหม่ที่นำความเป็นระเบียบแบบ Swiss editorial มาทำให้เป็นมิตรกับงานประจำวัน ไม่จำลองหน้าตาเครื่องมือบัญชีเก่า
- **หลักการ:** ยอดที่สำคัญอ่านได้ทันที; รายละเอียดทางบัญชีแบ่งบรรทัดชัด; ปุ่มงานหลักอยู่ในระยะนิ้วโป้งบนมือถือ; ทุกการกระทำมีสถานะตอบกลับ; ความเป็นส่วนตัวของข้อมูลในบัญชี Cloud และการสำรองก่อนย้ายสื่อสารชัดเจน
- **ปรัชญาสี:** ใช้พื้น charcoal/เขียวหมึกและแผงสี pine ที่แยกชั้นชัด ลดแสงจ้าแต่คงคอนทราสต์ของตัวเลขและข้อความ สี teal สว่างใช้เป็นจุดนำสายตาและสีแบรนด์ ส่วนปุ่ม LINE คงสีเขียวเฉพาะของ LINE; หน้ากระดาษบิลยังใช้พื้นขาวเพื่ออ่านและพิมพ์ได้ชัด
- **โครงแบบ:** แถบนำทางแนวตั้งบางบน desktop, เนื้อหากว้างจัดแนวซ้ายเป็นคอลัมน์เนื้อหา+แถบสรุป ไม่วาง dashboard เป็นตารางกลางซ้ำซาก บนมือถือเปลี่ยนเป็น bottom navigation, cards เต็มความกว้าง และ modal ที่เลื่อนบนจอได้
- **องค์ประกอบเด่น:** เลขห้องเป็นแถบป้ายรหัส; เส้นคั่นและตารางยอดแบบบัญชี; ตัวเลขยอดรวมขนาดใหญ่มีเส้นเน้น teal
- **ปรัชญาการโต้ตอบ:** ภาษาตรงไปตรงมา เน้นการบันทึก/ออกบิลอย่างชัดเจน มีการตรวจเลขมิเตอร์ก่อนบันทึก ให้เจ้าของเห็นตัวอย่างบิลก่อนพิมพ์หรือแชร์ และเตือนให้สำรองข้อมูลเพราะข้อมูลอยู่ในอุปกรณ์เดียว
- **ภาพเคลื่อนไหว:** เปลี่ยนหน้าและเปิดแผงด้วย fade/slide เบา ๆ 140–200ms, hover แสดงผลอย่างละเอียดบน desktop; ลด/ปิด motion เมื่อ `prefers-reduced-motion`; ไม่ใช้ motion ตกแต่งที่รบกวนการทำบัญชี
- **ระบบตัวอักษร:** ใช้ system sans-serif ของอุปกรณ์และฟอนต์ไทยที่ติดตั้งอยู่แล้ว เพื่อลดการเรียกฟอนต์จากบริการภายนอก; ใช้ตัวเลข tabular เมื่อรองรับ; หัวเรื่อง 28–32px desktop/23–26px mobile, เนื้อความ 14–16px, รายละเอียดอย่างน้อย 12px และคอนทราสต์ชัด
- **แก่นแบรนด์:** ผู้ช่วยออกบิลหอพักสำหรับเจ้าของรายย่อย ที่ทำให้ยอดประจำเดือนครบถ้วนและส่งถึงผู้เช่าได้ง่าย — สุขุม, แม่นยำ, เป็นมิตร
- **น้ำเสียง:** สั้น ชัด สุภาพ และเน้นการลงมือทำ ตัวอย่าง: “รอบบิลนี้มี 3 ห้องที่ยังค้างชำระ” และ “ข้อมูลอยู่ในบัญชี Cloud นี้ สำรองไว้ก่อนย้ายข้อมูล”
- **แนวคิดโลโก้/wordmark:** เครื่องหมายเส้นรูปหลังคาห้องหนึ่งคูหา คร่อมเส้นบรรทัดบัญชี 3 เส้น วางคู่ wordmark “RoomRent” น้ำหนักกลาง
- **สีแบรนด์หลัก:** deep teal `#0F766E`; พื้น dark charcoal `#111816`, แผง `#1A2420`, หมึกสว่าง `#E7EFEA`, เส้น `#2B3931`, teal เน้น `#55C9B2`, เขียวสำเร็จ `#55B77A`, amber `#D7A44C`, แดง `#E17B72`; LINE green ใช้เฉพาะปุ่ม LINE

## ข้อมูลและขอบเขตความเป็นส่วนตัว

- ห้องเก็บเลขห้อง ชื่อ/เบอร์ติดต่อผู้เช่า ค่าเช่าฐาน อัตราค่าน้ำ/ไฟต่อหน่วย สถานะ และวันบันทึกใน Supabase ภายใต้ owner_id
- บิลเก็บ snapshot ของห้อง/ผู้เช่า ณ วันออกบิล รอบเดือน วันครบกำหนด เลขมิเตอร์ หน่วย อัตรา รายการเพิ่ม-ลด ยอดสุทธิ วันที่ออกบิล และสถานะชำระใน Supabase; ป้องกันห้องเดียวกันมีบิลซ้ำในรอบเดือนเดียวต่อบัญชี
- รายจ่ายเก็บวันที่ หมวดหมู่ คำอธิบาย ยอดเงิน และหมายเหตุใน Supabase; หน้าสรุปถือเฉพาะบิลสถานะชำระแล้วเป็นรายรับตามรอบบิล และไม่รวมยอดค้างชำระในเงินรับแล้ว
- การคำนวณใช้เลขทศนิยมสองตำแหน่ง: หน่วยใช้จริง = เลขปัจจุบัน − เลขก่อนหน้า; ค่าน้ำ/ไฟ = หน่วย × อัตราต่อหน่วย; รวมค่าเช่า ค่าน้ำ ค่าไฟ และรายการเพิ่ม/ลด; เลขปัจจุบันต้องไม่น้อยกว่าครั้งก่อน
- ข้อมูลห้อง บิล รายจ่าย และ PromptPay settings ถูกอ่าน/เขียนผ่าน Supabase JS SDK; Login ใช้อีเมลและ OTP 6 หลักสำหรับบัญชีเดิมโดยไม่สร้าง user ใหม่; signup ยังคงอีเมล/รหัสผ่านและยืนยัน email OTP แยก; ทั้งสอง flow ใช้ Supabase Auth session เดียวกันและ RLS บังคับ owner_id ทุก operation; client ใช้เฉพาะ publishable/legacy anon key ไม่ใช้ secret/service_role
- service worker แคชเฉพาะ app shell ไม่แคชข้อมูล cloud; local migration ตรวจ backup ที่ export แล้ว แจ้งจำนวนและบัญชีปลายทาง ยืนยันก่อนส่งทั้งชุด และเก็บ local copy ไว้จนกว่าจะยืนยันว่า cloud import สำเร็จครบ
- ไฟล์ backup เป็นข้อมูลส่วนตัวของผู้ใช้ ผู้ใช้เลือกตำแหน่งเก็บ/แชร์เอง; การกู้คืน cloud ต้องยืนยันและห้าม overwrite/merge กับบัญชีที่มีข้อมูลอยู่แล้วโดยอัตโนมัติ
- LINE share เปิด share URL พร้อมข้อความบิลที่เจ้าของตรวจแล้ว แอปไม่ส่งข้อความอัตโนมัติและไม่สร้างลิงก์สาธารณะของข้อมูลผู้เช่า

## การเผยแพร่และข้อจำกัด

เผยแพร่เฉพาะ build แบบ static จาก `pnpm install --frozen-lockfile && pnpm build:static` ไปยัง `dist/public` บน HTTPS hostname ที่แพลตฟอร์มจัดให้ ไม่ต้องซื้อหรือผูกโดเมนเอง หน้าเว็บสาธารณะเป็นเพียงตัวแอปและมี Supabase URL กับ publishable key ที่เปิดเผยได้ ไม่บรรจุข้อมูลของผู้เช่า/backup หรือ secret key การติดตั้งบน iPhone ทำผ่าน Safari > Share > Add to Home Screen หลังโหลดครั้งแรกแล้ว service worker จึงทำงานออฟไลน์ได้

การพิมพ์/บันทึก PDF ใช้หน้าพิมพ์ของ browser/OS โดยไม่พึ่งบริการ PDF ภายนอก การแชร์ LINE เป็นการเปิด LINE share URL ผู้ใช้ต้องยืนยันส่งเอง เมื่อเข้าสู่ระบบข้อมูล cloud ที่ผ่าน RLS จะใช้ได้บนอุปกรณ์อื่น ส่วน app shell ยังทำงานออฟไลน์แต่ข้อมูลไม่พร้อมใช้ออฟไลน์ ฐานข้อมูลและโค้ด server จากเวอร์ชันเดิมไม่ถูกเรียกโดย static client และจะไม่ลบข้อมูลเดิมในฐานข้อมูลโดยอัตโนมัติ
