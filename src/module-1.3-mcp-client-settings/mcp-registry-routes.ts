import { Env } from '../env';
import { requireAdminToken } from '../lib/auth';
import { errorJson, json, methodNotAllowed, notFound } from '../lib/http';
import { addServer, listServers, removeServer, setServerEnabled } from './mcp-registry-store';

/**
 * /api/settings/mcp-servers            GET (list) / POST (add external server)
 * /api/settings/mcp-servers/:id        DELETE (remove, external only)
 * /api/settings/mcp-servers/:id/toggle POST { enabled: boolean }
 * ทุกเมธอดต้องมี header X-Admin-Token ที่ถูกต้อง (ดู lib/auth.ts)
 */
export async function handleMcpServersRoute(request: Request, env: Env, pathAfterPrefix: string): Promise<Response> {
  const authError = requireAdminToken(request, env);
  if (authError) return authError;

  const segments = pathAfterPrefix.split('/').filter(Boolean); // '' | ':id' | ':id/toggle'

  if (segments.length === 0) {
    if (request.method === 'GET') {
      const servers = await listServers(env);
      return json({ servers });
    }
    if (request.method === 'POST') {
      let body: { name?: string; url?: string; description?: string };
      try {
        body = await request.json();
      } catch {
        return errorJson('body ต้องเป็น JSON');
      }
      if (!body.name || !body.name.trim()) return errorJson('name ห้ามว่าง');
      if (!body.url || !/^https?:\/\//.test(body.url)) return errorJson('url ต้องขึ้นต้นด้วย http:// หรือ https://');

      try {
        const entry = await addServer(env, { name: body.name.trim(), url: body.url.trim(), description: body.description?.trim() });
        return json({ ok: true, server: entry });
      } catch (err) {
        return errorJson(err instanceof Error ? err.message : String(err));
      }
    }
    return methodNotAllowed();
  }

  const id = decodeURIComponent(segments[0]);

  if (segments.length === 1 && request.method === 'DELETE') {
    try {
      const servers = await removeServer(env, id);
      return json({ ok: true, servers });
    } catch (err) {
      return errorJson(err instanceof Error ? err.message : String(err), 400);
    }
  }

  if (segments.length === 2 && segments[1] === 'toggle' && request.method === 'POST') {
    let body: { enabled?: boolean };
    try {
      body = await request.json();
    } catch {
      return errorJson('body ต้องเป็น JSON');
    }
    if (typeof body.enabled !== 'boolean') return errorJson('ต้องระบุ enabled เป็น true/false');

    try {
      const servers = await setServerEnabled(env, id, body.enabled);
      return json({ ok: true, servers });
    } catch (err) {
      return errorJson(err instanceof Error ? err.message : String(err), 400);
    }
  }

  return notFound();
}
