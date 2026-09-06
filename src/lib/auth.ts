import { Env } from '../env';
import { errorJson } from './http';

/**
 * ป้องกันหน้า/endpoint settings (Module 1.2 เก็บ key, Module 1.3 ตั้งค่า MCP server)
 * ด้วย token เดียวที่ตั้งผ่าน `wrangler secret put ADMIN_TOKEN` — ผู้ใช้กรอก token นี้ครั้งเดียวในหน้าเว็บ
 * (เก็บใน localStorage ของเบราว์เซอร์ตัวเอง) แล้วส่งมาใน header `X-Admin-Token` ทุก request ถัดไป
 *
 * ออกแบบแบบ fail-closed โดยตั้งใจ: ถ้ายังไม่ได้ตั้ง ADMIN_TOKEN เลย ให้ปิดทุก endpoint settings ไปก่อน
 * (ดีกว่าเปิดโล่งให้ใครก็ได้ที่เจอ URL เข้ามาแก้ key คนอื่น)
 */
export function requireAdminToken(request: Request, env: Env): Response | null {
  if (!env.ADMIN_TOKEN) {
    return errorJson(
      'ยังไม่ได้ตั้งค่า ADMIN_TOKEN บน worker นี้ — รัน `wrangler secret put ADMIN_TOKEN` ก่อน ถึงจะใช้หน้า settings ได้ (ดู SETUP.md)',
      503
    );
  }

  const provided = request.headers.get('X-Admin-Token');
  if (!provided || !timingSafeEqual(provided, env.ADMIN_TOKEN)) {
    return errorJson('ต้องใส่ admin token ที่ถูกต้องใน header X-Admin-Token', 401);
  }

  return null; // ผ่านการตรวจสอบ
}

// เทียบ string แบบเวลาคงที่ กัน timing attack เดาความยาว/ตัวอักษรของ token ทีละตัว
// export ไว้ให้ site-session.ts (session cookie) และ server-factory.ts (MCP bearer token) ใช้ร่วมด้วย
export function timingSafeEqual(a: string, b: string): boolean {
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}
