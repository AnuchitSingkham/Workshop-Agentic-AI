const $ = (selector) => document.querySelector(selector);

const SOURCE_LABEL = { kv: 'ตั้งจากหน้านี้', env: 'มาจาก secret/var ตอน deploy', none: 'ยังไม่ได้ตั้งค่า' };
const PROVIDER_LABELS = { gemini: 'Google Gemini', openai: 'OpenAI', 'openai-compat': 'Custom (OpenAI-compatible gateway)' };

function renderApiKeyRow(status) {
  const wrap = document.createElement('div');
  wrap.className = 'panel';
  wrap.style.boxShadow = 'none';
  wrap.style.marginTop = '14px';
  wrap.style.padding = '16px 18px';

  const badgeClass = status.configured ? (status.source === 'kv' ? 'ok' : 'muted') : 'warn';
  const badgeText = status.configured && status.hint ? `${SOURCE_LABEL[status.source]} · ${status.hint}` : SOURCE_LABEL[status.source];

  wrap.innerHTML = `
    <div class="row-between">
      <strong class="provider-label" style="font: 600 0.95rem 'Space Grotesk', sans-serif"></strong>
      <span class="badge"></span>
    </div>
    <div class="row" style="margin-top: 12px">
      <input type="password" class="field-input" placeholder="วาง API key ใหม่ที่นี่" autocomplete="off" style="flex: 1; min-width: 200px" />
      <button class="btn save-btn" type="button">บันทึก</button>
      <button class="btn btn-outline clear-btn" type="button">ล้างค่าที่ตั้งไว้</button>
    </div>
    <p class="save-msg panel-sub" style="margin-top: 8px; min-height: 1em"></p>
  `;

  wrap.querySelector('.provider-label').textContent = PROVIDER_LABELS[status.provider];
  const badgeEl = wrap.querySelector('.badge');
  badgeEl.classList.add(badgeClass);
  badgeEl.textContent = badgeText;
  wrap.querySelector('.clear-btn').disabled = status.source !== 'kv';

  const input = wrap.querySelector('.field-input');
  const saveBtn = wrap.querySelector('.save-btn');
  const clearBtn = wrap.querySelector('.clear-btn');
  const msg = wrap.querySelector('.save-msg');

  saveBtn.addEventListener('click', async () => {
    const apiKey = input.value.trim();
    if (!apiKey) {
      msg.textContent = 'กรอก key ก่อนกดบันทึก';
      return;
    }
    saveBtn.disabled = true;
    msg.textContent = 'กำลังบันทึก...';
    try {
      await adminFetch('/api/settings/keys', { method: 'POST', body: JSON.stringify({ provider: status.provider, apiKey }) });
      input.value = '';
      msg.textContent = 'บันทึกแล้ว ✓';
      await loadStatus();
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      saveBtn.disabled = false;
    }
  });

  clearBtn.addEventListener('click', async () => {
    clearBtn.disabled = true;
    msg.textContent = 'กำลังล้างค่า...';
    try {
      await adminFetch(`/api/settings/keys?provider=${status.provider}`, { method: 'DELETE' });
      msg.textContent = 'ล้างแล้ว — กลับไปใช้ค่าจาก env';
      await loadStatus();
    } catch (err) {
      msg.textContent = err.message;
      clearBtn.disabled = false;
    }
  });

  return wrap;
}

function renderBaseUrlRow(status) {
  const wrap = document.createElement('div');
  wrap.className = 'panel';
  wrap.style.boxShadow = 'none';
  wrap.style.marginTop = '14px';
  wrap.style.padding = '16px 18px';

  const badgeClass = status.configured ? (status.source === 'kv' ? 'ok' : 'muted') : 'warn';
  const badgeText = status.configured ? `${SOURCE_LABEL[status.source]} · ${status.value}` : SOURCE_LABEL[status.source];

  wrap.innerHTML = `
    <div class="row-between">
      <strong style="font: 600 0.95rem 'Space Grotesk', sans-serif">Base URL (เฉพาะ Custom gateway)</strong>
      <span class="badge"></span>
    </div>
    <p class="panel-sub" style="margin-top: 4px">endpoint ของ AI gateway ที่พูดภาษา OpenAI-compatible เช่น <code>Replace base url</code> — ใช้ตอนเลือก provider "Custom" ในหน้า Chat เท่านั้น (Gemini/OpenAI ใช้ endpoint คงที่)</p>
    <div class="row" style="margin-top: 12px">
      <input type="text" class="field-input" placeholder="Replace base url" autocomplete="off" style="flex: 1; min-width: 200px" />
      <button class="btn save-btn" type="button">บันทึก</button>
      <button class="btn btn-outline clear-btn" type="button">ล้างค่าที่ตั้งไว้</button>
    </div>
    <p class="save-msg panel-sub" style="margin-top: 8px; min-height: 1em"></p>
  `;

  const badgeEl = wrap.querySelector('.badge');
  badgeEl.classList.add(badgeClass);
  badgeEl.textContent = badgeText;
  wrap.querySelector('.clear-btn').disabled = status.source !== 'kv';

  const input = wrap.querySelector('.field-input');
  const saveBtn = wrap.querySelector('.save-btn');
  const clearBtn = wrap.querySelector('.clear-btn');
  const msg = wrap.querySelector('.save-msg');

  saveBtn.addEventListener('click', async () => {
    const baseUrl = input.value.trim();
    if (!baseUrl) {
      msg.textContent = 'กรอก URL ก่อนกดบันทึก';
      return;
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      msg.textContent = 'URL ต้องขึ้นต้นด้วย http:// หรือ https://';
      return;
    }
    saveBtn.disabled = true;
    msg.textContent = 'กำลังบันทึก...';
    try {
      await adminFetch('/api/settings/keys', { method: 'POST', body: JSON.stringify({ baseUrl }) });
      input.value = '';
      msg.textContent = 'บันทึกแล้ว ✓';
      await loadStatus();
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      saveBtn.disabled = false;
    }
  });

  clearBtn.addEventListener('click', async () => {
    clearBtn.disabled = true;
    msg.textContent = 'กำลังล้างค่า...';
    try {
      await adminFetch('/api/settings/keys?field=baseUrl', { method: 'DELETE' });
      msg.textContent = 'ล้างแล้ว — กลับไปใช้ค่าจาก env';
      await loadStatus();
    } catch (err) {
      msg.textContent = err.message;
      clearBtn.disabled = false;
    }
  });

  return wrap;
}

async function loadStatus() {
  const rowsEl = $('#key-rows');
  try {
    const status = await adminFetch('/api/settings/keys');
    rowsEl.replaceChildren(...status.keys.map(renderApiKeyRow), renderBaseUrlRow(status.baseUrl));
    $('#unlock-panel').hidden = true;
    $('#keys-panel').hidden = false;
  } catch (err) {
    $('#unlock-panel').hidden = false;
    $('#keys-panel').hidden = true;
    $('#unlock-status').textContent = err.message;
  }
}

$('#unlock-btn').addEventListener('click', () => {
  setAdminToken($('#admin-token-input').value.trim());
  loadStatus();
});
$('#admin-token-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('#unlock-btn').click();
});

// ถ้าเคยปลดล็อกไว้แล้ว (token อยู่ใน localStorage) ให้ลองโหลดสถานะทันทีโดยไม่ต้องกรอกซ้ำ
if (getAdminToken()) {
  $('#admin-token-input').value = getAdminToken();
  loadStatus();
}
