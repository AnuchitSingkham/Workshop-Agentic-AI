/** Helper บาง ๆ คลุม KVNamespace ให้ทำงานกับ JSON ได้ตรง ๆ โดยไม่ต้อง JSON.parse/stringify มือทุกที่ */
export async function getJSON<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null; // ข้อมูลเสีย — ถือว่าไม่มีค่า แทนที่จะทำให้ทั้ง request พัง
  }
}

export async function putJSON(kv: KVNamespace, key: string, value: unknown, opts?: KVNamespacePutOptions): Promise<void> {
  await kv.put(key, JSON.stringify(value), opts);
}
