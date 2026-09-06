# Spec — Module 2.3: คุยผ่าน Telegram

> ไฟล์นี้เขียนให้ AI coding agent อ่านแล้วลงมือสร้าง/แก้ไฟล์ได้เลย (ดูวิธีสั่ง agent ใน README.md หัวข้อ "vibecode ด้วย AI coding agent")
> อยากอ่านคำอธิบายละเอียดกว่านี้ ดู [module-2.3-telegram.md](module-2.3-telegram.md)

## บริบท

โมดูลสุดท้าย (ก่อน Module 5 ที่เป็นของเสริม) — ให้คุยกับผู้ช่วยตัวเดียวกัน (provider + MCP tools ทั้งหมดจาก
module 1.1–2.2) ผ่าน Telegram ได้ ไม่ใช่แค่หน้าเว็บ ต่างจากหน้าเว็บตรงที่ Telegram ไม่มี state ฝั่ง browser คอย
เก็บ history ให้ เลยต้องเก็บความจำแชทสั้น ๆ + provider ที่เลือกไว้ ต่อ chat ไว้ใน KV เอง

## Prerequisites

- ทำ [Module 1.1](module-1.1-chat.md)–[1.3](module-1.3-mcp-client-settings.md) และ
  [2.1](module-2.1-mcp-simple-server.md)–[2.2](module-2.2-mcp-google-calendar.md) ให้เสร็จก่อน (ใช้ของครบทุกอัน
  ที่ทำมา)
- ทำ [SETUP.md](../SETUP.md) หัวข้อ "Module 2.3 เพิ่มเติม" (สร้างบอทผ่าน @BotFather ได้ `TELEGRAM_BOT_TOKEN`
  แล้ว, ตั้ง secret `TELEGRAM_WEBHOOK_SECRET` ด้วย)

## ไฟล์ที่ต้องสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/module-2.3-telegram/telegram-client.ts` | `sendTelegramMessage(chatId, text, env)` — เรียก Telegram Bot API `sendMessage` |
| `src/module-2.3-telegram/history-store.ts` | `getHistory(env, chatId)`/`appendTurn(env, chatId, userMsg, reply)`/`clearHistory(env, chatId)` — เก็บ history ล่าสุด (สูงสุด 20 ข้อความ, TTL 2 วัน) ต่อ `chatId` ใน KV คีย์ `tg:history:<chatId>`, `getPreferredProvider(env, chatId)`/`setPreferredProvider(env, chatId, provider)` เก็บ provider ที่เลือกไว้ต่อ chat ใน KV คีย์ `tg:provider:<chatId>` |
| `src/module-2.3-telegram/webhook.ts` | `handleTelegramWebhook(request, env)` — `POST /telegram/webhook`: ตรวจ header secret ของ Telegram ก่อน (`X-Telegram-Bot-Api-Secret-Token` เทียบ `env.TELEGRAM_WEBHOOK_SECRET`), parse update, จัดการคำสั่ง `/start`/`/help`/`/reset`/`/provider gemini\|openai\|openai-compat`, ข้อความปกติ → เรียก `runChatTurn()` จาก `chat-routes.ts` พร้อม provider ที่จำไว้และ history จาก KV แล้วตอบกลับผ่าน Telegram — **ต้องตอบ 200 กลับ Telegram เสมอ** แม้ error ข้างในเพื่อกัน Telegram retry รัว ๆ |

## แก้ไฟล์เดิม

**`src/router.ts`** — เพิ่มแค่ 1 route:
`if (pathname === '/telegram/webhook') return handleTelegramWebhook(request, env);`
(พร้อม import) — ไม่แตะไฟล์อื่นเลย, ไม่ต้องแก้ `chat-routes.ts` เพราะ `runChatTurn()` มีอยู่แล้วตั้งแต่ module 1.1

## ข้อกำหนดสำคัญ

1. ถ้าไม่ตั้ง `TELEGRAM_WEBHOOK_SECRET` เลย ให้ใช้ได้ (ไม่ fail-closed) แต่เตือนว่าไม่แนะนำสำหรับใช้งานจริงจัง —
   ต่างจาก `MCP_ACCESS_TOKEN`/`ADMIN_TOKEN` ที่ fail-closed แบบเข้ม
2. `handleTelegramWebhook()` ต้อง catch error ทุกจุดแล้วตอบ `200 ok` เสมอ (ไม่ใช่ 500) — Telegram จะ retry ซ้ำ ๆ
   ถ้าไม่ได้ 200 ทำให้ผู้ใช้ได้รับข้อความซ้ำ
3. คำสั่ง `/reset` ต้องล้างเฉพาะ history ของ `chatId` นั้น ไม่กระทบ chat อื่น
4. คำสั่ง `/provider <ชื่อ>` ต้องรับเฉพาะ `gemini`/`openai`/`openai-compat` เท่านั้น ตั้งค่าแล้วจดจำต่อ `chatId`
   นั้นในข้อความถัดไปทุกครั้งจนกว่าจะเปลี่ยนใหม่

## Acceptance Criteria

- [ ] `npm run typecheck` ผ่าน
- [ ] ผูก webhook แล้ว (ดู SETUP.md วิธี `setWebhook`) เปิดแชทกับบอทใน Telegram พิมพ์ `/start` → ได้ข้อความต้อนรับ
- [ ] พิมพ์ "ตอนนี้กี่โมงแล้ว" → บอทเรียก MCP tool จริงแล้วตอบเวลาปัจจุบัน (เหมือนหน้าเว็บ)
- [ ] พิมพ์คุยต่อเนื่องหลายข้อความ → บอทจำบริบทของข้อความก่อนหน้าได้ (ไม่ใช่ตอบแบบไม่มี context)
- [ ] พิมพ์ `/reset` แล้วถามอะไรที่อ้างอิงข้อความก่อนหน้า → บอทต้องจำไม่ได้แล้ว (history ถูกล้างจริง)
- [ ] พิมพ์ `/provider openai` (ถ้ามี `OPENAI_API_KEY`) แล้วคุยต่อ → บอทตอบด้วย OpenAI จริง (ไม่ใช่ Gemini)

## ห้ามทำเกินสโคป

- ไม่ต้องรองรับ group chat แบบแยกสิทธิ์ต่อผู้ใช้ในกลุ่ม (อยู่ใน "ต่อยอด" ของเอกสารอ้างอิง) — ทำแบบ 1 history ต่อ
  `chatId` พอ

## Prompt แนะนำสำหรับสั่ง AI agent

> อ่าน `docs/module-2.3-telegram-spec.md` ให้ครบ แล้วสร้างไฟล์ตามตาราง เรียก `runChatTurn()` ที่มีอยู่แล้วใน
> `chat-routes.ts` ตรง ๆ ห้ามเขียน chat engine ซ้ำ ตรวจให้แน่ใจว่า handler จับ error ทุกทางแล้วตอบ 200 เสมอ
> ก่อนรายงานผล
