# Module 5 — Text-to-SQL (ถามฐานข้อมูลด้วยภาษาคน)

**ก่อนเริ่ม**: ทำ [Module 1.1](module-1.1-chat.md)–[1.3](module-1.3-mcp-client-settings.md) และ
[2.1](module-2.1-mcp-simple-server.md)–[2.2](module-2.2-mcp-google-calendar.md) ให้เสร็จก่อน — โมดูลนี้ใช้
`server-factory.ts` เดียวกับ [Module 2.1](module-2.1-mcp-simple-server.md) และลงทะเบียนเข้า `BUILTIN_SERVERS`
ของ Module 1.3 เหมือนที่ Module 2.1/2.2 เคยทำมาก่อน + เตรียม connection info ของฐานข้อมูล MySQL ที่จะต่อ (host,
port, database, user, password)

## เป้าหมาย

เพิ่ม MCP server ตัวที่ 3 ที่ให้ผู้ช่วยตอบคำถามจากฐานข้อมูล MySQL จริงด้วยภาษาคนได้ เช่น "หมวดสินค้าไหนขายดีที่สุด"
หรือ "ลูกค้าคนไหนสั่งซื้อเยอะสุดเดือนนี้" — **ไม่ได้เขียน NL→SQL parser เอง** แต่ให้โมเดล (provider ที่ต่อไว้
แล้วใน Module 1.1) เป็นคนแปลคำถามเป็น SQL เองผ่าน tool-calling เหมือนที่ทำกับ Google Calendar ใน Module 2.2:
โมเดลเรียก `get_database_schema` ก่อนเพื่อรู้ชื่อตาราง/คอลัมน์ แล้วค่อยเขียน SQL เรียก `run_sql_query`

**สำคัญ**: server นี้ทำงานกับฐานข้อมูลจริง ไม่ใช่ demo/mock — บังคับ **อ่านอย่างเดียว (read-only)** ในระดับโค้ดหลาย
ชั้น (ดูหัวข้อความปลอดภัยด้านล่าง) แต่ก็ยังควรใช้กับฐานข้อมูล training/demo หรือฐานข้อมูลที่ตั้ง user สิทธิ์จำกัดไว้แล้ว
เท่านั้น ไม่ควรต่อกับฐานข้อมูล production ตรง ๆ

## ไฟล์ที่สร้างใหม่ในโมดูลนี้

| ไฟล์ | หน้าที่ |
|---|---|
| [`src/module-5-text-to-sql/sql-guard.ts`](../src/module-5-text-to-sql/sql-guard.ts) | เช็คว่า SQL ที่โมเดลเขียนมาเป็น query อ่านอย่างเดียวจริง (single statement, ขึ้นต้นด้วย `SELECT`/`WITH`, ไม่มีคีย์เวิร์ดต้องห้าม เช่น `INSERT`/`DELETE`/`DROP`) + เติม `LIMIT` อัตโนมัติถ้าไม่มี |
| [`src/module-5-text-to-sql/db-client.ts`](../src/module-5-text-to-sql/db-client.ts) | ต่อ MySQL ด้วย `mysql2` (เปิด connection ใหม่ทุก request แล้วปิดทันที — ดูคอมเมนต์ในไฟล์เรื่อง trade-off), `getDatabaseSchema()`, `runReadOnlyQuery()` |
| [`src/module-5-text-to-sql/text-to-sql-server.ts`](../src/module-5-text-to-sql/text-to-sql-server.ts) | ห่อเป็น MCP server ด้วย `createMcpServer()` (import จาก `module-2.1-mcp-simple-server/server-factory.ts`) — 2 tools: `get_database_schema`, `run_sql_query` |

## แก้ไฟล์เดิม

**1. [`src/env.ts`](../src/env.ts)** — เพิ่ม field: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

**2. [`src/router.ts`](../src/router.ts)** — เพิ่ม route ใหม่:

```ts
import { textToSqlServer } from './module-5-text-to-sql/text-to-sql-server';
// ...
if (pathname === '/mcp/text-to-sql') return textToSqlServer.fetch(request, env);
```

**3. [`src/module-1.3-mcp-client-settings/registry.ts`](../src/module-1.3-mcp-client-settings/registry.ts)** —
เพิ่มเข้า `BUILTIN_SERVERS` (แบบเดียวกับตอน Module 2.2 เพิ่ม `google-calendar`):

```ts
import { textToSqlServer } from '../module-5-text-to-sql/text-to-sql-server';

const BUILTIN_SERVERS: Record<string, McpServerHandle<Env>> = {
  utils: utilsServer,
  'google-calendar': googleCalendarServer,
  'text-to-sql': textToSqlServer,
};
```

