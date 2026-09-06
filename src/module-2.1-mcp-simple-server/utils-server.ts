/**
 * Module 2.1 — MCP server อย่างง่าย ไม่ต้องมี API key/OAuth ใด ๆ เปิดใช้ได้ทันที
 * ตัวอย่างที่ดีที่สุดสำหรับทำความเข้าใจว่า "MCP tool" หน้าตาเป็นยังไง ก่อนไปดู 2.2 (Google Calendar) ที่ซับซ้อนกว่า
 */
import { Env } from '../env';
import { createMcpServer } from './server-factory';

export const utilsServer = createMcpServer<Env>({
  name: 'ai-desk-utils',
  version: '0.1.0',
  tools: [
    {
      name: 'get_time',
      description: 'ดูวันเวลาปัจจุบัน (โซนเวลา Asia/Bangkok)',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const now = new Date();
        return {
          iso: now.toISOString(),
          bangkok: now.toLocaleString('th-TH-u-ca-gregory', {
            timeZone: 'Asia/Bangkok',
            dateStyle: 'full',
            timeStyle: 'medium',
          }),
        };
      },
    },
    {
      name: 'calculator',
      description: 'คำนวณนิพจน์เลขคณิตง่าย ๆ รองรับ + - * / ( )',
      inputSchema: {
        type: 'object',
        properties: { expression: { type: 'string', description: 'เช่น "12 * (3 + 4)"' } },
        required: ['expression'],
      },
      handler: async (args) => {
        const expression = String(args.expression ?? '');
        return { expression, result: safeCalculate(expression) };
      },
    },
    {
      name: 'echo',
      description: 'พูดข้อความเดิมกลับมาเป๊ะ ๆ — ใช้ทดสอบว่าเรียก MCP tool ได้จริงและได้ค่า args ถูกต้อง',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
      handler: async (args) => ({ echoed: String(args.text ?? '') }),
    },
  ],
});

/** คำนวณนิพจน์เลขคณิตแบบปลอดภัย (recursive-descent parser) — ตั้งใจไม่ใช้ eval()/Function() เด็ดขาด */
function safeCalculate(expression: string): number {
  const tokens = tokenize(expression);
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpression(): number {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const rhs = parseFactor();
      if (op === '/' && rhs === 0) throw new Error('หารด้วยศูนย์ไม่ได้');
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseFactor(): number {
    const tok = consume();
    if (tok === undefined) throw new Error('นิพจน์ไม่สมบูรณ์');
    if (tok === '(') {
      const value = parseExpression();
      if (consume() !== ')') throw new Error('วงเล็บไม่ครบ');
      return value;
    }
    if (tok === '-') return -parseFactor();
    if (tok === '+') return parseFactor();
    const num = Number(tok);
    if (Number.isNaN(num)) throw new Error(`อ่านนิพจน์ไม่ได้ที่ "${tok}"`);
    return num;
  }

  const result = parseExpression();
  if (pos !== tokens.length) throw new Error('มีอักขระเกินที่อ่านไม่ได้ในนิพจน์');
  if (!Number.isFinite(result)) throw new Error('ผลลัพธ์ไม่ใช่ตัวเลขที่ใช้ได้');
  return result;
}

function tokenize(expression: string): string[] {
  const cleaned = expression.trim();
  if (!cleaned) throw new Error('กรุณาใส่นิพจน์ที่ต้องการคำนวณ');
  if (!/^[0-9+\-*/().\s]+$/.test(cleaned)) {
    throw new Error('รองรับเฉพาะตัวเลขและเครื่องหมาย + - * / ( ) เท่านั้น');
  }
  return cleaned.match(/\d+(\.\d+)?|[+\-*/()]/g) || [];
}
