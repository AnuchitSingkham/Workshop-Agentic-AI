/**
 * Module 1.3 — จุดต่อระหว่าง chat engine (1.1) กับ MCP server ทุกตัวที่เปิดใช้งานอยู่
 * รวม server ในตัว (2.1 utils, 2.2 google-calendar — เรียก in-process ไม่ผ่าน HTTP) กับ server ภายนอกที่ผู้ใช้
 * เพิ่มเองผ่านหน้า "ตั้งค่า MCP server" (เรียกผ่าน mcp/client.ts) ให้ chat มองเห็นเป็น "รายการ tools" เดียวกัน
 */
import { Env } from '../env';
import { McpTool } from '../module-1.1-chat/types';
import { listServers, McpServerEntry } from './mcp-registry-store';
import { callRemoteTool, fetchRemoteTools } from './client';
import { McpServerHandle } from '../module-2.1-mcp-simple-server/server-factory';
import { McpToolDefinition } from '../module-2.1-mcp-simple-server/types';
import { utilsServer } from '../module-2.1-mcp-simple-server/utils-server';
import { googleCalendarServer } from '../module-2.2-mcp-google-calendar/google-calendar-server';
import { textToSqlServer } from '../module-5-text-to-sql/text-to-sql-server';

/**
 * MCP server "ในตัว" ทั้งหมด — โมดูล 2.1/2.2/5 มาเพิ่มบรรทัดของตัวเองที่นี่ทีละอัน
 *
 * `mcp-registry-store.ts` อ่านตัวนี้ใหม่ทุกครั้งที่ `listServers()` ทำงาน (ไม่ได้ seed ลง KV) — server ที่เพิ่ม
 * เข้ามาทีหลังจึงโผล่ในหน้า /settings-mcp/ และใช้งานได้ทันที แม้ KV จะมีข้อมูลเก่าจากการ deploy ครั้งก่อนค้างอยู่
 */
export const BUILTIN_SERVERS: Record<string, McpServerHandle<Env>> = {
  utils: utilsServer,
  'google-calendar': googleCalendarServer,
  'text-to-sql': textToSqlServer,
};

/** ชื่อ/คำอธิบายที่โชว์ในหน้า /settings-mcp/ — ไม่ใส่ก็ได้ (fallback ไปใช้ชื่อของ MCP server เอง) */
export const BUILTIN_LABELS: Record<string, { name?: string; description?: string }> = {
  utils: {
    name: 'Utils (ในตัว)',
    description: 'เครื่องมือพื้นฐาน: ดูเวลา, คำนวณเลข, echo — ไม่ต้องตั้งค่าอะไรเลย',
  },
  'google-calendar': {
    name: 'Google Calendar (ในตัว)',
    description: 'ดู/สร้างนัดหมายใน Google Calendar — ต้องตั้งค่า Google OAuth ก่อน (ดู SETUP.md)',
  },
  'text-to-sql': {
    name: 'Text-to-SQL (ในตัว)',
    description:
      'ถามฐานข้อมูล MySQL ด้วยภาษาคน — ต้องตั้งค่า DB_HOST/DB_NAME/DB_USER/DB_PASSWORD ก่อน (ดู SETUP.md, Module 5)',
  },
};

export async function listAvailableTools(env: Env): Promise<McpTool[]> {
  const servers = await listServers(env);
  const enabled = servers.filter((s) => s.enabled);

  const perServer = await Promise.all(
    enabled.map(async (server): Promise<McpTool[]> => {
      try {
        if (server.builtin) {
          const handle = BUILTIN_SERVERS[server.id];
          return handle ? handle.listTools().map((t) => toMcpTool(server, t)) : [];
        }
        if (!server.url) return [];
        const tools = await fetchRemoteTools(server.url);
        return tools.map((t) => toMcpTool(server, t));
      } catch (err) {
        // server ตัวเดียวต่อไม่ติดไม่ควรทำให้ chat ทั้งแชทพัง — log ไว้แล้วข้ามไป
        console.error(`โหลด tools จาก MCP server "${server.name}" (${server.id}) ไม่สำเร็จ:`, err);
        return [];
      }
    })
  );

  return perServer.flat();
}

export async function callTool(serverId: string, toolName: string, args: Record<string, unknown>, env: Env): Promise<unknown> {
  const servers = await listServers(env);
  const server = servers.find((s) => s.id === serverId && s.enabled);
  if (!server) throw new Error(`ไม่พบหรือยังไม่เปิดใช้งาน MCP server (${serverId})`);

  if (server.builtin) {
    const handle = BUILTIN_SERVERS[server.id];
    if (!handle) throw new Error(`ไม่พบ MCP server ในตัวชื่อ ${server.id}`);
    return handle.callTool(toolName, args, env);
  }

  if (!server.url) throw new Error(`MCP server "${server.name}" ไม่มี url ให้เรียก`);
  return callRemoteTool(server.url, toolName, args);
}

function toMcpTool(server: McpServerEntry, t: McpToolDefinition): McpTool {
  return {
    serverId: server.id,
    serverName: server.name,
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  };
}
