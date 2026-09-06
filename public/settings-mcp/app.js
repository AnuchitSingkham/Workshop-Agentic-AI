const $ = (selector) => document.querySelector(selector);

function renderServerItem(server) {
  const item = document.createElement('div');
  item.className = 'server-item';

  // โครง HTML แบบ static ก่อน แล้วค่อยเติมข้อความจริง (ชื่อ/คำอธิบาย/URL ที่แอดมินกรอกเอง) ด้วย textContent
  // เสมอ — กันข้อความที่บังเอิญมีอักขระ HTML หลุดไปตีความเป็น markup
  item.innerHTML = `
    <div class="row-between">
      <div>
        <div class="server-name"></div>
        <div class="server-desc"></div>
        <div class="server-url panel-sub" style="margin-top: 4px"></div>
      </div>
      <span class="badge"></span>
    </div>
    <div class="server-actions">
      <button class="btn btn-outline toggle-btn" type="button"></button>
      <button class="btn btn-danger delete-btn" type="button">ลบ</button>
    </div>
    <p class="item-status panel-sub" style="margin-top: 6px; min-height: 1em"></p>
  `;

  item.querySelector('.server-name').textContent = server.name;
  item.querySelector('.server-desc').textContent = server.description || '(ไม่มีคำอธิบาย)';
  item.querySelector('.server-url').textContent = server.builtin ? 'in-process (ในตัว worker)' : server.url;

  const badge = item.querySelector('.badge');
  badge.classList.add(server.enabled ? 'ok' : 'muted');
  badge.textContent = server.enabled ? 'เปิดใช้งาน' : 'ปิดอยู่';

  const toggleBtn = item.querySelector('.toggle-btn');
  toggleBtn.textContent = server.enabled ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน';

  const deleteBtn = item.querySelector('.delete-btn');
  if (server.builtin) {
    deleteBtn.disabled = true;
    deleteBtn.title = 'ลบ MCP server ในตัวไม่ได้ ปิดการใช้งานแทนได้';
  }

  const statusEl = item.querySelector('.item-status');

  toggleBtn.addEventListener('click', async () => {
    toggleBtn.disabled = true;
    statusEl.textContent = 'กำลังบันทึก...';
    try {
      await adminFetch(`/api/settings/mcp-servers/${encodeURIComponent(server.id)}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled: !server.enabled }),
      });
      await loadServers();
    } catch (err) {
      statusEl.textContent = err.message;
      toggleBtn.disabled = false;
    }
  });

  deleteBtn.addEventListener('click', async () => {
    if (server.builtin) return;
    if (!confirm(`ลบ MCP server "${server.name}" ใช่ไหม?`)) return;
    deleteBtn.disabled = true;
    statusEl.textContent = 'กำลังลบ...';
    try {
      await adminFetch(`/api/settings/mcp-servers/${encodeURIComponent(server.id)}`, { method: 'DELETE' });
      await loadServers();
    } catch (err) {
      statusEl.textContent = err.message;
      deleteBtn.disabled = false;
    }
  });

  return item;
}

async function loadServers() {
  const listEl = $('#server-list');
  try {
    const data = await adminFetch('/api/settings/mcp-servers');
    listEl.replaceChildren(...data.servers.map(renderServerItem));
    $('#unlock-panel').hidden = true;
    $('#servers-panel').hidden = false;
    $('#add-panel').hidden = false;
  } catch (err) {
    $('#unlock-panel').hidden = false;
    $('#servers-panel').hidden = true;
    $('#add-panel').hidden = true;
    $('#unlock-status').textContent = err.message;
  }
}

$('#unlock-btn').addEventListener('click', () => {
  setAdminToken($('#admin-token-input').value.trim());
  loadServers();
});
$('#admin-token-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('#unlock-btn').click();
});

$('#add-btn').addEventListener('click', async () => {
  const name = $('#new-name').value.trim();
  const url = $('#new-url').value.trim();
  const description = $('#new-desc').value.trim();
  const statusEl = $('#add-status');

  if (!name || !url) {
    statusEl.textContent = 'ต้องกรอกทั้งชื่อและ URL';
    return;
  }

  $('#add-btn').disabled = true;
  statusEl.textContent = 'กำลังเพิ่ม...';
  try {
    await adminFetch('/api/settings/mcp-servers', { method: 'POST', body: JSON.stringify({ name, url, description }) });
    $('#new-name').value = '';
    $('#new-url').value = '';
    $('#new-desc').value = '';
    statusEl.textContent = 'เพิ่มแล้ว ✓';
    await loadServers();
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    $('#add-btn').disabled = false;
  }
});

if (getAdminToken()) {
  $('#admin-token-input').value = getAdminToken();
  loadServers();
}
