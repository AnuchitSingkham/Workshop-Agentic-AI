/**
 * Module 5 — เช็คว่า SQL ที่โมเดลเขียนมาเป็น query อ่านอย่างเดียวจริง ก่อนยอมรันกับฐานข้อมูลจริง
 * นี่คือด่านป้องกันชั้นในโค้ด (defense in depth) — ไม่ใช่ตัวเดียวที่พึ่งได้ แนะนำให้ DB user (`train_imc` หรือ
 * user อื่นที่ตั้งเอง) มีสิทธิ์แค่ SELECT ในระดับฐานข้อมูลด้วยเสมอ (GRANT SELECT เท่านั้น) ดู SETUP.md หัวข้อ Module 5
 */

// คำสั่ง/คีย์เวิร์ดที่ทำให้ query ไม่ใช่ "อ่านอย่างเดียว" อีกต่อไป — เช็คแบบ word boundary กัน false positive
// เช่นคอลัมน์ชื่อ "created_at" ไม่ควรโดนคำว่า "create" ที่เป็นคำสั่งจับผิด
const FORBIDDEN_KEYWORDS = [
  'insert',
  'update',
  'delete',
  'drop',
  'alter',
  'create',
  'truncate',
  'grant',
  'revoke',
  'replace',
  'call',
  'exec',
  'execute',
  'lock',
  'unlock',
  'set',
  'use',
  'load',
  'outfile',
  'infile',
];

/** โยน Error ถ้า sql ไม่ใช่ query อ่านอย่างเดียวที่ปลอดภัย (single-statement, ขึ้นต้นด้วย SELECT/WITH, ไม่มีคีย์เวิร์ดต้องห้าม) */
export function assertSafeSelect(sql: string): void {
  const trimmed = sql.trim();
  if (!trimmed) throw new Error('sql ห้ามว่าง');

  // อนุญาต ; ปิดท้าย 1 ตัวได้ แต่ห้ามมี ; คั่นกลาง (กัน SQL injection แบบ stacked queries เช่น "SELECT 1; DROP TABLE x")
  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, '');
  if (withoutTrailingSemicolon.includes(';')) {
    throw new Error('อนุญาตให้รันได้ทีละ 1 query เท่านั้น (ห้ามมี ; คั่นกลาง)');
  }

  const lower = withoutTrailingSemicolon.toLowerCase();
  if (!/^\s*(select|with)\b/.test(lower)) {
    throw new Error('อนุญาตเฉพาะ query ที่ขึ้นต้นด้วย SELECT หรือ WITH (read-only) เท่านั้น');
  }

  for (const word of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      throw new Error(`ไม่อนุญาตให้ใช้คำสั่ง/คีย์เวิร์ด "${word}" ใน query นี้`);
    }
  }
}

/** เติม LIMIT ให้ query อัตโนมัติถ้ายังไม่มี กันดึงข้อมูลทั้งตารางโดยไม่ตั้งใจ */
export function enforceLimit(sql: string, maxRows: number): string {
  const trimmed = sql.trim().replace(/;\s*$/, '');
  if (/\blimit\s+\d+/i.test(trimmed)) return trimmed;
  return `${trimmed} LIMIT ${maxRows}`;
}
