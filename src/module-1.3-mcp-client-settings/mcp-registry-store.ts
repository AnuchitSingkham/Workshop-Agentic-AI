/** Module 1.3 (ครึ่ง settings) — รายชื่อ MCP server ที่ chat จะต่อด้วย เก็บใน Cloudflare KV */
import { Env } from '../env';
import { getJSON, putJSON } from '../lib/kv';
// import วนกลับไปหา registry.ts ได้ เพราะทั้งสองไฟล์ใช้ค่าของอีกฝั่งตอน "เรียกฟังก์ชัน" เท่านั้น
// ไม่มีใครอ่านค่าข้ามไฟล์ตอน evaluate ตัวโมดูล — วงจร import แบบนี้จึงปลอดภัย
import { BUILTIN_LABELS, BUILTIN_SERVERS } from './registry';

export interface McpServerEntry {
  id: string;
  name: string;
  description: string;
  /** ไม่มีถ้าเป็น builtin (เรียก in-process ผ่าน mcp/registry.ts ไม่ใช่ HTTP) */
  url?: string;
  enabled: boolean;
  builtin: boolean;
}

const KV_KEY = 'mcp:servers';

/**
 * รายชื่อ server ทั้งหมดที่ระบบรู้จัก = server ในตัว (จาก `BUILTIN_SERVERS` ในโค้ด) + server ภายนอกที่ผู้ใช้เพิ่มเอง
 * (จาก KV)
 *
 * **server ในตัวไม่เคยถูกอ่านจาก KV** — อ่านจากโค้ดใหม่ทุกครั้ง KV เก็บของมันแค่สถานะ `enabled` ที่ถูกสั่งเปิด/ปิด
 * เท่านั้น เหตุผล: พอ Module 2.1/2.2/5 เพิ่ม server ตัวใหม่เข้า `BUILTIN_SERVERS` มันต้องโผล่มาใช้งานได้ทันที
 * ไม่ใช่ต้องไปล้าง KV ก่อน (ซึ่งเป็นสิ่งที่เกิดขึ้นถ้า seed รายชื่อลง KV ตั้งแต่ครั้งแรกแบบเดิม)
 */
export async function listServers(env: Env): Promise<McpServerEntry[]> {
  const stored = (await getJSON<McpServerEntry[]>(env.APP_KV, KV_KEY)) ?? [];
  const storedById = new Map(stored.map((s) => [s.id, s]));

  const builtins: McpServerEntry[] = Object.keys(BUILTIN_SERVERS).map((id) => {
    const label = BUILTIN_LABELS[id] || {};
    const previous = storedById.get(id);
    return {
      id,
      name: label.name || BUILTIN_SERVERS[id].name,
      description: label.description || '',
      // ไม่เคยถูกสั่งอะไร = เปิดใช้งานไว้ก่อน (ให้เห็นผลทันทีตั้งแต่ deploy ครั้งแรก)
      enabled: previous ? previous.enabled : true,
      builtin: true,
    };
  });

  // server ในตัวที่ถูกถอดออกจากโค้ดไปแล้วจะหายไปเองตรงนี้ (ไม่ค้างเป็นรายการผีใน KV)
  const external = stored.filter((s) => !s.builtin && !BUILTIN_SERVERS[s.id]);

  return [...builtins, ...external];
}

export async function addServer(env: Env, entry: { name: string; url: string; description?: string }): Promise<McpServerEntry> {
  const servers = await listServers(env);
  const baseId = slugify(entry.name) || 'mcp-server';
  const id = servers.some((s) => s.id === baseId) ? `${baseId}-${Date.now().toString(36)}` : baseId;

  const newEntry: McpServerEntry = {
    id,
    name: entry.name,
    description: entry.description || '',
    url: entry.url,
    enabled: true,
    builtin: false,
  };
  servers.push(newEntry);
  await putJSON(env.APP_KV, KV_KEY, servers);
  return newEntry;
}

export async function setServerEnabled(env: Env, id: string, enabled: boolean): Promise<McpServerEntry[]> {
  const servers = await listServers(env);
  const idx = servers.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error(`ไม่พบ MCP server id "${id}"`);
  servers[idx] = { ...servers[idx], enabled };
  await putJSON(env.APP_KV, KV_KEY, servers);
  return servers;
}

export async function removeServer(env: Env, id: string): Promise<McpServerEntry[]> {
  const servers = await listServers(env);
  const target = servers.find((s) => s.id === id);
  if (!target) throw new Error(`ไม่พบ MCP server id "${id}"`);
  if (target.builtin) throw new Error('ลบ MCP server ที่มากับตัว worker ไม่ได้ — ปิดการใช้งาน (enabled=false) แทนได้');

  const next = servers.filter((s) => s.id !== id);
  await putJSON(env.APP_KV, KV_KEY, next);
  return next;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 40);
}
