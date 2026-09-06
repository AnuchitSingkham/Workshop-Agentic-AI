# Spec — Module 2.2: MCP server: Google Calendar

> ไฟล์นี้เขียนให้ AI coding agent อ่านแล้วลงมือสร้าง/แก้ไฟล์ได้เลย (ดูวิธีสั่ง agent ใน README.md หัวข้อ "vibecode ด้วย AI coding agent")
> อยากอ่านคำอธิบายละเอียดกว่านี้ ดู [module-2.2-mcp-google-calendar.md](module-2.2-mcp-google-calendar.md)

## บริบท

MCP server ตัวที่สอง — ใช้ framework เดียวกับ [Module 2.1](module-2.1-mcp-simple-server.md) แต่ต้องตั้งค่า
**Google OAuth refresh token** ก่อนถึงจะเรียกได้จริง ลงทะเบียนเข้า `BUILTIN_SERVERS` แบบเดียวกับ 2.1 แล้วใช้ใน
หน้า Chat ได้ทันที (ไม่ต้องแตะ chat engine เอง)

## Prerequisites

- ทำ [Module 2.1](module-2.1-mcp-simple-server.md) ให้เสร็จก่อน (ใช้ `server-factory.ts` ตัวเดียวกัน)
- ทำ [SETUP.md](../SETUP.md) หัวข้อ "Module 2.2 เพิ่มเติม" (ขอ Google OAuth refresh token ผ่าน Google Cloud
  Console + OAuth Playground) ให้ได้ `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN` มาก่อน

## ไฟล์ที่ต้องสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/module-2.2-mcp-google-calendar/google-calendar-client.ts` | `requireGoogleConfig(env)` (async) เช็คว่ามี `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` + refresh token (จาก `getEffectiveRefreshToken()`) ครบไหม (throw error อ่านง่ายถ้าไม่ครบ), ฟังก์ชันแลก refresh token → access token (`POST https://oauth2.googleapis.com/token`), เรียก Calendar REST API v3: `listEvents({days}, env)` (`GET .../events`) และ `createEvent({title, startDateTime, endDateTime}, env)` (`POST .../events`) |
| `src/module-2.2-mcp-google-calendar/google-calendar-server.ts` | สร้างด้วย `createMcpServer()` (import จาก `module-2.1-mcp-simple-server/server-factory.ts`) — 2 tools: `list_events` (`inputSchema: {days: number}`), `create_event` (`inputSchema: {title, startDateTime, endDateTime}` เป็น ISO 8601 พร้อม timezone offset) — handler เรียก `google-calendar-client.ts` |
| `src/module-2.2-mcp-google-calendar/google-oauth-store.ts` | ที่เก็บ refresh token แบบ KV-override-ก่อน-fallback-ไป-env (แพทเทิร์นเดียวกับ `module-1.2-key-settings/keys-store.ts`): `getEffectiveRefreshToken(env)`, `setRefreshToken(env, token)`, `clearRefreshToken(env)`, `getRefreshTokenSource(env)` + `createOAuthState(env)`/`consumeOAuthState(env, state)` เก็บ state token กัน CSRF ใน KV แบบมี TTL (`expirationTtl` ~600 วินาที) |
| `src/module-2.2-mcp-google-calendar/google-oauth-routes.ts` | `handleGoogleOAuthRoute(request, env, pathname)` รองรับ 2 path: `/oauth/google/start` (ต้องผ่าน `requireSiteSession()` ก่อน → สร้าง state → redirect ไป Google authorize URL พร้อม `access_type=offline&prompt=consent`) และ `/oauth/google/callback` (เช็ค site session + state → exchange `code` เป็น token ที่ `https://oauth2.googleapis.com/token` → เก็บ `refresh_token` ด้วย `setRefreshToken()` → คืนหน้า HTML สรุปผลสำเร็จ/ไม่สำเร็จ) |

## แก้ไฟล์เดิม

**1. `src/router.ts`** — เพิ่ม 2 route (พร้อม import `googleCalendarServer` และ `handleGoogleOAuthRoute`):

```ts
if (pathname === '/mcp/google-calendar') return googleCalendarServer.fetch(request, env);

if (pathname === '/oauth/google/start' || pathname === '/oauth/google/callback') {
  return handleGoogleOAuthRoute(request, env, pathname);
}
```

**2. `src/module-1.3-mcp-client-settings/registry.ts`** — เพิ่มเข้า `BUILTIN_SERVERS` (แบบเดียวกับที่ module 2.1
เพิ่ม `utils`) เพิ่มแค่บรรทัดเดียว:

```ts
const BUILTIN_SERVERS: Record<string, McpServerHandle<Env>> = {
  utils: utilsServer,
  'google-calendar': googleCalendarServer,
};
```

ไม่แตะไฟล์อื่นเลยนอกจากนี้ (ไม่ต้องแก้ `chat-routes.ts`, `mcp-registry-store.ts` หรือหน้าเว็บ)

## ข้อกำหนดสำคัญ

