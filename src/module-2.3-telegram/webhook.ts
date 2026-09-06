/**
 * Module 2.3 — POST /telegram/webhook: ให้คุยกับ chat engine เดียวกับหน้าเว็บ (1.1) ผ่าน Telegram ได้
 * รวม MCP tools (2.1/2.2/5) อัตโนมัติ เพราะเรียก runChatTurn() ตัวเดียวกับที่ chat-routes.ts ใช้
 */
import { Env } from '../env';
import { runChatTurn } from '../module-1.1-chat/chat-routes';
import { ChatProvider } from '../module-1.1-chat/types';
import { sendTelegramMessage } from './telegram-client';
import { appendTurn, clearHistory, getHistory, getPreferredProvider, setPreferredProvider } from './history-store';

interface TelegramUpdate {
  message?: { chat: { id: number }; text?: string };
}

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('ok — endpoint นี้รอรับ Telegram webhook POST เท่านั้น', { status: 200 });
  }
  if (!isFromTelegram(request, env)) {
    return new Response('forbidden', { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const message = update.message;
  if (!message?.text) return new Response('ok'); // ไม่ใช่ข้อความตัวหนังสือ (sticker/รูป ฯลฯ) ข้ามไป

  const chatId = message.chat.id;
  const text = message.text.trim();

  try {
    if (text === '/start') {
      await sendTelegramMessage(
        chatId,
        'สวัสดีครับ ผมคือ AI Desk ผู้ช่วยส่วนตัวของคุณ (Cloudflare Worker ตัวเดียวกับหน้าเว็บ)\n\n' +
          'พิมพ์คุยได้เลย — ถ้าตั้งค่า Google Calendar ไว้แล้ว ลองถาม "มีนัดอะไรบ้างสัปดาห์นี้" หรือ "ช่วยนัดพรุ่งนี้บ่ายสองโมง" ได้ด้วย\n\n' +
          'คำสั่ง: /provider gemini|openai|openai-compat (สลับโมเดล), /reset (ล้างความจำแชท), /help',
        env
      );
      return new Response('ok');
    }

    if (text === '/help') {
      await sendTelegramMessage(
        chatId,
        'พิมพ์ประโยคปกติได้เลย เช่น "สรุปนัดหมายสัปดาห์นี้" หรือ "12 คูณ (3+4) เท่ากับเท่าไหร่"\n\n' +
          'คำสั่ง:\n/provider gemini — สลับไปใช้ Gemini\n/provider openai — สลับไปใช้ OpenAI\n' +
          '/provider openai-compat — สลับไปใช้ gateway ที่กำหนดเอง\n/reset — ล้างความจำแชทนี้',
        env
      );
      return new Response('ok');
    }

    if (text === '/reset') {
      await clearHistory(env, chatId);
      await sendTelegramMessage(chatId, 'ล้างความจำแชทแล้วครับ เริ่มคุยใหม่ได้เลย', env);
      return new Response('ok');
    }

    const providerCommand = text.match(/^\/provider\s+(gemini|openai|openai-compat)$/i);
    if (providerCommand) {
      const provider = providerCommand[1].toLowerCase() as ChatProvider;
      await setPreferredProvider(env, chatId, provider);
      await sendTelegramMessage(chatId, `เปลี่ยนไปใช้ ${provider} แล้วครับ`, env);
      return new Response('ok');
    }

    const preferred = ((await getPreferredProvider(env, chatId)) as ChatProvider) || undefined;
    const history = await getHistory(env, chatId);
    const { reply } = await runChatTurn({
      env,
      provider: preferred || 'gemini',
      history: [...history, { role: 'user', content: text }],
    });

    await appendTurn(env, chatId, text, reply);
    await sendTelegramMessage(chatId, reply, env);
    return new Response('ok');
  } catch (err) {
    console.error('telegram handle message error', err);
    await sendTelegramMessage(chatId, 'ขอโทษครับ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', env).catch(() => {});
    return new Response('ok'); // ตอบ 200 กลับ Telegram เสมอ ไม่งั้น Telegram จะ retry รัว ๆ
  }
}

function isFromTelegram(request: Request, env: Env): boolean {
  if (!env.TELEGRAM_WEBHOOK_SECRET) return true; // ยังไม่ตั้ง secret — ใช้ได้แต่ไม่แนะนำสำหรับใช้งานจริงจัง
  return request.headers.get('X-Telegram-Bot-Api-Secret-Token') === env.TELEGRAM_WEBHOOK_SECRET;
}
