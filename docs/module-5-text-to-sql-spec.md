# Spec — Module 5: Text-to-SQL (ถามฐานข้อมูลด้วยภาษาคน)

> ไฟล์นี้เขียนให้ AI coding agent อ่านแล้วลงมือสร้าง/แก้ไฟล์ได้เลย (ดูวิธีสั่ง agent ใน README.md หัวข้อ "vibecode ด้วย AI coding agent")
> อยากอ่านคำอธิบายละเอียดกว่านี้ ดู [module-5-text-to-sql.md](module-5-text-to-sql.md)

## บริบท

เพิ่ม MCP server ตัวที่ 3 ที่ให้ผู้ช่วยตอบคำถามจากฐานข้อมูล MySQL จริงด้วยภาษาคน — **ไม่เขียน NL→SQL parser เอง**
ให้โมเดล (provider จาก module 1.1) แปลคำถามเป็น SQL เองผ่าน tool-calling: เรียก `get_database_schema` ก่อน
เพื่อรู้ชื่อตาราง/คอลัมน์ แล้วค่อยเขียน SQL เรียก `run_sql_query`

**สำคัญ**: server นี้ต่อฐานข้อมูลจริง — บังคับ **อ่านอย่างเดียว (read-only)** หลายชั้น ใช้กับฐานข้อมูล
training/demo หรือฐานข้อมูลที่จำกัดสิทธิ์ user ไว้แล้วเท่านั้น **ห้ามต่อกับฐานข้อมูล production ตรง ๆ**

## Prerequisites

- ทำ [Module 1.1](module-1.1-chat.md)–[1.3](module-1.3-mcp-client-settings.md) และ
  [2.1](module-2.1-mcp-simple-server.md)–[2.2](module-2.2-mcp-google-calendar.md) ให้เสร็จก่อน
- มี connection info ของฐานข้อมูล MySQL (host, port, database, user, password) — **แนะนำอย่างยิ่งให้สร้าง DB
  user แยกที่มีสิทธิ์แค่ `SELECT`** (`GRANT SELECT ON <db>.* TO 'readonly_user'@'%'`)

## ไฟล์ที่ต้องสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/module-5-text-to-sql/sql-guard.ts` | เช็คว่า SQL ที่โมเดลเขียนมาเป็น query อ่านอย่างเดียวจริง: single statement เท่านั้น (ปฏิเสธถ้ามี `;` คั่นกลาง — กัน stacked-query injection), ต้องขึ้นต้นด้วย `SELECT`/`WITH`, ปฏิเสธคีย์เวิร์ดเขียน/ทำลายข้อมูลทั้งหมด (`INSERT`/`UPDATE`/`DELETE`/`DROP`/`ALTER`/`TRUNCATE`/...) + ฟังก์ชัน `enforceLimit()` เติม `LIMIT 200` อัตโนมัติถ้าไม่มี |
| `src/module-5-text-to-sql/db-client.ts` | ต่อ MySQL ด้วย `mysql2` — **ต้องตั้ง `disableEval: true`** (บังคับบน Cloudflare Workers ไม่งั้น error "Code generation from strings disallowed"), เปิด connection ใหม่ทุก request แล้วปิดทันที (ไม่ pool), `getDatabaseSchema()` (คืนชื่อตาราง/คอลัมน์ทั้งหมด), `runReadOnlyQuery(sql)` (เรียก `sql-guard.ts` ตรวจก่อนรันทุกครั้ง) |
| `src/module-5-text-to-sql/text-to-sql-server.ts` | ห่อเป็น MCP server ด้วย `createMcpServer()` (import จาก `module-2.1-mcp-simple-server/server-factory.ts`) — 2 tools: `get_database_schema` (ไม่มี argument), `run_sql_query` (`inputSchema: {sql: string}`) |

## แก้ไฟล์เดิม

