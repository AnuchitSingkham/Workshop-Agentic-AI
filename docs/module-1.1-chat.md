# Module 1.1 — หน้าต่าง Chat (Gemini / OpenAI / gateway กำหนดเอง)

**ก่อนเริ่ม**: ทำ [SETUP.md](../SETUP.md) ข้อ 1–4 ให้เสร็จก่อน (KV namespace + `ADMIN_TOKEN` + อย่างน้อย 1 ใน
`GEMINI_API_KEY`/`OPENAI_API_KEY`/`OPENAI_COMPAT_API_KEY`) — โมดูลนี้เป็นจุดเริ่มต้นของทุกอย่าง ไม่มีโมดูลก่อนหน้า
ให้ต้องทำ

## เป้าหมาย

หน้าเว็บคุยกับ AI จริง ผ่าน backend (ไม่ใช่เรียก provider ตรงจากเบราว์เซอร์แบบ demo เดิม) เลือกได้ 3 ทาง:
**Google Gemini** (เรียก API ตรง), **OpenAI** (เรียก API ตรง เหมือนกัน) หรือ **AI gateway แบบ OpenAI-compatible
กำหนดเอง** (เช่น `Replace base url`, หรือ OpenRouter/Azure OpenAI/self-host ก็ได้เหมือนกัน
เพราะพูด wire format เดียวกัน) — **base URL ของ gateway กำหนดเองต้องไม่ hardcode ในโค้ด** ตั้งผ่าน
`wrangler secret`/`[vars]` ตอน deploy เท่านั้น (ยังไม่มีหน้าตั้งค่า, ยังไม่มี MCP tools — 2 อย่างนี้เป็นของ Module
1.2/1.3 ที่จะมา "อัปเกรด" โมดูลนี้ทีหลัง)

## สถานะตอนจบโมดูลนี้

คุยกับ AI ผ่านหน้าเว็บได้จริง ไม่มี memory ข้าม module อื่นเลย (ยังไม่มีหน้าตั้งค่า key, ยังไม่มี MCP
tools ให้เรียก, ยังไม่มี Telegram) — ตั้งใจให้เป็นระบบที่เล็กที่สุดที่ยังใช้งานได้จริง ทดสอบผ่านก่อนค่อยไปต่อ

## ไฟล์ที่สร้างใหม่ในโมดูลนี้

โมดูลแรก เลยต้องสร้าง "ระบบกลาง" (entrypoint/router/env types) ไปพร้อมกันด้วย ไม่ใช่แค่ไฟล์ของ chat เอง:

| ไฟล์ | หน้าที่ |
|---|---|
| [`src/env.ts`](../src/env.ts) | นิยาม `Env` — binding/secret/var ทั้งหมดที่ worker ใช้ (โมดูลหลังจะมาเพิ่ม field ในนี้เรื่อย ๆ) |
| [`src/index.ts`](../src/index.ts) | entrypoint `fetch()` — เรียก `route()` จาก router.ts |
| [`src/router.ts`](../src/router.ts) | ตอนนี้มีแค่ 1 บรรทัด: `if (pathname === '/api/chat') return handleChatRoute(request, env);` (+ `/healthz`) — โมดูลหลังจะมาเพิ่ม route ทีละบรรทัด |
| [`src/lib/http.ts`](../src/lib/http.ts) | helper `json()`/`errorJson()` ใช้ร่วมกันทุก route |
| [`src/module-1.1-chat/types.ts`](../src/module-1.1-chat/types.ts) | `ChatMessage`, `ChatProvider` (`'gemini' \| 'openai' \| 'openai-compat'`) และ type อื่น ๆ ที่โมดูลหลังจะ import ไปใช้ต่อ |
| [`src/module-1.1-chat/tool-schema.ts`](../src/module-1.1-chat/tool-schema.ts) | แปลง JSON Schema ให้เป็นรูปแบบที่ Gemini function calling ต้องการ (ยังไม่ได้ใช้จริงจนกว่าจะถึง Module 1.3 แต่เตรียมไว้เลย) |
| [`src/module-1.1-chat/providers/gemini.ts`](../src/module-1.1-chat/providers/gemini.ts) | เรียก Gemini `generateContent` — เขียนให้รองรับ tools/function-calling ไว้แต่แรก (รับ `tools: []` เฉย ๆ ตอนนี้) |
| [`src/module-1.1-chat/providers/openai-compat.ts`](../src/module-1.1-chat/providers/openai-compat.ts) | เรียก `chat/completions` แบบ OpenAI-compatible ไปที่ `baseUrl` ที่ส่งเข้ามา (ไม่ hardcode URL) — ใช้ได้ทั้งกับ provider `openai` (ส่ง baseUrl คงที่ของ OpenAI) และ `openai-compat` (ส่ง baseUrl ที่ผู้ใช้ตั้งเอง) เขียนแบบเดียวกับ gemini.ts |
| [`src/module-1.1-chat/chat-routes.ts`](../src/module-1.1-chat/chat-routes.ts) | `POST /api/chat` — **ตอนนี้ `resolveApiKey()`/`resolveBaseUrl()` อ่านจาก `env` ตรง ๆ และ `resolveTools()` คืน `tools: []` เสมอ** (อ่านคอมเมนต์ในไฟล์ — บรรทัดที่ Module 1.2/1.3 จะมาแก้ทีหลังมีคอมเมนต์บอกไว้ชัดเจนว่าเปลี่ยนอะไร) |
| [`public/chat/index.html`](../public/chat/index.html), [`app.js`](../public/chat/app.js) | หน้าเว็บ — ส่ง `POST /api/chat` พร้อม `{ message, history, provider, model }` |

