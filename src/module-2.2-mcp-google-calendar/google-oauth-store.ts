/**
 * Module 2.2 (เสริม) — ที่เก็บ Google refresh token แบบเดียวกับแพทเทิร์น `module-1.2-key-settings/keys-store.ts`
 * (KV override ชนะ env secret เสมอ) + ที่เก็บ state token กัน CSRF ของ flow `/oauth/google/*`
 *
 * ทำไมต้องมีไฟล์นี้: เดิม `GOOGLE_REFRESH_TOKEN` ตั้งได้ทางเดียวคือ `wrangler secret put` (ต้องไปขอผ่าน
 * Google OAuth Playground มาก่อน) ไฟล์นี้เปิดทางที่สอง — ให้ worker ขอ refresh token เองผ่านหน้าเว็บของตัวเอง
 * (`google-oauth-routes.ts`) แล้วเก็บผลลัพธ์ไว้ใน KV แทน ไม่ต้องพึ่ง Playground อีก แต่ยังรองรับ path เดิมอยู่
 * (ถ้าไม่เคย login ผ่านหน้าเว็บเลย จะ fallback ไปใช้ค่าจาก secret ตามปกติ)
 */
import { Env } from '../env';

const KV_KEY_REFRESH_TOKEN = 'secret:google_calendar_refresh_token';
const KV_STATE_PREFIX = 'oauth_state:google_calendar:';
const STATE_TTL_SECONDS = 600; // 10 นาที — พอสำหรับ redirect ไป Google แล้วกลับมา ไม่ต้องเก็บนานกว่านี้

export type RefreshTokenSource = 'kv' | 'env' | 'none';

/** refresh token จริงที่จะใช้เรียก Calendar API — KV (ได้จาก login ผ่านหน้าเว็บ) ชนะก่อน แล้วค่อย fallback ไป secret เดิม */
export async function getEffectiveRefreshToken(env: Env): Promise<string | undefined> {
  const override = await env.APP_KV.get(KV_KEY_REFRESH_TOKEN);
  if (override) return override;
  return env.GOOGLE_REFRESH_TOKEN;
}

export async function getRefreshTokenSource(env: Env): Promise<RefreshTokenSource> {
  const override = await env.APP_KV.get(KV_KEY_REFRESH_TOKEN);
  if (override) return 'kv';
  if (env.GOOGLE_REFRESH_TOKEN) return 'env';
  return 'none';
}

export async function setRefreshToken(env: Env, refreshToken: string): Promise<void> {
  await env.APP_KV.put(KV_KEY_REFRESH_TOKEN, refreshToken);
}

export async function clearRefreshToken(env: Env): Promise<void> {
  await env.APP_KV.delete(KV_KEY_REFRESH_TOKEN);
}

/** สร้าง state token สุ่ม เก็บลง KV แบบมี TTL ไว้เช็คตอน callback กัน CSRF (ใครสุ่มยิง /oauth/google/callback เอง ไม่ผ่าน) */
export async function createOAuthState(env: Env): Promise<string> {
  const state = crypto.randomUUID();
  await env.APP_KV.put(`${KV_STATE_PREFIX}${state}`, '1', { expirationTtl: STATE_TTL_SECONDS });
  return state;
}

/** เช็ค + ใช้ state ทิ้งทันที (ใช้ได้ครั้งเดียว) — คืน true ถ้า state ถูกต้องและยังไม่หมดอายุ */
export async function consumeOAuthState(env: Env, state: string): Promise<boolean> {
  if (!state) return false;
  const key = `${KV_STATE_PREFIX}${state}`;
  const exists = await env.APP_KV.get(key);
  if (!exists) return false;
  await env.APP_KV.delete(key);
  return true;
}
