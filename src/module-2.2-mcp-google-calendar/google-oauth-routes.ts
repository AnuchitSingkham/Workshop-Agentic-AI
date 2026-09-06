/**
 * Module 2.2 (เสริม) — ทำ Google OAuth "authorization code" flow เต็มรูปแบบผ่าน URL ของ worker เอง
 * แทนการต้องไปคัดลอก refresh token มาจาก Google OAuth Playground ด้วยมือ (วิธีเดิมยังใช้ได้อยู่ ดู SETUP.md)
 *
 *   GET /oauth/google/start     → redirect ไปหน้า consent ของ Google (ต้อง login เว็บนี้ก่อน กัน anonymous ยิงเล่น)
 *   GET /oauth/google/callback  → Google redirect กลับมาที่นี่พร้อม ?code=...&state=... → แลกเป็น refresh token
 *                                  แล้วเก็บลง KV (ดู google-oauth-store.ts) — เห็นผลทันทีไม่ต้อง deploy ใหม่
 *
 * ต้องสร้าง Google OAuth Client แบบ "Web application" (ไม่ใช่ "Desktop app" แบบวิธี Playground เดิม) แล้วเพิ่ม
 * Authorized redirect URI = "<WORKER_URL>/oauth/google/callback" ใน Google Cloud Console ก่อน — ดูขั้นตอนเต็มใน
 * SETUP.md หัวข้อ 5.4b
 */
import { Env } from '../env';
import { errorJson } from '../lib/http';
import { requireSiteSession } from '../lib/site-session';
import { consumeOAuthState, createOAuthState, setRefreshToken } from './google-oauth-store';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

function redirectUriFor(request: Request): string {
  return `${new URL(request.url).origin}/oauth/google/callback`;
}

export async function handleGoogleOAuthRoute(request: Request, env: Env, pathname: string): Promise<Response> {
  if (pathname === '/oauth/google/start') return handleStart(request, env);
  if (pathname === '/oauth/google/callback') return handleCallback(request, env);
  return errorJson('not found', 404);
}

// login เว็บนี้ (session cookie เดียวกับ /api/chat) ก่อนถึงจะเริ่มขอสิทธิ์ Google ได้ — กันคนแปลกหน้าที่เจอ URL
// เข้ามากดขอสิทธิ์เข้าปฏิทิน "ของใครก็ได้ที่บังเอิญ login Google ค้างอยู่บนเบราว์เซอร์นั้น" ทิ้งไว้เฉย ๆ
async function handleStart(request: Request, env: Env): Promise<Response> {
  const authError = await requireSiteSession(request, env);
  if (authError) return authError;

  if (!env.GOOGLE_CLIENT_ID) {
    return errorJson(
      'ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID — สร้าง OAuth Client แบบ Web application ใน Google Cloud Console ก่อน (ดู SETUP.md ข้อ 5.4b)',
      503
    );
  }

  const state = await createOAuthState(env);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUriFor(request),
    response_type: 'code',
    scope: CALENDAR_SCOPE,
    access_type: 'offline', // ต้องมีถึงจะได้ refresh_token กลับมาด้วย (ไม่ใช่แค่ access_token อายุสั้น)
    prompt: 'consent', // บังคับให้ Google ถามยินยอมใหม่ทุกครั้ง เพื่อให้ได้ refresh_token กลับมาซ้ำได้แม้เคย allow ไปแล้วก่อนหน้า
    state,
  });

  return Response.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`, 302);
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const authError = await requireSiteSession(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) return resultPage(false, `Google ปฏิเสธ/ยกเลิกคำขอ: ${error}`);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  if (!code) return resultPage(false, 'ไม่มี code ส่งกลับมาจาก Google');

  const stateOk = await consumeOAuthState(env, state);
  if (!stateOk) return resultPage(false, 'state ไม่ถูกต้องหรือหมดอายุแล้ว (เกิน 10 นาที) — ลองกดเชื่อมต่อใหม่');

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return resultPage(false, 'ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET บน worker นี้');
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUriFor(request),
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '');
    return resultPage(false, `แลก token ไม่สำเร็จ (HTTP ${tokenRes.status}) ${errText.slice(0, 300)}`);
  }

  const data: any = await tokenRes.json();
  const refreshToken = data.refresh_token as string | undefined;
  if (!refreshToken) {
    // มักเกิดตอน re-authorize บัญชีที่เคย allow ไปแล้วโดยไม่ได้ revoke ก่อน — access_type/prompt ด้านบนกันเคสนี้ไว้แล้ว
    // แต่กันพลาดไว้อีกชั้น เผื่อ Google เปลี่ยนพฤติกรรม
    return resultPage(
      false,
      'ได้ access token แต่ไม่มี refresh token กลับมา — ลองไปที่ https://myaccount.google.com/permissions ' +
        'เพิกถอนสิทธิ์แอปนี้ก่อน แล้วกดเชื่อมต่อใหม่'
    );
  }

  await setRefreshToken(env, refreshToken);
  return resultPage(true, 'เชื่อมต่อ Google Calendar สำเร็จ — เก็บ refresh token ไว้ใน KV แล้ว ใช้งาน /mcp/google-calendar ได้ทันที');
}

function resultPage(ok: boolean, message: string): Response {
  const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${ok ? 'เชื่อมต่อสำเร็จ' : 'เชื่อมต่อไม่สำเร็จ'} — Google Calendar</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; box-sizing: border-box; }
  .card { background: #1e293b; padding: 2rem; border-radius: 12px; width: 100%; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
  h1 { font-size: 1.1rem; margin: 0 0 .8rem; }
  p { line-height: 1.5; }
  a { color: #818cf8; }
</style>
</head>
<body>
<div class="card">
  <h1>${ok ? '✅ เชื่อมต่อสำเร็จ' : '❌ เชื่อมต่อไม่สำเร็จ'}</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="/">กลับหน้าแรก</a></p>
</div>
</body>
</html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
