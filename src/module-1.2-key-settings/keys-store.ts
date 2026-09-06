/**
 * Module 1.2 — ที่เก็บการตั้งค่า provider ของ chat: API key ต่อ provider (gemini/openai/openai-compat)
 * + base URL ของ openai-compat (ตัวเดียวที่ base URL ไม่ hardcode ในโค้ด ต้องตั้งเอง)
 * ลำดับความสำคัญ: ค่าที่ผู้ใช้ตั้งเองผ่านหน้า "ตั้งค่า Key" (เก็บใน Cloudflare KV ฟรี) ชนะค่าเริ่มต้นจาก
 * `wrangler secret put`/`[vars]` เสมอ — ทำให้ demo/workshop เปลี่ยน key/endpoint ได้จากหน้าเว็บโดยไม่ต้อง deploy ใหม่
 */
import { Env } from '../env';
import { ChatProvider } from '../module-1.1-chat/types';

const KV_PREFIX = 'secret:';
const KV_KEY_BASE_URL = 'config:openai_compat_base_url';

function kvKeyFor(provider: ChatProvider): string {
  return `${KV_PREFIX}${provider.replace('-', '_')}_api_key`;
}

function envKeyFor(provider: ChatProvider, env: Env): string | undefined {
  if (provider === 'gemini') return env.GEMINI_API_KEY;
  if (provider === 'openai') return env.OPENAI_API_KEY;
  return env.OPENAI_COMPAT_API_KEY;
}

/** key จริงที่จะใช้เรียก provider — KV override ก่อน แล้วค่อย fallback ไป env secret */
export async function getEffectiveApiKey(env: Env, provider: ChatProvider): Promise<string | undefined> {
  const override = await env.APP_KV.get(kvKeyFor(provider));
  if (override) return override;
  return envKeyFor(provider, env);
}

/** base URL ของ openai-compat gateway (เช่น Replace base url) — KV override ก่อน แล้วค่อย fallback ไป [vars]
 * (provider 'openai' ใช้ base URL คงที่ของ OpenAI เอง ไม่ต้องตั้ง, 'gemini' ไม่ใช้ base URL แบบนี้เลย) */
export async function getEffectiveBaseUrl(env: Env): Promise<string | undefined> {
  const override = await env.APP_KV.get(KV_KEY_BASE_URL);
  if (override) return override;
  return env.OPENAI_COMPAT_BASE_URL;
}

export interface KeyStatus {
  provider: ChatProvider;
  configured: boolean;
  source: 'kv' | 'env' | 'none';
  /** โชว์แค่ 4 ตัวท้าย กัน key หลุดออกไปทาง response แม้เป็นแค่ debug */
  hint?: string;
}

const ALL_PROVIDERS: ChatProvider[] = ['gemini', 'openai', 'openai-compat'];

export async function getKeyStatuses(env: Env): Promise<KeyStatus[]> {
  const statuses: KeyStatus[] = [];
  for (const provider of ALL_PROVIDERS) {
    const override = await env.APP_KV.get(kvKeyFor(provider));
    if (override) {
      statuses.push({ provider, configured: true, source: 'kv', hint: maskKey(override) });
    } else if (envKeyFor(provider, env)) {
      statuses.push({ provider, configured: true, source: 'env', hint: maskKey(envKeyFor(provider, env)!) });
    } else {
      statuses.push({ provider, configured: false, source: 'none' });
    }
  }
  return statuses;
}

export interface BaseUrlStatus {
  configured: boolean;
  source: 'kv' | 'env' | 'none';
  value?: string;
}

export async function getBaseUrlStatus(env: Env): Promise<BaseUrlStatus> {
  const kvValue = await env.APP_KV.get(KV_KEY_BASE_URL);
  if (kvValue) return { configured: true, source: 'kv', value: kvValue };
  if (env.OPENAI_COMPAT_BASE_URL) return { configured: true, source: 'env', value: env.OPENAI_COMPAT_BASE_URL };
  return { configured: false, source: 'none' };
}

export async function setApiKey(env: Env, provider: ChatProvider, apiKey: string): Promise<void> {
  await env.APP_KV.put(kvKeyFor(provider), apiKey);
}

export async function clearApiKey(env: Env, provider: ChatProvider): Promise<void> {
  await env.APP_KV.delete(kvKeyFor(provider));
}

export async function setBaseUrl(env: Env, baseUrl: string): Promise<void> {
  await env.APP_KV.put(KV_KEY_BASE_URL, baseUrl);
}

export async function clearBaseUrl(env: Env): Promise<void> {
  await env.APP_KV.delete(KV_KEY_BASE_URL);
}

function maskKey(key: string): string {
  if (key.length <= 4) return '••••';
  return `••••${key.slice(-4)}`;
}
