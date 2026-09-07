# Spec — Module 1.1: หน้าต่าง Chat (Gemini / OpenAI / gateway กำหนดเอง)

> ไฟล์นี้เขียนให้ AI coding agent อ่านแล้วลงมือสร้าง/แก้ไฟล์ได้เลย (ดูวิธีสั่ง agent ใน README.md หัวข้อ "vibecode ด้วย AI coding agent")
> อยากอ่านคำอธิบายละเอียด/เหตุผลเชิงลึกกว่านี้ ดู [module-1.1-chat.md](module-1.1-chat.md) (เอกสารอ้างอิงเดิม)

## บริบท

นี่คือ module แรกของ 7 module ยังไม่มีโค้ดใดในโปรเจกต์นี้เลยตอนเริ่ม (ถ้าเริ่มจาก branch `starter`) — ต้องสร้าง
"ระบบกลาง" ของ worker (entrypoint/router/env types) ไปพร้อมกับ chat engine ในโมดูลเดียวกัน

**เป้าหมายจบโมดูล**: เปิด `<WORKER_URL>/chat/` แล้วคุยกับ AI ได้จริง ผ่าน backend (ไม่ใช่เรียก API ตรงจาก
เบราว์เซอร์) เลือกได้ 3 provider: **Gemini**, **OpenAI** (เรียก API ตรงทั้งคู่) หรือ **AI gateway แบบ
OpenAI-compatible กำหนดเอง** (เช่น `Replace base url`) — **ห้าม hardcode base URL ของ gateway
กำหนดเองในโค้ดเด็ดขาด** ต้องอ่านจาก `env` เท่านั้น (ตั้งใน `wrangler.toml`) ยังไม่ต้องมี MCP tools หรือหน้าตั้งค่า
key ใด ๆ — ของ 2 อย่างนั้นเป็น module ถัดไป

## Prerequisites

- ทำ [SETUP.md](../SETUP.md) หัวข้อ 1–4 ให้ครบก่อน (อย่างน้อย 1 ใน `GEMINI_API_KEY`/`OPENAI_API_KEY`/
  `OPENAI_COMPAT_API_KEY` และถ้าจะใช้ตัวหลัง ต้องมี `OPENAI_COMPAT_BASE_URL`/`OPENAI_COMPAT_MODEL` ใน `[vars]`
  ของ `wrangler.toml` ด้วย)
- ไม่มี module ก่อนหน้า — นี่คือจุดเริ่มต้น

