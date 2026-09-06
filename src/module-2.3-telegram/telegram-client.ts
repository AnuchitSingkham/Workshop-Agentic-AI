/** Module 2.3 — ส่งข้อความออก Telegram */
import { Env } from '../env';

export async function sendTelegramMessage(chatId: number, text: string, env: Env): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.error('ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN — ส่งข้อความไม่ได้ (ดู SETUP.md หัวข้อ Module 2.3)');
    return;
  }
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    console.error('Telegram sendMessage error', res.status, await res.text().catch(() => ''));
  }
}
