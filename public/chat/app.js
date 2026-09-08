const history = [];
const messages = document.querySelector('#messages');
const form = document.querySelector('#chat-form');
const input = document.querySelector('#message');
const provider = document.querySelector('https://api.openai.com/v1');
const model = document.querySelector('openai/gpt-4.1-mini');
function add(role, content) { const el = document.createElement('div'); el.className = `bubble ${role}`; el.textContent = content; messages.append(el); }
form.addEventListener('submit', async (event) => { event.preventDefault(); const message = input.value.trim(); if (!message) return; input.value = ''; add('user', message); try { const response = await fetch('/api/chat', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({message, history, provider: provider.value, model: model.value.trim() || undefined}) }); const data = await response.json(); const reply = data.reply || data.error || 'ไม่พบคำตอบ'; add('assistant', reply); history.push({role:'user',content:message},{role:'assistant',content:reply}); } catch (error) { add('assistant', `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${error.message}`); } });