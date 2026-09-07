# Branch นี้คือจุดเริ่มต้นเปล่า ๆ

คุณกำลังอยู่บน branch **`starter`** — มีแค่โครงโปรเจกต์ (`wrangler.toml`, `package.json`, `tsconfig.json`) กับ
`docs/` เท่านั้น **ยังไม่มีโค้ด module ใดเลยสักบรรทัด** ตั้งใจให้เป็นแบบนี้

## วิธีใช้

**อยากให้ AI coding agent (Cline/Kilo Code ฯลฯ) เขียนให้แทนพิมพ์เอง** — อ่าน
[README.md](README.md) หัวข้อ "Vibecode ด้วย AI coding agent" แทนขั้นตอนด้านล่างนี้ได้เลย มันอธิบายวิธีสั่ง agent
สร้างทีละ module ผ่าน `docs/module-X-spec.md` ไว้ละเอียดกว่า

ทำเองแบบดั้งเดิม (พิมพ์โค้ดเอง อ่านแค่ doc):

1. Deploy branch นี้ขึ้น Cloudflare ก่อน (ดู [SETUP.md](SETUP.md)) — จะเห็นหน้าเว็บ placeholder ที่บอกว่ายังไม่มี
   module ใดถูกเพิ่ม แปลว่า deploy สำเร็จแล้ว พร้อมเริ่มได้
2. เปิด [`docs/module-1.1-chat.md`](docs/module-1.1-chat.md) (คำอธิบายละเอียด) หรือ
   [`docs/module-1.1-chat-spec.md`](docs/module-1.1-chat-spec.md) (สเปกกระชับ สั่ง agent ได้ตรง ๆ) แล้วสร้างไฟล์
   ตามที่ระบุไว้ทีละไฟล์ (สร้างที่ root ของ repo นี้เลย ไม่ต้องมีโฟลเดอร์ย่อย) — เมื่อสร้างครบ commit แล้ว
   Cloudflare จะ build/deploy ให้อัตโนมัติ ทดสอบตาม checkpoint ในเอกสาร
3. ทำเสร็จแต่ละ module แล้วไปต่อ module ถัดไปตามลำดับในตารางที่ [`README.md`](README.md)
4. ติดตรงไหน หรืออยากเทียบว่าไฟล์ที่เขียนถูกไหม — สลับไปดู branch **`main`** ของ repo เดียวกันนี้ (เป็นเฉลยฉบับ
   สมบูรณ์ ครบทั้ง 7 module) เทียบ path ต่อ path ได้เลย

## จุดสำคัญ

- ไฟล์ `wrangler.toml` ใน branch นี้ยังมี `REPLACE_WITH_KV_NAMESPACE_ID` อยู่ — ต้องสร้าง KV namespace เองก่อน
  (ดู SETUP.md ข้อ 2)
- `src/index.ts` ตอนนี้เป็นแค่ placeholder — Module 1.1 จะสร้างไฟล์นี้ใหม่ทั้งหมดพร้อมกับ `src/env.ts`,
  `src/router.ts`, `src/lib/http.ts`
- `public/` มีแค่หน้าแรกที่บอกสถานะ — Module 1.1 จะเพิ่มโฟลเดอร์ `public/chat/` เข้ามา
