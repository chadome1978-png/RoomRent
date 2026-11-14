# แผนพัฒนา RoomRent

## ขอบเขตและแนวทาง

RoomRent เป็นเว็บแอปภาษาไทยแบบ responsive สำหรับเจ้าของหอพักรายเดือน โดยเปิด HTTPS เป็น static PWA ไม่มี container หรือ application backend; ตามขอบเขตล่าสุดที่ผู้ใช้ยืนยัน แอปไม่ต้อง Login และทุกคนใช้ Supabase shared dataset ชุดเดียวกันผ่าน publishable/anon key; ห้องพัก ผู้เช่า เบอร์ติดต่อ บิล สถานะชำระ รายจ่าย และ PromptPay ในชุดนี้เปิดให้อ่านและแก้ไขได้จากผู้เข้าถึงแอป/API; ใช้ `roomrent_shared_data` แยกจาก snapshot ส่วนตัวเดิม; คัดลอกเฉพาะ snapshot ที่ผู้ใช้เลือกเข้า shared dataset และคง snapshot ต้นทาง/บัญชีอื่นไว้โดยไม่แก้ไข; `localStorage` ไม่ถูกส่งขึ้น Cloud เองและต้องจัดการด้วย backup/migration flow เดิม

ผู้ใช้ทั่วไปเปิดหน้าแอปและอ่าน/แก้ไข shared dataset ได้ทันทีโดยไม่มี Login/OTP; ทุกเบราว์เซอร์ใช้ document เดียวกันและบันทึกผ่าน revision-checked RPC `save_roomrent_shared_data`; RPC นี้เรียกได้โดย `anon` จึงตั้งใจให้บุคคลทั่วไปอ่านและแก้ข้อมูลได้ตามที่ผู้ใช้ยืนยัน ไม่ใช่ระบบจำกัดเฉพาะเจ้าของ. `roomrent_shared_data` แยกจาก `roomrent_account_data` เดิมซึ่งคง owner-scoped และไม่เปิด public; คัดลอก snapshot ที่ผู้ใช้เลือกเพียงชุดเดียวเข้า shared table โดยคงต้นทางและ snapshot ของบัญชีอื่นไว้ ไม่ลบหรือเขียนทับข้อมูลเดิม. ไม่มีหน้า Login/สมัครบัญชี, OTP, account gate, หรือ migration อัตโนมัติจาก `localStorage`; การสำรอง/กู้คืนยังคงทำได้ผ่าน JSON

เพิ่มหน้า **รายรับ-รายจ่าย** ที่เลือกเดือนได้: รายรับคำนวณจากบิลที่ชำระแล้วตามรอบบิล (แสดงยอดค้างแยกต่างหาก ไม่รวมเป็นรายรับ), รายจ่ายจากรายการที่เจ้าของบันทึกตามวันที่ และเงินคงเหลือเท่ากับรายรับลบรายจ่าย หน้าแสดงกราฟแท่งรายรับ/รายจ่ายย้อนหลัง 6 เดือนสิ้นสุดที่เดือนที่เลือก, สัดส่วนตามหมวดรายจ่าย และรายการของเดือนนั้น ระบุวิธีจัดกลุ่มรายรับชัดเจนเพื่อไม่ให้เข้าใจว่าเป็นวันที่รับเงินโอนจริง

ผู้ใช้แอปเพิ่ม/แก้ไข/ลบรายการรายจ่ายที่มีวันที่ หมวดหมู่ คำอธิบาย จำนวนเงิน และหมายเหตุได้ รายการเหล่านี้อยู่ใน shared dataset เดียวและอ่าน/แก้ไขได้โดยผู้เข้าถึงแอปโดยไม่ต้อง Login พร้อมรวมอยู่ใน backup JSON

