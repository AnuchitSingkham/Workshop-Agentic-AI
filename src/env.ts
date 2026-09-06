/**
 * รายการ binding/secret/var ทั้งหมดที่ worker นี้ใช้ — ดู SETUP.md สำหรับวิธีตั้งค่าแต่ละตัว
 * ทุกตัวเป็น optional ในระดับ type เพราะ worker ต้องรันได้แม้ตั้งค่าไม่ครบ (แค่ฟีเจอร์ที่ต้องใช้ค่านั้นจะปิดตัวเองแบบ
 * fail-closed พร้อมข้อความอธิบาย แทนที่จะ throw แบบเข้าใจยาก)
 */
export interface Env {
  // --- bindings (ตั้งใน wrangler.toml, ไม่ใช่ secret) ---
  APP_KV: KVNamespace;
  ASSETS: Fetcher;

  // --- non-secret config (ตั้งใน [vars] ของ wrangler.toml) ---
  // ค่า default ตอน deploy — เปลี่ยนได้จากหน้า "ตั้งค่า Key" โดยไม่ต้อง deploy ใหม่ (ดู module-1.2-key-settings/keys-store.ts)
  GEMINI_MODEL?: string;
  OPENAI_MODEL?: string;
  OPENAI_COMPAT_BASE_URL?: string;
  OPENAI_COMPAT_MODEL?: string;
  DEFAULT_CHAT_PROVIDER?: string;

  // --- secrets (ตั้งผ่าน `wrangler secret put` เท่านั้น) ---
  ADMIN_TOKEN?: string;

  // รหัสผ่านเข้าเว็บทั้งเว็บ (หน้า Chat/settings) — คนละตัวกับ ADMIN_TOKEN (นั่นคือ token เฉพาะหน้า settings)
  // ดู src/lib/site-session.ts
  CLASS_PASSWORD?: string;

  // token ที่ MCP client ภายนอก (n8n, Claude ฯลฯ) ต้องส่งมาใน header `Authorization: Bearer <token>`
  // เพื่อเรียก /mcp/* — ดู src/module-2.1-mcp-simple-server/server-factory.ts
  MCP_ACCESS_TOKEN?: string;

  // Module 1.1 — key ของแต่ละ provider (มีอะไรตั้งอันนั้น เลือกได้จากหน้าเว็บ/`provider` ใน request)
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  // key ของ OpenAI-compatible gateway แบบกำหนดเอง (เช่น Replace base url) — base URL ตั้งเป็น
  // var/KV ไม่ใช่ secret เพราะไม่ใช่ความลับ (ดู OPENAI_COMPAT_BASE_URL ด้านบน)
  OPENAI_COMPAT_API_KEY?: string;

  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;

  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;

  // Module 5 — DB_PORT ไม่ใช่ secret จริง ๆ แต่ตั้งเป็น secret ไปด้วยเพื่อความง่าย (ตั้งทีเดียวจบชุดเดียวกัน)
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
}
