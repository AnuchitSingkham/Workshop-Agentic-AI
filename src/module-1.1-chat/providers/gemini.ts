/**
 * Provider: Google Gemini — เรียก generateContent พร้อม function calling
 * ดูคู่ที่ทำแบบเดียวกันสำหรับ OpenAI/OpenAI-compatible ใน ./openai-compat.ts (โครงเดียวกัน ต่างแค่ wire format)
 */
import { ChatMessage, ChatTurnResult, McpTool, ToolCaller, toolFunctionName } from '../types';
import { toGeminiSchema } from '../tool-schema';

const MAX_TOOL_ITERATIONS = 4;

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: { content: unknown } };
}
interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

export async function runGeminiConversation(params: {
  history: ChatMessage[];
  tools: McpTool[];
  apiKey: string;
  model: string;
  systemPrompt: string;
  callTool: ToolCaller;
}): Promise<ChatTurnResult> {
  const { history, tools, apiKey, model, systemPrompt, callTool } = params;

  if (!apiKey) {
    return {
      reply: 'ยังไม่ได้ตั้งค่า Gemini API key — ไปที่หน้า "ตั้งค่า Key" เพื่อใส่ key ของตัวเอง หรือให้แอดมินตั้ง GEMINI_API_KEY (ดู SETUP.md)',
      toolTrace: [],
    };
  }

  const contents: GeminiContent[] = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const geminiTools = tools.length
    ? [
        {
          functionDeclarations: tools.map((t) => ({
            name: toolFunctionName(t),
            description: t.description || '',
            parameters: toGeminiSchema(t.inputSchema),
          })),
        },
      ]
    : undefined;

  const toolTrace: ChatTurnResult['toolTrace'] = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await callGenerateContent({ contents, tools: geminiTools, systemPrompt, apiKey, model });
    const candidateContent: GeminiContent | undefined = response?.candidates?.[0]?.content;
    const part = candidateContent?.parts?.[0];

    if (part?.functionCall) {
      const call = part.functionCall;
      const tool = tools.find((t) => toolFunctionName(t) === call.name);
      const args = call.args || {};

      let result: unknown;
      try {
        result = tool ? await callTool(tool.serverId, tool.name, args) : { error: `ไม่รู้จักเครื่องมือชื่อ ${call.name}` };
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      toolTrace.push({ name: call.name, args, result });

      // ผูกทั้ง function call ของโมเดลและผลลัพธ์ที่รันจริงกลับเข้า history เพื่อให้ Gemini สรุปคำตอบสุดท้ายรอบถัดไป
      contents.push(candidateContent!);
      contents.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: { content: result } } }] });
      continue;
    }

    return { reply: part?.text || 'ขอโทษครับ ตอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง', toolTrace };
  }

  return { reply: 'ขอโทษครับ ใช้เครื่องมือหลายขั้นตอนเกินไป ลองถามใหม่แบบสั้นลงนะครับ', toolTrace };
}

async function callGenerateContent(params: {
  contents: GeminiContent[];
  tools: any[] | undefined;
  systemPrompt: string;
  apiKey: string;
  model: string;
}): Promise<any> {
  const { contents, tools, systemPrompt, apiKey, model } = params;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const body: Record<string, unknown> = {
    contents,
    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
  };
  if (tools) body.tools = tools;

  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API เรียกไม่สำเร็จ (HTTP ${res.status}) — เช็ค GEMINI_API_KEY / model${errText ? `: ${errText.slice(0, 300)}` : ''}`);
  }
  return res.json();
}