เพิ่มการตั้งค่า PromptPay ID และชื่อผู้รับเงินไว้ใน shared dataset และไฟล์สำรอง; บิลที่ยังรอชำระแสดง QR PromptPay แบบระบุยอดสุทธิบนตัวอย่างและใบแจ้งที่พิมพ์/บันทึก PDF ได้; บิลที่ชำระแล้วซ่อน QR เพื่อป้องกันการจ่ายซ้ำ; หากยังไม่ตั้งค่าให้มีทางลัดไปหน้าตั้งค่า; การสร้าง payload และ QR ใช้ไลบรารี JavaScript ที่ bundle อยู่ใน static PWA เพื่อทำงานออฟไลน์ ไม่ส่ง PromptPay ID หรือข้อมูลบิลไปบริการ QR ภายนอก; QR เป็นเพียงคำขอชำระเงิน และการสแกนไม่เปลี่ยนสถานะบิลเป็นชำระแล้วอัตโนมัติ

PWA ใช้ manifest ที่แอปเป็นเจ้าของ มีไอคอนและหน้าตา standalone, service worker สำหรับ precache ไฟล์ HTML/JS/CSS/ไอคอนของ app shell และแสดง app shell เมื่อเปิดออฟไลน์; ข้อมูล cloud ทุกประเภทไม่ถูกแคชโดย service worker และอ่าน/บันทึกไม่ได้ขณะออฟไลน์ โดยต้องแสดงสถานะชัดเจนและไม่เก็บการแก้ไขที่ยัง sync ไม่สำเร็จให้ดูเหมือนบันทึกแล้ว บิลยังใช้กระดาษสีขาวเพื่ออ่านและพิมพ์ได้ชัด แม้ส่วนจัดการใช้ธีมมืด

## โครงสร้างหลัก

- `client/src/pages/Home.tsx`: เข้าสู่ RoomRent static PWA ที่หน้าหลักเพียงหน้าเดียว
- Login/OTP UI เดิมจะไม่อยู่ในเส้นทางใช้งานทั่วไป; คง source compatibility ไว้และไม่ลบ Auth users/schema/Edge Functions จาก Production โดยอัตโนมัติ
- `client/src/components/roomrent/RoomRentApp.tsx`: แดชบอร์ด บิล รายจ่าย สำรอง/กู้คืน และโหลด/บันทึก shared cloud dataset โดยไม่สร้าง session
- `client/src/components/roomrent/supabaseRooms.ts`: คง shared Supabase client และ helper เก่าสำหรับ Auth/legacy migration; public shared data ไม่เรียก Auth และไม่ query private snapshots
- `client/src/components/roomrent/usernameLogin.ts`, `supabase/functions/login-with-username/*`, `supabase/login_names*.sql`, `supabase/login_rate_limits.sql`: legacy compatibility ที่ไม่อยู่ในเส้นทางแอปใหม่และไม่เปลี่ยนในงานนี้
- `client/src/components/roomrent/supabaseAccountData.ts`, `accountMigration.ts`, `SupabaseAccountPanel.tsx`: คง adapter/flow private เดิม; เพิ่ม shared snapshot adapter และ flow คัดลอก snapshot ที่เลือกโดยคง source ไว้; Auth panel ไม่แสดงในเส้นทางใช้งานทั่วไป
- `supabase/rental_rooms.sql`, `supabase/roomrent_account_data.sql`, `supabase/roomrent_shared_data.sql`, `docs/supabase-room-storage.md`, `.env.example`: เก็บ schema legacy และ owner-scoped เดิม; เพิ่ม shared snapshot/RPC ที่อ่านได้โดย anon และเขียนด้วย revision check; client ไม่มี service-role/secret key
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

