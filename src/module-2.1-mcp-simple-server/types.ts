/** JSON-RPC 2.0 + MCP (Model Context Protocol) — เฉพาะส่วนที่ต้องใช้จริง (initialize/tools) ไม่ใช่ทั้งสเปก */

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, any>;
}

export interface McpContentBlock {
  type: 'text';
  text: string;
}

export interface McpToolCallResult {
  content: McpContentBlock[];
  isError?: boolean;
}