## ไฟล์ที่ต้องสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/env.ts` | นิยาม type `Env` — binding/secret/var ทั้งหมดที่ worker ใช้ ทุก field เป็น optional (worker ต้องรันได้แม้ตั้งค่าไม่ครบ — ฟีเจอร์ที่ขาด config จะปิดตัวเองแบบ fail-closed พร้อมข้อความอธิบาย ไม่ crash) ต้องมีอย่างน้อย: `APP_KV: KVNamespace`, `ASSETS: Fetcher`, `GEMINI_API_KEY?`, `GEMINI_MODEL?`, `OPENAI_API_KEY?`, `OPENAI_MODEL?`, `OPENAI_COMPAT_BASE_URL?`, `OPENAI_COMPAT_MODEL?`, `OPENAI_COMPAT_API_KEY?`, `DEFAULT_CHAT_PROVIDER?` |
| `src/index.ts` | entrypoint `fetch()` ของ worker — เรียก `route()` จาก `router.ts` |
| `src/router.ts` | route table แบบ if/else ตาม `pathname` — ตอนนี้มีแค่ `/api/chat` (เรียก `handleChatRoute`) กับ `/healthz` (ตอบ 200 เฉย ๆ) |
| `src/lib/http.ts` | helper `json(data, status?)` และ `errorJson(message, status?)` คืน `Response` แบบ JSON ให้ทุก route เรียกใช้ร่วมกัน |
| `src/module-1.1-chat/types.ts` | `ChatMessage` (`{role: 'user'\|'assistant', content: string}`), `ChatProvider` (`'gemini' \| 'openai' \| 'openai-compat'`), `McpTool`, `ToolTraceEntry`, `ChatTurnResult`, `ToolCaller`, `toolFunctionName()` (สร้างชื่อ tool แบบ `<serverId>__<toolName>` กันชนกันระหว่าง MCP server — ยังไม่ต้องใช้จริงจนกว่าจะถึง module 1.3 แต่นิยามไว้ก่อน) |
| `src/module-1.1-chat/tool-schema.ts` | `toGeminiSchema(schema)` แปลง JSON Schema มาตรฐาน (type ตัวพิมพ์เล็ก) ให้เป็นรูปแบบที่ Gemini function calling ต้องการ (type ตัวพิมพ์ใหญ่ เช่น `OBJECT`/`STRING`) — recursive ผ่าน `properties`/`items` |
| `src/module-1.1-chat/providers/gemini.ts` | เรียก `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}` วนเรียก tool สูงสุด 4 รอบถ้าโมเดลขอ tool call (ตอนนี้ `tools` จะว่างเสมอเพราะ module 1.3 ยังไม่มา) ถ้า `apiKey` ว่าง ให้คืนข้อความแจ้งเตือนที่อ่านเข้าใจได้ (ไม่ throw) |
| `src/module-1.1-chat/providers/openai-compat.ts` | เรียก `POST {baseUrl}/chat/completions` แบบ OpenAI-compatible (`messages`, `tools`/`tool_choice` ถ้ามี) วนเรียก tool สูงสุด 4 รอบเหมือนกัน — รับ `baseUrl` เป็นพารามิเตอร์ (ไม่ hardcode) ใช้ได้ทั้ง provider `openai` (baseUrl คงที่ `https://api.openai.com/v1`) และ `openai-compat` (baseUrl ผู้ใช้ตั้งเอง) ถ้า `baseUrl`/`apiKey` ว่าง ให้คืนข้อความแจ้งเตือน |
| `src/module-1.1-chat/chat-routes.ts` | `handleChatRoute(request, env)` — `POST /api/chat` รับ `{message, history, provider?, model?}`, เรียก `resolveApiKey()`/`resolveBaseUrl()` (ตอนนี้ = อ่านจาก `env` ตรง ๆ ตาม provider) และ `resolveTools()` (ตอนนี้ = คืน `tools: []` เสมอ), ประกอบ system prompt ภาษาไทย, dispatch ไปยัง `runGeminiConversation()` หรือ `runOpenAiCompatConversation()` ตาม provider, คืน `{reply, provider, model, toolTrace}` — เขียน `buildSystemPrompt()`/`resolveProvider()`/`defaultModelFor()` แยกไว้ให้แก้ทีเดียว และเขียนฟังก์ชัน `runChatTurn()` ท้ายไฟล์ (module 2.3 จะมาเรียกใช้ตรง ๆ ในอนาคต ยังไม่ต้องมี route ใดเรียกตอนนี้) |
| `public/chat/index.html`, `public/chat/app.js` | หน้าเว็บแชท plain HTML/CSS/JS (ไม่มี build step) — ส่ง `POST /api/chat` พร้อม `{message, history, provider, model}`, แสดงประวัติแชทแบบ bubble, มี dropdown เลือก provider (Gemini/OpenAI/Custom gateway) + ช่องกรอก model แบบ text input |
| `public/index.html` | **Portal Hub** — หน้าแรกของระบบ (เขียนทับหน้า starter เดิมที่บอกว่า "ยังไม่ได้เพิ่ม module ใดเลย") แสดงการ์ดนำทางไปแต่ละหน้า ตอนนี้มีใบเดียวคือ 💬 หน้าต่าง Chat (`/chat/`) — module 1.2/1.3 จะมาเพิ่มการ์ดต่อทีละใบ |
| `wrangler.toml` | `name`, `main = "src/index.ts"`, `compatibility_date` ปัจจุบัน, `[assets] directory = "./public"` binding `ASSETS`, `[[kv_namespaces]]` binding `APP_KV`, `[vars]` มี `GEMINI_MODEL`/`OPENAI_MODEL`/`DEFAULT_CHAT_PROVIDER`/`OPENAI_COMPAT_BASE_URL`/`OPENAI_COMPAT_MODEL` |