- Shared dataset เก็บเลขห้อง ชื่อ/เบอร์ติดต่อผู้เช่า ค่าเช่าฐาน อัตราค่าน้ำ/ไฟ สถานะ และวันบันทึก; บุคคลที่เข้าถึงแอป/API อ่านและแก้ไขข้อมูลชุดนี้ได้
- บิลเก็บ snapshot ห้อง/ผู้เช่า ณ วันออกบิล รอบเดือน วันครบกำหนด เลขมิเตอร์ หน่วย อัตรา รายการเพิ่ม-ลด ยอดสุทธิ วันที่ออกบิล และสถานะชำระใน shared dataset; validation ของแอปป้องกันบิลซ้ำสำหรับห้องและรอบเดือนเดียวกัน
- รายจ่ายเก็บวันที่ หมวดหมู่ คำอธิบาย ยอดเงิน และหมายเหตุใน shared dataset; หน้าสรุปถือเฉพาะบิลสถานะชำระแล้วเป็นรายรับตามรอบบิล และไม่รวมยอดค้างชำระในเงินรับแล้ว
- การคำนวณใช้เลขทศนิยมสองตำแหน่ง: หน่วยใช้จริง = เลขปัจจุบัน − เลขก่อนหน้า; ค่าน้ำ/ไฟ = หน่วย × อัตราต่อหน่วย; รวมค่าเช่า ค่าน้ำ ค่าไฟ และรายการเพิ่ม/ลด; เลขปัจจุบันต้องไม่น้อยกว่าครั้งก่อน
- Shared data อ่านผ่าน Supabase JS SDK ด้วย publishable/anon key และเขียนผ่าน revision-checked RPC; ไม่มี Login/session; ผู้เข้าถึงแอป/API อ่านและแก้ shared document ได้; account snapshots อื่นยังคง owner-scoped และไม่ถูกเปิด public; client ไม่ใช้ secret/service_role
- เพราะ RPC นี้รับ shared document ทั้งชุดและเปิด execute ให้ `anon`, ผู้ที่เรียก API ได้สามารถแทนที่หรือล้างข้อมูล shared ทั้งหมดได้; revision ตรวจจับการแก้พร้อมกันแต่ไม่ใช่ ACL/การป้องกันการลบหรือการโจมตี; UI และคู่มือต้องแจ้งความเสี่ยงนี้โดยตรง
- service worker แคชเฉพาะ app shell ไม่แคชข้อมูล Cloud; การคัดลอก snapshot ที่ผู้ใช้เลือกไป shared dataset ต้องคง source snapshot เดิมและไม่คัดลอกบัญชีอื่น
- ไฟล์ backup อาจมีข้อมูลผู้เช่า/การชำระเงิน ผู้ใช้เลือกตำแหน่งจัดเก็บเอง; restore ยังคงต้องยืนยันและไม่เขียนทับข้อมูลโดยอัตโนมัติ
- LINE share เปิด share URL พร้อมข้อความบิลที่ผู้ใช้ตรวจแล้ว แอปไม่ส่งข้อความอัตโนมัติ; เนื้อหาใน shared dataset อ่านได้จากผู้เข้าถึงแอป/API ตามโหมดที่ยืนยัน

## การเผยแพร่และข้อจำกัด

เผยแพร่เฉพาะ build แบบ static จาก `pnpm install --frozen-lockfile && pnpm build:static` ไปยัง `dist/public` บน HTTPS hostname ที่แพลตฟอร์มจัดให้ ไม่ต้องซื้อหรือผูกโดเมนเอง หน้าเว็บสาธารณะเป็นเพียงตัวแอปและมี Supabase URL กับ publishable key ที่เปิดเผยได้ ไม่บรรจุข้อมูลของผู้เช่า/backup หรือ secret key การติดตั้งบน iPhone ทำผ่าน Safari > Share > Add to Home Screen หลังโหลดครั้งแรกแล้ว service worker จึงทำงานออฟไลน์ได้

