# Spec — Module 1.2: หน้าตั้งค่า Key (เก็บใน Cloudflare KV)

> ไฟล์นี้เขียนให้ AI coding agent อ่านแล้วลงมือสร้าง/แก้ไฟล์ได้เลย (ดูวิธีสั่ง agent ใน README.md หัวข้อ "vibecode ด้วย AI coding agent")
> อยากอ่านคำอธิบายละเอียดกว่านี้ ดู [module-1.2-key-settings.md](module-1.2-key-settings.md)

## บริบท

ต่อยอดจาก [Module 1.1](module-1.1-chat.md) (ต้องทำเสร็จก่อน) — เพิ่มหน้าเว็บให้ผู้ใช้เปลี่ยน key ของแต่ละ
provider (`GEMINI_API_KEY`/`OPENAI_API_KEY`/`OPENAI_COMPAT_API_KEY`) และ base URL ของ gateway กำหนดเอง
(`OPENAI_COMPAT_BASE_URL`) ได้เองโดยไม่ต้องแก้ `wrangler.toml`/`wrangler secret put` + deploy ใหม่ทุกครั้ง —
ค่าที่ตั้งจากหน้านี้เก็บใน **Cloudflare KV** และมีสิทธิ์เหนือกว่าค่าจาก env/`[vars]` เสมอ

หน้านี้แก้ config ที่มีผลกับทุกคนที่ใช้ worker นี้ เลยต้องป้องกันด้วย **admin token** (`ADMIN_TOKEN`)

## Prerequisites

- ทำ [Module 1.1](module-1.1-chat.md) ให้เสร็จก่อน (มีไฟล์ `chat-routes.ts`, `env.ts`, `router.ts`,
  `ChatProvider` type อยู่แล้ว)
- ตั้ง secret `ADMIN_TOKEN` ไว้แล้ว (SETUP.md ข้อ 3) — ถ้ายังไม่ตั้ง endpoint ต้องปิดทั้งหมด (fail-closed)

## ไฟล์ที่ต้องสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/auth.ts` | `requireAdminToken(request, env)` — เทียบ header `X-Admin-Token` กับ `env.ADMIN_TOKEN` แบบ timing-safe คืน `Response` error ถ้าไม่ตรง/ไม่ได้ตั้งค่า (fail-closed), คืน `undefined` ถ้าผ่าน |
| `src/module-1.2-key-settings/keys-store.ts` | `getEffectiveApiKey(env, provider)` — เช็ค KV ก่อน (`secret:<provider>_api_key` เช่น `secret:gemini_api_key`, `secret:openai_api_key`, `secret:openai_compat_api_key`) แล้ว fallback ไป `env` ตาม provider, `getEffectiveBaseUrl(env)` (เฉพาะ openai-compat) เช็ค KV (`config:openai_compat_base_url`) แล้ว fallback `env.OPENAI_COMPAT_BASE_URL`, `getKeyStatuses(env)` คืนสถานะ key ทุก provider (configured/source/masked hint), `getBaseUrlStatus(env)`, `setApiKey`/`clearApiKey` (รับ provider) และ `setBaseUrl`/`clearBaseUrl` เขียน/ลบใน KV |
| `src/module-1.2-key-settings/keys-routes.ts` | `handleKeysRoute(request, env)` — `GET/POST/DELETE /api/settings/keys` ทุกเมธอดเช็ค `requireAdminToken()` ก่อน `POST` รับ `{provider?, apiKey?, baseUrl?}` (ตั้ง apiKey ต้องมี provider ที่ valid ด้วย, validate ว่า `baseUrl` ขึ้นต้นด้วย `http(s)://`) `DELETE` รับ `?provider=` (ล้าง key) หรือ `?field=baseUrl` (ล้าง base URL) |
| `public/settings-keys/index.html`, `app.js` | หน้าเว็บ: กรอก admin token ปลดล็อก แล้วเห็น 3 แถว API key (Gemini/OpenAI/Custom gateway) + 1 แถว Base URL (เฉพาะ gateway กำหนดเอง) พร้อมปุ่มบันทึก/ล้างค่า แสดงสถานะว่าค่าปัจจุบันมาจาก KV หรือ env |
| `public/shared/admin-auth.js` | เก็บ admin token ใน `localStorage`, helper `adminFetch(path, options)` แนบ header `X-Admin-Token` ให้อัตโนมัติ, `getAdminToken()`/`setAdminToken()` |

