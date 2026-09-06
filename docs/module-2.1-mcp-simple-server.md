# Module 2.1 — MCP server อย่างง่าย (Utils)

**ก่อนเริ่ม**: ทำ [Module 1.1](module-1.1-chat.md)–[1.3](module-1.3-mcp-client-settings.md) ให้เสร็จก่อน —
โมดูลนี้เป็น **MCP server ตัวแรกของเราเอง** สร้างไฟล์ใหม่ล้วน ๆ ไม่แตะของเดิม (ยกเว้นเพิ่มอย่างละ 1 บรรทัดใน
`router.ts` และ `registry.ts`) ทดสอบผ่าน curl ได้จบในตัวเอง แล้วใช้งานในหน้า Chat ได้ทันทีเพราะ Module 1.3
ต่อฝั่ง client ไว้ให้หมดแล้ว

## เป้าหมาย

สร้าง [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server ตัวแรกในตัว worker — ไม่ต้องมี
API key/OAuth ใด ๆ ใช้ได้ทันที ให้เห็นภาพว่า "MCP tool" คืออะไรก่อนไปดู Module 2.2 (Google Calendar) ที่ซับซ้อนกว่า
เพราะต้องผ่าน OAuth

เป็น MCP server แบบ **Streamable HTTP** (JSON-RPC 2.0 ผ่าน HTTP POST) เวอร์ชัน "ง่าย" ที่ตัดส่วน
resources/prompts/session ออก เหลือแค่ `tools` — พอสำหรับ use case ส่วนใหญ่ และยังคุยกับ MCP client ภายนอกจริง ๆ ได้
(ไม่ใช่แค่ chat engine ของ worker นี้เอง)

## ไฟล์ที่สร้างใหม่ในโมดูลนี้

| ไฟล์ | หน้าที่ |
|---|---|
| [`src/module-2.1-mcp-simple-server/server-factory.ts`](../src/module-2.1-mcp-simple-server/server-factory.ts) | framework กลาง — `createMcpServer({name, tools})` คืน handler ที่พูด JSON-RPC ถูกสเปก (`initialize`, `tools/list`, `tools/call`) ใช้ซ้ำกับ Module 2.2 |
| [`src/module-2.1-mcp-simple-server/types.ts`](../src/module-2.1-mcp-simple-server/types.ts) | type ของ JSON-RPC/MCP (`McpToolDefinition` ฯลฯ) ที่ server-factory.ts ใช้ |
| [`src/module-2.1-mcp-simple-server/utils-server.ts`](../src/module-2.1-mcp-simple-server/utils-server.ts) | 3 tools: `get_time` (เวลาปัจจุบัน), `calculator` (คำนวณเลขปลอดภัย ไม่ใช้ `eval`), `echo` |

## แก้ไฟล์เดิม (อย่างละ 1 บรรทัด)

**1. [`src/router.ts`](../src/router.ts)** — เพิ่ม route ใหม่:

```ts
import { utilsServer } from './module-2.1-mcp-simple-server/utils-server';
// ...
if (pathname === '/mcp/utils') return utilsServer.fetch(request, env);
```

**2. [`src/module-1.3-mcp-client-settings/registry.ts`](../src/module-1.3-mcp-client-settings/registry.ts)** —
ลงทะเบียนเข้า `BUILTIN_SERVERS` (จากเดิมที่เป็น object ว่าง):

```ts
import { utilsServer } from '../module-2.1-mcp-simple-server/utils-server';

const BUILTIN_SERVERS: Record<string, McpServerHandle<Env>> = {
  utils: utilsServer,
};
```

แค่บรรทัดเดียวนี้ทำให้ chat เห็น tool ทั้ง 3 ตัว และ server โผล่ในหน้า `/settings-mcp/` เอง — ไม่ต้องแตะ KV
ไม่ต้องแก้ `chat-routes.ts` และไม่ต้องแก้หน้าเว็บ (Module 1.3 เตรียมไว้ให้หมดแล้ว)

## Auth — ต้องตั้ง `MCP_ACCESS_TOKEN` ก่อน (`wrangler secret put MCP_ACCESS_TOKEN`, ดู SETUP.md)

ทุก request ไป `/mcp/*` (รวม GET discovery) ต้องแนบ header `Authorization: Bearer <MCP_ACCESS_TOKEN>` — ถ้ายัง
ไม่ตั้ง secret นี้เลย endpoint จะปิด (503) ถ้าตั้งแล้วแต่ token ผิด/ไม่แนบ header จะได้ 401 (ดู `requireBearerToken`
ใน [`server-factory.ts`](../src/module-2.1-mcp-simple-server/server-factory.ts)) MCP client ภายนอก (n8n, Claude
Desktop/Code ฯลฯ) ที่รองรับตั้ง custom header ก็ใส่ header นี้ตอน config connection ได้ตามปกติ

## ทดสอบด้วย curl (คุยกับ MCP server ตรง ๆ โดยไม่ผ่าน chat)

```bash
# 1) initialize (MCP client จริงต้องทำขั้นนี้ก่อนเสมอ)
curl -X POST <WORKER_URL>/mcp/utils -H 'content-type: application/json' -H "Authorization: Bearer <MCP_ACCESS_TOKEN>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'

# 2) ดูรายการ tools
curl -X POST <WORKER_URL>/mcp/utils -H 'content-type: application/json' -H "Authorization: Bearer <MCP_ACCESS_TOKEN>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3) เรียก tool จริง
curl -X POST <WORKER_URL>/mcp/utils -H 'content-type: application/json' -H "Authorization: Bearer <MCP_ACCESS_TOKEN>" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"calculator","arguments":{"expression":"12*(3+4)"}}}'
```

**checkpoint — ถามในหน้า Chat ได้เลยตอนนี้**: เปิด `/chat/` แล้วถาม "ตอนนี้กี่โมงแล้ว" หรือ "12 คูณ (3+4)
เท่ากับเท่าไร" — ผู้ช่วยต้องเรียก tool จริงแล้วตอบด้วยผลลัพธ์จริง (ดู `toolTrace` ที่ตอบกลับมา) ต่างจากตอนจบ
Module 1.3 ที่ยังไม่มี tool ให้เรียกสักตัว

ถ้ายังไม่เรียก tool ให้เปิด `/settings-mcp/` เช็คว่า server "utils" โผล่มาและ enabled อยู่ — ถ้าไม่โผล่แปลว่ายัง
ไม่ได้เพิ่มลง `BUILTIN_SERVERS` ในขั้นตอน "แก้ไฟล์เดิม" ข้อ 2

## ต่อยอด

เพิ่ม tool ใหม่: เติม object ใน `tools: [...]` ของ `utils-server.ts` — แค่ `name`, `description`,
`inputSchema` (JSON Schema มาตรฐาน) และ `handler(args, env)` ที่ return ค่าอะไรก็ได้ที่ JSON-serialize ได้
(server-factory.ts ห่อเป็น MCP content block ให้อัตโนมัติ) อยากทำ MCP server ตัวใหม่ทั้งอัน: สร้างโฟลเดอร์ module
ใหม่ใน `src/`, เรียก `createMcpServer()` เหมือนกัน (import จาก `module-2.1-mcp-simple-server/server-factory.ts`)
แล้วไปเพิ่มใน `BUILTIN_SERVERS` ของ
[`src/module-1.3-mcp-client-settings/registry.ts`](../src/module-1.3-mcp-client-settings/registry.ts) —
บรรทัดเดียวจบ ไม่ต้องแตะ KV หรือหน้าเว็บ (นี่คือแพทเทิร์นที่ Module 2.2 และ Module 5 ใช้เหมือนกัน)
