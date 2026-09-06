/**
 * Module 1.1 — POST /api/chat: จุดเดียวที่ทั้งหน้าเว็บ Chat (public/chat) และ Telegram (2.3) เรียกใช้
 *
 * ไฟล์นี้ถูก "อัปเกรด" ต่อโดยหลายโมดูล ไม่ได้เขียนจบในทีเดียวตอนทำ 1.1 — ดูว่าใครแตะตรงไหนบ้าง:
 *   - Module 1.1 (ตอนนี้): โครงหลักทั้งหมด + resolveApiKey()/resolveTools() แบบ baseline (ดูคอมเมนต์ในแต่ละฟังก์ชัน)
 *   - Module 1.2: แก้ resolveApiKey()/resolveBaseUrl() ให้เช็ค KV ก่อน env — ดู docs/module-1.2-key-settings.md
 *   - Module 1.3: แก้ resolveTools() ให้ดึง tools จาก MCP server ที่เปิดใช้งานอยู่ — ดู docs/module-1.3-mcp-client-settings.md
 *   - Module 2.3: เพิ่มฟังก์ชัน runChatTurn() ท้ายไฟล์ ให้ Telegram เรียก engine เดียวกันได้ — ดู docs/module-2.3-telegram.md
 *
 * รองรับ 3 provider: 'gemini' (Google ตรง ๆ), 'openai' (OpenAI ตรง ๆ, endpoint คงที่),
 * 'openai-compat' (gateway OpenAI-compatible แบบกำหนด base URL เอง ไม่ hardcode ในโค้ด) — ดู
 * src/module-1.1-chat/providers/gemini.ts, providers/openai-compat.ts, src/module-1.2-key-settings/keys-store.ts
 */
import { Env } from '../env';
import { errorJson, json, methodNotAllowed } from '../lib/http';
import { getEffectiveApiKey, getEffectiveBaseUrl } from '../module-1.2-key-settings/keys-store';
import { callTool as callMcpTool, listAvailableTools } from '../module-1.3-mcp-client-settings/registry';
import { ChatMessage, ChatProvider, ChatTurnResult, McpTool, ToolCaller } from './types';
import { runGeminiConversation } from './providers/gemini';
import { runOpenAiCompatConversation } from './providers/openai-compat';

const MAX_HISTORY = 16;
const VALID_PROVIDERS: ChatProvider[] = ['gemini', 'openai', 'openai-compat'];
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export async function handleChatRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed();

  let body: { message?: string; history?: unknown; provider?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return errorJson('body ต้องเป็น JSON');
  }

  const message = (body.message || '').trim();
  if (!message) return errorJson('message ห้ามว่าง');

  const provider = resolveProvider(body.provider, env);
  const model = body.model?.trim() || defaultModelFor(provider, env);

  const history = sanitizeHistory(body.history).slice(-MAX_HISTORY);
  history.push({ role: 'user', content: message });

  const [apiKey, baseUrl, { tools, callTool }] = await Promise.all([
    resolveApiKey(env, provider),
    resolveBaseUrl(env, provider),
    resolveTools(env),
  ]);
  const systemPrompt = buildSystemPrompt(tools.length > 0);

  try {
    const result = await runProvider(provider, { history, tools, apiKey: apiKey || '', baseUrl, model, systemPrompt, callTool });
    return json({ reply: result.reply, provider, model, toolTrace: result.toolTrace });
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : String(err), 502);
  }
}

/**
 * key ที่จะใช้เรียก provider จริง
 *
 * Module 1.1 (baseline — ตอนเพิ่งทำ 1.1 เสร็จ ควรมีแค่นี้):
 *   return provider === 'gemini' ? env.GEMINI_API_KEY : provider === 'openai' ? env.OPENAI_API_KEY : env.OPENAI_COMPAT_API_KEY;
 *
 * Module 1.2 (อัปเกรด — ปัจจุบัน): ให้ค่าที่ตั้งจากหน้า "ตั้งค่า Key" (เก็บใน KV) ชนะ env เสมอ
 * เปลี่ยนได้จากหน้าเว็บโดยไม่ต้อง deploy ใหม่ — โค้ดจริงอยู่ใน module-1.2-key-settings/keys-store.ts
 */
async function resolveApiKey(env: Env, provider: ChatProvider): Promise<string | undefined> {
  return getEffectiveApiKey(env, provider);
}

/** base URL ของ gateway — เฉพาะ 'openai-compat' เท่านั้นที่กำหนดเองได้ (KV ก่อน env), 'openai' คงที่, 'gemini' ไม่ใช้ */
async function resolveBaseUrl(env: Env, provider: ChatProvider): Promise<string | undefined> {
  if (provider === 'openai') return OPENAI_BASE_URL;
  if (provider === 'openai-compat') return getEffectiveBaseUrl(env);
  return undefined;
}

