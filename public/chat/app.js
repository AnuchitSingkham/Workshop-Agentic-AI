const state = { messages: [] }; // { role: 'user'|'assistant', content }
const $ = (selector) => document.querySelector(selector);
const messagesEl = $('#messages');

const DEFAULT_MODELS = {
  gemini: 'gemini-flash-latest',
  openai: 'gpt-4o-mini',
  'openai-compat': 'gpt-4o-mini',
};
const PROVIDER_LABELS = { gemini: 'Google Gemini', openai: 'OpenAI', 'openai-compat': 'Custom gateway' };

function updateConnectionLabel() {
  const providerLabel = PROVIDER_LABELS[$('#provider').value];
  const modelValue = $('#model').value.trim() || '(default)';
  $('#connection-label').textContent = `${providerLabel} · ${modelValue}`;
}

function nowLabel() {
  return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function addMessage(role, text, opts = {}) {
  state.messages.push({ role, content: text });

  const article = document.createElement('article');
  article.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'assistant' ? '✦' : 'คุณ';

  const bubble = document.createElement('div');
  bubble.className = `bubble${opts.error ? ' error' : ''}`;
  text.split('\n').forEach((line) => {
    const p = document.createElement('p');
    p.textContent = line; // textContent เท่านั้น — ห้าม innerHTML กับข้อความที่มาจากผู้ใช้/โมเดล
    bubble.appendChild(p);
  });

  if (opts.toolCount) {
    const note = document.createElement('p');
    note.className = 'tool-note';
    note.textContent = `🔧 เรียกเครื่องมือ ${opts.toolCount} ครั้งระหว่างตอบ`;
    bubble.appendChild(note);
  }

  const time = document.createElement('time');
  time.textContent = nowLabel();
  bubble.appendChild(time);

  article.append(avatar, bubble);
  messagesEl.appendChild(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showThinking() {
  const article = document.createElement('article');
  article.className = 'message assistant thinking';
  article.id = 'thinking-message';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '✦';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.append('กำลังคิด', Object.assign(document.createElement('span'), { className: 'thinking-dots' }));
  bubble.lastChild.append(...[1, 2, 3].map(() => document.createElement('span')));
  article.append(avatar, bubble);
  messagesEl.appendChild(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function hideThinking() {
  $('#thinking-message')?.remove();
}

async function callChatApi(userText) {
  // ส่ง history ก่อนหน้า (ไม่รวมข้อความล่าสุดที่เพิ่ง push เข้า state.messages ไปแล้ว) — backend จะเติมข้อความ
  // ล่าสุดต่อท้ายเองจาก field `message`
  const history = state.messages.slice(0, -1).slice(-16);

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: userText,
      history,
      provider: $('#provider').value,
      model: $('#model').value.trim() || undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `เรียก /api/chat ไม่สำเร็จ (HTTP ${res.status})`);
  return data;
}

async function ask(text) {
  addMessage('user', text);
  const button = $('.send-button');
  button.disabled = true;
  showThinking();
  try {
    const data = await callChatApi(text);
    hideThinking();
    addMessage('assistant', data.reply, { toolCount: data.toolTrace?.length || 0 });
  } catch (error) {
    hideThinking();
    addMessage('assistant', `เกิดข้อผิดพลาด: ${error.message}`, { error: true });
  } finally {
    button.disabled = false;
  }
}

$('#chat-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#message-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  ask(text);
});

$('#message-input').addEventListener('input', (event) => {
  event.target.style.height = 'auto';
  event.target.style.height = `${Math.min(event.target.scrollHeight, 100)}px`;
});
$('#message-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    $('#chat-form').requestSubmit();
  }
});

document.querySelectorAll('.prompt').forEach((button) =>
  button.addEventListener('click', () => {
    $('#message-input').value = button.dataset.prompt;
    $('#chat-form').requestSubmit();
  })
);

$('#clear-chat').addEventListener('click', () => {
  state.messages = [];
  messagesEl.replaceChildren();
  addMessage('assistant', 'ล้างบทสนทนาแล้วครับ เริ่มคุยใหม่ได้เลย');
});

$('#provider').addEventListener('change', () => {
  $('#model').placeholder = DEFAULT_MODELS[$('#provider').value] || '';
  updateConnectionLabel();
});
$('#model').addEventListener('input', updateConnectionLabel);

$('#model').placeholder = DEFAULT_MODELS[$('#provider').value] || '';
updateConnectionLabel();
