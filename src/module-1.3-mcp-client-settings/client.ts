/**
 * Module 1.3 (ครึ่ง client) — เรียก MCP server ภายนอกที่ผู้ใช้เพิ่มเองผ่านหน้า "ตั้งค่า MCP server"
 * ทำ handshake แบบง่าย: initialize แล้วค่อย tools/list หรือ tools/call ทุกครั้ง (ไม่ persist session ข้าม
 * request ของผู้ใช้จริง — Worker เป็น stateless อยู่แล้ว) รองรับทั้ง response แบบ JSON ตรง ๆ และแบบ SSE
 * (text/event-stream) ตามที่สเปก Streamable HTTP อนุญาตให้ server เลือกได้
 */
import { McpToolDefinition } from '../module-2.1-mcp-simple-server/types';

const CLIENT_INFO = { name: 'ai-desk-worker', version: '0.1.0' };
const PROTOCOL_VERSION = '2025-03-26';

let requestCounter = 1;

interface RpcOutcome {
  result?: any;
  error?: { code: number; message: string };
  sessionId?: string;
}

async function rpcCall(url: string, method: string, params: unknown, sessionId?: string): Promise<RpcOutcome> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: requestCounter++, method, params }),
  });

  if (!res.ok) {
    throw new Error(`MCP server (${url}) ตอบกลับ HTTP ${res.status}`);
  }

  const returnedSessionId = res.headers.get('Mcp-Session-Id') || undefined;
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('text/event-stream') ? await parseSseJsonRpc(res) : await res.json();

  if (body?.error) return { error: body.error, sessionId: returnedSessionId };
  return { result: body?.result, sessionId: returnedSessionId };
}

async function parseSseJsonRpc(res: Response): Promise<any> {
  const text = await res.text();
  const dataLines: string[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    } else if (line.trim() === '' && dataLines.length) {
      break; // จบ event แรกที่เจอ — พอสำหรับ request/response แบบง่าย ไม่ต้องรอ stream ยาว ๆ
    }
  }
  if (!dataLines.length) throw new Error('อ่านผลตอบกลับแบบ SSE จาก MCP server ไม่สำเร็จ (ไม่พบบรรทัด data:)');
  return JSON.parse(dataLines.join('\n'));
}

async function handshake(url: string): Promise<string | undefined> {
  const init = await rpcCall(
    url,
    'initialize',
    { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO }
  );
  if (init.error) throw new Error(`เชื่อมต่อ MCP server ไม่สำเร็จ: ${init.error.message}`);
  return init.sessionId;
}

export async function fetchRemoteTools(url: string): Promise<McpToolDefinition[]> {
  const sessionId = await handshake(url);
  const list = await rpcCall(url, 'tools/list', {}, sessionId);
  if (list.error) throw new Error(`ขอรายการเครื่องมือจาก MCP server ไม่สำเร็จ: ${list.error.message}`);
  return list.result?.tools || [];
}

export async function callRemoteTool(url: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  const sessionId = await handshake(url);
  const call = await rpcCall(url, 'tools/call', { name, arguments: args }, sessionId);
  if (call.error) throw new Error(`เรียกเครื่องมือ "${name}" ไม่สำเร็จ: ${call.error.message}`);

  const content = call.result?.content;
  if (Array.isArray(content)) {
    const text = content
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c.text)
      .join('\n');
    if (call.result?.isError) throw new Error(text || `เครื่องมือ "${name}" รายงาน error โดยไม่มีรายละเอียด`);
    return text;
  }
  return call.result;
}
