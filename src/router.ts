/**
 * รวม route ทั้งหมดของ worker ไว้จุดเดียว — ดูตารางเต็มใน README.md
 * หน้า static (Chat / ตั้งค่า Key / ตั้งค่า MCP server) เสิร์ฟที่ fallback ท้ายไฟล์นี้เอง (เรียก env.ASSETS.fetch()
 * ตรง ๆ) หลังเช็ค session cookie ผ่านแล้วเท่านั้น — เพราะตั้ง run_worker_first = true ไว้ใน wrangler.toml ให้ทุก
 * request วิ่งเข้ามาที่นี่ก่อนเสมอ (ดู lib/site-session.ts สำหรับ login/session)
 */
import { Env } from './env';
import { json } from './lib/http';
import { handleSiteAuthRoute, redirectToLogin, requireSiteSession, verifySessionCookie } from './lib/site-session';
import { handleChatRoute } from './module-1.1-chat/chat-routes';
import { handleKeysRoute } from './module-1.2-key-settings/keys-routes';
import { utilsServer } from './module-2.1-mcp-simple-server/utils-server';
import { googleCalendarServer } from './module-2.2-mcp-google-calendar/google-calendar-server';
import { handleGoogleOAuthRoute } from './module-2.2-mcp-google-calendar/google-oauth-routes';
import { handleMcpServersRoute } from './module-1.3-mcp-client-settings/mcp-registry-routes';
import { handleTelegramWebhook } from './module-2.3-telegram/webhook';
import { textToSqlServer } from './module-5-text-to-sql/text-to-sql-server';

const MCP_SERVERS_PREFIX = '/api/settings/mcp-servers';

export async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === '/healthz') return json({ ok: true, service: 'ai-desk-worker' });

  // เข้าเว็บทั้งเว็บต้องกรอกรหัสผ่าน class ก่อน (ดู lib/site-session.ts) — หน้า login เองต้องผ่านได้เสมอ
  if (pathname === '/login' || pathname === '/logout') return handleSiteAuthRoute(request, env, pathname);

  // Module 1.1 — เช็ค session cookie เดียวกับหน้าเว็บก่อน กัน caller ภายนอกยิงตรงมาใช้ API key ของเราฟรี ๆ
  if (pathname === '/api/chat') {
    const authError = await requireSiteSession(request, env);
    if (authError) return authError;
    return handleChatRoute(request, env);
  }

  // Module 1.2
  if (pathname === '/api/settings/keys') return handleKeysRoute(request, env);

  // Module 1.3 (ฝั่งตั้งค่า) — รองรับทั้ง /api/settings/mcp-servers, /:id และ /:id/toggle
  if (pathname === MCP_SERVERS_PREFIX || pathname.startsWith(`${MCP_SERVERS_PREFIX}/`)) {
    return handleMcpServersRoute(request, env, pathname.slice(MCP_SERVERS_PREFIX.length));
  }

  // Module 2.1 — MCP server อย่างง่าย ต่อจาก MCP client ภายนอกได้ตรง ๆ ด้วย
  if (pathname === '/mcp/utils') return utilsServer.fetch(request, env);

  // Module 2.2 — MCP server Google Calendar
  if (pathname === '/mcp/google-calendar') return googleCalendarServer.fetch(request, env);

  // Module 2.2 (เสริม) — ขอ Google OAuth refresh token ผ่านหน้าเว็บของ worker เอง แทนการใช้ OAuth Playground
  // (ต้อง login เว็บนี้ก่อน — เช็คอยู่ใน handleGoogleOAuthRoute เอง ดู google-oauth-routes.ts)
  if (pathname === '/oauth/google/start' || pathname === '/oauth/google/callback') {
    return handleGoogleOAuthRoute(request, env, pathname);
  }

  // Module 2.3
  if (pathname === '/telegram/webhook') return handleTelegramWebhook(request, env);

  // Module 5 — MCP server text-to-SQL
  if (pathname === '/mcp/text-to-sql') return textToSqlServer.fetch(request, env);

  // ทุก path ที่เหลือ = หน้าเว็บ static (public/) — ต้องมี session cookie (login แล้ว) ก่อนถึงจะเห็น
  // (run_worker_first = true ใน wrangler.toml ทำให้ path พวกนี้วิ่งมาถึงตรงนี้แทนที่จะถูก [assets] เสิร์ฟข้ามโค้ดเราไปเลย)
  const hasSession = await verifySessionCookie(request, env);
  if (!hasSession) return redirectToLogin(pathname);
  return env.ASSETS.fetch(request);
}
