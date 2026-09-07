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
| [`src/module-1.3-mcp-client-settings/client.ts`](../src/module-1.3-mcp-client-settings/client.ts) | MCP client จริง — ทำ session handshake ครบ 3 ขั้น (`initialize` → `notifications/initialized` → แนบ `Mcp-Session-Id`) แล้ว `tools/list`/`tools/call` ไปยัง MCP server ภายนอก รองรับ response ทั้งแบบ JSON ตรง ๆ และ SSE |
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

**3. [`src/module-1.1-chat/tool-schema.ts`](../src/module-1.1-chat/tool-schema.ts) และ
[`providers/gemini.ts`](../src/module-1.1-chat/providers/gemini.ts)** — สองไฟล์นี้เขียนไว้ตั้งแต่ Module 1.1 แต่
**โมดูลนี้คือครั้งแรกที่มันถูกใช้จริง** เพราะเพิ่งมี tools ไหลเข้าไป จึงเป็นจุดที่เจอปัญหา — ดูหัวข้อ
"3 กับดักที่เจอจริง" ด้านล่าง

**4. [`public/chat/app.js`](../public/chat/app.js)** — เพิ่มกล่องพับเก็บได้ใต้คำตอบเมื่อมี `toolTrace`

**5. [`public/index.html`](../public/index.html)** — เพิ่มการ์ด "🔌 จัดการ MCP Servers" เข้า Portal Hub
พอจบโมดูลนี้หน้าแรกจะมีครบ 3 การ์ด (Chat / ตั้งค่า Key / จัดการ MCP Servers)

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

## 3 กับดักที่เจอจริงตอนต่อ MCP server ภายนอก

ทั้งสามข้อนี้มาจากการทำจริงแล้วพัง — จุดร่วมคือ **error ที่ได้ไม่ได้บอกสาเหตุตรง ๆ** ถ้าไม่รู้ล่วงหน้าจะหาสาเหตุนาน

### 1. `Bad Request: Server not initialized`

**อาการ**: เพิ่ม server ในหน้า `/settings-mcp/` สำเร็จ แต่ในหน้า Chat ผู้ช่วยบอกว่าไม่มีเครื่องมือ หรือดึง tool ไม่ได้

**สาเหตุ**: Streamable HTTP MCP เป็นโปรโตคอลแบบ **มี session** — server ที่ stateful (n8n, FastMCP) จะไม่ยอมให้
เรียก `tools/list` จนกว่าจะทำ handshake ครบก่อน การยิง `tools/list` เข้าไปเลยแบบ stateless จะโดนตีกลับ

**วิธีแก้** — `client.ts` ต้องทำ 3 ขั้นนี้ให้ครบก่อนเรียก tool ใด ๆ:

```
1) POST initialize                     → อ่าน header  Mcp-Session-Id  จาก response
2) POST notifications/initialized      → เป็น notification: ไม่มี id, server ตอบ 202 ไม่มี body
                                          แนบ header Mcp-Session-Id ด้วย
3) POST tools/list / tools/call        → แนบ Mcp-Session-Id ทุกครั้งจากนี้ไป
```

และทุก POST ต้องมี header `Accept: application/json, text/event-stream` — server บางตัวตอบ `406 Not Acceptable`
ถ้าขาด header นี้ ส่วน server ที่ไม่ส่ง `Mcp-Session-Id` กลับมา (แบบ stateless) ก็ยังใช้งานได้ปกติ แค่ข้ามการแนบไป

### 2. `400 Unknown name "$schema"` จาก Gemini

**อาการ**: ต่อ server ได้ ดึงรายการ tool ได้ แต่พอถามคำถามในหน้า Chat แล้ว Gemini ตอบ 400 ทันที

```
Invalid JSON payload received. Unknown name "$schema" at 'tools[0].function_declarations[0].parameters'
Invalid JSON payload received. Unknown name "additionalProperties"
```

**สาเหตุ**: MCP server ส่ง `inputSchema` เป็น JSON Schema มาตรฐาน (Draft 2020-12) ซึ่งมี `$schema`,
`additionalProperties`, `$defs` ติดมาด้วย แต่ Gemini รับแค่ subset ของ OpenAPI 3.0 — เจอฟิลด์นอกรายการเมื่อไหร่
ปฏิเสธทั้งก้อนทันที

**วิธีแก้**: ให้ `toGeminiSchema()` ทำ whitelist เฉพาะ `type`, `description`, `properties`, `required`, `items`,
`enum`, `format`, `nullable` แล้วตัดที่เหลือทิ้ง **แบบ recursive** (schema ที่ซ้อนอยู่ใน `properties` และ `items`
ต้องโดนกรองด้วย ไม่ใช่กรองแค่ชั้นบนสุด)

> OpenAI-compatible ไม่มีปัญหานี้เพราะรับ JSON Schema ตรง ๆ — ถ้าทดสอบด้วย provider นั้นอย่างเดียวจะไม่เจอบั๊ก
> แล้วไปเจอเอาตอนสาธิตด้วย Gemini

### 3. `400 Role 'function' is not supported`

**อาการ**: รอบแรกโมเดลขอเรียก tool สำเร็จ เราเรียก tool ได้ผลลัพธ์แล้ว แต่พอส่งผลกลับเข้ารอบที่ 2 กลับพัง

**สาเหตุ**: Gemini รับ role แค่ `user` กับ `model` เท่านั้น ส่วน `role: 'function'` เป็นของ PaLM API รุ่นเก่า
และค่าใน `functionResponse.response` ต้องเป็น object เสมอ ส่ง string หรือตัวเลขเปล่า ๆ ไม่ได้

**วิธีแก้**: ใน `gemini.ts` ส่ง content ที่มี `functionResponse` ด้วย `role: 'user'` และถ้า tool คืนค่าที่ไม่ใช่
object ให้ห่อเป็น `{ result: <ค่า> }` ก่อน

### เผื่อไว้ด้วย: server พังตัวเดียวห้ามล้มทั้งแชท

`listAvailableTools()` ควรหุ้ม try/catch แยกต่อ server — ถ้าตัวไหนต่อไม่ติดให้ log แล้วคืน list ว่างของตัวนั้น
ไม่ใช่ throw ทิ้งทั้งก้อน ไม่งั้นผู้เรียนที่เผลอใส่ URL ผิดไว้ตัวเดียวจะแชทไม่ได้เลยและงงว่าเกิดอะไรขึ้น

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
ค่ายังอยู่ และเปิดหน้าแรก `/` ต้องเห็นการ์ดครบ 3 ใบแล้ว

ลองใส่ URL มั่ว ๆ เป็น server ภายนอกดูสักตัว (`https://example.invalid/mcp`) แล้วกลับไปแชท — **ต้องยังแชทได้ปกติ**
ถ้าแชทพังแปลว่ายังไม่ได้ครอบ try/catch ต่อ server ตามหัวข้อกับดักด้านบน

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
