import type { ChatMessage, ChatTurnResult, McpTool, ToolCaller, ToolTraceEntry } from '../types';

type OpenAiResponse = { choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ function: { name: string; arguments: string } }> } }> };

export async function runOpenAiCompatConversation(baseUrl: string | undefined, apiKey: string | undefined, model: string, messages: ChatMessage[], systemPrompt: string, tools: McpTool[] = [], callTool?: ToolCaller): Promise<ChatTurnResult> {
  if (!baseUrl?.trim()) return { reply: 'ยังไม่ได้ตั้งค่า base URL ของ gateway กรุณาตั้งค่า OPENAI_COMPAT_BASE_URL ก่อนใช้งาน provider นี้', toolTrace: [] };
  if (!apiKey?.trim()) return { reply: 'ยังไม่ได้ตั้งค่า API key กรุณาตั้งค่า OPENAI_COMPAT_API_KEY ก่อนใช้งาน provider นี้', toolTrace: [] };
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const apiMessages: Array<Record<string, unknown>> = [{ role: 'system', content: systemPrompt }, ...messages.map((message) => ({ role: message.role, content: message.content }))];
  const trace: ToolTraceEntry[] = [];
  for (let round = 0; round < 4; round += 1) {
    const body: Record<string, unknown> = { model, messages: apiMessages };
    if (tools.length) { body.tools = tools.map((tool) => ({ type: 'function', function: { name: `${tool.serverId}__${tool.name}`, description: tool.description, parameters: tool.inputSchema } })); body.tool_choice = 'auto'; }
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
    if (!response.ok) return { reply: `AI gateway ตอบกลับด้วยข้อผิดพลาด (${response.status})`, toolTrace: trace };
    const message = (await response.json() as OpenAiResponse).choices?.[0]?.message;
    const call = message?.tool_calls?.[0];
    if (!call || !callTool) return { reply: message?.content ?? 'โมเดลไม่ส่งข้อความตอบกลับ', toolTrace: trace };
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(call.function.arguments) as Record<string, unknown>; } catch { return { reply: 'โมเดลส่ง arguments ของเครื่องมือไม่ถูกต้อง', toolTrace: trace }; }
    const result = await callTool(call.function.name, args);
    trace.push({ name: call.function.name, arguments: args, result });
    apiMessages.push({ role: 'assistant', content: message.content, tool_calls: message.tool_calls }, { role: 'tool', tool_call_id: call.function.name, content: JSON.stringify(result) });
  }
  return { reply: 'การเรียกเครื่องมือใช้จำนวนรอบสูงสุดแล้ว', toolTrace: trace };
}