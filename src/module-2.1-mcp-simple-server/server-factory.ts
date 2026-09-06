/**
 * Module 2.1 (framework) — สร้าง MCP server แบบง่ายจากลิสต์ tools
 * ใช้ implement ทั้ง mcp/servers/utils-server.ts (2.1) และ mcp/servers/google-calendar-server.ts (2.2)
 *
 * เป็น Streamable HTTP แบบ "stateless" (ไม่มี session/resources/prompts) — พอสำหรับ MCP server ที่มีแค่ tools
 * แต่ยังพูด JSON-RPC 2.0 ตรงสเปก ต่อจาก MCP client จริงภายนอก (ไม่ใช่แค่ mcp/registry.ts ของ worker เราเอง) ได้
 *
 * ทุก request (รวม GET discovery) ต้องแนบ header `Authorization: Bearer <MCP_ACCESS_TOKEN>` — กัน MCP client
 * แปลกหน้ามาเรียก tools ของเราฟรี ๆ โดยไม่รู้ token (fail-closed ถ้ายังไม่ตั้ง secret นี้ เหมือน ADMIN_TOKEN)
 */
import { McpToolDefinition } from './types';
import { timingSafeEqual } from '../lib/auth';

const PROTOCOL_VERSION = '2025-03-26';

export interface McpToolSpec<TEnv> {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: Record<string, unknown>, env: TEnv) => Promise<unknown> | unknown;
}

export interface McpServerDefinition<TEnv> {
  name: string;
  version: string;
  tools: McpToolSpec<TEnv>[];
}

export interface McpServerHandle<TEnv> {
  name: string;
  /** ใช้ mount เป็น route ตรง ๆ (Fetch handler) ให้ MCP client ภายนอกต่อได้ */
  fetch: (request: Request, env: TEnv) => Promise<Response>;
  /** ใช้เรียกแบบ in-process จาก mcp/registry.ts (ไม่ต้องผ่าน HTTP หนึ่งรอบ) */
  callTool: (name: string, args: Record<string, unknown>, env: TEnv) => Promise<unknown>;
  listTools: () => McpToolDefinition[];
}

export function createMcpServer<TEnv extends { MCP_ACCESS_TOKEN?: string }>(
  def: McpServerDefinition<TEnv>
): McpServerHandle<TEnv> {
  function listTools(): McpToolDefinition[] {
    return def.tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
  }

  async function callTool(name: string, args: Record<string, unknown>, env: TEnv): Promise<unknown> {
    const tool = def.tools.find((t) => t.name === name);
    if (!tool) throw new Error(`ไม่รู้จักเครื่องมือชื่อ ${name}`);
    return tool.handler(args, env);
  }

  async function fetch(request: Request, env: TEnv): Promise<Response> {
    const authError = requireBearerToken(request, env);
    if (authError) return authError;

    if (request.method === 'GET') {
      return jsonResponse({ server: def.name, version: def.version, protocolVersion: PROTOCOL_VERSION, tools: listTools().map((t) => t.name) });
    }
    if (request.method !== 'POST') {
      return new Response('method not allowed — MCP server นี้รับเฉพาะ POST JSON-RPC', { status: 405 });
    }

    let rpc: any;
    try {
      rpc = await request.json();
    } catch {
      return jsonRpcError(null, -32700, 'Parse error — body ต้องเป็น JSON-RPC 2.0');
    }

    const hasId = rpc && typeof rpc === 'object' && Object.prototype.hasOwnProperty.call(rpc, 'id');
    const id = hasId ? rpc.id : null;
    const method = rpc?.method;
    const params = rpc?.params;

    // notification (ไม่มี id) — ตามสเปก MCP ต้องตอบแค่ 202 ไม่มี body ไม่ต้องประมวลผลอะไรต่อ
    if (!hasId) return new Response(null, { status: 202 });

    try {
      switch (method) {
        case 'initialize':
          return jsonRpcResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: def.name, version: def.version },
          });

        case 'ping':
          return jsonRpcResult(id, {});

        case 'tools/list':
          return jsonRpcResult(id, { tools: listTools() });

        case 'tools/call': {
          const toolName = params?.name;
          const args = params?.arguments || {};
          try {
            const result = await callTool(toolName, args, env);
            return jsonRpcResult(id, toToolCallResult(result));
          } catch (err) {
            // error ระดับ "เครื่องมือทำงานไม่สำเร็จ" ยังคงเป็น JSON-RPC success ตามสเปก MCP (isError:true ใน result)
            // ต่างจาก error ระดับ protocol (method ไม่รู้จัก ฯลฯ) ที่ใช้ jsonRpcError ด้านล่าง
            const message = err instanceof Error ? err.message : String(err);
            return jsonRpcResult(id, { content: [{ type: 'text', text: message }], isError: true });
          }
        }

        default:
          return jsonRpcError(id, -32601, `ไม่รู้จัก method: ${method}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonRpcError(id, -32603, message);
    }
  }

  return { name: def.name, fetch, callTool, listTools };
}

function requireBearerToken<TEnv extends { MCP_ACCESS_TOKEN?: string }>(request: Request, env: TEnv): Response | null {
  if (!env.MCP_ACCESS_TOKEN) {
    return jsonResponse(
      { jsonrpc: '2.0', error: { code: -32000, message: 'ยังไม่ได้ตั้งค่า MCP_ACCESS_TOKEN บน worker นี้ — รัน `wrangler secret put MCP_ACCESS_TOKEN` ก่อน (ดู SETUP.md)' } },
      503
    );
  }

  const header = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match?.[1];
  if (!provided || !timingSafeEqual(provided, env.MCP_ACCESS_TOKEN)) {
    return jsonResponse({ jsonrpc: '2.0', error: { code: -32001, message: 'ต้องใส่ header Authorization: Bearer <token> ที่ถูกต้อง' } }, 401);
  }

  return null;
}

function toToolCallResult(result: unknown) {
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  return { content: [{ type: 'text', text }] };
}

function jsonRpcResult(id: string | number | null, result: unknown): Response {
  return jsonResponse({ jsonrpc: '2.0', id, result });
}

function jsonRpcError(id: string | number | null, code: number, message: string): Response {
  return jsonResponse({ jsonrpc: '2.0', id, error: { code, message } });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
