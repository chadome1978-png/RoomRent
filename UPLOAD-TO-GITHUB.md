# RoomRent source bundle

แตกไฟล์ ZIP นี้ลงใน root ของ repository `RoomRent` แล้ว commit และ push เนื้อหาภายใน (ไม่ใช่ตัว ZIP)

ไฟล์ `package.json` และ `pnpm-lock.yaml` อยู่ระดับ root เดียวกันแล้ว โฟลเดอร์ที่ต้องมีสำหรับ source/build ได้แก่ `client/`, `server/`, `shared/`, `drizzle/`, `supabase/` และ configuration files ที่ root

ไฟล์ `.github/workflows/main.yml` ไม่รวมอยู่ใน ZIP เพราะ repository ปลายทางมี workflow อยู่แล้ว ให้เก็บ workflow เพียงไฟล์เดียวเพื่อไม่ให้ deploy ซ้ำ

ไฟล์ `.env`, `.env.*`, `node_modules/`, `dist/`, `.git/`, logs และไฟล์ debug เฉพาะ Manus ถูกตัดออก อย่าอัปโหลดข้อมูลห้อง/ผู้เช่าจริงหรือไฟล์ backup เข้าสู่ GitHub
