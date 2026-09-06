# Module 1.2 — หน้าตั้งค่า Key (เก็บใน Cloudflare KV)

**ก่อนเริ่ม**: ทำ [Module 1.1](module-1.1-chat.md) ให้คุยได้จริงก่อน — โมดูลนี้ "อัปเกรด" `chat-routes.ts` ของ 1.1
ไม่ได้เริ่มจากศูนย์

## เป้าหมาย

ต่อยอดจาก [Module 1.1](module-1.1-chat.md): เพิ่มหน้าเว็บให้เปลี่ยน `GEMINI_API_KEY`/`OPENAI_API_KEY`/
`OPENAI_COMPAT_API_KEY`/`OPENAI_COMPAT_BASE_URL` ได้โดยไม่ต้อง `wrangler secret put`/แก้ `wrangler.toml` + deploy
ใหม่ทุกครั้ง — ค่าที่ตั้งจากหน้านี้เก็บใน **Cloudflare KV** (storage แบบ key-value ฟรีของ Cloudflare, free tier:
อ่าน 100,000 ครั้ง/วัน เขียน 1,000 ครั้ง/วัน พอเหลือเฟือสำหรับ workshop/demo) และมีสิทธิ์เหนือกว่าค่าจาก
env/`[vars]` เสมอ

หน้านี้ (และ Module 1.3) แก้ config ที่มีผลกับทุกคนที่ใช้ worker นี้ เลยต้องป้องกันด้วย **admin token**
(`ADMIN_TOKEN`) — ถ้ายังไม่ตั้งค่านี้ endpoint จะปิดทั้งหมด (fail-closed) ดู [SETUP.md](../SETUP.md) ข้อ 3

## ไฟล์ที่สร้างใหม่ในโมดูลนี้

| ไฟล์ | หน้าที่ |
|---|---|
| [`public/settings-keys/index.html`](../public/settings-keys/index.html), [`app.js`](../public/settings-keys/app.js) | หน้าเว็บ: ปลดล็อกด้วย admin token แล้วดู/ตั้ง/ล้าง key ต่อ provider + base URL ของ gateway กำหนดเอง |
| [`public/shared/admin-auth.js`](../public/shared/admin-auth.js) | เก็บ admin token ใน `localStorage` ของเบราว์เซอร์ + helper `adminFetch()` ที่แนบ header ให้อัตโนมัติ |
| [`src/lib/auth.ts`](../src/lib/auth.ts) | `requireAdminToken()` — เทียบ header `X-Admin-Token` กับ `env.ADMIN_TOKEN` แบบ timing-safe |
| [`src/module-1.2-key-settings/keys-store.ts`](../src/module-1.2-key-settings/keys-store.ts) | อ่าน/เขียน key แต่ละ provider ใน KV (`secret:gemini_api_key`, `secret:openai_api_key`, `secret:openai_compat_api_key`, `config:openai_compat_base_url`) + fallback ไป env |
| [`src/module-1.2-key-settings/keys-routes.ts`](../src/module-1.2-key-settings/keys-routes.ts) | `GET/POST/DELETE /api/settings/keys` |

## แก้ไฟล์เดิม (อัปเกรดจาก Module 1.1)

**1. [`src/module-1.1-chat/chat-routes.ts`](../src/module-1.1-chat/chat-routes.ts)** — แก้ `resolveApiKey()`/`resolveBaseUrl()`
จาก:

```ts
async function resolveApiKey(env: Env, provider: ChatProvider): Promise<string | undefined> {
  if (provider === 'gemini') return env.GEMINI_API_KEY;
  if (provider === 'openai') return env.OPENAI_API_KEY;
  return env.OPENAI_COMPAT_API_KEY;
}
```

เป็น:

```ts
async function resolveApiKey(env: Env, provider: ChatProvider): Promise<string | undefined> {
  return getEffectiveApiKey(env, provider);
}
```

(พร้อม `import { getEffectiveApiKey, getEffectiveBaseUrl } from '../module-1.2-key-settings/keys-store';` ที่หัวไฟล์)
— แค่นี้ทั้ง `handleChatRoute()` และ `runChatTurn()` ก็ใช้ key จาก KV ทันทีโดยไม่ต้องแก้จุดอื่นเลย เพราะทั้งคู่เรียกผ่าน
`resolveApiKey()` ตัวเดียวกัน (`resolveBaseUrl()` ของ provider `openai-compat` แก้แบบเดียวกัน เรียก
`getEffectiveBaseUrl(env)`)

**2. [`src/router.ts`](../src/router.ts)** — เพิ่ม route ใหม่:

```ts
import { handleKeysRoute } from './module-1.2-key-settings/keys-routes';
// ...
if (pathname === '/api/settings/keys') return handleKeysRoute(request, env);
```

## ทดสอบ

```bash
# ไม่ใส่ token — ต้องถูกปฏิเสธ
curl <WORKER_URL>/api/settings/keys

# ใส่ token ถูก — เห็นสถานะ key ของทุก provider + base URL (masked)
curl <WORKER_URL>/api/settings/keys -H "X-Admin-Token: <ADMIN_TOKEN>"

# ตั้ง key ใหม่ผ่าน KV (แทนที่ env) — provider เป็นหนึ่งใน gemini/openai/openai-compat
curl -X POST <WORKER_URL>/api/settings/keys \
  -H "X-Admin-Token: <ADMIN_TOKEN>" -H 'content-type: application/json' \
  -d '{"provider":"gemini","apiKey":"..."}'

# ตั้ง base URL ของ gateway กำหนดเอง (ใช้กับ provider openai-compat เท่านั้น)
curl -X POST <WORKER_URL>/api/settings/keys \
  -H "X-Admin-Token: <ADMIN_TOKEN>" -H 'content-type: application/json' \
  -d '{"baseUrl":"Replace base url"}'

# ล้างค่ากลับไปใช้ env
curl -X DELETE '<WORKER_URL>/api/settings/keys?provider=gemini' -H "X-Admin-Token: <ADMIN_TOKEN>"
curl -X DELETE '<WORKER_URL>/api/settings/keys?field=baseUrl' -H "X-Admin-Token: <ADMIN_TOKEN>"
```

หรือเปิด `<WORKER_URL>/settings-keys/` แล้วทำผ่านหน้าเว็บได้เลย — ตั้ง key ใหม่แล้วกลับไปคุยที่หน้า `/chat/`
(Module 1.1) อีกรอบ ต้องยังคุยได้ปกติเหมือนเดิม (แค่ key มาจากคนละที่)

## ต่อยอด

- เพิ่ม provider ใหม่ (เช่น Anthropic ตรง ๆ ไม่ผ่าน gateway): เพิ่มใน `ChatProvider` type
  (`src/module-1.1-chat/types.ts`), `envKeyFor()`/`kvKeyFor()` ใน `keys-store.ts`, เขียน provider client ใหม่ใน
  `src/module-1.1-chat/providers/`
- อยากให้ผู้ใช้แต่ละคนมี key ของตัวเอง (multi-tenant) แทนที่จะเป็น config กลาง: ต้องเพิ่มระบบ auth ผู้ใช้และ
  เปลี่ยน KV key ให้ผูกกับ user id — นอกสโคปของ workshop นี้
