/**
 * Module 5 — ต่อ MySQL ตรง ๆ จาก Worker ผ่าน `mysql2` (ใช้ได้เพราะเปิด `nodejs_compat` ไว้ใน wrangler.toml
 * ซึ่งแปลง TCP socket ของ Node ให้ไปใช้ `cloudflare:sockets` เบื้องหลัง)
 *
 * Worker เป็น stateless ต่อ request — โค้ดนี้เปิด connection ใหม่แล้วปิดทันทีทุกครั้ง ไม่มี pooling ข้าม request
 * (เหมาะกับ workshop/demo ที่ traffic ไม่สูง ถ้าจะสเกลจริงจังหรือกังวลเรื่อง connection ล้น แนะนำใช้
 * Cloudflare Hyperdrive แทน — นอกสโคปของโมดูลนี้)
 *
 * หมายเหตุ type: mysql2's `Connection` type ใช้ mixin pattern ที่ tsc มองไม่เห็น `.query()` ภายใต้ config ของ
 * โปรเจกต์นี้ (moduleResolution: Bundler) — เลี่ยงปัญหาด้วยการนิยาม interface ของตัวเองแค่ส่วนที่ใช้จริง แทนที่จะ
 * import type `Connection` ตรง ๆ (runtime ยังเป็น mysql2 connection จริงเป๊ะ ๆ แค่ type-check ฝั่งเราเท่านั้น)
 */
import { createConnection } from 'mysql2/promise';
import { Env } from '../env';
import { assertSafeSelect, enforceLimit } from './sql-guard';

const MAX_ROWS = 200;

interface MysqlConnectionLike {
  query(sql: string, values?: unknown): Promise<[unknown, unknown]>;
  end(): Promise<void>;
}

function requireDbConfig(env: Env) {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = env;
  if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASSWORD) {
    throw new Error('ยังไม่ได้ตั้งค่าฐานข้อมูล (DB_HOST/DB_NAME/DB_USER/DB_PASSWORD) — ดู SETUP.md หัวข้อ Module 5');
  }
  return {
    host: DB_HOST,
    port: DB_PORT ? Number(DB_PORT) : 3306,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    // Workers sandbox ห้าม eval/new Function (V8 isolate ปิด unsafe-eval) — mysql2 ปกติใช้ code generation
    // เพื่อความเร็วตอน parse ผลลัพธ์ ต้องปิดด้วย flag นี้ (รองรับตั้งแต่ mysql2 3.13.0) ไม่งั้นจะเจอ error
    // "Code generation from strings disallowed for this context" ทันทีที่ query แรก
    disableEval: true,
  };
}

async function withConnection<T>(env: Env, fn: (conn: MysqlConnectionLike) => Promise<T>): Promise<T> {
  const config = requireDbConfig(env);
  const conn = (await createConnection({ ...config, connectTimeout: 8000 })) as unknown as MysqlConnectionLike;
  try {
    return await fn(conn);
  } finally {
    await conn.end().catch(() => {});
  }
}

export interface TableSchema {
  table: string;
  columns: { name: string; type: string }[];
}

/** ดึงชื่อตาราง + คอลัมน์ทั้งหมด ให้โมเดลใช้ประกอบก่อนเขียน SQL (ไม่ต้องเดาชื่อคอลัมน์เอง) */
export async function getDatabaseSchema(env: Env): Promise<TableSchema[]> {
  return withConnection(env, async (conn) => {
    const [tablesResult] = await conn.query('SHOW TABLES');
    const tables = tablesResult as Record<string, unknown>[];

    const result: TableSchema[] = [];
    for (const row of tables) {
      const tableName = String(Object.values(row)[0]);
      const [colsResult] = await conn.query('DESCRIBE ??', [tableName]);
      const cols = colsResult as { Field: string; Type: string }[];
      result.push({ table: tableName, columns: cols.map((c) => ({ name: String(c.Field), type: String(c.Type) })) });
    }
    return result;
  });
}

/** รัน SELECT ที่ผ่านการตรวจสอบจาก sql-guard.ts แล้วเท่านั้น — ห้ามเรียกตรงด้วย sql ที่ยังไม่เช็ค */
export async function runReadOnlyQuery(env: Env, sql: string): Promise<{ rows: unknown[]; rowCount: number; sqlExecuted: string }> {
  assertSafeSelect(sql);
  const limitedSql = enforceLimit(sql, MAX_ROWS);

  return withConnection(env, async (conn) => {
    const [rowsResult] = await conn.query(limitedSql);
    const rowsArray = Array.isArray(rowsResult) ? rowsResult : [];
    return { rows: rowsArray, rowCount: rowsArray.length, sqlExecuted: limitedSql };
  });
}