## แก้ไฟล์เดิม

**`src/module-1.1-chat/chat-routes.ts`** — แก้ `resolveApiKey()`/`resolveBaseUrl()` จากอ่าน `env` ตรง ๆ ให้เรียก
`getEffectiveApiKey(env, provider)`/`getEffectiveBaseUrl(env)` จาก `keys-store.ts` แทน (import เพิ่มที่หัวไฟล์) —
จุดอื่นในไฟล์ไม่ต้องแก้ เพราะทั้ง `handleChatRoute()` และ `runChatTurn()` เรียกผ่านสองฟังก์ชันนี้ตัวเดียวกันอยู่แล้ว

**`src/router.ts`** — เพิ่ม route: `if (pathname === '/api/settings/keys') return handleKeysRoute(request, env);`

## ข้อกำหนดสำคัญ

1. Key ที่บันทึกแล้วห้าม echo กลับเต็ม ๆ ผ่าน API — โชว์แค่ 4 ตัวท้าย (mask ที่เหลือด้วย `••••`)
2. ไม่ตั้ง `ADMIN_TOKEN` เลย → ทุก request ไป `/api/settings/keys` ต้องถูกปฏิเสธ (fail-closed ไม่ใช่เปิดโล่ง)
3. `baseUrl` ที่ POST เข้ามาต้อง validate รูปแบบ (ขึ้นต้น `http://` หรือ `https://`) ก่อนเขียนลง KV
4. `provider` ที่ POST/DELETE เข้ามาต้องเป็นหนึ่งใน `gemini`/`openai`/`openai-compat` เท่านั้น

## Acceptance Criteria

- [ ] `npm run typecheck` ผ่าน
- [ ] `curl <WORKER_URL>/api/settings/keys` (ไม่แนบ token) → ถูกปฏิเสธ
- [ ] `curl <WORKER_URL>/api/settings/keys -H "X-Admin-Token: <ADMIN_TOKEN>"` → เห็นสถานะ key ทั้ง 3 provider +
      base URL (masked)
- [ ] `POST` ตั้ง key ของ provider ใดก็ได้ (หรือ `baseUrl`) ผ่าน curl หรือหน้าเว็บ `/settings-keys/` แล้วค่าที่ตั้ง
      มีผลจริงตอนคุยที่ `/chat/` (เลือก provider เดียวกันแล้วลองคุยดู)
- [ ] `DELETE ...?provider=gemini` (หรือ `?field=baseUrl`) แล้วกลับไปใช้ค่าจาก `env`/`wrangler.toml` เหมือนเดิม

## ห้ามทำเกินสโคป

- ยังไม่ต้องมี MCP settings ([module 1.3](module-1.3-mcp-client-settings.md)) — หน้า `/settings-mcp/`
  เป็นของ module ถัดไป

## Prompt แนะนำสำหรับสั่ง AI agent

> อ่าน `docs/module-1.2-key-settings-spec.md` ให้ครบ แล้ว "อัปเกรด" โปรเจกต์ตามหัวข้อ "ไฟล์ที่ต้องสร้าง" และ
> "แก้ไฟล์เดิม" — อย่าลบของเดิมที่ module 1.1 สร้างไว้ แก้เฉพาะจุดที่ระบุ ตรวจด้วย Acceptance Criteria ทุกข้อก่อน
> รายงานผล
