# Spec — Module 2.1: MCP server อย่างง่าย (Utils)

> ไฟล์นี้เขียนให้ AI coding agent อ่านแล้วลงมือสร้าง/แก้ไฟล์ได้เลย (ดูวิธีสั่ง agent ใน README.md หัวข้อ "vibecode ด้วย AI coding agent")
> อยากอ่านคำอธิบายละเอียดกว่านี้ ดู [module-2.1-mcp-simple-server.md](module-2.1-mcp-simple-server.md)

## บริบท

โมดูลนี้**ไม่ต่อยอดจาก chat เลย** — เป็น [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server
แยกเดี่ยว ทดสอบผ่าน curl ได้จบในตัวเอง ไม่ต้องพึ่ง chat หรือ AI provider key ใด ๆ เป้าหมายคือให้เห็นภาพว่า "MCP
tool" คืออะไร ก่อนไปทำ Module 2.2 (Google Calendar) ที่ซับซ้อนกว่าเพราะต้องผ่าน OAuth

เป็น MCP server แบบ **Streamable HTTP** (JSON-RPC 2.0 ผ่าน HTTP POST) เวอร์ชัน "ง่าย" ตัดส่วน
resources/prompts/session ออก เหลือแค่ `tools`

## Prerequisites

- ทำ [Module 1.1](module-1.1-chat.md)–[1.3](module-1.3-mcp-client-settings.md) ให้เสร็จก่อน — ต้องมี
  `BUILTIN_SERVERS` ใน `src/module-1.3-mcp-client-settings/registry.ts` อยู่แล้ว (โมดูลนี้ไม่แตะของเดิมเลย
  ยกเว้น 1 บรรทัดใน `router.ts` และ 1 บรรทัดใน `registry.ts`)
- ตั้ง secret `MCP_ACCESS_TOKEN` ไว้แล้ว (SETUP.md) — ไม่ตั้งแล้ว `/mcp/*` ต้องปิด (503) ไม่ใช่เปิดโล่ง

## ไฟล์ที่ต้องสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/module-2.1-mcp-simple-server/types.ts` | type ของ JSON-RPC/MCP: `McpToolDefinition { name, description, inputSchema, handler(args, env) }` และ type อื่นที่ `server-factory.ts` ใช้ |
| `src/module-2.1-mcp-simple-server/server-factory.ts` | `createMcpServer({name, tools})` คืน object ที่มี `fetch(request, env)` — พูด JSON-RPC ถูกสเปก: `initialize` (คืน `protocolVersion`/`capabilities`/`serverInfo`), `tools/list` (คืนรายชื่อ tool + inputSchema), `tools/call` (เรียก `handler` ของ tool ที่ตรงชื่อ, ห่อผลลัพธ์เป็น MCP content block) ต้องเช็ค `requireBearerToken(request, env)` ก่อนทุก request (เทียบ header `Authorization: Bearer <MCP_ACCESS_TOKEN>` กับ `env.MCP_ACCESS_TOKEN`, ไม่ตั้ง secret → 503, ตั้งแต่ token ผิด/ไม่แนบ → 401) |
| `src/module-2.1-mcp-simple-server/utils-server.ts` | สร้างด้วย `createMcpServer()` — 3 tools: `get_time` (คืนเวลาปัจจุบันเขตเวลา Asia/Bangkok), `calculator` (คำนวณนิพจน์เลขจาก string อย่างปลอดภัย **ห้ามใช้ `eval`**), `echo` (สะท้อนข้อความกลับ) |

## แก้ไฟล์เดิม

**1. `src/router.ts`** — เพิ่มแค่ 1 route: `if (pathname === '/mcp/utils') return utilsServer.fetch(request, env);`
(พร้อม import `utilsServer` จาก `./module-2.1-mcp-simple-server/utils-server`)

**2. `src/module-1.3-mcp-client-settings/registry.ts`** — ลงทะเบียน server เข้า `BUILTIN_SERVERS` (จากเดิมที่
เป็น object ว่าง) เพิ่มแค่บรรทัดเดียว:
```ts
const BUILTIN_SERVERS: Record<string, McpServerHandle<Env>> = {
  utils: utilsServer,
};
```
— แค่นี้ chat จะเห็น tool ทั้ง 3 ตัวทันที และ server จะโผล่ในหน้า `/settings-mcp/` เองโดยไม่ต้องแตะ KV
(ไม่ต้องแก้ `mcp-registry-store.ts` หรือหน้าเว็บใด ๆ)

## ข้อกำหนดสำคัญ

1. `calculator` **ห้ามใช้ `eval`/`Function()` กับ string ที่มาจาก user โดยตรง** — พาร์สนิพจน์เองแบบปลอดภัย
   (whitelist ตัวเลข/ตัวดำเนินการ/วงเล็บเท่านั้น)
2. ทุก request ไป `/mcp/*` (รวม `GET` สำหรับ discovery ถ้ามี) ต้องผ่าน bearer token check ก่อนเสมอ
3. `tools/list` ต้องคืนได้แม้ config อื่นในระบบยังไม่ครบ (tool นี้ไม่ต้องพึ่ง OAuth/API key ใด ๆ)

## Acceptance Criteria

- [ ] `npm run typecheck` ผ่าน
- [ ] ไม่แนบ header → เช่น `curl -X POST <WORKER_URL>/mcp/utils -d '{...}'` (ไม่มี `Authorization`) → 401 หรือ 503
      ถ้ายังไม่ตั้ง secret
- [ ] `initialize` handshake:
  ```bash
  curl -X POST <WORKER_URL>/mcp/utils -H 'content-type: application/json' -H "Authorization: Bearer <MCP_ACCESS_TOKEN>" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
  ```
  ต้องได้ response ที่มี `result.protocolVersion`/`result.capabilities`/`result.serverInfo`
- [ ] `tools/list` คืนรายชื่อ 3 tools ครบ
- [ ] `tools/call` เรียก `calculator` ด้วย `{"expression":"12*(3+4)"}` ต้องได้ผลลัพธ์ `84` ใน content block
- [ ] **checkpoint สำคัญ**: เปิด `/settings-mcp/` ต้องเห็น server "utils" โผล่มาเอง (enabled) โดยไม่ต้องกดเพิ่ม
- [ ] **checkpoint สำคัญ**: กลับไปที่ `/chat/` แล้วถาม "ตอนนี้กี่โมงแล้ว" หรือ "12 คูณ (3+4) เท่ากับเท่าไร" —
      ต้องเรียก tool จริงแล้วตอบด้วยผลลัพธ์จริง (มี `toolTrace` กลับมา ไม่ใช่โมเดลเดาเอง)
- [ ] ปิด server "utils" ผ่านหน้า `/settings-mcp/` แล้วถามใหม่ — ผู้ช่วยต้องไม่เรียก tool นี้อีก (เปิดกลับก็ใช้ได้
      ตามเดิม)

## ห้ามทำเกินสโคป

- ไม่ต้องแก้ `chat-routes.ts`, `mcp-registry-store.ts` หรือหน้าเว็บใด ๆ — [Module 1.3](module-1.3-mcp-client-settings.md)
  ทำไว้ให้หมดแล้ว โมดูลนี้แตะแค่ `router.ts` กับ `BUILTIN_SERVERS` อย่างละบรรทัด

## Prompt แนะนำสำหรับสั่ง AI agent

> อ่าน `docs/module-2.1-mcp-simple-server-spec.md` ให้ครบ แล้วสร้างไฟล์ตามตาราง เขียน `server-factory.ts` ให้
> generic พอที่ module ถัดไปจะ import ไปใช้ซ้ำได้โดยไม่ต้องแก้ไฟล์นี้อีก ตรวจด้วย Acceptance Criteria ทุกข้อด้วย
> curl จริงก่อนรายงานผล