การพิมพ์/บันทึก PDF ใช้หน้าพิมพ์ของ browser/OS โดยไม่พึ่งบริการ PDF ภายนอก การแชร์ LINE เป็นการเปิด LINE share URL ผู้ใช้ต้องยืนยันส่งเอง shared cloud dataset ใช้ร่วมกันโดยทุกคนและอาจถูกอ่าน/แก้ไขผ่านแอปหรือ Supabase Data API ได้โดยไม่ต้องยืนยันตัวตน; app shell ยังทำงานออฟไลน์แต่ข้อมูล cloud ไม่พร้อมใช้ออฟไลน์; account snapshot เดิมและโค้ด server เก่าไม่ถูกลบโดยอัตโนมัติ

## การเปลี่ยนขอบเขตที่ผู้ใช้ยืนยัน 14 พฤศจิกายน 2026

- ยกเลิก Login/OTP สำหรับการใช้งานทั่วไป; ผู้ใช้ทุกคนเห็นและแก้ไข shared dataset เดียว
- ทำ privileged metadata-only preflight ก่อนกำหนด shared dataset; ถ้ามีข้อมูลที่ผู้ใช้ต้องการย้ายและยืนยัน source/counts/backup ให้คัดลอก snapshot นั้นโดยคงต้นทางไว้; หาก source ว่าง ผู้ใช้เลือกเริ่มด้วย shared dataset ว่างโดยไม่ copy ข้อมูลส่วนตัว
- ข้อมูลห้อง ผู้เช่า/เบอร์ติดต่อ บิล/สถานะชำระ รายจ่าย และ PromptPay ใน shared dataset ถือว่าเปิดเผยต่อผู้เข้าถึงแอป/API; UI ต้องแจ้งชัดก่อนเริ่มใช้งาน
- ส่วนนี้ supersede ข้อความก่อนหน้าในแผนที่กำหนดให้ต้อง Login/OTP หรือบังคับ owner-scoped access สำหรับชุดข้อมูลที่ย้ายเข้า shared dataset; private account snapshots อื่นยังคง owner-scoped และไม่ถูกเปิด public
- โมดูลหลักที่เพิ่ม/เปลี่ยน: `RoomRentApp.tsx` โหลด shared data โดยไม่สร้าง session; เพิ่ม shared-data adapter และ `supabase/roomrent_shared_data.sql`; ใช้ migration flow คัดลอก snapshot ที่ผู้ใช้เลือกโดยคงต้นทาง; Auth/OTP panels เดิมจะไม่อยู่ในเส้นทางใช้งานทั่วไป
- โครงสร้างที่เพิ่ม: `supabase/roomrent_shared_data.sql` สำหรับ private staging table, server-side validation, revision-checked save RPC และ privileged preview/copy; `supabase/roomrent_shared_data_enable_public.sql` เปิด anon SELECT/save RPC หลัง copy ที่ตรวจแล้ว หรือหลังผู้ใช้เลือก empty dataset จาก preflight ว่าง; adapter ฝั่ง client แยกจาก Auth/account adapter; tests ใช้ข้อมูลสังเคราะห์เท่านั้น
- แผนได้รับอนุมัติ; preflight ยืนยันว่า source ว่างและผู้ใช้เลือก empty dataset จึงไม่ copy snapshot; Auto Publish ของ bound project รายงาน ON จึงห้าม push checkpoint/deploy จนกว่าผู้ใช้ปิด Auto Publish ผ่าน Dashboard


## การตัดสินใจ Production ล่าสุด 14 พฤศจิกายน 2026

