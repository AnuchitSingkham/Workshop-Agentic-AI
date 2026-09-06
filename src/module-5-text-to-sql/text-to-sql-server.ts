/**
 * Module 5 — ห่อ db-client.ts เป็น MCP server ด้วย server-factory.ts เดียวกับ Module 2.1/2.2
 * ให้โมเดลเป็นคนแปล "คำถามภาษาคน" เป็น SQL เอง (ผ่าน tool-calling) โดยเรียก get_database_schema ก่อนเพื่อรู้ว่า
 * มีตาราง/คอลัมน์อะไรบ้าง แล้วค่อยเรียก run_sql_query ด้วย SQL ที่เขียนขึ้นเอง — เราไม่ได้เขียน NL→SQL parser
 * เองเลย ปล่อยให้เป็นหน้าที่ของโมเดลที่คุยผ่าน Module 1.1 อยู่แล้ว
 */
import { Env } from '../env';
import { createMcpServer } from '../module-2.1-mcp-simple-server/server-factory';
import { getDatabaseSchema, runReadOnlyQuery } from './db-client';

export const textToSqlServer = createMcpServer<Env>({
  name: 'ai-desk-text-to-sql',
  version: '0.1.0',
  tools: [
    {
      name: 'get_database_schema',
      description:
        'ดูรายชื่อตารางและคอลัมน์ทั้งหมดในฐานข้อมูล ใช้เครื่องมือนี้ก่อนเขียน SQL เสมอถ้ายังไม่รู้ชื่อตาราง/คอลัมน์ที่แน่นอน',
      inputSchema: { type: 'object', properties: {} },
      handler: async (_args, env) => getDatabaseSchema(env),
    },
    {
      name: 'run_sql_query',
      description:
        'รัน SQL query แบบอ่านอย่างเดียว (ขึ้นต้นด้วย SELECT หรือ WITH เท่านั้น) กับฐานข้อมูล — ห้ามใช้ ' +
        'INSERT/UPDATE/DELETE/DROP/ALTER ฯลฯ เด็ดขาด (จะถูกปฏิเสธ) จำกัดผลลัพธ์สูงสุด 200 แถวต่อครั้ง เขียนเป็น MySQL syntax',
      inputSchema: {
        type: 'object',
        properties: { sql: { type: 'string', description: 'SQL SELECT statement มาตรฐาน (MySQL syntax) 1 คำสั่ง' } },
        required: ['sql'],
      },
      handler: async (args, env) => runReadOnlyQuery(env, String(args.sql ?? '')),
    },
  ],
});
