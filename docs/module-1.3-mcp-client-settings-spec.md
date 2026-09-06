# Spec — Module 1.3: Chat ต่อ MCP server ได้ (client) + หน้าตั้งค่า MCP

> ไฟล์นี้เขียนให้ AI coding agent อ่านแล้วลงมือสร้าง/แก้ไฟล์ได้เลย (ดูวิธีสั่ง agent ใน README.md หัวข้อ "vibecode ด้วย AI coding agent")
> อยากอ่านคำอธิบายละเอียดกว่านี้ ดู [module-1.3-mcp-client-settings.md](module-1.3-mcp-client-settings.md)

## บริบท

โมดูลปิดท้ายของ Module 1 — **งานฝั่งเว็บทั้งหมดของ workshop จบที่นี่** ทำให้ chat ของ
[Module 1.1](module-1.1-chat.md) มองเห็นและเรียกใช้ tools จาก **MCP server ภายนอก** ได้เอง (ที่ไหนก็ได้ ขอแค่พูด
Streamable HTTP JSON-RPC ตรงสเปก) พร้อมหน้าเว็บให้เพิ่ม/ลบ/เปิด-ปิด server แต่ละตัว เก็บรายชื่อใน KV เดียวกับ
[Module 1.2](module-1.2-key-settings.md)

พอจบโมดูลนี้ โครงทั้งหมดพร้อมแล้ว — Module 2 เป็นต้นไปจะเป็นการ **สร้าง MCP server ของตัวเอง** อย่างเดียว
ไม่ต้องแตะหน้าเว็บหรือ chat engine อีก แค่ลงทะเบียน server ใหม่เข้า `BUILTIN_SERVERS` บรรทัดเดียวก็ใช้งานได้ทันที

## Prerequisites

- ทำ [Module 1.1](module-1.1-chat.md) และ [Module 1.2](module-1.2-key-settings.md) ให้เสร็จก่อน (ต้องมี
  `chat-routes.ts`, `router.ts`, `src/lib/auth.ts`, `public/shared/admin-auth.js` อยู่แล้ว)
- ตั้ง secret `ADMIN_TOKEN` ไว้แล้ว (SETUP.md ข้อ 3) — ถ้ายังไม่ตั้ง endpoint ต้องปิดทั้งหมด (fail-closed)

## ไฟล์ที่ต้องสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/module-1.3-mcp-client-settings/client.ts` | MCP client จริง — ทำ `initialize` handshake แล้วเรียก `tools/list`/`tools/call` ไปยัง MCP server ภายนอกผ่าน HTTP (รองรับทั้ง response แบบ JSON ตรง ๆ และ SSE stream), แนบ header `Authorization: Bearer <token>` ให้ถ้า entry ของ server นั้นเก็บ token ไว้ |
| `src/module-1.3-mcp-client-settings/registry.ts` | `BUILTIN_SERVERS` — **ในโมดูลนี้ต้องเป็น object ว่าง `{}`** (module 2.1/2.2/5 จะมาเติมทีละตัว), `listAvailableTools(env)` รวม tools จาก server ที่ `enabled` ทั้งหมดเป็น `McpTool[]` เดียว (built-in เรียก in-process, ภายนอกเรียกผ่าน `client.ts`), `callTool(serverId, toolName, args, env)` dispatch กลับไปยัง server ที่ถูกต้อง |
| `src/module-1.3-mcp-client-settings/mcp-registry-store.ts` | เก็บ **เฉพาะ server ภายนอก** + สถานะ `enabled` ที่ถูกเปลี่ยน ไว้ใน KV คีย์ `mcp:servers`, `listServers(env)` คืนรายการที่ **merge built-in จาก `BUILTIN_SERVERS` ตอน runtime** เข้ากับของใน KV (built-in default `enabled: true`), `addServer`/`removeServer`/`toggleServer` |
| `src/module-1.3-mcp-client-settings/mcp-registry-routes.ts` | `handleMcpServersRoute()` — `GET/POST /api/settings/mcp-servers`, `DELETE .../:id`, `POST .../:id/toggle` (ทุกเมธอดเช็ค `requireAdminToken()` เหมือน module 1.2) |
| `public/settings-mcp/index.html`, `app.js` | หน้าเว็บจัดการ MCP server (ปลดล็อกด้วย admin token ผ่าน `admin-auth.js` ของ module 1.2, list/เพิ่ม/ลบ/toggle) |

## แก้ไฟล์เดิม

**`src/module-1.1-chat/chat-routes.ts`** — แก้ `resolveTools()` จากคืน `{tools: [], callTool: ...throw}` เสมอ
ให้เป็น:
```ts
async function resolveTools(env: Env): Promise<{ tools: McpTool[]; callTool: ToolCaller }> {
  const tools = await listAvailableTools(env);
  const callTool: ToolCaller = (serverId, toolName, args) => callMcpTool(serverId, toolName, args, env);
  return { tools, callTool };
}
```
(import `callTool as callMcpTool, listAvailableTools` จาก `../module-1.3-mcp-client-settings/registry` ที่หัวไฟล์)
— จุดอื่นในไฟล์ไม่ต้องแก้ เพราะ `handleChatRoute()`/`runChatTurn()` เรียกผ่าน `resolveTools()` ตัวเดียวกันอยู่แล้ว
(แพทเทิร์นเดียวกับที่ Module 1.2 แก้ `resolveApiKey()` จุดเดียวแล้วมีผลทั้งไฟล์)

**`src/router.ts`** — เพิ่ม route ที่รองรับ path ซ้อน (`/api/settings/mcp-servers`, `/api/settings/mcp-servers/:id`,
`/api/settings/mcp-servers/:id/toggle`) เรียก `handleMcpServersRoute(request, env, subPath)`

