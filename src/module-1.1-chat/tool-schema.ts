import { JsonSchema } from './types';

const TYPE_MAP: Record<string, string> = {
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
  object: 'OBJECT',
  array: 'ARRAY',
};

/**
 * แปลง JSON Schema มาตรฐาน (แบบที่ MCP tools/list คืนมาใน inputSchema — type เป็นตัวพิมพ์เล็กตาม JSON Schema
 * และเป็นรูปแบบเดียวกับที่ OpenAI ใช้ได้ตรง ๆ) ให้เป็นรูปแบบที่ Gemini function calling ต้องการ
 * (type ต้องเป็นตัวพิมพ์ใหญ่ เช่น "OBJECT"/"STRING" และไม่รู้จัก field แปลกที่ไม่อยู่ในสเปกของ Gemini)
 */
export function toGeminiSchema(schema: JsonSchema | undefined): any {
  if (!schema || typeof schema !== 'object') return { type: 'OBJECT', properties: {} };

  const type = TYPE_MAP[String(schema.type)] || 'OBJECT';
  const out: any = { type };

  if (schema.description) out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;

  if (type === 'OBJECT') {
    const props = schema.properties || {};
    out.properties = {};
    for (const key of Object.keys(props)) {
      out.properties[key] = toGeminiSchema(props[key]);
    }
    if (Array.isArray(schema.required) && schema.required.length) out.required = schema.required;
  }

  if (type === 'ARRAY' && schema.items) {
    out.items = toGeminiSchema(schema.items);
  }

  return out;
}