1. **`src/env.ts`** — เพิ่ม field: `DB_HOST?`, `DB_PORT?`, `DB_NAME?`, `DB_USER?`, `DB_PASSWORD?` (ทั้งหมด optional)
2. **`src/router.ts`** — เพิ่ม route: `if (pathname === '/mcp/text-to-sql') return textToSqlServer.fetch(request, env);`
3. **`src/module-1.3-mcp-client-settings/registry.ts`** — เพิ่ม `'text-to-sql': textToSqlServer` เข้า
   `BUILTIN_SERVERS` (แบบเดียวกับที่ module 2.2 เพิ่ม `google-calendar`) — บรรทัดเดียวจบ ไม่ต้องแตะ KV หรือ
   `mcp-registry-store.ts` เพราะ built-in ถูก merge จาก `BUILTIN_SERVERS` ตอน runtime อยู่แล้ว

## ข้อกำหนดสำคัญ (ความปลอดภัย — สำคัญที่สุดของโมดูลนี้)

1. **`disableEval: true` ต้องอยู่ใน mysql2 connection config เสมอ** — ไม่มี flag นี้จะ error บน Cloudflare Workers
2. `sql-guard.ts` ต้องปฏิเสธ query ที่ไม่ผ่านเงื่อนไขทั้งหมดข้างต้น **ก่อน** ส่งไปรันที่ฐานข้อมูลจริงเสมอ ไม่มี
   ทางลัดข้ามการเช็คนี้
3. `run_sql_query` ต้อง reject การรันทันทีถ้า guard ไม่ผ่าน (คืน error message บอกเหตุผล ไม่ใช่ throw ทั่วไป)
4. ถ้ายังไม่ตั้ง `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` ครบ ให้ error message อ่านเข้าใจง่ายบอกว่าต้องตั้ง
   อะไรเพิ่ม (เหมือน pattern fail-closed แบบสุภาพของ module 2.2)

## Acceptance Criteria

- [ ] `npm run typecheck` ผ่าน
- [ ] `get_database_schema` คืนชื่อตาราง/คอลัมน์จริงจากฐานข้อมูลที่ต่อไว้
- [ ] `run_sql_query` ด้วย SQL `SELECT` ปกติ → ได้ผลลัพธ์จริง
- [ ] `run_sql_query` ด้วย `DELETE FROM <table>` (หรือ `INSERT`/`DROP`/มี `;` คั่นหลาย statement) → **ต้องถูก
      ปฏิเสธ** โดย guard (ไม่ใช่ error จากฐานข้อมูลเพราะสิทธิ์ไม่พอ —ต้องถูกกันตั้งแต่ชั้นแอปก่อนยิงจริง)
- [ ] **checkpoint**: ถามในหน้า `/chat/` เช่น "หมวดสินค้าไหนขายรวมมากที่สุด" — ผู้ช่วยเรียก `get_database_schema`
      ก่อน แล้วเรียก `run_sql_query` ด้วย SQL ที่เขียนเอง แล้วสรุปคำตอบเป็นภาษาคน (เช็คได้จาก `toolTrace` ใน
      response ของ `/api/chat`)

## ห้ามทำเกินสโคป

- ไม่ต้องรองรับฐานข้อมูลหลายตัว/Cloudflare Hyperdrive (อยู่ใน "ต่อยอด" ของเอกสารอ้างอิง)
- ไม่ต้องเพิ่ม schema เข้า system prompt โดยตรง — ให้เรียกผ่าน tool ตามที่สเปกนี้กำหนด

## Prompt แนะนำสำหรับสั่ง AI agent

> อ่าน `docs/module-5-text-to-sql-spec.md` ให้ครบ **โดยเฉพาะหัวข้อความปลอดภัย** แล้วสร้างไฟล์ตามตาราง อย่าลืม
> `disableEval: true` ใน mysql2 config และเช็ค `sql-guard.ts` ก่อนรัน query ทุกครั้งไม่มีข้อยกเว้น ทดสอบด้วย query
> อันตราย (`DELETE`, stacked query) ให้แน่ใจว่าถูกปฏิเสธจริงก่อนรายงานผล