จบแค่นี้ — **ไม่ต้องแตะ KV หรือ `mcp-registry-store.ts` เลย** เพราะ built-in server ถูก merge จาก
`BUILTIN_SERVERS` ตอน runtime ทุกครั้ง (ดู [Module 1.3](module-1.3-mcp-client-settings.md) หัวข้อ "built-in
server มาจากไหน") ต่อให้เคย deploy ไปแล้วและ KV มีข้อมูลเก่าอยู่ server ตัวใหม่ก็จะโผล่ในหน้า `/settings-mcp/`
และใช้งานได้ทันที

## ตั้งค่า

```bash
npx wrangler secret put DB_HOST       # เช่น 49.0.197.251
npx wrangler secret put DB_PORT       # เช่น 3306
npx wrangler secret put DB_NAME       # เช่น sale-demo
npx wrangler secret put DB_USER
npx wrangler secret put DB_PASSWORD
npm run deploy
```

(หรือใส่ใน `.dev.vars` ตอนรัน `npm run dev` ในเครื่อง — ห้าม commit ไฟล์นี้ขึ้น git เด็ดขาด อยู่ใน `.gitignore` แล้ว)

**แนะนำอย่างยิ่ง**: สร้าง DB user แยกที่มีสิทธิ์แค่ `SELECT` (`GRANT SELECT ON sale-demo.* TO 'readonly_user'@'%'`)
แทนการใช้ user ที่มีสิทธิ์เขียนได้ — โค้ดกัน query เขียนไว้ในชั้นแอปแล้ว (`sql-guard.ts`) แต่การจำกัดสิทธิ์ที่ตัว
ฐานข้อมูลเองเป็นเกราะป้องกันอีกชั้นที่ไม่ขึ้นกับว่าโค้ดแอปมีช่องโหว่หรือเปล่า

## ความปลอดภัย (สำคัญ อ่านก่อนใช้กับฐานข้อมูลจริง)

MCP server นี้ต่อกับฐานข้อมูลจริง ต่างจาก Module 2.1/2.2 ที่เป็น API ของ Google ที่มี rate limit/scope ควบคุมอยู่แล้ว
— มีการป้องกัน 3 ชั้น:

1. **`sql-guard.ts`**: ปฏิเสธ query ที่ไม่ได้ขึ้นต้นด้วย `SELECT`/`WITH`, ปฏิเสธคีย์เวิร์ดเขียน/ทำลายข้อมูล
   (`INSERT`/`UPDATE`/`DELETE`/`DROP`/`ALTER`/`TRUNCATE`/...), ปฏิเสธ query ซ้อนหลาย statement (`;` คั่นกลาง —
   กัน SQL injection แบบ stacked queries)
2. **`enforceLimit()`**: เติม `LIMIT 200` อัตโนมัติถ้าโมเดลลืมใส่ กันดึงข้อมูลทั้งตารางมาเปลืองทั้งเวลาและ token
3. **DB user สิทธิ์จำกัด** (แนะนำใน "ตั้งค่า" ด้านบน): เกราะป้องกันชั้นนอกสุด ไม่พึ่งความถูกต้องของโค้ดแอปอย่างเดียว

ข้อ 1–2 เป็น string-based guard ไม่ใช่ SQL parser เต็มรูปแบบ — ป้องกัน SQL injection/DML พื้นฐานได้ แต่ไม่ใช่
bulletproof 100% (เช่น subquery แปลก ๆ ที่ไม่มีคีย์เวิร์ดต้องห้ามแต่ทำอะไรไม่คาดคิดในทางทฤษฎี) เพราะแบบนั้น **ข้อ 3
คือด่านที่พึ่งได้จริงที่สุด**

## ทดสอบ

```bash
curl -X POST <WORKER_URL>/mcp/text-to-sql -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_database_schema","arguments":{}}}'

curl -X POST <WORKER_URL>/mcp/text-to-sql -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"run_sql_query","arguments":{
        "sql":"SELECT category, COUNT(*) FROM products GROUP BY category"
      }}}'

# ต้องถูกปฏิเสธ (ทดสอบว่า guard ทำงาน)
curl -X POST <WORKER_URL>/mcp/text-to-sql -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"run_sql_query","arguments":{"sql":"DELETE FROM products"}}}'
```

**checkpoint**: กลับไปที่หน้า `/chat/` ถามคำถามเกี่ยวกับข้อมูลในฐานข้อมูลตรง ๆ เช่น "หมวดสินค้าไหนขายรวมมากที่สุด"
— ผู้ช่วยควรเรียก `get_database_schema` ก่อน แล้วเรียก `run_sql_query` ด้วย SQL ที่มันเขียนเอง แล้วสรุปคำตอบเป็น
ภาษาคน (ดู `toolTrace` ใน response ของ `/api/chat` เพื่อดูว่าเรียก SQL อะไรไปจริง ๆ)

## ต่อยอด

- อยากให้โมเดลเห็น schema ในทุก turn โดยไม่ต้องเรียก tool เอง (เร็วขึ้น ประหยัด round-trip): เพิ่ม schema summary
  เข้าไปใน system prompt (`buildSystemPrompt()` ใน `chat-routes.ts`) แทนที่จะให้เรียกผ่าน tool ทุกครั้ง — แลกกับ
  system prompt ที่ยาวขึ้นและต้องอัปเดตเองเวลา schema เปลี่ยน
- อยากรองรับฐานข้อมูลมากกว่า 1 ตัว/สลับฐานข้อมูลจากหน้าเว็บ: เพิ่ม field เลือกฐานข้อมูลใน request, เก็บ connection
  info หลายชุดใน KV (แบบเดียวกับ Module 1.2) แทนที่จะ hardcode ชุดเดียวใน secret
- Traffic สูงขึ้น/กังวลเรื่อง connection ล้นฐานข้อมูล (Worker เปิด connection ใหม่ทุก request): ย้ายไปใช้
  [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) ซึ่งทำ connection pooling ให้ — ต้องเพิ่ม
  binding ใหม่ใน `wrangler.toml` และปรับ `db-client.ts` เล็กน้อย
