# Module 2.3 — คุยผ่าน Telegram

**ก่อนเริ่ม**: ทำ [Module 1.1](module-1.1-chat.md)–[1.3](module-1.3-mcp-client-settings.md) และ
[2.1](module-2.1-mcp-simple-server.md)–[2.2](module-2.2-mcp-google-calendar.md) ให้เสร็จก่อน (ใช้ของครบทุกอันที่
ทำมา) + ทำ [SETUP.md](../SETUP.md) ข้อ 6 (สร้างบอทผ่าน @BotFather)

## เป้าหมาย

ให้คุยกับผู้ช่วยตัวเดียวกัน (provider, MCP tools ทั้งหมดจาก Module 1.1–2.2) ผ่าน Telegram ได้ ไม่ใช่แค่หน้าเว็บ —
ต่างจากหน้าเว็บตรงที่ Telegram ไม่มี state ฝั่ง browser คอยเก็บ history ให้ เลยต้องเก็บความจำแชทสั้น ๆ ต่อ chat
ไว้ใน KV เอง (ตัวเดียวกับที่ Module 1.2/1.3 ใช้)

## ไฟล์ที่สร้างใหม่ในโมดูลนี้

| ไฟล์ | หน้าที่ |
|---|---|
| [`src/module-2.3-telegram/webhook.ts`](../src/module-2.3-telegram/webhook.ts) | `POST /telegram/webhook` — รับข้อความ, จัดการคำสั่งลัด, เรียก `runChatTurn()` |
| [`src/module-2.3-telegram/telegram-client.ts`](../src/module-2.3-telegram/telegram-client.ts) | ส่งข้อความออก Telegram (`sendMessage`) |
| [`src/module-2.3-telegram/history-store.ts`](../src/module-2.3-telegram/history-store.ts) | เก็บ history ล่าสุด (สูงสุด 20 ข้อความ, TTL 2 วัน) และ provider ที่เลือกไว้ ต่อ `chatId` ใน KV |

## แก้ไฟล์เดิม (อัปเกรดจาก Module 1.1)

**1. [`src/module-1.1-chat/chat-routes.ts`](../src/module-1.1-chat/chat-routes.ts)** — เพิ่มฟังก์ชันใหม่ต่อท้าย
ไฟล์ (ไม่ได้แก้โค้ดเดิมที่มีอยู่ แค่เพิ่มเข้าไป) ให้ webhook.ts เรียก chat engine เดียวกับหน้าเว็บได้ตรง ๆ โดยไม่ต้อง
ยิง HTTP self-fetch กลับเข้า worker ตัวเอง — ใช้ `resolveApiKey()`/`resolveTools()` ชุดเดียวกับ `handleChatRoute()`
เลย จึงได้ KV key override (1.2) และ MCP tools (1.3) มาฟรีโดยไม่ต้องเขียนซ้ำ:

```ts
export async function runChatTurn(params: {
  env: Env;
  provider: ChatProvider;
  model?: string;
  history: ChatMessage[];
}): Promise<{ reply: string; toolTraceCount: number }> {
  const { env, history } = params;
  const provider = resolveProvider(params.provider, env);
  const model = params.model?.trim() || defaultModelFor(provider, env);

  const [apiKey, baseUrl, { tools, callTool }] = await Promise.all([
    resolveApiKey(env, provider),
    resolveBaseUrl(env, provider),
    resolveTools(env),
  ]);
  const systemPrompt = buildSystemPrompt(tools.length > 0);

  const result = await runProvider(provider, { history, tools, apiKey: apiKey || '', baseUrl, model, systemPrompt, callTool });

  return { reply: result.reply, toolTraceCount: result.toolTrace.length };
}
```

**2. [`src/router.ts`](../src/router.ts)** — เพิ่ม route ใหม่:

```ts
import { handleTelegramWebhook } from './module-2.3-telegram/webhook';
// ...
if (pathname === '/telegram/webhook') return handleTelegramWebhook(request, env);
```

## คำสั่งที่บอทรองรับ

- ข้อความปกติ — เข้า chat engine ตรง ๆ (ใช้ MCP tools ที่เปิดอยู่ได้เหมือนหน้าเว็บ)
- `/start`, `/help` — คำแนะนำการใช้งาน
- `/provider gemini`, `/provider openai`, `/provider openai-compat` — สลับ provider เฉพาะ chat นี้ (จำไว้ใน KV)
- `/reset` — ล้างความจำแชทของ chat นี้

## ตั้งค่า + ทดสอบ

ดู [SETUP.md](../SETUP.md) ข้อ 6 (สร้างบอทผ่าน @BotFather, ตั้ง secret, ผูก webhook) จากนั้นเปิดแชทกับบอทใน
Telegram แล้วลอง `/start`

**checkpoint (จบทั้ง 6 module)**: ลองถามบอทใน Telegram แบบเดียวกับที่ถามในหน้า `/chat/` เช่น "ตอนนี้กี่โมงแล้ว" —
ควรได้คำตอบเหมือนกัน เพราะใช้ chat engine, key, และ MCP tools ชุดเดียวกันทั้งหมด นี่คือจุดที่ระบบครบทั้ง 6 module
แล้วจริง ๆ

## ต่อยอด

- อยากให้ทุก chat ใช้ provider เดียวกันเสมอ (ไม่ให้สลับเอง): ลบส่วน `/provider` command ออกจาก
  `webhook.ts` แล้วใช้ `env.DEFAULT_CHAT_PROVIDER` ตรง ๆ
- อยากรองรับ group chat แบบแยกสิทธิ์/แยกความจำต่อผู้ใช้ในกลุ่ม (ไม่ใช่ต่อ chat): ต้องเปลี่ยน key ใน
  `history-store.ts` จาก `chatId` เป็น `${chatId}:${userId}` และปรับ logic การอ่าน `update.message.from.id`
