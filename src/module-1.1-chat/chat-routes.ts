import type { Env } from '../env';
import { errorJson, json } from '../lib/http';
import type { ChatMessage, ChatProvider, ChatTurnResult, McpTool } from './types';
import { runGeminiConversation } from './providers/gemini';
import { runOpenAiCompatConversation } from './providers/openai-compat';

type ChatRequest = { message?: unknown; history?: unknown; provider?: unknown; model?: unknown };

export function buildSystemPrompt(): string {
  return 'คุณคือผู้ช่วย AI ภาษาไทย ตอบอย่างสุภาพ ชัดเจน และช่วยเหลือผู้ใช้ตามคำถาม หากไม่แน่ใจให้บอกตรง ๆ';
}

export function resolveProvider(value: unknown, env: Env): ChatProvider {
  const provider = value ?? env.DEFAULT_CHAT_PROVIDER;
  return provider === 'openai' || provider === 'openai-compat' ? provider : 'gemini';
}

export function defaultModelFor(provider: ChatProvider, env: Env): string {
  if (provider === 'openai') return env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  if (provider === 'openai-compat') return env.OPENAI_COMPAT_MODEL?.trim() || 'gpt-4o-mini';
  return env.GEMINI_MODEL?.trim() || 'gemini-flash-latest';
}

function validHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ChatMessage => typeof item === 'object' && item !== null && ((item as ChatMessage).role === 'user' || (item as ChatMessage).role === 'assistant') && typeof (item as ChatMessage).content === 'string').slice(-50);
}

export function resolveApiKey(provider: ChatProvider, env: Env): string | undefined {
  if (provider === 'gemini') return env.GEMINI_API_KEY;
  if (provider === 'openai') return env.OPENAI_API_KEY;
  return env.OPENAI_COMPAT_API_KEY;
}

export function resolveBaseUrl(provider: ChatProvider, env: Env): string | undefined {
  return provider === 'openai' ? 'https://api.openai.com/v1' : provider === 'openai-compat' ? env.OPENAI_COMPAT_BASE_URL : undefined;
}

export function resolveTools(): McpTool[] { return []; }

export async function runChatTurn(provider: ChatProvider, model: string, messages: ChatMessage[], env: Env): Promise<ChatTurnResult> {
  const tools = resolveTools();
  const key = resolveApiKey(provider, env);
  const prompt = buildSystemPrompt();
  if (provider === 'gemini') return runGeminiConversation(key, model, messages, prompt, tools);
  return runOpenAiCompatConversation(resolveBaseUrl(provider, env), key, model, messages, prompt, tools);
}

export async function handleChatRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return errorJson('รองรับเฉพาะ POST /api/chat', 405);
  let body: ChatRequest;
  try { body = await request.json() as ChatRequest; } catch { return errorJson('รูปแบบ JSON ไม่ถูกต้อง'); }
  if (typeof body.message !== 'string' || !body.message.trim()) return errorJson('กรุณาระบุ message เป็นข้อความที่ไม่ว่าง');
  const provider = resolveProvider(body.provider, env);
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : defaultModelFor(provider, env);
  const result = await runChatTurn(provider, model, [...validHistory(body.history), { role: 'user', content: body.message }], env);
  return json({ reply: result.reply, provider, model, toolTrace: result.toolTrace });
}