/**
 * app.js — ClaudeChat via Puter.js
 * Modular, single-page chat UI with history & streaming
 */

// ─── State ────────────────────────────────────────────────
const state = {
  sessions: [],        // [{ id, title, messages: [{role, content}] }]
  activeId: null,
  isStreaming: false,
};

// ─── DOM refs ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const messagesWrap = $('messages-wrap');
const chatInput    = $('chat-input');
const sendBtn      = $('send-btn');
const modelSelect  = $('model-select');
const topbarModel  = $('topbar-model');
const historyList  = $('chat-history');
const newChatBtn   = $('new-chat-btn');
const clearBtn     = $('clear-chat');
const sidebarToggle = $('sidebar-toggle');
const sidebar      = document.querySelector('.sidebar');

// ─── Theme toggle ─────────────────────────────────────────
(function initTheme() {
  const btn  = $('theme-toggle');
  const root = document.documentElement;
  let dark = root.getAttribute('data-theme') === 'dark';
  const update = () => {
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    btn.innerHTML = dark
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
    btn.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  };
  update();
  btn.addEventListener('click', () => { dark = !dark; update(); });
})();

// ─── Sidebar toggle ───────────────────────────────────────
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  const expanded = !sidebar.classList.contains('collapsed');
  sidebarToggle.setAttribute('aria-expanded', String(expanded));
});

// ─── Model label sync ─────────────────────────────────────
modelSelect.addEventListener('change', () => {
  topbarModel.textContent = modelSelect.options[modelSelect.selectedIndex].text;
});

// ─── Session helpers ──────────────────────────────────────
function createSession() {
  const id = Date.now().toString();
  const session = { id, title: 'New Chat', messages: [] };
  state.sessions.unshift(session);
  state.activeId = id;
  return session;
}

function activeSession() {
  return state.sessions.find(s => s.id === state.activeId) || createSession();
}

function renderHistory() {
  historyList.innerHTML = '';
  state.sessions.forEach(s => {
    const el = document.createElement('div');
    el.className = 'history-item' + (s.id === state.activeId ? ' active' : '');
    el.textContent = s.title;
    el.setAttribute('role', 'listitem');
    el.addEventListener('click', () => {
      state.activeId = s.id;
      renderHistory();
      renderMessages();
    });
    historyList.appendChild(el);
  });
}

// ─── Markdown-ish renderer (simple, no dep) ───────────────
function renderMarkdown(text) {
  return text
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang}">${escHtml(code.trim())}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // H1-H3
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Unordered list
    .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    // Ordered list
    .replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs (double newline → <p>)
    .split(/\n{2,}/)
    .map(block => {
      if (/^<(h[1-3]|pre|ul|ol|li)/.test(block.trim())) return block;
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Render messages ──────────────────────────────────────
function renderMessages() {
  const session = activeSession();
  // Remove welcome or re-render
  messagesWrap.innerHTML = '';
  if (session.messages.length === 0) {
    messagesWrap.appendChild(buildWelcome());
    return;
  }
  session.messages.forEach(m => messagesWrap.appendChild(buildMsgEl(m.role, m.content)));
  scrollBottom();
}

function buildWelcome() {
  const div = document.createElement('div');
  div.id = 'welcome';
  div.className = 'welcome';
  div.innerHTML = `
    <div class="welcome-icon">
      <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
        <rect x="2" y="2" width="28" height="28" rx="8" fill="var(--color-primary)"/>
        <path d="M10 22L16 10L22 22" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12.5 18H19.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <h1>How can I help you today?</h1>
    <p>Free, unlimited Claude access via Puter.js. No API key required.</p>
    <div class="suggestions">
      <button class="suggestion-chip">Write a Python data cleaning script</button>
      <button class="suggestion-chip">Explain a regex pattern</button>
      <button class="suggestion-chip">Debug my Google Apps Script</button>
      <button class="suggestion-chip">Summarize this text for me</button>
    </div>`;
  div.querySelectorAll('.suggestion-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.textContent;
      adjustHeight();
      sendBtn.disabled = false;
      sendMessage();
    });
  });
  return div;
}

