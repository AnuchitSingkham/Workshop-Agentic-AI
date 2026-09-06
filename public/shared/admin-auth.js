/**
 * ใช้ร่วมกันโดยหน้า "ตั้งค่า Key" (Module 1.2) และ "ตั้งค่า MCP server" (Module 1.3)
 * เก็บ admin token ไว้ใน localStorage ของเบราว์เซอร์ตัวเอง (ไม่ส่งไปที่ไหนนอกจาก worker นี้)
 * แล้วแนบเป็น header X-Admin-Token ทุก request ไปยัง /api/settings/*
 */
const ADMIN_TOKEN_STORAGE_KEY = 'ai-desk-admin-token';

function getAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    /* localStorage ใช้ไม่ได้ (private mode ฯลฯ) — ปล่อยผ่าน แค่ต้องกรอกใหม่ทุกครั้งที่เปิดหน้า */
  }
}

/** fetch ที่แนบ X-Admin-Token ให้อัตโนมัติ + แปลง error response เป็น Error พร้อมข้อความจาก server */
async function adminFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', 'X-Admin-Token': getAdminToken(), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `เรียก ${path} ไม่สำเร็จ (HTTP ${res.status})`);
  }
  return data;
}
