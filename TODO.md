

## Passwordless Email OTP Login (14 พฤศจิกายน 2026)

- [x] หน้า Login ให้ผู้ใช้ที่มีบัญชีเดิมกรอกอีเมลเพื่อขอ OTP 6 หลัก แล้วกรอก OTP เพื่อเข้าสู่ระบบ; request ใช้ Supabase Auth `signInWithOtp` พร้อม `shouldCreateUser: false` และยังไม่ให้ session จน `verifyOtp` สำเร็จ; ไม่มีช่อง username/password ใน Login; สมัครบัญชีใหม่ยังคงอีเมล+รหัสผ่านและ flow ยืนยัน signup OTP แยก; หลังยืนยัน Auth session ระบบใช้ account/migration gate และ RLS เดิม; UI มีการจัดการ resend/cooldown/error โดยไม่เปิดเผย raw Auth error; ไม่มีการเรียก `login_names` จากหน้าเว็บ
- [ ] ก่อน merge/deploy Production: Supabase Production **Magic link or OTP** template ต้องแสดง `{{ .Token }}` และใช้ Custom SMTP ที่บันทึกครบ เพื่อให้ผู้ใช้ได้รับ OTP แทน confirmation link; ตรวจ live template + delivery readiness ก่อนเปลี่ยนหน้า Production ให้เป็น OTP-only
- 14 พฤศจิกายน 2026: release branch `feature/passwordless-email-otp-20261114` สร้างจาก `origin/main` SHA `55c0a1fd`; read-only review ไม่พบ code-level blocker; การตรวจใน BNK Dashboard ยังแสดง default email templates และแจ้งให้ตั้ง Custom SMTP ก่อนแก้ template ได้; ยังไม่ merge, deploy หรือเปลี่ยน Supabase settings
