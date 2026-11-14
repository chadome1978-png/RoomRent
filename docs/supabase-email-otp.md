# ตั้งค่าอีเมลยืนยัน OTP สำหรับ RoomRent

คู่มือนี้ครอบคลุมสอง flow ที่แยกกัน: สมัครบัญชีด้วยอีเมลและรหัสผ่านแล้วกรอกรหัส OTP ใน **Confirm sign up** template; และเข้าสู่ระบบบัญชีเดิมด้วยอีเมลและ OTP 6 หลักจาก **Magic link or OTP** template โดยไม่กรอกชื่อผู้ใช้หรือรหัสผ่าน

## ลำดับการนำไปใช้กับ Production

การเปลี่ยนแปลงใน source เพิ่มหน้าเข้าสู่ระบบอีเมล+OTP และฟอร์ม OTP ที่ใช้ได้ทั้ง sign-in/signup แต่ยังต้องตั้ง **ทั้ง** Confirm sign up และ Magic link or OTP templates บน Hosted Supabase แยกกันก่อนใช้งานจริง ไฟล์ HTML ใน repository ไม่อัปเดต Dashboard ให้อัตโนมัติ และการเข้าสู่ระบบแบบนี้ไม่ต้องใช้ Username Edge Function หรือ SQL mapping `login_names` หน้า code request ไม่ได้ sign in จนกว่า `verifyOtp` จะสำเร็จ

การเผยแพร่ production ของ repository นี้ทำผ่าน GitHub Actions เมื่อ merge ไป `main`; เป็นคนละกลไกกับ Manus Webdev Auto Publish และไม่ได้ปรับ Auto Publish ในคู่มือนี้ ก่อน merge/deploy ต้องตรวจว่า Supabase Production เปิดใช้ Custom SMTP และตั้ง **Magic link or OTP** template ให้แสดง `{{ .Token }}` มิฉะนั้นผู้ใช้อาจได้ลิงก์แทน OTP ที่หน้า Login ขอให้กรอก การตรวจ Dashboard วันที่ 14 พฤศจิกายน 2026 ยังแสดง default email templates และแจ้งให้ตั้ง Custom SMTP ก่อนแก้ template ได้ จึงยังไม่ผ่าน gate นี้

## ตั้งค่า Confirm sign up template

ใน Supabase Dashboard ของโปรเจกต์ที่ใช้งานจริง ให้ไปที่ **Auth > Emails/Templates > Confirm sign up** (ชื่อเมนูอาจต่างกันตามเวอร์ชัน Dashboard) ตั้ง Subject เป็น:

```text
RoomRent — รหัสยืนยันอีเมล
```

นำเนื้อหา HTML จาก [`supabase/templates/confirm-signup-otp.html`](../supabase/templates/confirm-signup-otp.html) ไปใส่ในช่องเนื้อหาอีเมล Confirm sign up โดยคง `{{ .Token }}` ไว้ตรงตำแหน่งรหัส OTP อย่าใส่รหัส OTP ใน Subject

คง **Confirm email** เป็นเปิดอยู่ใน **Auth > Sign In/Providers > Email** (ชื่อเมนูอาจต่างกัน) เพื่อให้บัญชีต้องยืนยันอีเมลก่อนถือว่าใช้งานได้ Template Confirm sign up รองรับการใช้ `{{ .Token }}` เป็นรหัสยืนยัน และการใช้ลิงก์ยืนยันอาจถูกระบบสแกนอีเมลเปิดล่วงหน้าได้ [1]

เทมเพลตนี้มีเพียงลิงก์คงที่ไปยังหน้าแอป `https://roomrent-local-pwa.pages.dev/` เพื่อให้ผู้ใช้กลับมาใส่รหัสในแอป ลิงก์ไม่ผูกกับบัญชีหรือ OTP และไม่มี query string; อย่าเพิ่มตัวแปรลิงก์ยืนยัน, token hash หรือรหัส OTP ลงใน URL วิธีนี้ไม่ทำให้การเปิดลิงก์จาก mail scanner ไปยืนยันบัญชีแทนผู้ใช้

## Flow สมัครและยืนยันอีเมล

เมื่อสมัครด้วยอีเมลและรหัสผ่าน แอปเรียก `supabase.auth.signUp({ email, password })` ซึ่งส่งอีเมลจาก Confirm sign up template หากต้องการส่งอีเมลยืนยันใหม่ ให้เรียก `supabase.auth.resend({ type: 'signup', email })` ด้วยอีเมลเดิมและ shared Supabase client

เพิ่มทางเข้า **“ยืนยันอีเมลด้วยรหัส OTP”** บนหน้าเข้าสู่ระบบ/สมัคร เพื่อแสดงแบบฟอร์มที่มีช่องอีเมลและช่องรหัส 6 หลัก ผู้ใช้กรอกรหัสจากอีเมลแล้วกดยืนยัน แอปเรียก:

