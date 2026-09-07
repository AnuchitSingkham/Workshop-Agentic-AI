# Workshop: Vibecoding ผู้ช่วย AI ส่วนตัวด้วย Visual Studio Code + MCP + Telegram

Workshop สำหรับสร้างผู้ช่วย AI ส่วนตัวที่มีหน้าเว็บ Chat จริง ต่อได้ 3 provider — **Google Gemini**, **OpenAI**
(ตรง ๆ ทั้งคู่) หรือ **AI gateway แบบ OpenAI-compatible กำหนดเอง** (base URL ตั้งค่าเองได้ ไม่ hardcode ในโค้ด เช่น
`Replace base url`) — มี **MCP server** ในตัว (Utils, Google Calendar, Text-to-SQL), เปิดให้
Chat ต่อ MCP server เพิ่มเองได้, และคุยผ่าน **Telegram** ได้ — ทั้งหมดรันเป็น **Cloudflare Worker ตัวเดียว**
(หนึ่ง `wrangler.toml`, deploy ทีเดียวได้ครบ)

รันได้ทันทีจาก root ของ repo นี้เลย ไม่ต้อง `cd` เข้าโฟลเดอร์ย่อยไหน

## Vibecode ด้วย AI coding agent

อยากใช้ AI coding agent (Cline / Kilo Code ฯลฯ) เป็นคนเขียนไฟล์จริงให้แทนพิมพ์เอง — ทำตามนี้:

1. **Fork repo นี้** เข้าบัญชี GitHub ของตัวเอง (ปุ่ม Fork มุมขวาบนของหน้า repo)
2. **เปิด repo ที่ fork มาในเครื่องมือ AI coding** ที่ใช้ (Cline, Kilo Code ฯลฯ) ให้ agent มองเห็น/
   แก้ไฟล์ในโปรเจกต์ได้จริง ไม่ใช่แค่วางโค้ดในแชทลอย ๆ
