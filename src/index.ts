/**
 * จุดเริ่มต้น (entrypoint) ของ worker — ตอนนี้ยังไม่มี module ใดถูกเพิ่มเลย
 *
 * ไฟล์นี้จะถูก "แทนที่" ตอนทำ Module 1.1 (ดู docs/module-1.1-chat.md) — โมดูลนั้นจะสร้าง
 * src/env.ts, src/router.ts, src/lib/http.ts ขึ้นมาใหม่ และเปลี่ยนไฟล์นี้ให้เรียก route() จาก router.ts แทน
 *
 * ตอนนี้แค่ตอบ 200 กลับไปเฉย ๆ เพื่อให้ `npm run deploy` ผ่านและทดสอบว่า worker ใช้งานได้จริงก่อนเริ่มต่อ module
 */
export default {
  async fetch(): Promise<Response> {
    return new Response('AI Desk worker พร้อมแล้ว — ยังไม่มี module ใดถูกเพิ่ม เริ่มที่ Module 1.1 ได้เลย', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};