- ผู้ใช้เลือกเริ่มด้วย shared dataset ว่าง หลัง metadata-only preflight พบว่า snapshot ที่ระบุและตาราง legacy ไม่มีรายการ; รอบนี้ไม่เรียก `copy_roomrent_account_snapshot_to_shared` และคง source/private snapshots ทั้งหมดไว้
- ติดตั้ง private staging schema และรัน `roomrent_shared_data_enable_public.sql` ใน Supabase Production แล้ว; แถว shared ก่อนเปิดมี revision 1, rooms/invoices/expenses 0 และไม่มี PromptPay
- หลังเปิด gate ตรวจ metadata แล้ว: anon SELECT และ save RPC เป็น `true`; anon direct INSERT/UPDATE/DELETE และ privileged preview/copy เป็น `false`
- เมื่อเปิด public แล้ว ข้อมูลใหม่ทุกชนิดใน shared dataset เปิดเผยต่อผู้เข้าถึง API และผู้เรียก save RPC สามารถแก้ ลบ แทนที่ หรือล้างทั้ง document ได้; revision check ไม่ใช่มาตรการป้องกันผู้ประสงค์ร้าย
- ไม่เปลี่ยน Auth users หรือ private snapshots; frontend no-login ยังไม่ได้ push/deploy และ Production website ยังเป็นเวอร์ชันเดิม; Auto Publish ของ bound Webdev project รายงานว่า ON จึงห้าม push/checkpoint/deploy จนกว่าผู้ใช้ปิดสวิตช์ผ่าน Dashboard

## คำขอแก้ Webdev publish contract — 14 พฤศจิกายน 2026

