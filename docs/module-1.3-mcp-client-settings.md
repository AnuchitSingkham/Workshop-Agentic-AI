# Module 1.3 — Chat ต่อ MCP server ได้ (client) + หน้าตั้งค่า MCP

**ก่อนเริ่ม**: ทำ [Module 1.1](module-1.1-chat.md) และ [Module 1.2](module-1.2-key-settings.md) ให้เสร็จก่อน —
โมดูลนี้ "อัปเกรด" `chat-routes.ts` ของ 1.1 อีกรอบ เหมือนที่ 1.2 เคยอัปเกรดมาก่อน และใช้ admin token /
`admin-auth.js` ตัวเดียวกับ 1.2

## เป้าหมาย

ทำให้ Chat ของ [Module 1.1](module-1.1-chat.md) มองเห็นและเรียกใช้ tools จาก **MCP server ภายนอก** ได้เอง
(ที่ไหนก็ได้ ขอแค่พูด Streamable HTTP JSON-RPC ตรงสเปก) พร้อมหน้าเว็บให้เพิ่ม/ลบ/เปิด-ปิด server แต่ละตัว —
เก็บรายชื่อใน KV เดียวกับ Module 1.2 และป้องกันด้วย admin token เดียวกัน

**โมดูลนี้คือจุดจบของงานฝั่งเว็บทั้ง workshop** — ตั้งแต่ Module 2 เป็นต้นไปจะไม่แตะหน้าเว็บหรือ chat engine อีกเลย
เหลือแค่ "สร้าง MCP server ของตัวเอง" แล้วลงทะเบียนเข้า `BUILTIN_SERVERS` บรรทัดเดียว

## ไฟล์ที่สร้างใหม่ในโมดูลนี้

| ไฟล์ | หน้าที่ |
|---|---|
| [`src/module-1.3-mcp-client-settings/client.ts`](../src/module-1.3-mcp-client-settings/client.ts) | MCP client จริง — ทำ `initialize` handshake แล้ว `tools/list`/`tools/call` ไปยัง MCP server ภายนอก (รองรับทั้ง response แบบ JSON ตรง ๆ และ SSE) |
| [`src/module-1.3-mcp-client-settings/registry.ts`](../src/module-1.3-mcp-client-settings/registry.ts) | `BUILTIN_SERVERS` (ตอนนี้ว่างเปล่า — module 2.1/2.2/5 จะมาเติม) + รวม tools จากทุก server ที่เปิดใช้งานเป็น "รายการ tools" เดียวให้ chat engine ใช้ |
| [`src/module-1.3-mcp-client-settings/mcp-registry-store.ts`](../src/module-1.3-mcp-client-settings/mcp-registry-store.ts) | เก็บ server ภายนอก + สถานะ enabled ใน KV (`mcp:servers`) แล้ว merge กับ built-in ตอนอ่าน |
| [`src/module-1.3-mcp-client-settings/mcp-registry-routes.ts`](../src/module-1.3-mcp-client-settings/mcp-registry-routes.ts) | `GET/POST /api/settings/mcp-servers`, `DELETE .../:id`, `POST .../:id/toggle` |
| [`public/settings-mcp/`](../public/settings-mcp/) | หน้าเว็บจัดการ server ทั้งหมด |

## แก้ไฟล์เดิม (อัปเกรดจาก Module 1.1)

**1. [`src/module-1.1-chat/chat-routes.ts`](../src/module-1.1-chat/chat-routes.ts)** — แก้ `resolveTools()`
จาก:

```ts
async function resolveTools(env: Env): Promise<{ tools: McpTool[]; callTool: ToolCaller }> {
  return { tools: [], callTool: async () => { throw new Error('Module 1.1 ยังไม่รองรับ MCP tools'); } };
}
```

เป็น:

```ts
async function resolveTools(env: Env): Promise<{ tools: McpTool[]; callTool: ToolCaller }> {
  const tools = await listAvailableTools(env);
  const callTool: ToolCaller = (serverId, toolName, args) => callMcpTool(serverId, toolName, args, env);
  return { tools, callTool };
}
```

(พร้อม `import { callTool as callMcpTool, listAvailableTools } from '../module-1.3-mcp-client-settings/registry';`
ที่หัวไฟล์) — เหมือนตอน Module 1.2 อัปเกรด `resolveApiKey()`: แก้จุดเดียว ทั้ง `handleChatRoute()` และ
`runChatTurn()` ได้ tools ไปด้วยอัตโนมัติ

**2. [`src/router.ts`](../src/router.ts)** — เพิ่ม route ใหม่:

```ts
import { handleMcpServersRoute } from './module-1.3-mcp-client-settings/mcp-registry-routes';
// ...
if (pathname === MCP_SERVERS_PREFIX || pathname.startsWith(`${MCP_SERVERS_PREFIX}/`)) {
  return handleMcpServersRoute(request, env, pathname.slice(MCP_SERVERS_PREFIX.length));
}
```

## built-in server มาจากไหน (จุดที่ต้องเข้าใจ)

`registry.ts` มี object ชื่อ `BUILTIN_SERVERS` ที่ตอนนี้ **ว่างเปล่า**:

```ts
const BUILTIN_SERVERS: Record<string, McpServerHandle<Env>> = {
  // module 2.1 จะเพิ่ม utils
  // module 2.2 จะเพิ่ม google-calendar
};
```