async function runProvider(
  provider: ChatProvider,
  params: { history: ChatMessage[]; tools: McpTool[]; apiKey: string; baseUrl?: string; model: string; systemPrompt: string; callTool: ToolCaller }
): Promise<ChatTurnResult> {
  if (provider === 'gemini') {
    return runGeminiConversation({
      history: params.history,
      tools: params.tools,
      apiKey: params.apiKey,
      model: params.model,
      systemPrompt: params.systemPrompt,
      callTool: params.callTool,
    });
  }
  return runOpenAiCompatConversation({
    history: params.history,
    tools: params.tools,
    apiKey: params.apiKey,
    baseUrl: params.baseUrl || '',
    model: params.model,
    systemPrompt: params.systemPrompt,
    callTool: params.callTool,
  });
}

/**
 * tools ที่จะแนบไปให้โมเดลเลือกเรียก + ฟังก์ชันไว้เรียก tool จริงเมื่อโมเดลร้องขอ
 *
 * Module 1.1 (baseline — ตอนเพิ่งทำ 1.1 เสร็จ ควรมีแค่นี้ ยังไม่มี MCP เลย):
 *   return { tools: [], callTool: async () => { throw new Error('Module 1.1 ยังไม่รองรับ MCP tools'); } };
 *
 * Module 1.3 (อัปเกรด — ปัจจุบัน): ดึงรายการ tools จาก MCP server ทุกตัวที่เปิดใช้งานอยู่ (ทั้งในตัวจาก
 * 2.1/2.2 และภายนอกที่ผู้ใช้เพิ่มเอง) แล้วผูก callTool ให้ dispatch กลับไปที่ server ที่ถูกต้อง — โค้ดจริงอยู่ใน
 * module-1.3-mcp-client-settings/registry.ts
 */
async function resolveTools(env: Env): Promise<{ tools: McpTool[]; callTool: ToolCaller }> {
  const tools = await listAvailableTools(env);
  const callTool: ToolCaller = (serverId, toolName, args) => callMcpTool(serverId, toolName, args, env);
  return { tools, callTool };
}

/**
 * Module 2.3 — เพิ่มฟังก์ชันนี้ตอนทำ Telegram: ให้ webhook.ts เรียก engine เดียวกับ handleChatRoute() ตรง ๆ
 * (ใช้ resolveApiKey()/resolveBaseUrl()/resolveTools() ชุดเดียวกันด้านบน) โดยไม่ต้องยิง HTTP self-fetch กลับเข้า worker ตัวเอง
 */
export async function runChatTurn(params: {
  env: Env;
  provider: ChatProvider;
  model?: string;
  history: ChatMessage[];
}): Promise<{ reply: string; toolTraceCount: number }> {
  const { env, history } = params;
  const provider = resolveProvider(params.provider, env);
  const model = params.model?.trim() || defaultModelFor(provider, env);

  const [apiKey, baseUrl, { tools, callTool }] = await Promise.all([
    resolveApiKey(env, provider),
    resolveBaseUrl(env, provider),
    resolveTools(env),
  ]);
  const systemPrompt = buildSystemPrompt(tools.length > 0);

  const result = await runProvider(provider, { history, tools, apiKey: apiKey || '', baseUrl, model, systemPrompt, callTool });
  return { reply: result.reply, toolTraceCount: result.toolTrace.length };
}

function resolveProvider(raw: string | undefined, env: Env): ChatProvider {
  if (VALID_PROVIDERS.includes(raw as ChatProvider)) return raw as ChatProvider;
  const fallback = env.DEFAULT_CHAT_PROVIDER;
  return VALID_PROVIDERS.includes(fallback as ChatProvider) ? (fallback as ChatProvider) : 'gemini';
}

function defaultModelFor(provider: ChatProvider, env: Env): string {
  if (provider === 'gemini') return env.GEMINI_MODEL || 'gemini-flash-latest';
  if (provider === 'openai') return env.OPENAI_MODEL || 'gpt-4o-mini';
  return env.OPENAI_COMPAT_MODEL || 'gpt-4o-mini';
}

function sanitizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m): m is ChatMessage => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content }));
}

function buildSystemPrompt(hasTools: boolean): string {
  const today = new Date().toLocaleDateString('th-TH-u-ca-gregory', { timeZone: 'Asia/Bangkok' });
  const base = `คุณเป็นผู้ช่วย AI ส่วนตัวชื่อ "AI Desk" ตอบเป็นภาษาไทย กระชับ เป็นกันเอง เข้าใจง่าย วันนี้คือ ${today} (เขตเวลา Asia/Bangkok)`;
  if (!hasTools) return base;
  return `${base} คุณมีเครื่องมือ (tools) ให้เรียกใช้ได้จริงเมื่อจำเป็น เช่น ดูเวลา คำนวณเลข หรือดู/สร้างนัดหมายใน Google Calendar — ให้เรียกเครื่องมือแทนการเดาคำตอบเองเมื่อคำถามต้องใช้ข้อมูลหรือการกระทำจริง`;
}
