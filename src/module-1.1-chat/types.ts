export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type JsonSchema = Record<string, any>;

/** เครื่องมือหนึ่งตัวที่ดึงมาจาก MCP server ตัวใดตัวหนึ่ง (ผ่าน tools/list) — serverId ใช้ตอน dispatch tools/call กลับ */
export interface McpTool {
  serverId: string;
  serverName: string;
  name: string;
  description?: string;
  inputSchema: JsonSchema;
}

export interface ToolTraceEntry {
  name: string;
  args: unknown;
  result: unknown;
}

export interface ChatTurnResult {
  reply: string;
  toolTrace: ToolTraceEntry[];
}

/** ฟังก์ชันที่ provider เรียกกลับเมื่อโมเดลอยากใช้เครื่องมือ — ให้ chat-routes.ts ผูกกับ module-1.3-mcp-client-settings/registry.ts (ดู resolveTools() ใน chat-routes.ts) */
export type ToolCaller = (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>;

/** 'openai' = OpenAI ตรง ๆ (api.openai.com), 'openai-compat' = OpenAI-compatible gateway แบบกำหนด base URL เอง */
export type ChatProvider = 'gemini' | 'openai' | 'openai-compat';

/**
 * ชื่อ tool เดียวกันอาจซ้ำกันได้ระหว่าง MCP server ต่างตัว (เช่น server ของผู้ใช้เองก็มี tool ชื่อ "list_events")
 * เลยต้องกันชนด้วย prefix serverId — ใช้ "__" (double underscore) เป็นตัวคั่นเสมอ ดังนั้น serverId และชื่อ tool
 * ห้ามมี "__" อยู่ในตัวเอง (serverId ที่ระบบสร้างให้ใช้ตัวอักษร/ตัวเลข/ขีดกลางเท่านั้น ดู module-1.3-mcp-client-settings/registry.ts)
 */
export function toolFunctionName(tool: McpTool): string {
  return `${tool.serverId}__${tool.name}`;
}
