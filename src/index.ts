/**
 * AI Desk — Chat (OpenRouter/Gemini) + key settings + MCP servers (utils, Google Calendar) + MCP client
 * + Telegram, ทั้งหมดอยู่ใน Cloudflare Worker เดียว
 *
 * หน้าเว็บ static (public/) ถูกเสิร์ฟโดย [assets] binding ใน wrangler.toml โดยอัตโนมัติสำหรับ path ที่ตรงกับ
 * ไฟล์จริง — fetch() ด้านล่างนี้จะถูกเรียกเฉพาะ path ที่ไม่ตรงไฟล์ static เท่านั้น (คือ route แบบ dynamic
 * ทั้งหมด ดู src/router.ts) ดูภาพรวมสถาปัตยกรรม/ตาราง route เต็มใน README.md, ดูวิธีตั้งค่าใน SETUP.md
 */
import { Env } from './env';
import { route } from './router';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (err) {
      console.error('unhandled worker error', err);
      return new Response(JSON.stringify({ error: 'internal error' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
  },
};
