# SETUP — ตั้งค่าครั้งแรกก่อนเริ่ม Module 1.1

ทำหัวข้อ 1–4 ให้ครบก่อน แล้ว Module 1.1, 1.2, 1.3, 2.1 จะใช้งานได้ทันที (2.1 ไม่ต้องตั้งอะไรเพิ่มเลยด้วยซ้ำ)
ส่วนหัวข้อ 5 (Module 2.2 — Google Calendar), หัวข้อ 6 (Module 2.3 — Telegram) และหัวข้อ 7 (Module 5 —
Text-to-SQL) ทำเพิ่มเมื่อถึง module นั้นก็ได้ ไม่ต้องทำครบทุกอย่างตั้งแต่ต้น

เอกสารนี้เขียนโดยสมมติว่า deploy ผ่าน `npx wrangler` จาก command line (หัวข้อ 1–7 ด้านล่าง) — ถ้าไม่อยากยุ่งกับ
command line เลย ใช้วิธี **fork repo นี้แล้วต่อ Cloudflare Workers Builds** แทนได้ ดู
[Deploy แบบไม่ใช้ command line](#deploy-แบบไม่ใช้-command-line-cloudflare-workers-builds) ท้ายไฟล์นี้

## 1. เตรียมเครื่อง

- ติดตั้ง [Node.js](https://nodejs.org/) (LTS)
- สมัครบัญชี [Cloudflare](https://dash.cloudflare.com/sign-up) (ฟรี ไม่ต้องผูกบัตร)

```bash
npm install
npx wrangler login
```

`wrangler login` จะเปิดเบราว์เซอร์ให้ล็อกอิน Cloudflare ครั้งเดียว

## 2. สร้าง Cloudflare KV namespace (storage ฟรีที่ Module 1.2/1.3/2.3 ใช้เก็บ key/MCP server/ความจำแชท)

```bash
npx wrangler kv namespace create APP_KV
```

จะได้ผลลัพธ์หน้าตาประมาณนี้:

```
{ binding = "APP_KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

เอาค่า `id` ไปแทนที่ `REPLACE_WITH_KV_NAMESPACE_ID` ใน [`wrangler.toml`](wrangler.toml) — **แก้ในเครื่องตัวเองพอ
ไม่ต้อง commit กลับเข้า repo กลาง** ถ้าเป็น fork ของตัวเอง (เช่นใช้วิธี Workers Builds ด้านล่าง) จะ commit ทับ
ค่า placeholder ไปเลยก็ได้ เพราะเป็น KV ของ fork ตัวเองอยู่แล้ว ไม่ชนกับใคร

## 3. ตั้งค่า secret

**ต้องตั้งก่อนถึงจะเปิดหน้า settings ได้ (fail-closed โดยตั้งใจ):**

```bash
npx wrangler secret put ADMIN_TOKEN
```

ใส่ค่าอะไรก็ได้ที่คาดเดายาก เช่นสุ่มด้วย `openssl rand -hex 24` — จำไว้กรอกในหน้า "ตั้งค่า Key"/"ตั้งค่า MCP server"

**อย่างน้อยต้องมี 1 ใน 3 ตัวนี้ ถึงจะคุยได้ (Module 1.1):**

```bash
npx wrangler secret put GEMINI_API_KEY
# ได้ฟรีที่ https://aistudio.google.com/apikey

npx wrangler secret put OPENAI_API_KEY
# สมัครที่ https://platform.openai.com/api-keys

npx wrangler secret put OPENAI_COMPAT_API_KEY
# key ของ AI gateway แบบ OpenAI-compatible กำหนดเอง (เช่น Replace base url)
```

**base URL ของ `openai-compat` gateway ไม่ใช่ความลับ ตั้งใน `[vars]` ของ [`wrangler.toml`](wrangler.toml) แทน**
(ไม่ hardcode ในโค้ด — Gemini/OpenAI ใช้ endpoint คงที่ ไม่ต้องตั้ง):

```toml
[vars]
OPENAI_COMPAT_BASE_URL = "Replace base url"
OPENAI_COMPAT_MODEL = "gpt-4o-mini"
```

(ไม่ตั้งตอนนี้ก็ได้ — มาตั้งทีหลังผ่านหน้า "ตั้งค่า Key" (Module 1.2) แทนก็ได้เหมือนกัน ทั้ง base URL และ API key)

รันทดสอบในเครื่องก่อนก็ได้ (`npm run dev`) โดยคัดลอก [`.dev.vars.example`](.dev.vars.example) เป็น `.dev.vars`
แล้วใส่ค่าเดียวกัน (ไฟล์นี้อยู่ใน `.gitignore` แล้ว ห้าม commit)

## 4. รันและ deploy

```bash
npm run typecheck   # เช็ค TypeScript ก่อน deploy จริง
npm run dev          # รันในเครื่อง เปิด http://localhost:8787/chat/
npm run deploy       # deploy ขึ้น Cloudflare จริง ได้ URL แบบ https://ai-desk-worker.<ชื่อบัญชี>.workers.dev
```

deploy ใหม่แล้ว URL เดิมอัปเดตทันที ไม่ต้องกด "New version" แยกแบบ Apps Script

เปิด `<WORKER_URL>/chat/` ทดสอบคุยได้เลย ถ้าตั้ง `ADMIN_TOKEN` ไว้แล้วลองเปิด `<WORKER_URL>/settings-mcp/`
ดูว่า Module 2.1 (Utils) ทำงานได้ทันที (ลองถาม "ตอนนี้กี่โมง" ในหน้า Chat)

---

## 5. Module 2.2 เพิ่มเติม — ต่อ Google Calendar (ต้องทำ OAuth เอง)

Cloudflare Workers ไม่มี `CalendarApp` ในตัวแบบ Apps Script ต้องขอ **Google OAuth refresh token** เอง — ขั้นตอนยุ่งกว่าปกติ
แต่ทำครั้งเดียวจบ

### 5.1 สร้างโปรเจกต์ + เปิดใช้ API

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) → สร้างโปรเจกต์ใหม่ (หรือใช้โปรเจกต์เดิม)
2. เปิดใช้งาน **Google Calendar API** ที่เมนู "APIs & Services → Library"

### 5.2 ตั้งค่า OAuth consent screen

1. ไปที่ "APIs & Services → OAuth consent screen" → User type: **External**
2. กรอกชื่อแอป/อีเมลติดต่อ (ใส่อะไรก็ได้ เพราะใช้คนเดียว)
3. เพิ่ม Scope: `https://www.googleapis.com/auth/calendar`
4. เพิ่มอีเมลของคุณเองใน "Test users"
5. **สำคัญมาก**: หลังทดสอบผ่านแล้ว เปลี่ยน **Publishing status เป็น "In production"** — ถ้าปล่อยไว้เป็น
   "Testing" **refresh token จะหมดอายุทุก 7 วัน** เงียบ ๆ (เจอ error "invalid_grant") พอเปลี่ยนเป็น In production
   จะเจอหน้าเตือน "unverified app" ตอน login ครั้งแรก — กด **Advanced → Go to (ชื่อแอป) (unsafe)** ผ่านได้ตามปกติ
   เพราะเป็นแอปที่คุณสร้างเอง ใช้เอง

### 5.3 สร้าง OAuth Client ID

เลือก **1 ใน 2 แบบ** ตามวิธีขอ refresh token ที่จะใช้ในข้อ 5.4:

- **แบบ A — จะขอผ่าน OAuth Playground (ข้อ 5.4a)**: "APIs & Services → Credentials → Create Credentials →
  OAuth client ID" → Application type: **Desktop app**
- **แบบ B — จะขอผ่านหน้าเว็บของ worker เอง (ข้อ 5.4b, แนะนำถ้า deploy แล้ว)**: Application type: **Web
  application** → ใส่ **Authorized redirect URIs** = `<WORKER_URL>/oauth/google/callback` (แทน
  `<WORKER_URL>` ด้วย URL จริงหลัง deploy เช่น `https://workshop-agentic-ai.<ชื่อบัญชี>.workers.dev`)

ทั้งสองแบบได้ **Client ID** และ **Client Secret** มาเหมือนกัน — สร้างแค่แบบเดียวก็พอ (สร้างทั้งคู่ไว้ก็ได้ถ้า
อยากมีสำรอง แต่ตอนตั้ง secret ข้อ 5.5 ใช้ได้แค่ชุดเดียว)

### 5.4a ขอ refresh token ผ่าน Google OAuth Playground (แบบ manual)

1. เปิด [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. กดไอคอนเฟือง (⚙) มุมขวาบน → ติ๊ก **"Use your own OAuth credentials"** → ใส่ Client ID/Secret จากข้อ 5.3 (แบบ A)
3. ช่อง "Step 1": ค้นหาแล้วเลือก scope `https://www.googleapis.com/auth/calendar`
4. กด **Authorize APIs** → login ด้วยบัญชี Google ที่จะใช้ → Allow
5. ช่อง "Step 2": กด **Exchange authorization code for tokens**
6. คัดลอก **Refresh token** — นี่คือค่าที่จะตั้งเป็น secret `GOOGLE_REFRESH_TOKEN` (ข้อ 5.5)

### 5.4b ขอ refresh token ผ่านหน้าเว็บของ worker เอง (แนะนำ)

วิธีนี้**ไม่ต้องใช้ OAuth Playground เลย** เพราะ worker ที่ deploy แล้วมี URL สาธารณะของตัวเองอยู่แล้ว ใช้เป็น
`redirect_uri` ได้ตรง ๆ (ต้องสร้าง Client ID แบบ B ในข้อ 5.3 ก่อน) — เส้นทาง `/oauth/google/start` และ
`/oauth/google/callback` เป็นสิ่งที่คุณจะสร้างเองตอนเขียนโค้ด Module 2.2 (ดู
[`docs/module-2.2-mcp-google-calendar-spec.md`](docs/module-2.2-mcp-google-calendar-spec.md)) — ยังไม่มีในโครง
เปล่าตอนนี้:

1. ตั้ง secret `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (จาก Client แบบ B) แล้ว `npm run deploy` ก่อน — ดูข้อ 5.5
   (**ยังไม่ต้องตั้ง `GOOGLE_REFRESH_TOKEN`** เพราะขั้นตอนนี้จะได้มาอัตโนมัติ)
2. Login เว็บนี้ก่อน (`<WORKER_URL>/login` ด้วย `CLASS_PASSWORD`)
3. เปิด `<WORKER_URL>/oauth/google/start` ในเบราว์เซอร์เดียวกัน
4. เข้าหน้า consent ของ Google → เลือกบัญชี → Allow
5. Google redirect กลับมาเองที่ `/oauth/google/callback` → เห็นหน้า "✅ เชื่อมต่อสำเร็จ" ก็ใช้งานได้ทันที —
   refresh token ถูกเก็บลง Cloudflare KV ให้อัตโนมัติ **ไม่ต้อง `wrangler secret put GOOGLE_REFRESH_TOKEN` และไม่ต้อง
   deploy ใหม่**

### 5.5 ตั้ง secret แล้วทดสอบ

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npm run deploy
```

- **ถ้าใช้ 5.4a (Playground)**: ตั้ง refresh token เป็น secret เพิ่มอีกตัวก่อน deploy
  ```bash
  npx wrangler secret put GOOGLE_REFRESH_TOKEN
  npm run deploy
  ```
- **ถ้าใช้ 5.4b (worker เอง)**: deploy รอบเดียวจากด้านบนพอ แล้วไปทำขั้นตอนในข้อ 5.4b ต่อ (ได้ refresh token
  มาเก็บใน KV เอง ไม่ต้องตั้ง secret ตัวนี้)

ทดสอบผ่าน `curl` (`POST <WORKER_URL>/mcp/google-calendar`) หรือถามในหน้า Chat ตรง ๆ — ดูตัวอย่างใน
[`docs/module-2.2-mcp-google-calendar.md`](docs/module-2.2-mcp-google-calendar.md)

---

## 6. Module 2.3 เพิ่มเติม — ต่อ Telegram

1. เปิด Telegram คุยกับ [@BotFather](https://t.me/BotFather) → `/newbot` → ตั้งชื่อ → ได้ **Bot Token**
2. ตั้ง secret:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # ตั้งค่าอะไรก็ได้ที่คาดเดายาก กัน webhook ปลอม
npm run deploy
```

3. ผูก webhook (แทนค่าจริงในเบราว์เซอร์):

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<WORKER_URL>/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

ควรเห็น `{"ok":true,"result":true,...}` — เปิดแชทกับบอทใน Telegram แล้วลอง `/start`

---

## 7. Module 5 เพิ่มเติม — ต่อฐานข้อมูล (Text-to-SQL)

ต้องมี connection info ของฐานข้อมูล MySQL ที่จะให้ผู้ช่วยอ่าน (host, port, database, user, password) — **แนะนำ
อย่างยิ่งให้ใช้ DB user ที่มีสิทธิ์แค่ `SELECT` เท่านั้น** ไม่ใช่ user ที่เขียนข้อมูลได้ (ดูเหตุผลใน
[docs/module-5-text-to-sql.md](docs/module-5-text-to-sql.md) หัวข้อความปลอดภัย)

```bash
npx wrangler secret put DB_HOST
npx wrangler secret put DB_PORT       # ปกติคือ 3306
npx wrangler secret put DB_NAME
npx wrangler secret put DB_USER
npx wrangler secret put DB_PASSWORD
npm run deploy
```

ทดสอบผ่าน `curl` (`POST <WORKER_URL>/mcp/text-to-sql`) หรือถามในหน้า Chat ตรง ๆ — ดูตัวอย่างใน
[`docs/module-5-text-to-sql.md`](docs/module-5-text-to-sql.md)

---

## Troubleshooting

| อาการ | สาเหตุที่เป็นไปได้ |
|---|---|
| หน้า settings ขึ้น "ยังไม่ได้ตั้งค่า ADMIN_TOKEN" | รัน `npx wrangler secret put ADMIN_TOKEN` แล้ว deploy ใหม่ |
| Chat ตอบ "ยังไม่ได้ตั้งค่า ... API key" | ตั้ง `GEMINI_API_KEY`/`OPENAI_API_KEY`/`OPENAI_COMPAT_API_KEY` (secret) ให้ตรงกับ provider ที่เลือก หรือหน้า "ตั้งค่า Key" (openai-compat ต้องมี `OPENAI_COMPAT_BASE_URL` ด้วย) |
| `wrangler dev`/`deploy` error เรื่อง KV namespace | เช็คว่าใส่ `id` จริงใน `wrangler.toml` แล้ว (ข้อ 2) ไม่ใช่ค่า placeholder |
| Telegram บอทไม่ตอบเลย | `npx wrangler tail` ดู log real-time ว่า request เข้าไหม / webhook ผูกถูก URL ไหม |
| Calendar tool error "invalid_grant" | refresh token หมดอายุ — เช็คว่า OAuth consent screen เป็น "In production" แล้ว (ข้อ 5.2) ถ้าใช้ทาง 5.4b แค่เปิด `/oauth/google/start` ใหม่อีกรอบก็ได้ token ใหม่ทันที ไม่ต้องรอ deploy |
| เปิด `/oauth/google/start` แล้วได้ 401 | ยังไม่ได้ login เว็บนี้ (ต้องมี session cookie จาก `/login` ก่อน — ดูข้อ 4) |
| `/oauth/google/callback` ขึ้น "แลก token ไม่สำเร็จ" / `redirect_uri_mismatch` | Authorized redirect URI ที่ตั้งไว้ใน Google Cloud Console (ข้อ 5.3 แบบ B) ไม่ตรงกับ `<WORKER_URL>/oauth/google/callback` เป๊ะ ๆ (เช็ค http/https, ลงท้ายด้วย `/` เกินไหม) |
| `/oauth/google/callback` ขึ้น "ได้ access token แต่ไม่มี refresh token กลับมา" | บัญชีนี้เคย allow แอปนี้ไปแล้วก่อนหน้าและ Google ไม่ส่ง refresh token ซ้ำ — ไปที่ https://myaccount.google.com/permissions เพิกถอนสิทธิ์แอปนี้ก่อน แล้วกด `/oauth/google/start` ใหม่ |
| Text-to-SQL tool error "ยังไม่ได้ตั้งค่าฐานข้อมูล" | ตั้ง `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` ให้ครบ (ข้อ 7) |
| Text-to-SQL error "Code generation from strings disallowed" | ใช้ mysql2 เวอร์ชันเก่ากว่า 3.13.0 หรือไปแก้ `disableEval: true` หายไปจาก `db-client.ts` — ต้องมี flag นี้เสมอบน Cloudflare Workers |
| `wrangler deploy` error เรื่อง compatibility_date | อัปเดต `compatibility_date` ใน `wrangler.toml` เป็นวันที่ปัจจุบัน |

---

## Deploy แบบไม่ใช้ command line (Cloudflare Workers Builds)

สำหรับคนที่ไม่ถนัด command line — ต่อ repo เข้า Cloudflare แล้วให้ deploy อัตโนมัติทุกครั้งที่ push แทนการรัน
`npx wrangler deploy` เอง **แต่ละคนต้อง fork repo นี้เป็นของตัวเองก่อน** (อย่าต่อ repo กลางตรง ๆ) เพราะ
`wrangler.toml` มี KV namespace id ที่ต้องเป็นของแต่ละคน ถ้าต่อ repo เดียวกันหลายคนจะ push ทับ id กันเอง

1. **Fork repo นี้** เข้าบัญชี GitHub ของตัวเอง (ปุ่ม Fork มุมขวาบนของหน้า repo บน GitHub)
2. **สร้าง KV namespace ผ่านหน้าเว็บ** (ไม่ต้องใช้ CLI): Cloudflare dashboard → **Workers & Pages → KV** →
   Create a namespace → ตั้งชื่ออะไรก็ได้ (เช่น `APP_KV`) → คัดลอก **Namespace ID** ที่ได้
3. **แก้ `wrangler.toml` ใน fork ของตัวเอง** ผ่านหน้าเว็บ GitHub ตรง ๆ: เปิดไฟล์ `wrangler.toml` → กดไอคอนดินสอ
   (Edit) → แทนที่ `REPLACE_WITH_KV_NAMESPACE_ID` ด้วย id จากข้อ 2 → **Commit changes** ตรง branch `starter`
4. **ต่อ Cloudflare Workers Builds**: Cloudflare dashboard → **Workers & Pages → Create → Import a repository**
   → เลือก fork ของตัวเอง (ต้องกด Authorize ให้ Cloudflare เข้าถึง GitHub ก่อนครั้งแรก) → ปล่อยให้ Cloudflare
   ตรวจจับ `wrangler.toml` แล้วเดา build command ให้เอง (ปกติเป็น `npx wrangler deploy`) → กด **Save and Deploy**
5. **ตั้ง secret ผ่านหน้าเว็บ** (แทนคำสั่ง `npx wrangler secret put ...` ในหัวข้อ 3 ด้านบนทั้งหมด): เปิด Worker ที่
   เพิ่ง deploy ไป → **Settings → Variables and Secrets** → Add → เลือกประเภท **Secret** → ใส่ชื่อ/ค่าทีละตัว
   ตามชื่อในหัวข้อ 3 (`ADMIN_TOKEN`, `GEMINI_API_KEY`/`OPENAI_API_KEY`/`OPENAI_COMPAT_API_KEY`, ฯลฯ) — กด Save
   จะ deploy ใหม่ให้อัตโนมัติ
6. หลังจากนี้ **แก้โค้ดแล้ว push ขึ้น branch `starter` ของ fork ตัวเอง** (จะแก้ผ่านหน้าเว็บ GitHub หรือดึงไปแก้ใน
   เครื่องแล้ว push กลับก็ได้) — Cloudflare จะ build/deploy ให้อัตโนมัติทุกครั้ง ไม่ต้องรัน `npm run deploy` เองอีก