3. ทำ [SETUP.md](SETUP.md) หัวข้อ 1–4 ให้ครบก่อนเริ่ม Module 1.1 (ไม่ถนัด command line ดูหัวข้อ "Deploy แบบไม่ใช้
   command line" ท้าย SETUP.md แทน)
4. **ไล่ทำทีละ module ตามลำดับในตารางด้านล่าง** — แต่ละ module มีไฟล์ **`docs/module-X-spec.md`** เป็นสเปกที่สั่ง
   agent อ่านแล้วลงมือสร้าง/แก้ไฟล์ได้ตรง ๆ ใช้ prompt ประมาณนี้ (แก้ path ให้ตรง module ที่กำลังทำ):

   > อ่านสเปกใน `docs/module-1.1-chat-spec.md` ให้ครบทั้งไฟล์ก่อน แล้วสร้าง/แก้ไฟล์ตามหัวข้อ "ไฟล์ที่ต้องสร้าง"
   > และ "แก้ไฟล์เดิม" ให้ตรงตามข้อกำหนดทุกข้อ อย่าทำเกินสโคปที่ระบุไว้ในหัวข้อ "ห้ามทำเกินสโคป" เสร็จแล้วรัน
   > `npm run typecheck` ให้ผ่านก่อนบอกว่าทำเสร็จ แล้วไล่เช็คตามหัวข้อ "Acceptance Criteria" ทีละข้อ รายงานผลว่า
   > ข้อไหนผ่าน/ไม่ผ่านทำไม

5. **ทดสอบจริงด้วยตัวเอง** ตาม Acceptance Criteria ในสเปก (`npm run typecheck`, เปิดเว็บ/ยิง curl จริง) — อย่าเชื่อ
   แค่คำบอกของ agent ว่า "เสร็จแล้ว" โดยไม่ลองเอง
6. **Commit เมื่อ module นั้นทำงานได้แล้วเท่านั้น** ให้ทุก commit เป็น checkpoint ที่ใช้งานได้จริง แล้วไป module
   ถัดไป
7. ติดขัด/ผลลัพธ์ไม่ตรงสเปก — สั่ง agent อ่าน `spec.md` ซ้ำพร้อมชี้ Acceptance Criteria ข้อที่ไม่ผ่าน หรือให้ agent
   เทียบไฟล์กับ branch `main` (เฉลยฉบับสมบูรณ์) ไฟล์ต่อไฟล์

Spec.md แต่ละไฟล์มีโครงเดียวกันเสมอ: บริบท → Prerequisites → ไฟล์ที่ต้องสร้าง → แก้ไฟล์เดิม → ข้อกำหนดสำคัญ →
Acceptance Criteria → ห้ามทำเกินสโคป → Prompt แนะนำ — ส่วน `docs/module-X.md` (ไม่มี `-spec` ต่อท้าย) คืออ่านเพิ่ม
ถ้าอยากรู้เหตุผลเชิงลึกกว่านี้

## เตรียมตัวก่อน workshop

1. บัญชี Google (Gmail ปกติ ใช้ทดสอบได้ ไม่ต้องเป็น Workspace องค์กร)
2. บัญชี Cloudflare (ฟรี ไม่ต้องผูกบัตร) — สมัครที่ [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
3. บัญชี Telegram + โทรศัพท์ติดตั้งแอป Telegram (ใช้ตอน Module 2.3)
4. Node.js (LTS)
5. API key อย่างน้อย 1 ใน 3 (ใช้ตอน Module 1.1): [Gemini](https://aistudio.google.com/apikey) (ฟรี),
   [OpenAI](https://platform.openai.com/api-keys), หรือ key + base URL ของ AI gateway แบบ OpenAI-compatible
   ที่กำหนดเอง (เช่น `Replace base url`)
6. Connection info ของฐานข้อมูล MySQL (host/port/database/user/password) — ใช้ตอน Module 5 เท่านั้น (แนะนำ DB
   user ที่มีสิทธิ์แค่ SELECT)

## เริ่มจากตรงนี้

เปิด [SETUP.md](SETUP.md) ก่อนเพื่อเตรียมเครื่อง/บัญชี Cloudflare แล้วไล่ทำตาม module ทีละอันตามลำดับนี้ (แต่ละอันมี
doc อธิบายว่าทำอะไร ไฟล์ไหนเกี่ยวข้อง วิธีทดสอบ และจุดต่อยอด):

| Module | เรื่อง | Doc | Spec (สั่ง agent) |
|---|---|---|---|
| **1.1** | หน้าต่าง Chat ↔ Gemini/OpenAI/gateway กำหนดเอง | [docs/module-1.1-chat.md](docs/module-1.1-chat.md) | [docs/module-1.1-chat-spec.md](docs/module-1.1-chat-spec.md) |
| **1.2** | หน้าตั้งค่า Key (เก็บใน Cloudflare KV) | [docs/module-1.2-key-settings.md](docs/module-1.2-key-settings.md) | [docs/module-1.2-key-settings-spec.md](docs/module-1.2-key-settings-spec.md) |
| **1.3** | Chat ต่อ MCP server ได้ (client) + หน้าตั้งค่า MCP | [docs/module-1.3-mcp-client-settings.md](docs/module-1.3-mcp-client-settings.md) | [docs/module-1.3-mcp-client-settings-spec.md](docs/module-1.3-mcp-client-settings-spec.md) |
| **2.1** | MCP server อย่างง่าย (Utils) | [docs/module-2.1-mcp-simple-server.md](docs/module-2.1-mcp-simple-server.md) | [docs/module-2.1-mcp-simple-server-spec.md](docs/module-2.1-mcp-simple-server-spec.md) |
| **2.2** | MCP server: Google Calendar | [docs/module-2.2-mcp-google-calendar.md](docs/module-2.2-mcp-google-calendar.md) | [docs/module-2.2-mcp-google-calendar-spec.md](docs/module-2.2-mcp-google-calendar-spec.md) |
| **2.3** | คุยผ่าน Telegram | [docs/module-2.3-telegram.md](docs/module-2.3-telegram.md) | [docs/module-2.3-telegram-spec.md](docs/module-2.3-telegram-spec.md) |
| **5** | Text-to-SQL — ถามฐานข้อมูล MySQL ด้วยภาษาคน | [docs/module-5-text-to-sql.md](docs/module-5-text-to-sql.md) | [docs/module-5-text-to-sql-spec.md](docs/module-5-text-to-sql-spec.md) |

ทำ 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 5 ตามลำดับ แต่ละ module ใช้ได้จริงทันทีที่ทำเสร็จ ไม่ต้องรอทำครบทุกอันก่อนถึงจะ
เห็นผล — repo นี้เป็นทั้งเฉลย (deploy ได้จริงทันที ครบทุก module) และ**ของอ้างอิงระหว่างทำตาม**: แต่ละ
`docs/module-*.md` มีทั้งไฟล์ใหม่ที่ต้องสร้างและ **ไฟล์เดิมที่ต้องแก้ (พร้อม diff)** เพราะบางโมดูล (เช่น 1.2, 1.3,
2.3) ไม่ได้เขียนไฟล์ใหม่ล้วน ๆ แต่ "อัปเกรด" ไฟล์ของโมดูลก่อนหน้าด้วย — ทำตามแล้วเทียบกับโค้ดจริงในโฟลเดอร์นี้ได้เสมอ
ถ้าติดตรงไหน

โครงแบ่งเป็น 2 ช่วงชัดเจน: **Module 1 = งานฝั่งเว็บทั้งหมด** (หน้า Chat, หน้าตั้งค่า Key, หน้าตั้งค่า MCP และตัว
MCP client) พอจบ 1.3 ระบบพร้อมใช้งานเต็มรูปแบบแล้ว ต่อ MCP server ภายนอกได้ทันที — **Module 2 เป็นต้นไป = สร้าง
MCP server ของตัวเอง** อย่างเดียว แต่ละตัวลงทะเบียนเข้า `BUILTIN_SERVERS` บรรทัดเดียวแล้วใช้ในหน้า Chat ได้เลย
ไม่ต้องกลับไปแก้หน้าเว็บหรือ chat engine อีก

## โครงสร้างโฟลเดอร์

**1 โฟลเดอร์ต่อ 1 module** — เห็นชัดว่าแต่ละ module มีไฟล์อะไรบ้าง ไล่ทำ/อัปเกรดทีละโฟลเดอร์ได้ (module หลังอาจ
import จาก module ก่อนหน้า หรือ "ต่อยอด" ไฟล์ระบบกลางอย่าง `router.ts` เพิ่ม — ดูรายละเอียดใน `docs/module-*.md`
ของแต่ละอัน)

```
src/
  index.ts, router.ts, env.ts        ระบบกลาง — entrypoint, route table, Env (bindings/secrets) ทั้งหมด
  lib/                                 http.ts, auth.ts (admin token), site-session.ts (login รหัสผ่าน class + cookie), kv.ts — helper ใช้ร่วมกันทุก module
  module-1.1-chat/                     chat engine, provider clients (gemini, openai/openai-compat)
  module-1.2-key-settings/             เก็บ/อ่าน key ใน KV + route ตั้งค่า
  module-1.3-mcp-client-settings/      MCP client (ต่อ server ภายนอก) + registry (รวม built-in/ภายนอก) + route ตั้งค่า
  module-2.1-mcp-simple-server/        framework สร้าง MCP server (server-factory.ts) + ตัวอย่าง (utils)
  module-2.2-mcp-google-calendar/      Google OAuth client + MCP server Calendar (ใช้ server-factory จาก 2.1)
  module-2.3-telegram/                 Telegram webhook + client + ความจำแชทใน KV
  module-5-text-to-sql/                MCP server ต่อ MySQL จริง (mysql2) + SQL guard (read-only เท่านั้น)
public/
  chat/, settings-keys/, settings-mcp/    หน้าเว็บ 3 หน้า (plain HTML/CSS/JS ไม่มี build step)
  shared/                                 styles.css + admin-auth.js ที่ใช้ร่วมกัน
docs/                                   doc อธิบายแต่ละ module (ตารางด้านบน)
```

## Route ทั้งหมด

| Method | Path | Module | Auth |
|---|---|---|---|
| GET | `/`, `/chat/`, `/settings-keys/`, `/settings-mcp/` | static (`public/`) | session cookie (`/login` ด้วย `CLASS_PASSWORD`) |
| GET/POST | `/login` | — | ไม่มี (นี่คือทางเข้า) |
| GET | `/logout` | — | ไม่มี |
| POST | `/api/chat` | 1.1 | session cookie เดียวกับหน้าเว็บ (กัน caller ภายนอกยิงตรง) |
| GET/POST/DELETE | `/api/settings/keys` | 1.2 | `X-Admin-Token` |
| GET/POST/DELETE | `/api/settings/mcp-servers[/:id[/toggle]]` | 1.3 | `X-Admin-Token` |
| GET/POST (JSON-RPC) | `/mcp/utils` | 2.1 | `Authorization: Bearer <MCP_ACCESS_TOKEN>` |
| GET/POST (JSON-RPC) | `/mcp/google-calendar` | 2.2 | `Authorization: Bearer <MCP_ACCESS_TOKEN>` (tool call เองที่ fail ต่อถ้ายังไม่ตั้ง OAuth) |
| GET | `/oauth/google/start`, `/oauth/google/callback` | 2.2 | session cookie เดียวกับหน้าเว็บ — ขอ Google refresh token ผ่านหน้าเว็บ worker เอง แทน OAuth Playground (ดู SETUP.md ข้อ 5.4b) |
| POST | `/telegram/webhook` | 2.3 | header secret ของ Telegram |
| GET/POST (JSON-RPC) | `/mcp/text-to-sql` | 5 | `Authorization: Bearer <MCP_ACCESS_TOKEN>` (tool call เองที่ fail ต่อถ้ายังไม่ตั้งฐานข้อมูล, บังคับ read-only ในโค้ด) |
| GET | `/healthz` | — | ไม่มี |

ทุก path ที่ไม่ตรง route ด้านบน (รวม path ที่ตรงไฟล์ static ใน `public/`) วิ่งเข้า `src/index.ts` → `src/router.ts`
ก่อนเสมอ (ตั้ง `run_worker_first = true` ใน `wrangler.toml`) — router.ts เช็ค session cookie ก่อนค่อยเรียก
`env.ASSETS.fetch()` เอง ดู [`src/lib/site-session.ts`](src/lib/site-session.ts)

## คำสั่งที่ใช้บ่อย

```bash
npm run dev         # รันในเครื่อง
npm run typecheck   # เช็ค TypeScript (tsc --noEmit)
npm run deploy      # deploy ขึ้น Cloudflare
npm run tail        # ดู log real-time หลัง deploy
```