1. **Fail-closed แบบสุภาพ**: ถ้ายังไม่ตั้งค่า OAuth ครบ (ไม่ว่าจะยังไม่ตั้ง secret หรือยังไม่เคย login ผ่าน
   `/oauth/google/start`) — `tools/list` ยังต้องแสดง tool ตามปกติ (ไม่ซ่อน) แต่ `tools/call` ต้อง error
   พร้อมข้อความบอกว่าต้องตั้งอะไรเพิ่ม (อ้างอิง SETUP.md) แทนที่จะ crash เฉย ๆ
2. Bearer token check (`MCP_ACCESS_TOKEN`) ต้องเหมือนกับ Module 2.1 ทุกประการ (ใช้ `server-factory.ts` ตัวเดียวกัน
   จึงได้มาฟรีอยู่แล้ว) — ใช้กับ `/mcp/google-calendar` เท่านั้น ไม่เกี่ยวกับ `/oauth/google/*` (2 route หลังนี้
   กันด้วย site session cookie แทน เพราะเป็น browser flow ไม่ใช่ MCP client เรียก)
3. เวลาที่ใช้เป็น ISO 8601 ต้องมี timezone offset เสมอ (เช่น `+07:00`) ไม่ใช้ UTC เปล่า ๆ
4. `/oauth/google/start` และ `/oauth/google/callback` ต้อง **ไม่** ทำงานถ้าไม่มี site session cookie (เรียก
   `requireSiteSession()` เหมือน `/api/chat`) — กันคนแปลกหน้าที่เจอ URL เข้ามากดขอสิทธิ์ Google ของใครก็ได้เล่น
5. state token ต้องใช้ได้แค่ครั้งเดียว (`consumeOAuthState()` ต้อง delete ออกจาก KV ทันทีหลังเช็คผ่าน) และหมดอายุ
   เองถ้าไม่ใช้ภายใน ~10 นาที (`expirationTtl`)

## Acceptance Criteria

- [ ] `npm run typecheck` ผ่าน
- [ ] ยังไม่ตั้ง Google OAuth: เรียก `tools/call` ของ `list_events`/`create_event` → ได้ error message บอกว่าต้อง
      ตั้งค่าอะไร (ไม่ crash, ไม่ 500 เปล่า ๆ)
- [ ] ตั้งค่าครบแล้ว ทดสอบด้วย curl:
  ```bash
  curl -X POST <WORKER_URL>/mcp/google-calendar -H 'content-type: application/json' -H "Authorization: Bearer <MCP_ACCESS_TOKEN>" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_events","arguments":{"days":7}}}'
  ```
  ต้องได้รายการ event จริงจาก Google Calendar กลับมา (หรือ list ว่างถ้าไม่มีนัดจริง ๆ ไม่ใช่ error)
- [ ] `create_event` แล้วไปเช็คใน Google Calendar จริงว่ามีนัดใหม่ตามที่สั่ง
- [ ] ไม่มี site session (ยังไม่ login เว็บ): เปิด `/oauth/google/start` → ได้ 401 ไม่ใช่ redirect ไป Google ตรง ๆ
- [ ] login เว็บแล้ว เปิด `/oauth/google/start` → redirect ไป `accounts.google.com` → Allow → กลับมาที่
      `/oauth/google/callback` → เห็นหน้า "เชื่อมต่อสำเร็จ" และเรียก `list_events`/`create_event` ผ่าน `/mcp/google-calendar`
      ได้ทันทีโดยไม่ต้องตั้ง secret `GOOGLE_REFRESH_TOKEN`/deploy ใหม่เลย
- [ ] **checkpoint สำคัญ**: เปิด `/settings-mcp/` เห็น server "google-calendar" โผล่มาเอง (enabled) แล้วกลับไปที่
      `/chat/` ถาม "มีนัดอะไรบ้างสัปดาห์นี้" หรือสั่ง "ช่วยนัดพรุ่งนี้บ่ายสองโมง ชื่อทดสอบ MCP" — ต้องเรียก tool จริง
      และเห็นผลใน Google Calendar จริง

## ห้ามทำเกินสโคป

- ไม่ต้องทำ Gmail (scope นี้ตัดออกแล้วโดยตั้งใจ), ไม่ต้องทำ `delete_event`/`search_events` (อยู่ใน "ต่อยอด" ของ
  เอกสารอ้างอิง ไม่ใช่ required scope)
- ไม่ต้องแก้ `chat-routes.ts` หรือหน้าเว็บใด ๆ — [Module 1.3](module-1.3-mcp-client-settings.md) ทำไว้ให้แล้ว
  โมดูลนี้แตะแค่ `router.ts` กับ `BUILTIN_SERVERS`

## Prompt แนะนำสำหรับสั่ง AI agent

> อ่าน `docs/module-2.2-mcp-google-calendar-spec.md` ให้ครบ แล้วสร้างไฟล์ตามตาราง ใช้ `createMcpServer()` จาก
> module 2.1 ตัวเดียวกัน ห้ามเขียน JSON-RPC handler ใหม่ ทำ fail-closed แบบสุภาพตามข้อกำหนด แล้วตรวจด้วย
> Acceptance Criteria ก่อนรายงานผล (ข้อที่ต้องมี OAuth จริงอาจข้ามได้ถ้ายังไม่ได้ตั้งค่า แต่ต้องบอกผู้ใช้ด้วยว่า
> ข้ามข้อไหนเพราะอะไร)