```ts
supabase.auth.verifyOtp({ email, token, type: 'email' })
```

ชนิด `email` ใช้ตรวจ OTP ที่ส่งทางอีเมล [2] หากตรวจสำเร็จ Supabase จะยืนยันอีเมลและให้ session ผ่าน shared client โดยอัตโนมัติ แอปจึงควรใช้ auth state/session flow เดิม ไม่ต้องสร้าง session แยกเอง

หากผู้ใช้ยังไม่ได้อีเมล ให้ปุ่มส่งรหัสใหม่เรียก `resend({ type: 'signup', email })` แสดงข้อความตอบกลับแบบกลาง ๆ เช่น “หากอีเมลนี้มีบัญชีที่ยังไม่ยืนยัน ระบบจะส่งรหัสให้ โปรดตรวจสอบกล่องจดหมายและ Spam/Junk” ไม่ควรบอกว่ามีหรือไม่มีบัญชีอีเมลนั้น กำหนดปุ่มส่งซ้ำให้รอ 60 วินาทีเพื่อช่วยป้องกันการกดซ้ำ แต่ตัวนับในหน้าจอเป็นเพียง UX ไม่ใช่กลไกความปลอดภัยฝั่งเซิร์ฟเวอร์ Supabase มีการจำกัดการส่งอีเมลแยกต่างหาก และค่าเริ่มต้นอาจเปลี่ยนแปลงได้ [3]

## อายุรหัสและความยาว OTP

ค่าเริ่มต้นของ Supabase สำหรับอายุ OTP ทางอีเมลคือ 1 ชั่วโมง คู่มือนี้แนะนำให้ผู้ดูแลตั้งอายุเป็น 600 วินาที (10 นาที) ในการตั้งค่า Auth Email OTP expiry หากนโยบายของโครงการรองรับ ค่านี้มีผลร่วมกับ OTP/ลิงก์ยืนยันทางอีเมลชนิดอื่นของ Auth ไม่ใช่เฉพาะ Confirm sign up; อย่าระบุเวลาอายุในอีเมลหรือ UI ว่าตั้งไว้แล้วจนกว่าจะตรวจค่าจริงใน Dashboard [3]

หาก Dashboard แสดงการตั้งค่าความยาว OTP ให้ตรวจว่าตั้งไว้ 6 หลักให้ตรงกับช่อง OTP ของ RoomRent การเพิ่มช่อง 6 หลักในแอปไม่ได้เปลี่ยนการตั้งค่าฝั่ง Supabase และคู่มือนี้ไม่ได้ยืนยันว่าค่าปัจจุบันของโปรเจกต์เป็น 6 หลัก

## ตั้งค่า Template สำหรับ passwordless sign-in

ใน Supabase Dashboard ไปที่ **Authentication → Emails → Templates → Magic link or OTP** (ชื่อเมนูอาจต่างตาม Dashboard) ตั้ง Subject เช่น:

```text
RoomRent — รหัสเข้าสู่ระบบ
```

ใส่เนื้อหาจาก [`supabase/templates/magic-link-otp.html`](../supabase/templates/magic-link-otp.html) และต้องคง `{{ .Token }}` ไว้ โดย **ไม่ใช้ `{{ .ConfirmationURL }}`** หากต้องการรหัส 6 หลักแทน magic link; template นี้ใช้กับ sign-in ส่วน Confirm sign up ยังคงแยกกันตามคู่มือด้านบน [1][5]

สำหรับระบบปัจจุบัน ผู้ใช้กรอกอีเมลแล้วแอปเรียก:

```ts
supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: false },
})
```

`shouldCreateUser: false` ป้องกันการสมัครอัตโนมัติจากหน้าล็อกอิน สำหรับ request ที่สำเร็จ Supabase ส่ง `data.user` และ `data.session` เป็น `null`; อย่าเปิดข้อมูล Cloud จนกว่าจะตรวจรหัสด้วย:

```ts
supabase.auth.verifyOtp({ email, token, type: 'email' })
```

เมื่อยืนยันสำเร็จ shared Auth client จะรับ session แล้ว auth state listener เดิมจึงโหลด account gate/RLS ตามเดิม ระบบตอบข้อความกลาง ๆ (“หากอีเมลนี้มีบัญชี RoomRent ระบบจะส่งรหัส OTP ให้”) และไม่เรียก `login_names` หรือสร้างบัญชีใหม่ หากไม่พบอีเมล

## การเข้าสู่ระบบและขอบเขตข้อมูล

