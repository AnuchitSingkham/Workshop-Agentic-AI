# Module 2.2 — MCP server: Google Calendar

**ก่อนเริ่ม**: ทำ [Module 2.1](module-2.1-mcp-simple-server.md) ให้เสร็จก่อน (ใช้ `server-factory.ts` ตัวเดียวกัน)
+ ทำ [SETUP.md](../SETUP.md) ข้อ 5 (ขอ Google OAuth refresh token) — แพทเทิร์นเหมือน 2.1 ทุกอย่าง คือสร้าง server
ใหม่แล้วลงทะเบียนเข้า `BUILTIN_SERVERS` บรรทัดเดียว ไม่ต้องแตะ chat engine หรือหน้าเว็บเลย

## เป้าหมาย

MCP server ตัวที่สอง — ใช้ framework เดียวกับ [Module 2.1](module-2.1-mcp-simple-server.md) แต่ต้องตั้งค่า
**Google OAuth refresh token** ก่อนถึงจะเรียกได้จริง (ดูขั้นตอนขอใน [SETUP.md](../SETUP.md) ข้อ 5) — เขียน REST
call ตรง ๆ ด้วย OAuth refresh-token flow ตัดส่วน Gmail ออก เหลือแค่ Calendar

## ไฟล์ที่สร้างใหม่ในโมดูลนี้

| ไฟล์ | หน้าที่ |
|---|---|
| [`src/module-2.2-mcp-google-calendar/google-calendar-client.ts`](../src/module-2.2-mcp-google-calendar/google-calendar-client.ts) | แลก refresh token → access token, เรียก Calendar REST API (`list`/`insert` events) |
| [`src/module-2.2-mcp-google-calendar/google-calendar-server.ts`](../src/module-2.2-mcp-google-calendar/google-calendar-server.ts) | ห่อเป็น MCP server ด้วย `createMcpServer()` (import จาก `module-2.1-mcp-simple-server/server-factory.ts`) — 2 tools: `list_events`, `create_event` |
| `src/module-2.2-mcp-google-calendar/google-oauth-store.ts` | ที่เก็บ refresh token ใน KV (แพทเทิร์นเดียวกับ `module-1.2-key-settings/keys-store.ts`: KV override ชนะ secret เดิมเสมอ) + ที่เก็บ state token กัน CSRF ของ flow ด้านล่าง |
| `src/module-2.2-mcp-google-calendar/google-oauth-routes.ts` | ทำ OAuth "authorization code" flow เต็มรูปแบบผ่าน URL ของ worker เอง (`/oauth/google/start` → `/oauth/google/callback`) แทนการต้องคัดลอก refresh token มาจาก OAuth Playground ด้วยมือ |

## แก้ไฟล์เดิม (อัปเกรดจาก Module 2.1)

**1. [`src/router.ts`](../src/router.ts)** — เพิ่ม route ใหม่:

```ts
import { googleCalendarServer } from './module-2.2-mcp-google-calendar/google-calendar-server';
import { handleGoogleOAuthRoute } from './module-2.2-mcp-google-calendar/google-oauth-routes';
// ...
if (pathname === '/mcp/google-calendar') return googleCalendarServer.fetch(request, env);

if (pathname === '/oauth/google/start' || pathname === '/oauth/google/callback') {
  return handleGoogleOAuthRoute(request, env, pathname);
}
```

**2. [`src/module-1.3-mcp-client-settings/registry.ts`](../src/module-1.3-mcp-client-settings/registry.ts)** —
ลงทะเบียนเข้า `BUILTIN_SERVERS` แบบเดียวกับที่ 2.1 เพิ่ม `utils`:

```ts
import { googleCalendarServer } from '../module-2.2-mcp-google-calendar/google-calendar-server';

const BUILTIN_SERVERS: Record<string, McpServerHandle<Env>> = {
  utils: utilsServer,
  'google-calendar': googleCalendarServer,
};
```

ไม่แตะไฟล์อื่นเลยนอกจาก 2 จุดนี้

