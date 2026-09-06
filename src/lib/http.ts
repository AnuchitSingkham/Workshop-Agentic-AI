/** Response helper เล็ก ๆ ที่ใช้ซ้ำได้ทุก route — คืน JSON เสมอ พร้อม header มาตรฐาน */
export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) },
  });
}

export function errorJson(message: string, status = 400, extra?: Record<string, unknown>): Response {
  return json({ error: message, ...extra }, { status });
}

export function methodNotAllowed(): Response {
  return errorJson('method not allowed', 405);
}

export function notFound(): Response {
  return errorJson('not found', 404);
}