`listServers()` ใน `mcp-registry-store.ts` จะ **อ่าน `BUILTIN_SERVERS` ใหม่ทุกครั้ง** แล้ว merge กับ server ภายนอก
ที่เก็บใน KV — ไม่ได้ seed รายชื่อ built-in ลง KV ตั้งแต่แรก

เหตุผลสำคัญ: พอ Module 2.1 เพิ่ม `utils` เข้าไปในโค้ด server ตัวนั้นจะ **โผล่ในหน้า `/settings-mcp/` และใช้งานได้
ทันที** โดยผู้เรียนไม่ต้องไปล้าง KV หรือกดเพิ่มเอง — ถ้าใช้วิธี seed ลง KV คนที่ deploy ไปแล้วก่อนหน้าจะไม่ได้
server ใหม่ ต้องมานั่งเพิ่มมือทีหลัง ซึ่งเป็นกับดักที่เจอบ่อยเวลาสอน

ส่วน KV เก็บแค่ 2 อย่าง: server ภายนอกที่ผู้ใช้เพิ่มเอง และสถานะ `enabled` ของ server ที่ถูกสั่งเปิด/ปิด
(built-in ที่ไม่เคยถูกสั่งอะไรเลย = `enabled: true` โดยปริยาย)

## ทดสอบ

```bash
# ไม่ใส่ token — ต้องถูกปฏิเสธ
curl <WORKER_URL>/api/settings/mcp-servers

# ใส่ token ถูก — ตอนนี้ต้องได้ list ว่าง [] (ยังไม่มี MCP server ตัวไหนในระบบ)
curl <WORKER_URL>/api/settings/mcp-servers -H "X-Admin-Token: <ADMIN_TOKEN>"

# เพิ่ม MCP server ภายนอก
curl -X POST <WORKER_URL>/api/settings/mcp-servers \
  -H "X-Admin-Token: <ADMIN_TOKEN>" -H 'content-type: application/json' \
  -d '{"name":"Demo ภายนอก","url":"https://your-external-mcp.example/mcp","description":"ทดสอบต่อ server ภายนอก"}'

# ปิด/เปิด server
curl -X POST <WORKER_URL>/api/settings/mcp-servers/<id>/toggle \
  -H "X-Admin-Token: <ADMIN_TOKEN>" -H 'content-type: application/json' -d '{"enabled": false}'

# ลบ (ได้เฉพาะ server ภายนอก — built-in ลบไม่ได้ ปิดได้อย่างเดียว)
curl -X DELETE <WORKER_URL>/api/settings/mcp-servers/<id> -H "X-Admin-Token: <ADMIN_TOKEN>"
```

หรือเปิด `<WORKER_URL>/settings-mcp/` ทำผ่านหน้าเว็บได้เลย

**checkpoint ของโมดูลนี้**: กลับไปที่ `/chat/` แล้วคุยตามปกติ — ต้องยังคุยได้เหมือนเดิมทั้งที่ยังไม่มี tool สักตัว
(ถ้าพังแปลว่า `resolveTools()` คืนค่าผิดรูป) ส่วนหน้า `/settings-mcp/` ต้องเพิ่ม/ลบ/toggle แล้ว reload หน้าเว็บ
ค่ายังอยู่

**ยังไม่เห็นผลเต็ม ๆ ตอนนี้เป็นเรื่องปกติ** — เพราะยังไม่มี MCP server ให้ต่อ ถ้ามี server ภายนอกใช้ได้จริงอยู่แล้ว
ลองเพิ่มดูได้เลย แต่ถ้าไม่มี ให้ไปดูผลจริงที่ [Module 2.1](module-2.1-mcp-simple-server.md) ซึ่งจะสร้าง MCP server
ตัวแรกของเราเอง แล้วถาม "ตอนนี้กี่โมงแล้ว" ในหน้า Chat ได้ทันทีโดยไม่ต้องกลับมาแก้อะไรในโมดูลนี้อีก

## ข้อควรระวัง

ผลลัพธ์จาก MCP server ภายนอกจะถูกส่งกลับให้โมเดลอ่านตรง ๆ — เพิ่มเฉพาะ server ที่เชื่อถือได้ เพราะ server ที่ไม่น่า
เชื่อถืออาจแฝงข้อความหลอกให้โมเดลทำสิ่งที่ไม่ตั้งใจ (prompt injection ผ่านผลลัพธ์ของเครื่องมือ)

## ต่อยอด

- ชื่อ tool ชนกันระหว่าง server ต่างตัว: ระบบกันชนให้อัตโนมัติด้วย prefix `<serverId>__<toolName>` (ดู
  `toolFunctionName()` ใน [`src/module-1.1-chat/types.ts`](../src/module-1.1-chat/types.ts)) ไม่ต้องทำอะไรเพิ่ม
- อยาก cache รายการ tools ของ server ภายนอกไม่ให้ handshake ใหม่ทุกครั้ง (เร็วขึ้นตอนแชท): เพิ่ม cache
  ใน `registry.ts` (เช่น KV ที่มี `expirationTtl` สั้น ๆ)
- อยากให้ MCP server ภายนอกที่ต้อง auth ใช้งานได้: เก็บ token ต่อ server ใน entry ของ KV แล้วให้ `client.ts`
  แนบ `Authorization: Bearer` ตอนเรียก
