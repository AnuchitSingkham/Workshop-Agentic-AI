import type { ChatMessage, ChatTurnResult, McpTool, ToolCaller, ToolTraceEntry } from '../types';
import { toGeminiSchema } from '../tool-schema';

type GeminiPart = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: { name: string; response: unknown } };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> };

export async function runGeminiConversation(apiKey: string | undefined, model: string, messages: ChatMessage[], systemPrompt: string, tools: McpTool[] = [], callTool?: ToolCaller): Promise<ChatTurnResult> {
  if (!apiKey?.trim()) return { reply: 'ยังไม่ได้ตั้งค่า Gemini API key กรุณาตั้งค่า GEMINI_API_KEY ก่อนใช้งาน provider นี้', toolTrace: [] };
  const contents: Array<{ role: string; parts: GeminiPart[] }> = [
    { role: 'user', parts: [{ text: `${systemPrompt}\n\n${messages.map((m) => `${m.role}: ${m.content}`).join('\n')}` }] },
  ];
  const toolTrace: ToolTraceEntry[] = [];
  for (let round = 0; round < 4; round += 1) {
    const body: Record<string, unknown> = { contents, generationConfig: {} };
    if (tools.length) body.tools = [{ functionDeclarations: tools.map((tool) => ({ name: `${tool.serverId}__${tool.name}`, description: tool.description, parameters: toGeminiSchema(tool.inputSchema) })) }];
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) return { reply: `Gemini ตอบกลับด้วยข้อผิดพลาด (${response.status})`, toolTrace };
    const data = await response.json() as GeminiResponse;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const call = parts.find((part) => part.functionCall)?.functionCall;
    if (!call || !callTool) return { reply: parts.map((part) => part.text ?? '').join('') || 'โมเดลไม่ส่งข้อความตอบกลับ', toolTrace };
    const args = call.args ?? {};
    const result = await callTool(call.name, args);
    toolTrace.push({ name: call.name, arguments: args, result });
    contents.push({ role: 'model', parts }, { role: 'user', parts: [{ functionResponse: { name: call.name, response: result } }] });
  }
  return { reply: 'การเรียกเครื่องมือใช้จำนวนรอบสูงสุดแล้ว', toolTrace };
}