Login ใช้ passwordless email OTP สำหรับบัญชี Supabase Auth ที่มีอยู่; Signup ยังคงใช้อีเมลและรหัสผ่านและยืนยันด้วย Confirm sign up OTP แยกกัน การยืนยัน OTP ไม่ได้สร้างข้อมูลห้อง ไม่ได้เปลี่ยน RLS และไม่ข้าม account gate การทำงาน `login_names`/username mapping ไม่จำเป็นกับหน้า Login นี้และไม่มีการเรียกใช้จาก browser

การยืนยันอีเมลเพียงทำให้บัญชีผ่านขั้นยืนยันและได้ session เมื่อสำเร็จ การเข้าถึงข้อมูลยังต้องผ่าน account gate และ RLS/migration flow ที่มีอยู่ ไม่มีการสร้างบัญชี Cloud เปล่า อัปโหลดข้อมูล หรือเขียนข้อมูล Cloud อัตโนมัติเพียงเพราะยืนยัน OTP สำเร็จ

ห้ามปิดการยืนยันอีเมลเพื่อให้ flow ผ่าน ห้ามแก้ `auth.users` ด้วย SQL และห้ามนำ secret/service-role key ใส่ใน `VITE_*` หรือ frontend; แอปใช้เฉพาะ publishable/anon key โดยมี RLS ตามเดิม

## การส่งอีเมลสำหรับ production

SMTP เริ่มต้นของ Supabase เหมาะกับการทดลอง ไม่ใช่การส่ง production อย่างเชื่อถือได้: จำกัดการส่งไว้กับที่อยู่อีเมลของทีม และขณะนี้มีโควตา 2 อีเมลต่อชั่วโมงโดยเป็น best-effort; ข้อจำกัด/ตัวเลขนี้อาจเปลี่ยนได้ ควรเชื่อม custom SMTP สำหรับการส่งจริง [4] อย่าโพสต์หรือส่ง SMTP credentials ในแชต ให้ผู้ดูแลตั้งค่าโดยตรงใน Dashboard และจำกัดสิทธิ์การเข้าถึงข้อมูลรับรอง

## ทดสอบด้วยตนเองอย่างปลอดภัย

ทำ E2E ภายหลังเมื่อผู้ใช้เป็นผู้ดำเนินการเอง หรือเมื่อได้รับอนุญาตให้ทดสอบอย่างชัดเจนเท่านั้น ใช้อีเมลทดสอบที่ใช้ได้และได้รับอนุญาต ไม่ใช้บัญชีหรือข้อมูลผู้เช่าจริงโดยไม่จำเป็น:

1. สมัครด้วยอีเมลทดสอบและรหัสผ่าน แล้วตรวจว่าได้รับอีเมลหัวข้อที่ตั้งไว้
2. อ่าน OTP จากอีเมล กรอกอีเมลกับรหัส 6 หลักใน RoomRent และตรวจว่าการยืนยันสำเร็จพร้อมเข้าสู่ account gate เดิม
3. ทดสอบรหัสผิดและรหัสหมดอายุว่าถูกปฏิเสธโดยไม่สร้าง session และตรวจว่าข้อความแสดงข้อผิดพลาดไม่เปิดเผยข้อมูลบัญชี
4. ทดสอบ passwordless sign-in ด้วยบัญชี Auth ที่มีอยู่: กรอกอีเมล ขอ OTP, ตรวจอีเมลและป้อนรหัส 6 หลัก; ทดสอบอีเมลที่ไม่มีบัญชีว่าข้อความตอบกลับยังเป็นกลางและระบบไม่สร้างบัญชีใหม่; ยืนยันว่าการขอรหัสซ้ำมี cooldown 60 วินาที และหลัง OTP สำเร็จโหลดข้อมูลผ่าน account gate/RLS เดิม

**สถานะงาน:** code/UI/documentation เป็น source change ในเครื่องและผ่าน local checks; งานนี้ไม่ได้เปลี่ยน Supabase Production templates/SMTP, ไม่ได้ publish frontend และไม่ได้ส่งอีเมลหรือรัน live E2E test การใช้งานจริงต้องเผยแพร่ frontend รุ่นใหม่นี้และตั้ง Magic link or OTP template ให้ใช้ `{{ .Token }}`; Custom SMTP ยังไม่ได้ตรวจหรือทดสอบในงานนี้

## References

[1]: https://supabase.com/docs/guides/auth/auth-email-templates "Supabase Auth email templates"
[2]: https://supabase.com/docs/reference/javascript/auth-verifyotp "Supabase JavaScript verifyOtp"
[3]: https://supabase.com/docs/guides/auth/auth-email-passwordless "Supabase passwordless email authentication"
[4]: https://supabase.com/docs/guides/auth/auth-smtp "Supabase custom SMTP"
[5]: https://supabase.com/docs/reference/javascript/auth-signinwithotp "Supabase JavaScript signInWithOtp"