- คำขอรอบนี้เป็นการแก้ `publish_contract_missing` ของ bound Webdev resource เท่านั้น ไม่ได้เริ่มหรือค้นหา deployment ใหม่ และไม่ใช่การปล่อย Cloudflare Pages `roomrent-local-pwa`.
- Bound config มี `features.server:true` และ `features.database:true` อยู่แล้ว; source มี root `Dockerfile`, Express server, production static root `dist/public`, และ `GET /api/health` ที่ตอบ 200 แบบไม่ต้อง auth โดย listener ใช้ `PORT` และ bind `0.0.0.0`. จึงใช้ hybrid contract: คง static build เดิม (`pnpm install --frozen-lockfile && pnpm build:static`, output `dist/public`), เพิ่ม `deploy` ด้วย `Dockerfile` และ health path `/api/health`, route `/api/*` ไป server และคง static cache rules พร้อม catch-all SPA ไป static.
- ผู้ใช้สั่งให้แก้ config และหาก retry ใช้ `webdev.config POST publish` ซึ่งมี confirmation ของแพลตฟอร์ม; จะไม่อ้างว่ามี deployment ที่เริ่มแล้ว และจะไม่ค้นหาสถานะของงานที่ไม่เคยเริ่ม.
- Version ใน error คือ checkpoint `d9fea3d3b938b79aeff25fcb51a4dd427b53407a`; local worktree มีการเปลี่ยนแปลง 29 paths ที่ยังไม่อยู่ใน checkpoint ดังนั้นการ publish checkpoint นี้ไม่รวมการเปลี่ยน no-login ที่ยังไม่ checkpoint และไม่ใช่ Cloudflare release.
- `GET env` ของ bound Webdev ไม่มี `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; ห้ามใช้ `.env` หรือ dev credentials แทน production values. ก่อนอ้างว่าแอปเชื่อม Supabase ได้ ต้องจัด production browser values ให้กับ build environment ด้วยทางรับค่าที่ปลอดภัย หรือหยุด publish และแจ้ง blocker.
- การเปลี่ยนครั้งนี้เป็นข้อยกเว้นตามคำขอใหม่ของผู้ใช้สำหรับ bound Webdev project; ไม่เปลี่ยน schema/RLS, Auth users, private snapshots, Supabase public gate, หรือ deployment workflow ของ Cloudflare.


## การแก้ Webdev publish contract — 14 พ.ย. 2026

- คำขอนี้เป็น Webdev publish แยกจาก Cloudflare Pages Direct Upload: แก้ `publish_contract_missing` สำหรับ bound resource `wdp_58fda750de44873a50fe8f93` โดยคง static build `pnpm install --frozen-lockfile && pnpm build:static` และ output `dist/public`; เพิ่ม `deploy` เป็น root `Dockerfile` กับ health path `/api/health`; เพิ่ม route `/api/*` ไป server, รักษา static no-cache/immutable rules และ `/*` static SPA fallback; config บันทึกสำเร็จ revision 7
- ยังไม่เรียก `POST publish`: checkpoint `d9fea3d3b938b79aeff25fcb51a4dd427b53407a` ที่ error อ้างถึงใช้ `localStorage` และไม่มี Supabase/shared adapter; การ publish checkpoint นี้จะไม่ปล่อย no-login shared mode ที่อยู่ใน worktree ปัจจุบัน; worktree มี 29 paths เปลี่ยนและยังไม่ checkpoint
- `GET env` แสดงว่าไม่มี `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน Production environment; ห้ามใช้ `.env` หรือค่า dev ไปแทน; ต้องยืนยันค่า production ผ่าน protected input หาก target Webdev build นี้จะเชื่อม Supabase
- `publishing.auto_publish` ยังอ่านได้เป็น `true`; ห้าม push/checkpoint ขณะสถานะนี้ยังเปิด; การ publish ที่ผู้ใช้ร้องขอจะทำผ่าน `POST publish` หลัง source checkpoint และ Production env ตรงกับเวอร์ชันที่ต้องการเท่านั้น


### สถานะ environment หลัง protected input

Production-only values สำหรับ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ได้รับและบันทึกผ่าน protected input แล้ว; GET config แสดงว่าทั้งสอง key ถูกตั้งไว้เฉพาะ `production` (revision 8) โดยไม่มีการเขียนค่าใน source, `.env`, logs หรือไฟล์ใน repository; ข้อนี้ supersedes สถานะก่อนหน้าที่รายงานว่ายังไม่มีค่าใน environment.


## การตัดสินใจ release ล่าสุด — 14 พฤศจิกายน 2026

- ผู้ใช้เลือกไม่ publish checkpoint เก่า `d9fea3d3b938b79aeff25fcb51a4dd427b53407a` เพราะไม่มี Supabase shared adapter; ให้ปล่อย no-login shared build ที่ถูก checkpoint แทน
- Auto Publish ถูกปิดโดยผู้ใช้และยืนยัน readback ของ bound RoomRent resource แล้ว; ให้ตรวจ readback ซ้ำก่อน push ทุกครั้ง
- `deploy`/hybrid routes บันทึกแล้วที่ config revision 7 และ Production-only Supabase URL/publishable anon key ได้รับผ่าน protected input ที่ revision 8; ไม่เขียนค่าเหล่านี้ลง source, `.env`, หรือไฟล์ repository
- ถัดไป stage เฉพาะไฟล์ no-login shared mode ที่จำเป็น, fetch/integrate `origin/main`, รันทดสอบ, push ไป `origin/main` เพื่อบันทึก checkpoint แล้วใช้ `POST publish` ที่มี confirmation; ยังไม่มี checkpoint ใหม่หรือ publication ของ no-login code
- การ publish ของ bound Webdev เป็นคนละเส้นทางกับ Cloudflare Pages `roomrent-local-pwa.pages.dev`; ห้ามอ้างว่า Cloudflare ถูกอัปเดตจาก Webdev publish
- Supabase Production public shared row ยังว่าง; anon อ่านและเรียก save RPC ได้ตามการอนุมัติ; ไม่มี snapshot ส่วนตัวถูกคัดลอก


## การตัดสินใจ release ที่มีผล ณ 14 พฤศจิกายน 2026 (แทนบันทึก Webdev เดิมด้านบน)

- RoomRent คงสถาปัตยกรรม Static PWA บน Cloudflare Pages; `publish_contract_missing` เป็น diagnostic ของ bound Webdev และไม่ใช่เหตุให้เพิ่ม container หรือ application API; ไม่มี Webdev deployment ที่เริ่มแล้ว และไม่เรียก `POST publish` สำหรับ Webdev
- มีการเพิ่ม `deploy` และ route `/api/*` ไป server ชั่วคราวเพื่อวินิจฉัย แล้วคืนค่าแล้ว; Webdev `GET config` readback revision 10 ยืนยันว่าคง static build ไป `dist/public`, routes เป็น static cache rules/SPA fallback, ไม่มี `deploy` และไม่มี `/api/*` server route; `publishing.auto_publish=false`; server/database capability flags เป็นค่าที่มีอยู่ใน bound template ไม่ได้ใช้เป็น deployment target
- Production-only `VITE_SUPABASE_URL` และ publishable/anon key ที่รับผ่าน protected input ยังอยู่ใน Webdev environment แต่ไม่ได้ใช้เป็น Cloudflare release credential; Cloudflare workflow ใช้ Repository Variables และ Secret ตามเดิม; ห้ามใส่ service-role/secret key ใน `VITE_*`, source หรือ bundle
- GitHub repository `chadome1978-png/RoomRent` มี `main` ที่ `55c0a1fd7bedbf8bbea3344dcb139de0eb7b13c0` และมี workflow ที่ตรวจ Cloudflare token/Pages permission และ Supabase build variables; history แยกจาก Manus `origin/main` (`d9fea3d`), จึงคง workflow/repository files เดิมและนำ no-login source เข้าแยกโดยไม่ force-push/merge ประวัติที่ไม่เกี่ยวข้อง
- GitHub ยังมี Draft PR #2 `feature/passwordless-email-otp`; ไม่ merge PR นี้เพราะ no-login shared mode supersedes login; คง PR ไว้จนกว่าจะมีคำสั่งปิด/จัดการแยก
- GitHub connector อ่าน Actions Variables/Secrets ไม่ได้ (HTTP 403); ผู้ใช้เคยยืนยันการตั้งค่าไว้แล้ว; ห้ามอ่านหรือพิมพ์ secret values และตรวจผลจาก workflow/deployment หลัง push แทน
- Shared production row ยังคงว่าง; anon SELECT/save RPC เปิดตามการอนุมัติ; ไม่มีการคัดลอกหรือแก้ Auth users/private snapshots
- Service Worker v13, route manifest, secret/phone scan, TypeScript, 106 tests, static build, and `git diff --cached --check` passed; only remaining build notice is a JavaScript chunk over 500 kB. Commit `f0536e9d88ceed2db959e3b412172c0ee054690c` was pushed to canonical Manus `origin/main`; `git ls-remote` verified the exact ref, and config revision 10 read back `publishing.auto_publish=false`. No Webdev publication was started; Version History was not exposed by available MCP resources.
- Next: transfer only the approved no-login source/docs/SQL into the separate GitHub repository, preserve its current Cloudflare workflow and unrelated history, push to GitHub `main` as the explicitly authorized Production release, then verify the Actions and Cloudflare Pages result before reporting the URL.


## สถานะการตรวจรอบล่าสุด — 14 พฤศจิกายน 2026

Service Worker ปรับเป็น `roomrent-pwa-v13` และแคชได้เฉพาะ app shell กับ static assets ที่ allowlist และ MIME type ตรงกัน; same-origin `/api/`, `/rest/`, `/auth/`, `/functions/`, query-bearing navigation และ cross-origin Supabase requests จะไม่ถูก intercept หรือบันทึกใน Cache Storage. Mock check ผ่าน และ `GET /manus-routes.json` คืน route `/` ตรงกับ source.

รอบตรวจหลังการแก้ผ่าน `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test` (106 tests/10 files), `pnpm build:static`, `node --check client/public/sw.js`, route manifest, `git diff --check` และยืนยัน `dist/public/index.html`; build สำเร็จแต่ยังมีคำเตือน bundle JavaScript ใหญ่กว่า 500 kB ซึ่งไม่ทำให้ build ล้ม. ก่อน commit ให้ตรวจ secret scan ของไฟล์ที่จะ stage และ `git diff --cached --check`; ก่อน Manus checkpoint ให้ยืนยัน `publishing.auto_publish=false` อีกครั้ง. Cloudflare Production release ยังไม่เริ่ม.