> **ทำไม gemini.ts/openai-compat.ts รองรับ tools ตั้งแต่แรกทั้งที่ยังไม่ใช้**: เพราะ provider client ไม่จำเป็นต้องรู้ว่า
> tools มาจากไหน (นั่นคือหน้าที่ของ `chat-routes.ts`) แค่รับ `tools: McpTool[]` (ว่างก็ได้) กับ `callTool` มา —
> ทำให้ Module 1.3 ไม่ต้องแก้ไฟล์ provider เลยสักตัว แก้แค่ `resolveTools()` ใน `chat-routes.ts` พอ

## flow

1. ผู้ใช้พิมพ์ข้อความในหน้า Chat → JS เก็บ history ไว้ในตัวแปรฝั่ง browser (ไม่ persist ข้าม reload)
2. `chat-routes.ts` เรียก `resolveApiKey()`/`resolveBaseUrl()` (ตอนนี้ = อ่านจาก `env` ตรง ๆ) และ `resolveTools()` (ตอนนี้ = ว่างเสมอ)
3. ยิงไปที่ provider ที่เลือก — เพราะยังไม่มี tools โมเดลจะตอบข้อความล้วน ๆ ไม่มี function call ให้วนเรียก
4. ตอบกลับเป็น `{ reply, provider, model, toolTrace: [] }`

## ทดสอบ (checkpoint)

```bash
curl -X POST <WORKER_URL>/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"สวัสดี","provider":"gemini"}'
```

ถ้ายังไม่ได้ตั้ง key ของ provider ที่เลือก (หรือ `OPENAI_COMPAT_BASE_URL` ถ้าเลือก `openai-compat`) จะได้ `reply`
เป็นข้อความแจ้งเตือนที่อ่านเข้าใจได้ (ไม่ crash) — ตั้ง key แล้วลองใหม่ให้เห็นคำตอบจริงจากโมเดลก่อนไปทำ Module 1.2
ต่อ (เปิด `<WORKER_URL>/chat/` ทดสอบผ่านหน้าเว็บก็ได้เหมือนกัน)

## ต่อยอด

- เพิ่มโมเดลในรายการ: แก้ `DEFAULT_MODELS` ใน [`public/chat/app.js`](../public/chat/app.js) จุดเดียว
- เปลี่ยน system prompt/บุคลิกผู้ช่วย: แก้ `buildSystemPrompt()` ใน [`chat-routes.ts`](../src/module-1.1-chat/chat-routes.ts)
- อยาก stream คำตอบทีละ token แทนรอครบ: ต้องเปลี่ยนทั้ง endpoint (Server-Sent Events) และ provider clients —
  ไม่รวมอยู่ใน scope นี้ เก็บไว้เป็นการบ้านต่อยอด