## ข้อกำหนดสำคัญ

1. **`BUILTIN_SERVERS` ต้องว่างเปล่าในโมดูลนี้** — ห้ามใส่ `utils`/`google-calendar` ล่วงหน้า เพราะไฟล์เหล่านั้น
   ยังไม่มีอยู่จริง (จะทำให้ `npm run typecheck` พัง) module 2.1/2.2/5 จะมาเพิ่มเองทีละตัว
2. **ห้าม seed รายชื่อ built-in ลง KV** — built-in ต้องถูก merge จาก `BUILTIN_SERVERS` ตอน `listServers()` ทำงาน
   ทุกครั้ง เหตุผล: module ถัดไปเพิ่ม server ใหม่แล้วต้องโผล่ในหน้าเว็บทันที โดยผู้เรียนไม่ต้องไปล้าง KV หรือเพิ่มเอง
   KV เก็บแค่ (ก) server ภายนอกที่ผู้ใช้เพิ่ม และ (ข) สถานะ `enabled` ของ server ที่ถูกสั่งเปิด/ปิด
3. built-in server **ลบไม่ได้** (`DELETE` ต้องตอบ error) — ปิดด้วย toggle ได้อย่างเดียว ส่วน server ภายนอกลบได้ปกติ
4. ชื่อ tool ที่มาจาก server ต่างตัวอาจซ้ำกันได้ — ต้องกันชนด้วย prefix `<serverId>__<toolName>` (ใช้
   `toolFunctionName()` จาก module 1.1 ที่มีอยู่แล้ว)
5. server ที่ `enabled: false` ต้องไม่ปรากฏใน `listAvailableTools()` เลย (ไม่ใช่แค่ปิดการเรียก)
6. **ผลลัพธ์จาก MCP server ภายนอกอาจแฝง prompt injection ได้** — ไม่ต้อง sanitize เนื้อหา (โมเดลอ่านตรง ๆ ตาม
   design) แต่ต้องมี warning ในหน้าเว็บ `/settings-mcp/` เตือนผู้ใช้ก่อนเพิ่ม server ที่ไม่รู้จัก
7. `url` ที่ POST เข้ามาต้อง validate ว่าขึ้นต้นด้วย `http://`/`https://` ก่อนเขียนลง KV

## Acceptance Criteria

- [ ] `npm run typecheck` ผ่าน
- [ ] `curl <WORKER_URL>/api/settings/mcp-servers` (ไม่แนบ token) → ถูกปฏิเสธ
- [ ] `curl <WORKER_URL>/api/settings/mcp-servers -H "X-Admin-Token: <ADMIN_TOKEN>"` → คืน **list ว่าง `[]`**
      (ถูกต้องแล้ว — ยังไม่มี MCP server ตัวไหนในระบบจนกว่าจะทำ Module 2.1)
- [ ] `POST` เพิ่ม server ภายนอก 1 ตัว → `GET` เห็น แล้ว **reload หน้า `/settings-mcp/` ยังอยู่** (พิสูจน์ว่าเก็บลง
      KV จริง ไม่ใช่ค้างใน memory)
- [ ] `POST .../<id>/toggle {"enabled": false}` แล้ว `GET` เห็นสถานะเปลี่ยนจริง
- [ ] `DELETE .../<id>` ลบ server ภายนอกออกได้
- [ ] กลับไปที่ `/chat/` แล้วคุยตามปกติ — **ต้องยังคุยได้เหมือนเดิมทั้งที่ยังไม่มี tool สักตัว** (0 tools ต้องไม่ทำให้พัง)
- [ ] (ถ้ามี MCP server ภายนอกที่ใช้ได้จริงอยู่แล้ว) เพิ่มเข้าไปแล้วถามคำถามที่ต้องใช้ tool นั้นในหน้า Chat —
      ต้องเรียก tool จริงและมี `toolTrace` กลับมา

> **checkpoint เต็มรูปแบบอยู่ที่ [Module 2.1](module-2.1-mcp-simple-server.md)** — ตอนนั้นจะมี MCP server ตัวแรก
> ของเราเองให้ทดสอบ แล้วถาม "ตอนนี้กี่โมงแล้ว" ในหน้า Chat ได้ทันทีโดยไม่ต้องแก้อะไรในโมดูลนี้อีก ถ้ายังไม่มี server
> ภายนอกให้ทดสอบตอนนี้ ข้อสุดท้ายข้ามไปก่อนได้

## ห้ามทำเกินสโคป

- **ห้ามสร้าง MCP server เอง** — เป็นงานของ [Module 2.1](module-2.1-mcp-simple-server.md) โมดูลนี้ทำแค่ฝั่ง client
- ไม่ต้องทำ cache รายการ tools ของ server ภายนอก (อยู่ใน "ต่อยอด" ของเอกสารอ้างอิง)

## Prompt แนะนำสำหรับสั่ง AI agent

> อ่าน `docs/module-1.3-mcp-client-settings-spec.md` ให้ครบ แล้ว "อัปเกรด" โปรเจกต์ตามหัวข้อ "ไฟล์ที่ต้องสร้าง"
> และ "แก้ไฟล์เดิม" — แก้ `resolveTools()` แค่จุดเดียวใน `chat-routes.ts` อย่าเขียน chat engine ใหม่ และ
> `BUILTIN_SERVERS` ต้องเป็น `{}` ว่างเปล่าในโมดูลนี้ อย่าใส่ server ที่ยังไม่มีไฟล์ลงไป ตรวจ Acceptance Criteria
> ทุกข้อก่อนรายงานผล