## ข้อกำหนดสำคัญ

1. **ห้าม hardcode base URL ของ gateway กำหนดเอง (`openai-compat`) หรือ API key ใด ๆ ในโค้ด** — ต้องอ่านจาก
   `env` เท่านั้น (module 1.2 จะมาเพิ่มช่องกรอกจากหน้าเว็บทีหลัง) — `gemini`/`openai` ใช้ endpoint คงที่ของแต่ละเจ้า
   ได้ตรง ๆ (ไม่ใช่ "base URL แบบกำหนดเอง" จึง hardcode endpoint พวกนี้ได้ตามปกติ)
2. Backend เท่านั้นที่ยิง request ไปหา AI provider — เบราว์เซอร์ห้ามเห็น API key เด็ดขาด
3. ถ้ายังไม่ตั้งค่า key ของ provider ที่เลือก (หรือ base URL กรณี `openai-compat`) ให้ตอบข้อความแจ้งเตือนภาษาไทย
   ที่อ่านรู้เรื่องกลับไปในแชท (ห้าม crash/500)
4. ประวัติแชท (`history`) เก็บฝั่ง browser เท่านั้น (ตัวแปร JS ธรรมดา ไม่ persist ข้าม reload) — backend ไม่เก็บ state
   ข้าม request ในโมดูลนี้
5. ไม่ระบุ `provider` มาใน request — fallback ไป `env.DEFAULT_CHAT_PROVIDER` ถ้าตั้งไว้ ไม่งั้น default เป็น
   `'gemini'`

## Acceptance Criteria

- [ ] `npm run typecheck` ผ่านไม่มี error
- [ ] `npm run dev` แล้วเปิด `http://localhost:8787/chat/` เห็นหน้าแชทจริง มี dropdown เลือก provider
- [ ] เปิด `http://localhost:8787/` (หน้าแรก) เห็น Portal Hub ที่มีการ์ด "💬 หน้าต่าง Chat" คลิกแล้วไป `/chat/` ได้จริง
      (ไม่ใช่ข้อความ starter เดิม)
- [ ] ยังไม่ตั้ง key ของ provider ที่เลือก: พิมพ์อะไรก็ได้ในหน้าแชท ต้องได้ข้อความแจ้งเตือนกลับมา ไม่ error/crash
- [ ] ตั้งค่าแล้ว: พิมพ์ "สวัสดี" ในหน้าแชท (ลองทั้ง Gemini และ OpenAI ถ้ามี key ทั้งคู่) ต้องได้คำตอบจริงจากโมเดล
- [ ] ทดสอบตรงด้วย curl ก็ต้องได้ผลเดียวกัน:
  ```bash
  curl -X POST <WORKER_URL>/api/chat -H 'content-type: application/json' -d '{"message":"สวัสดี","provider":"gemini"}'
  ```
- [ ] `GET /healthz` ตอบ 200

## ห้ามทำเกินสโคป

- ยังไม่ต้องมีหน้าตั้งค่า key (module 1.2), ยังไม่ต้องมี MCP tools จริง (module 1.3), ยังไม่ต้องมี Telegram
  (module 2.3) — อย่าเผื่ออนาคตเกินจำเป็น ทำแค่ที่ระบุในสเปกนี้
- ไม่ต้องทำ login/session/รหัสผ่านเข้าเว็บ (เป็นเรื่อง hardening แยกต่างหาก ไม่ใช่ scope ของ module นี้)

## Prompt แนะนำสำหรับสั่ง AI agent

> อ่านสเปกใน `docs/module-1.1-chat-spec.md` ให้ครบก่อน แล้วสร้างไฟล์ทั้งหมดตามตารางในหัวข้อ "ไฟล์ที่ต้องสร้าง"
> ให้ตรงตามข้อกำหนดทุกข้อ เขียนโค้ด TypeScript ที่ type-safe รันผ่าน `npm run typecheck` เสร็จแล้วรันเช็คตาม
> Acceptance Criteria ทีละข้อ แล้วสรุปผลให้ฟัง
