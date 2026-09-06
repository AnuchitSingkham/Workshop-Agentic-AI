/**
 * Module 2.3 — Telegram ไม่มี state ของตัวเองเหมือนหน้าเว็บ (ที่เก็บ history ไว้ใน JS ฝั่ง browser)
 * เลยต้องเก็บความจำแชทสั้น ๆ ต่อ chatId ไว้ใน KV เอง ถึงจะคุยแบบมีบริบทต่อเนื่องหลายข้อความได้
 */
import { Env } from '../env';
import { getJSON, putJSON } from '../lib/kv';
import { ChatMessage } from '../module-1.1-chat/types';

const MAX_MESSAGES = 20;
const TTL_SECONDS = 60 * 60 * 24 * 2; // เก็บไว้ 2 วัน ไม่ต้องมีคนมาล้างมือ

const historyKey = (chatId: number) => `tg:history:${chatId}`;
const providerKey = (chatId: number) => `tg:provider:${chatId}`;

export async function getHistory(env: Env, chatId: number): Promise<ChatMessage[]> {
  return (await getJSON<ChatMessage[]>(env.APP_KV, historyKey(chatId))) || [];
}

export async function appendTurn(env: Env, chatId: number, userMessage: string, assistantReply: string): Promise<void> {
  const history = await getHistory(env, chatId);
  history.push({ role: 'user', content: userMessage }, { role: 'assistant', content: assistantReply });
  await putJSON(env.APP_KV, historyKey(chatId), history.slice(-MAX_MESSAGES), { expirationTtl: TTL_SECONDS });
}

export async function clearHistory(env: Env, chatId: number): Promise<void> {
  await env.APP_KV.delete(historyKey(chatId));
}

export async function getPreferredProvider(env: Env, chatId: number): Promise<string | null> {
  return env.APP_KV.get(providerKey(chatId));
}

export async function setPreferredProvider(env: Env, chatId: number, provider: string): Promise<void> {
  await env.APP_KV.put(providerKey(chatId), provider, { expirationTtl: TTL_SECONDS });
}