function buildMsgEl(role, content, streaming = false) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'user' ? 'U' : 'C';

  const body = document.createElement('div');
  body.className = 'msg-body';

  const roleLabel = document.createElement('div');
  roleLabel.className = 'msg-role';
  roleLabel.textContent = role === 'user' ? 'You' : 'Claude';

  const contentEl = document.createElement('div');
  contentEl.className = 'msg-content' + (streaming ? ' streaming' : '');
  contentEl.innerHTML = streaming ? '' : renderMarkdown(content);

  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'msg-action-btn';
  copyBtn.setAttribute('aria-label', 'Copy message');
  copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(content).then(() => {
      copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 12 4 10"/></svg> Copied!`;
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      }, 1500);
    });
  });

  actions.appendChild(copyBtn);
  body.append(roleLabel, contentEl, actions);
  wrap.append(avatar, body);
  return wrap;
}

// ─── Scrolling ────────────────────────────────────────────
function scrollBottom() {
  requestAnimationFrame(() => {
    messagesWrap.scrollTop = messagesWrap.scrollHeight;
  });
}

// ─── Send message ─────────────────────────────────────────
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || state.isStreaming) return;

  const session = activeSession();
  session.messages.push({ role: 'user', content: text });

  // First message → set title
  if (session.messages.length === 1) {
    session.title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
  }

  chatInput.value = '';
  adjustHeight();
  sendBtn.disabled = true;
  state.isStreaming = true;

  // Remove welcome
  const welcome = messagesWrap.querySelector('#welcome, .welcome');
  if (welcome) welcome.remove();

  // Add user msg
  messagesWrap.appendChild(buildMsgEl('user', text));
  renderHistory();
  scrollBottom();

  // Add streaming assistant bubble
  const assistantEl = buildMsgEl('assistant', '', true);
  const contentEl = assistantEl.querySelector('.msg-content');
  messagesWrap.appendChild(assistantEl);
  scrollBottom();

  let fullText = '';

  try {
    const model = modelSelect.value;
    const apiMessages = session.messages.map(m => ({ role: m.role, content: m.content }));

    const response = await puter.ai.chat(apiMessages, { model, stream: true });

    for await (const part of response) {
      const chunk = part?.text || '';
      fullText += chunk;
      contentEl.innerHTML = renderMarkdown(fullText);
      scrollBottom();
    }

    contentEl.classList.remove('streaming');
    session.messages.push({ role: 'assistant', content: fullText });

    // update copy button with real content
    const copyBtn = assistantEl.querySelector('.msg-action-btn');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(fullText);
    });

  } catch (err) {
    contentEl.classList.remove('streaming');
    contentEl.innerHTML = `<p style="color:var(--color-text-muted)">⚠️ Error: ${escHtml(err?.message || 'Something went wrong. Try signing in to Puter for higher limits.')}</p>`;
    // remove failed message from history
    session.messages.pop();
    showToast('Error: ' + (err?.message || 'API call failed'));
  } finally {
    state.isStreaming = false;
    sendBtn.disabled = chatInput.value.trim() === '';
    renderHistory();
    scrollBottom();
  }
}

// ─── Toast ────────────────────────────────────────────────
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ─── Input auto-resize ────────────────────────────────────
function adjustHeight() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
}

chatInput.addEventListener('input', () => {
  adjustHeight();
  sendBtn.disabled = chatInput.value.trim() === '' || state.isStreaming;
});

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

// ─── New chat ─────────────────────────────────────────────
newChatBtn.addEventListener('click', () => {
  createSession();
  renderHistory();
  renderMessages();
  chatInput.focus();
});

// ─── Clear current chat ───────────────────────────────────
clearBtn.addEventListener('click', () => {
  const s = activeSession();
  s.messages = [];
  s.title = 'New Chat';
  renderHistory();
  renderMessages();
});

// ─── Init ─────────────────────────────────────────────────
createSession();
renderHistory();
renderMessages();
chatInput.focus();
