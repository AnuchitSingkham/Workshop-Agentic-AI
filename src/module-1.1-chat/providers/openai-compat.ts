/**
 * Provider: OpenAI-compatible chat completions — ใช้ได้กับ endpoint ใดก็ได้ที่พูดภาษาเดียวกับ OpenAI
 * `chat/completions` ไฟล์นี้ใช้ร่วมกัน 2 provider: 'openai' (baseUrl คงที่ `https://api.openai.com/v1` ส่งมาจาก
 * chat-routes.ts) และ 'openai-compat' (gateway/endpoint กำหนดเอง เช่น OpenRouter, Azure OpenAI, self-host อย่าง
 * vLLM/Ollama, หรือ gateway ของหน่วยงาน เช่น Replace base url — `baseUrl` ไม่ hardcode ในไฟล์นี้
 * ตั้งได้จากหน้า "ตั้งค่า Key" หรือ env `OPENAI_COMPAT_BASE_URL` ดู module-1.2-key-settings/keys-store.ts)
 */
import { ChatMessage, ChatTurnResult, McpTool, ToolCaller, toolFunctionName } from '../types';

const MAX_TOOL_ITERATIONS = 4;

interface OaToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
interface OaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: OaToolCall[];
  tool_call_id?: string;
}

export async function runOpenAiCompatConversation(params: {
  history: ChatMessage[];
  tools: McpTool[];
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  callTool: ToolCaller;
}): Promise<ChatTurnResult> {
  const { history, tools, apiKey, baseUrl, model, systemPrompt, callTool } = params;

  if (!baseUrl) {
    return {
      reply: 'ยังไม่ได้ตั้งค่า base URL ของ AI gateway — ไปที่หน้า "ตั้งค่า Key" เพื่อกรอก URL (เช่น Replace base url) หรือให้แอดมินตั้ง OPENAI_COMPAT_BASE_URL (ดู SETUP.md)',
      toolTrace: [],
    };
  }
  if (!apiKey) {
    return {
      reply: 'ยังไม่ได้ตั้งค่า API key ของ provider นี้ — ไปที่หน้า "ตั้งค่า Key" เพื่อใส่ key ของตัวเอง หรือให้แอดมินตั้ง secret ที่เกี่ยวข้อง (OPENAI_API_KEY หรือ OPENAI_COMPAT_API_KEY แล้วแต่ provider — ดู SETUP.md)',
      toolTrace: [],
    };
  }

  const messages: OaMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content }) as OaMessage),
  ];

  const oaTools = tools.length
    ? tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: toolFunctionName(t),
          description: t.description || '',
          parameters: t.inputSchema && Object.keys(t.inputSchema).length ? t.inputSchema : { type: 'object', properties: {} },
        },
      }))
    : undefined;

  const toolTrace: ChatTurnResult['toolTrace'] = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const data = await callChatCompletions({ messages, tools: oaTools, apiKey, baseUrl, model });
    const message = data?.choices?.[0]?.message;

    if (message?.tool_calls?.length) {
      messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls });

      for (const call of message.tool_calls as OaToolCall[]) {
        const fnName = call.function?.name || '';
        const tool = tools.find((t) => toolFunctionName(t) === fnName);
        let args: Record<string, unknown> = {};
        try {
          args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          // arguments parse ไม่ได้ — ปล่อยเป็น object ว่าง แทนที่จะทำให้ทั้ง turn พัง
        }

        let result: unknown;
        try {
          result = tool ? await callTool(tool.serverId, tool.name, args) : { error: `ไม่รู้จักเครื่องมือชื่อ ${fnName}` };
        } catch (err) {
          result = { error: err instanceof Error ? err.message : String(err) };
        }
        toolTrace.push({ name: fnName, args, result });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }

    return { reply: message?.content || 'ขอโทษครับ ตอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง', toolTrace };
  }

  return { reply: 'ขอโทษครับ ใช้เครื่องมือหลายขั้นตอนเกินไป ลองถามใหม่แบบสั้นลงนะครับ', toolTrace };
}

async function callChatCompletions(params: {
  messages: OaMessage[];
  tools: any[] | undefined;
  apiKey: string;
  baseUrl: string;
  model: string;
}): Promise<any> {
  const { messages, tools, apiKey, baseUrl, model } = params;
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, ...(tools ? { tools, tool_choice: 'auto' } : {}) }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `เรียก AI gateway ไม่สำเร็จ (HTTP ${res.status}) — เช็ค base URL / API key / model${errText ? `: ${errText.slice(0, 300)}` : ''}`
    );
  }
  return res.json();
}
