/**
 * Module 2.2 — Gmail/Calendar ผ่าน REST API ตรง ๆ ด้วย OAuth refresh-token flow
 * ย่อจากโค้ด Gmail/Calendar OAuth ตัวเดิมของโปรเจกต์นี้ — ตัดส่วน Gmail ออก
 * เหลือแค่ Calendar ตามสโคปของ Module นี้ (วิธีขอ refresh token ดู SETUP.md)
 *
 * refresh token อ่านผ่าน `getEffectiveRefreshToken()` (google-oauth-store.ts) — ได้จาก KV ก่อน (login ผ่าน
 * `/oauth/google/start` ในหน้าเว็บของ worker เอง) แล้วค่อย fallback ไปที่ secret `GOOGLE_REFRESH_TOKEN` เดิม
 * (วิธี OAuth Playground แบบ manual) เพื่อให้ทั้งสองวิธีใน SETUP.md ใช้ได้พร้อมกัน
 */
import { Env } from '../env';
import { getEffectiveRefreshToken } from './google-oauth-store';

export interface CalendarEventSummary {
  id?: string;
  title: string;
  start: string;
  end: string;
}

async function requireGoogleConfig(env: Env): Promise<{ clientId: string; clientSecret: string; refreshToken: string }> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env;
  const refreshToken = await getEffectiveRefreshToken(env);
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !refreshToken) {
    throw new Error(
      'ยังไม่ได้ตั้งค่า Google OAuth สำหรับ Calendar (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / refresh token) — ' +
        'เชื่อมต่อผ่าน <WORKER_URL>/oauth/google/start หรือดูวิธีตั้งค่าด้วยมือใน SETUP.md หัวข้อ Module 2.2'
    );
  }
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, refreshToken };
}

// แลก refresh token เป็น access token ใหม่ทุกครั้ง (access token อายุสั้น ~1 ชั่วโมง)
async function getAccessToken(env: Env): Promise<string> {
  const { clientId, clientSecret, refreshToken } = await requireGoogleConfig(env);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `ขอ Google access token ไม่สำเร็จ (HTTP ${res.status}) — refresh token อาจหมดอายุ ` +
        `(ถ้า OAuth consent screen ยังเป็นสถานะ Testing token จะหมดอายุทุก 7 วัน ต้องเปลี่ยนเป็น In production) ` +
        `${errText.slice(0, 200)}`
    );
  }

  const data: any = await res.json();
  return data.access_token;
}

function calendarHeaders(accessToken: string) {
  return { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
}

export async function listUpcomingEvents(env: Env, days: number): Promise<CalendarEventSummary[]> {
  const accessToken = await getAccessToken(env);
  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: until.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: calendarHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`Calendar list เรียกไม่สำเร็จ (HTTP ${res.status})`);

  const data: any = await res.json();
  const items: any[] = data.items || [];
  return items.map((ev) => ({
    id: ev.id,
    title: ev.summary || '(ไม่มีชื่อ)',
    start: ev.start?.dateTime || ev.start?.date,
    end: ev.end?.dateTime || ev.end?.date,
  }));
}

export async function createCalendarEvent(
  env: Env,
  title: string,
  startDateTime: string,
  endDateTime: string
): Promise<{ eventId: string }> {
  const accessToken = await getAccessToken(env);
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: calendarHeaders(accessToken),
    body: JSON.stringify({ summary: title, start: { dateTime: startDateTime }, end: { dateTime: endDateTime } }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`สร้างนัดหมายไม่สำเร็จ (HTTP ${res.status}) ${errText.slice(0, 200)}`);
  }

  const data: any = await res.json();
  return { eventId: data.id };
}
