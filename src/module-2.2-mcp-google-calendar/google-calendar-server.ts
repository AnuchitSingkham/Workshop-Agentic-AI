/**
 * Module 2.2 — ห่อ google-calendar-client.ts เป็น MCP server ด้วย server-factory.ts เดียวกับ Module 2.1
 * ถ้ายังไม่ตั้งค่า Google OAuth (GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN) tools/list ยังคงแสดง tool ให้เห็นตามปกติ
 * แต่ tools/call จะ error พร้อมคำอธิบายที่อ่านเข้าใจได้ (ดู requireGoogleConfig ใน google-calendar-client.ts)
 */
import { Env } from '../env';
import { createMcpServer } from '../module-2.1-mcp-simple-server/server-factory';
import { createCalendarEvent, listUpcomingEvents } from './google-calendar-client';

export const googleCalendarServer = createMcpServer<Env>({
  name: 'ai-desk-google-calendar',
  version: '0.1.0',
  tools: [
    {
      name: 'list_events',
      description: 'ดูนัดหมายที่กำลังจะถึงใน Google Calendar (ปฏิทินหลักของบัญชีที่ตั้งค่า OAuth ไว้)',
      inputSchema: {
        type: 'object',
        properties: { days: { type: 'number', description: 'จำนวนวันข้างหน้าที่จะดู (ค่าเริ่มต้น 7)' } },
      },
      handler: async (args, env) => {
        const days = Number(args.days);
        return listUpcomingEvents(env, Number.isFinite(days) && days > 0 ? days : 7);
      },
    },
    {
      name: 'create_event',
      description: 'สร้างนัดหมายใหม่ใน Google Calendar (ปฏิทินหลัก)',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'ชื่อหัวข้อนัดหมาย' },
          startDateTime: { type: 'string', description: 'วันเวลาเริ่ม รูปแบบ ISO 8601 เช่น 2026-09-01T14:00:00+07:00' },
          endDateTime: { type: 'string', description: 'วันเวลาสิ้นสุด รูปแบบ ISO 8601' },
        },
        required: ['title', 'startDateTime', 'endDateTime'],
      },
      handler: async (args, env) => {
        const title = String(args.title ?? '');
        const startDateTime = String(args.startDateTime ?? '');
        const endDateTime = String(args.endDateTime ?? '');
        if (!title || !startDateTime || !endDateTime) {
          throw new Error('ต้องระบุ title, startDateTime และ endDateTime ให้ครบ');
        }
        const result = await createCalendarEvent(env, title, startDateTime, endDateTime);
        return { status: 'created', title, ...result };
      },
    },
  ],
});
