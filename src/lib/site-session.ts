/**
 * ล็อกทั้งเว็บ (หน้า static ทุกหน้า + /api/chat) ด้วยรหัสผ่านเดียว (`CLASS_PASSWORD`) — ใช้แจกให้ผู้เข้าร่วม
 * workshop คนละคน ไม่ใช่ auth ระดับ user จริง ๆ (ไม่มี username, ไม่มี per-user session)
 *
 * กลไก: เข้ารหัสผ่านถูก → ได้ cookie ที่เซ็น HMAC-SHA256 ด้วย CLASS_PASSWORD เอง (ไม่ต้องพึ่ง KV/DB เก็บ session)
 * cookie มีวันหมดอายุฝังอยู่ในตัว ปลอมไม่ได้เพราะไม่รู้ CLASS_PASSWORD แต่ verify ได้เร็วโดยไม่ query อะไรเพิ่ม
 *
 * ใช้ร่วมกัน 2 จุด (ดู router.ts):
 *   - ทุกหน้า static (fallback ท้าย route()) — ไม่มี session คือ redirect ไป /login
 *   - /api/chat — ไม่มี session คือ 401 (กัน caller ภายนอกยิงตรงมาใช้ API key ของเราฟรี ๆ)
 */
import { Env } from '../env';
import { errorJson } from './http';
import { timingSafeEqual } from './auth';

const COOKIE_NAME = 'ai_desk_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ชั่วโมง — พอสำหรับ 1 วัน workshop ต้องล็อกอินใหม่วันถัดไป

export function isSitePasswordConfigured(env: Env): boolean {
  return !!env.CLASS_PASSWORD;
}

/** true ถ้า request มี cookie session ที่ยังไม่หมดอายุและเซ็นถูกต้อง (ใช้ gate หน้า static) */
export async function verifySessionCookie(request: Request, env: Env): Promise<boolean> {
  if (!env.CLASS_PASSWORD) return false; // ยังไม่ตั้งรหัสผ่าน — fail-closed เหมือน ADMIN_TOKEN

  const value = readCookie(request, COOKIE_NAME);
  if (!value) return false;

  const [expiresAtStr, signature] = value.split('.');
  const expiresAt = Number(expiresAtStr);
  if (!expiresAtStr || !signature || Number.isNaN(expiresAt) || expiresAt < Date.now()) return false;

  const expectedSignature = await sign(expiresAtStr, env.CLASS_PASSWORD);
  return timingSafeEqual(signature, expectedSignature);
}

/** ใช้กับ /api/chat — คืน Response error (401/503) ถ้าไม่มี session ที่ถูกต้อง, คืน null ถ้าผ่าน */
export async function requireSiteSession(request: Request, env: Env): Promise<Response | null> {
  if (!env.CLASS_PASSWORD) {
    return errorJson('ยังไม่ได้ตั้งค่า CLASS_PASSWORD บน worker นี้ — รัน `wrangler secret put CLASS_PASSWORD` ก่อน (ดู SETUP.md)', 503);
  }
  const ok = await verifySessionCookie(request, env);
  if (!ok) return errorJson('ต้อง login ก่อน (เปิด /login) — session หมดอายุหรือยังไม่ได้ login', 401);
  return null;
}

/** GET/POST /login, GET /logout — หน้า login ในตัว ไม่พึ่งไฟล์ static ใด ๆ (กัน chicken-and-egg กับ gate) */
export async function handleSiteAuthRoute(request: Request, env: Env, pathname: string): Promise<Response> {
  if (pathname === '/logout') {
    return new Response(null, {
      status: 303,
      headers: { Location: '/login', 'Set-Cookie': clearCookieHeader() },
    });
  }

  // pathname === '/login'
  if (request.method === 'GET') {
    const next = sanitizeNext(new URL(request.url).searchParams.get('next') || '');
    return loginPage(undefined, next);
  }

  if (request.method !== 'POST') {
    return errorJson('method not allowed', 405);
  }

  if (!env.CLASS_PASSWORD) {
    return loginPage('ยังไม่ได้ตั้งค่า CLASS_PASSWORD บน worker นี้ — ผู้ดูแลต้องรัน `wrangler secret put CLASS_PASSWORD` ก่อน');
  }

  const form = await request.formData().catch(() => null);
  const password = (form?.get('password') || '').toString();
  const next = sanitizeNext((form?.get('next') || '').toString());

  if (!password || !timingSafeEqual(password, env.CLASS_PASSWORD)) {
    return loginPage('รหัสผ่านไม่ถูกต้อง', next);
  }

  const cookieValue = await createSessionCookieValue(env);
  return new Response(null, {
    status: 303,
    headers: { Location: next, 'Set-Cookie': buildCookieHeader(cookieValue) },
  });
}

export function redirectToLogin(pathname: string): Response {
  const next = sanitizeNext(pathname);
  return new Response(null, { status: 303, headers: { Location: `/login?next=${encodeURIComponent(next)}` } });
}

// --- helpers ภายในไฟล์นี้ ---

async function createSessionCookieValue(env: Env): Promise<string> {
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  const signature = await sign(expiresAt, env.CLASS_PASSWORD!);
  return `${expiresAt}.${signature}`;
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

function buildCookieHeader(value: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// กัน open-redirect: ยอมรับเฉพาะ path สัมพัทธ์ที่ขึ้นต้นด้วย "/" ตัวเดียว
// ("//evil.com" หรือ "/\evil.com" คือ protocol-relative URL หลอกเบราว์เซอร์ให้ไปโดเมนอื่นได้)
function sanitizeNext(next: string): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next;
  return '/';
}

function loginPage(error?: string, next = '/'): Response {
  const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Login — AI Desk</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  form { background: #1e293b; padding: 2rem; border-radius: 12px; width: 100%; max-width: 320px; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
  h1 { font-size: 1.1rem; margin: 0 0 1rem; }
  input { width: 100%; box-sizing: border-box; padding: .6rem .8rem; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 1rem; }
  button { width: 100%; margin-top: .8rem; padding: .6rem .8rem; border: none; border-radius: 8px; background: #6366f1; color: white; font-size: 1rem; cursor: pointer; }
  button:hover { background: #4f46e5; }
  .err { color: #f87171; font-size: .85rem; margin: .5rem 0 0; }
</style>
</head>
<body>
<form method="POST" action="/login">
  <h1>🔒 AI Desk — กรอกรหัสผ่านเข้าเว็บ</h1>
  <input type="hidden" name="next" value="${escapeHtml(next)}" />
  <input type="password" name="password" placeholder="รหัสผ่าน" autofocus required />
  <button type="submit">เข้าใช้งาน</button>
  ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
</form>
</body>
</html>`;
  return new Response(html, { status: error ? 401 : 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