**ตั้งใจให้ fail-closed แบบสุภาพ**: ถ้ายังไม่ตั้งค่า `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/refresh token
(ไม่ว่าจะยังไม่ตั้งหรือยังไม่เคย login ผ่าน `/oauth/google/start`) — `tools/list` ยังคงแสดง tool ให้เห็นตามปกติ
(ไม่ปิดบัง) แต่ `tools/call` จะ error พร้อมข้อความบอกว่าต้องตั้งอะไรเพิ่ม แทนที่จะ crash เฉย ๆ

## วิธีขอ refresh token — 2 ทางเลือก

### ทางที่ 1 (แนะนำ): login ผ่านหน้าเว็บของ worker เอง

เพราะ worker deploy แล้วมี URL สาธารณะอยู่แล้ว (`<WORKER_URL>`) เอา URL นี้ไปใช้เป็น `redirect_uri` ของ OAuth
ได้เลย ไม่ต้องผ่าน OAuth Playground:

1. Login เว็บนี้ก่อน (ต้องมี `CLASS_PASSWORD` session อยู่แล้ว)
2. เปิด `<WORKER_URL>/oauth/google/start` ในเบราว์เซอร์
3. เข้าหน้า consent ของ Google → เลือกบัญชี → Allow
4. Google redirect กลับมาที่ `/oauth/google/callback` เอง → เห็นหน้า "✅ เชื่อมต่อสำเร็จ" ก็ใช้งานได้ทันที
   (เก็บ refresh token ลง KV ให้อัตโนมัติ ไม่ต้อง `wrangler secret put` / deploy ใหม่)

**ข้อกำหนดก่อนใช้ทางนี้**: ต้องสร้าง Google OAuth Client แบบ **"Web application"** (ไม่ใช่ "Desktop app")
แล้วเพิ่ม Authorized redirect URI = `<WORKER_URL>/oauth/google/callback` ก่อน — ดูขั้นตอนเต็มใน
[SETUP.md](../SETUP.md) หัวข้อ 5.4b

### ทางที่ 2 (เดิม): OAuth Playground แบบ manual

ยังใช้ได้ตามปกติ ดู [SETUP.md](../SETUP.md) หัวข้อ 5.4a — ได้ refresh token มาแล้วตั้งเป็น secret
`GOOGLE_REFRESH_TOKEN` ผ่าน `wrangler secret put` โค้ดจะ fallback มาใช้ค่านี้เองถ้ายังไม่เคย login ผ่านทางที่ 1

## ทดสอบด้วย curl

```bash
curl -X POST <WORKER_URL>/mcp/google-calendar -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_events","arguments":{"days":7}}}'

curl -X POST <WORKER_URL>/mcp/google-calendar -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_event","arguments":{
        "title":"ทดสอบ MCP","startDateTime":"2026-09-01T14:00:00+07:00","endDateTime":"2026-09-01T15:00:00+07:00"
      }}}'
```

**checkpoint — ถามในหน้า Chat ได้เลยตอนนี้** เหมือน 2.1: เปิด `/chat/` แล้วถาม "มีนัดอะไรบ้างสัปดาห์นี้" หรือสั่ง
"ช่วยนัดพรุ่งนี้บ่ายสองโมง ชื่อทดสอบ MCP" — ผู้ช่วยต้องเรียก tool จริงและเห็นผลใน Google Calendar จริง

ถ้ายังไม่เรียก tool ให้เปิด `/settings-mcp/` เช็คว่า server "google-calendar" โผล่มาและ enabled อยู่ — ถ้าไม่โผล่
แปลว่ายังไม่ได้เพิ่มลง `BUILTIN_SERVERS` ในขั้นตอน "แก้ไฟล์เดิม" ข้อ 2

## ต่อยอด

- เพิ่ม Gmail กลับมา (list/send email): เพิ่มฟังก์ชันใน `google-calendar-client.ts` (หรือแยกไฟล์
  `gmail-client.ts` ใหม่) แล้วเพิ่ม scope `gmail.readonly`/`gmail.send` ตอนขอ OAuth ใน SETUP.md, เพิ่ม tool
  ใหม่ใน `google-calendar-server.ts` (หรือสร้าง `gmail-server.ts` แยก แล้วไปเพิ่มใน `BUILTIN_SERVERS`)
- เพิ่ม `delete_event`/`search_events`: เติมฟังก์ชันเรียก Calendar API ใน `google-calendar-client.ts`
  แล้วเพิ่ม tool spec ใหม่ใน `google-calendar-server.ts` ตามแพทเทิร์นเดิม
