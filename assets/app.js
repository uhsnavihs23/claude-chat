// assets/app.js  — claude-chat v2.3
// Depends on: assets/files.js, assets/search.js, assets/ocr.js (loaded before this)

(() => {
'use strict';

// ── Config ───────────────────────────────────────────────────
const PROXY_URL = window.APP_CONFIG?.PROXY_URL
  || 'https://dark-feather-5042.insightfulscroll.workers.dev';

// ── Model caps (context window in tokens) ──────────────────────────────────
const MODEL_CAPS = {
  'default':                                         128000,
  'google/gemma-4-31b-it:free':                      131072,
  'google/gemma-4-26b-a4b-it:free':                  131072,
  'google/gemma-3-27b-it:free':                      131072,
  'google/gemma-3-12b-it:free':                      131072,
  'google/gemma-3-4b-it:free':                       131072,
  'google/gemma-3n-e4b-it:free':                     131072,
  'google/gemma-3n-e2b-it:free':                     131072,
  'meta-llama/llama-3.3-70b-instruct:free':          131072,
  'meta-llama/llama-3.2-3b-instruct:free':           131072,
  'meta-llama/llama-3.2-11b-vision-instruct:free':   131072,
  'nvidia/nemotron-nano-12b-v2-vl:free':             131072,
  'nvidia/nemotron-3-nano-30b-a3b:free':             131072,
  'nvidia/nemotron-nano-9b-v2:free':                 131072,
  'nvidia/nemotron-3-nano-omni:free':                131072,
  'nvidia/llama-nemotron-super-70b-instruct:free':   131072,
  'nvidia/llama-nemotron-embed-vl-1b-v2:free':         4096,
  'qwen/qwen3-coder-480b-a35b:free':                 131072,
  'qwen/qwen3-235b-a22b:free':                       131072,
  'qwen/qwen3-next-80b-a3b:free':                    131072,
  'nous/hermes-3-405b-instruct:free':                131072,
  'baidu/qianfan-ocr-fast:free':                       4096,
  'liquid/lfm2.5-1.2b-thinking:free':                32768,
  'liquid/lfm2.5-1.2b-instruct:free':                32768,
  'poolside/laguna-m1:free':                         131072,
  'poolside/laguna-xs2:free':                        131072,
  'openai/gpt-4o-mini-search-preview:free':          128000,
  'venice-ai/venice-uncensored:free':                131072,
};

// ── Fallback model list (used if /models fetch fails) ────────────────────────
const FALLBACK_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free',       name: 'Meta: Llama 3.3 70B',            context: 131072 },
  { id: 'meta-llama/llama-3.2-3b-instruct:free',        name: 'Meta: Llama 3.2 3B',             context: 131072 },
  { id: 'google/gemma-4-31b-it:free',                   name: 'Google: Gemma 4 31B',            context: 131072 },
  { id: 'google/gemma-4-26b-a4b-it:free',               name: 'Google: Gemma 4 26B A4B',        context: 131072 },
  { id: 'google/gemma-3-27b-it:free',                   name: 'Google: Gemma 3 27B',            context: 131072 },
  { id: 'google/gemma-3-12b-it:free',                   name: 'Google: Gemma 3 12B',            context: 131072 },
  { id: 'google/gemma-3-4b-it:free',                    name: 'Google: Gemma 3 4B',             context: 131072 },
  { id: 'google/gemma-3n-e4b-it:free',                  name: 'Google: Gemma 3n 4B',            context: 131072 },
  { id: 'google/gemma-3n-e2b-it:free',                  name: 'Google: Gemma 3n 2B',            context: 131072 },
  { id: 'nvidia/nemotron-3-nano-30b-a3b:free',          name: 'NVIDIA: Nemotron 3 Nano 30B',    context: 131072 },
  { id: 'nvidia/nemotron-nano-9b-v2:free',              name: 'NVIDIA: Nemotron Nano 9B V2',    context: 131072 },
  { id: 'nvidia/nemotron-nano-12b-v2-vl:free',          name: 'NVIDIA: Nemotron Nano 12B VL',   context: 131072 },
  { id: 'nvidia/nemotron-3-nano-omni:free',             name: 'NVIDIA: Nemotron 3 Nano Omni',   context: 131072 },
  { id: 'nvidia/llama-nemotron-super-70b-instruct:free',name: 'NVIDIA: Nemotron Super 70B',     context: 131072 },
  { id: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',   name: 'NVIDIA: Nemotron Embed VL 1B',   context: 4096   },
  { id: 'qwen/qwen3-coder-480b-a35b:free',              name: 'Qwen: Qwen3 Coder 480B',         context: 131072 },
  { id: 'qwen/qwen3-235b-a22b:free',                    name: 'Qwen3 235B A22B',                context: 131072 },
  { id: 'qwen/qwen3-next-80b-a3b:free',                 name: 'Qwen: Qwen3 Next 80B',           context: 131072 },
  { id: 'nous/hermes-3-405b-instruct:free',             name: 'Nous: Hermes 3 405B',            context: 131072 },
  { id: 'liquid/lfm2.5-1.2b-thinking:free',             name: 'LiquidAI: LFM2.5 1.2B Thinking', context: 32768  },
  { id: 'liquid/lfm2.5-1.2b-instruct:free',             name: 'LiquidAI: LFM2.5 1.2B Instruct', context: 32768  },
  { id: 'poolside/laguna-m1:free',                      name: 'Poolside: Laguna M.1',           context: 131072 },
  { id: 'poolside/laguna-xs2:free',                     name: 'Poolside: Laguna XS.2',          context: 131072 },
  { id: 'baidu/qianfan-ocr-fast:free',                  name: 'Baidu: Qianfan OCR Fast',        context: 4096   },
  { id: 'venice-ai/venice-uncensored:free',             name: 'Venice: Uncensored',             context: 131072 },
  { id: 'openrouter/auto',                              name: 'Free Models Router',             context: 128000 },
];

// ── State ────────────────────────────────────────────────────────
const state = {
  sessions:       {},
  currentId:      null,
  streaming:      false,
  pendingFiles:   [],
  searchEnabled:  false,
  models:         [],
  modelsLoaded:   false,
};

// ── DOM refs ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const DOM = {
  sidebar:         () => document.querySelector('.sidebar'),
  sidebarBackdrop: () => $('sidebarBackdrop'),
  messages:        () => $('messages'),
  textarea:        () => $('chatInput'),
  sendBtn:         () => $('sendBtn'),
  modelSelect:     () => $('modelSelect'),
  sysPrompt:       () => $('sysPrompt'),
  keyInput:        () => $('apiKey'),
  keyStatus:       () => $('keyStatus'),
  fileInput:       () => $('fileInput'),
  attachBtn:       () => $('attachBtn'),
  fileStrip:       () => $('fileStrip'),
  tokenFill:       () => $('tokenFill'),
  tokenLabel:      () => $('tokenLabel'),
  statMsgs:        () => $('statMsgs'),
  statTokens:      () => $('statTokens'),
  statModel:       () => $('statModel'),
  topbarTitle:     () => $('topbarTitle'),
  topbarBadge:     () => $('topbarBadge'),
  historyList:     () => $('historyList'),
  searchToggle:    () => $('searchToggle'),
  newChatBtn:      () => $('newChatBtn'),
  sidebarToggle:   () => $('sidebarToggle'),  // collapse btn (in sidebar)
  sidebarOpen:     () => $('sidebarOpen'),    // open btn (in topbar)
  toast:           () => $('toast'),
  themeToggle:     () => $('themeToggle'),
};

// ── Sidebar helpers ─────────────────────────────────────────────────
function openSidebar() {
  DOM.sidebar()?.classList.remove('collapsed');
  DOM.sidebarBackdrop()?.classList.add('active');
}

function closeSidebar() {
  DOM.sidebar()?.classList.add('collapsed');
  DOM.sidebarBackdrop()?.classList.remove('active');
}

function toggleSidebar() {
  const sidebar = DOM.sidebar();
  if (!sidebar) return;
  if (sidebar.classList.contains('collapsed')) openSidebar();
  else closeSidebar();
}

// ── Utilities ──────────────────────────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function showToast(msg, type = '', duration = 3200) {
  const t = DOM.toast();
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast${type ? ' ' + type : ''} show`;
  clearTimeout(t._tid);
  if (msg) t._tid = setTimeout(() => t.classList.remove('show'), duration);
}

function getModelCtx(modelId) {
  const live = state.models.find(m => m.id === modelId);
  if (live?.context) return live.context;
  return MODEL_CAPS[modelId] || MODEL_CAPS['default'];
}

function approxTokens(text) { return Math.ceil((text || '').length / 3.8); }

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Dark / light theme ──────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem('theme');
  const pref  = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', saved || pref);
})();

function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = DOM.themeToggle();
  if (btn) btn.setAttribute('aria-label', `Switch to ${cur} mode`);
}

// ── Markdown renderer ───────────────────────────────────────────────
function renderMd(text) {
  let s = text || '';

  // Fenced code blocks
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const id = 'cb_' + genId();
    return `<pre><div class="code-header"><span class="code-lang">${escHtml(lang||'text')}</span>`
      + `<button class="copy-code-btn" onclick="copyCode('${id}')">Copy</button></div>`
      + `<code id="${id}">${escHtml(code.replace(/\n$/,''))}</code></pre>`;
  });

  // Inline code
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`);

  // GFM tables
  s = s.replace(/((?:\|.+\|\n?)+)/g, block => {
    const rows = block.trim().split('\n').map(r =>
      r.trim().replace(/^\||\|$/g,'').split('|').map(c => c.trim())
    );
    if (rows.length < 2) return block;
    const isSep = r => r.every(c => /^:?-+:?$/.test(c));
    let head = rows[0], body = rows.slice(1);
    if (isSep(body[0])) body = body.slice(1);
    const th = head.map(h => `<th>${inlineMd(h)}</th>`).join('');
    const tb = body.map(r =>
      `<tr>${r.map(c => `<td>${inlineMd(c)}</td>`).join('')}</tr>`
    ).join('\n');
    return `<div class="md-table-wrap"><table class="md-table"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`;
  });

  // Task lists
  s = s.replace(/^[ \t]*[-*] \[( |x)\] (.+)$/gm, (_, ch, txt) =>
    `<li class="task-item"><input type="checkbox" ${ch==='x'?'checked':''}disabled>${inlineMd(txt)}</li>`
  );

  // Headings
  s = s.replace(/^######\s+(.+)$/gm, (_, t) => `<h6>${inlineMd(t)}</h6>`);
  s = s.replace(/^#####\s+(.+)$/gm,  (_, t) => `<h5>${inlineMd(t)}</h5>`);
  s = s.replace(/^####\s+(.+)$/gm,   (_, t) => `<h4>${inlineMd(t)}</h4>`);
  s = s.replace(/^###\s+(.+)$/gm,    (_, t) => `<h3>${inlineMd(t)}</h3>`);
  s = s.replace(/^##\s+(.+)$/gm,     (_, t) => `<h2>${inlineMd(t)}</h2>`);
  s = s.replace(/^#\s+(.+)$/gm,      (_, t) => `<h1>${inlineMd(t)}</h1>`);

  // Blockquote
  s = s.replace(/^>\s?(.+)$/gm, (_, t) => `<blockquote>${inlineMd(t)}</blockquote>`);

  // HR
  s = s.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr>');

  // Lists
  s = s.replace(/((?:^[ \t]*[-*+] .+\n?)+)/gm, block => {
    const items = block.trim().split('\n')
      .map(l => l.replace(/^[ \t]*[-*+] /, '').trim())
      .map(l => `<li>${inlineMd(l)}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  s = s.replace(/((?:^[ \t]*\d+\. .+\n?)+)/gm, block => {
    const items = block.trim().split('\n')
      .map(l => l.replace(/^[ \t]*\d+\. /, '').trim())
      .map(l => `<li>${inlineMd(l)}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs
  s = s.split(/\n{2,}/).map(para => {
    para = para.trim();
    if (!para) return '';
    if (/^<(h[1-6]|ul|ol|li|pre|blockquote|hr|div|table)/.test(para)) return para;
    return `<p>${inlineMd(para)}</p>`;
  }).join('\n');

  return s;
}

function inlineMd(t) {
  return (t || '')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/__(.+?)__/g,         '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/_(.+?)_/g,           '<em>$1</em>')
    .replace(/~~(.+?)~~/g,         '<del>$1</del>')
    .replace(/`([^`]+)`/g,         (_, c) => `<code>${escHtml(c)}</code>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      (_, txt, href) => `<a href="${escHtml(href)}" target="_blank" rel="noopener">${escHtml(txt)}</a>`);
}

window.copyCode = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => showToast('Copied!', 'success', 1800));
};

// ── Dynamic model loading ───────────────────────────────────────────────
async function loadModels() {
  const sel = DOM.modelSelect();
  if (!sel) return;

  try {
    const res  = await fetch(`${PROXY_URL}/models`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = (data.data || []).filter(m => m.id);

    if (list.length) {
      state.models     = list;
      state.modelsLoaded = true;

      // Register vision-capable models with AppOCR so images route correctly
      if (window.AppOCR) {
        list.forEach(m => {
          if (m.capabilities?.vision) window.AppOCR.registerVisionModel(m.id);
        });
      }

      populateModelSelect(list);
      console.info(`[claude-chat] Loaded ${list.length} models from OpenRouter`);
      return;
    }
  } catch (e) {
    console.warn('[claude-chat] Model fetch failed, using fallback list:', e.message);
  }

  // Fallback
  state.models = FALLBACK_MODELS;
  populateModelSelect(FALLBACK_MODELS);
}

function populateModelSelect(models) {
  const sel = DOM.modelSelect();
  if (!sel) return;
  const saved = sel.value || localStorage.getItem('selectedModel') || '';

  // Group by provider prefix
  const groups = {};
  models.forEach(m => {
    const provider = (m.name || m.id).split(':')[0].split('/')[0].split(' ')[0] || 'Other';
    (groups[provider] = groups[provider] || []).push(m);
  });

  sel.innerHTML = '';

  // Free Models Router first
  const router = models.find(m => m.id === 'openrouter/auto');
  if (router) {
    const opt       = document.createElement('option');
    opt.value       = router.id;
    opt.textContent = '⚡ ' + (router.name || 'Free Models Router');
    sel.appendChild(opt);
  }

  Object.keys(groups).sort().forEach(provider => {
    const grp   = document.createElement('optgroup');
    grp.label   = provider;
    groups[provider]
      .filter(m => m.id !== 'openrouter/auto')
      .forEach(m => {
        const opt       = document.createElement('option');
        opt.value       = m.id;
        const cap       = window.AppOCR?.capabilityLabel(m.id);
        opt.textContent = (m.name || m.id) + (cap ? ` [${cap}]` : '');
        grp.appendChild(opt);
      });
    if (grp.children.length) sel.appendChild(grp);
  });

  // Restore saved selection
  if (saved && [...sel.options].some(o => o.value === saved)) sel.value = saved;

  updateTopbarBadge();
}

// ── Sessions ─────────────────────────────────────────────────────────
function newSession() {
  const id = genId();
  state.sessions[id] = { id, title: 'New chat', messages: [], tokenCount: 0, createdAt: Date.now() };
  return id;
}

function switchSession(id) {
  if (!state.sessions[id]) return;
  state.currentId = id;
  renderMessages();
  renderHistory();
  updateStats();
  const tt = DOM.topbarTitle();
  if (tt) tt.textContent = state.sessions[id].title || 'New chat';
}

function currentSession() { return state.sessions[state.currentId]; }

// ── History sidebar ─────────────────────────────────────────────────────
function renderHistory() {
  const list = DOM.historyList();
  if (!list) return;
  const sessions = Object.values(state.sessions).sort((a,b) => b.createdAt - a.createdAt);
  list.innerHTML = sessions.map(s =>
    `<div class="history-item${s.id === state.currentId ? ' active' : ''}"
          data-sid="${s.id}"
          title="${escHtml(s.title)}">${escHtml(s.title)}</div>`
  ).join('');
  // Delegate clicks
  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => switchSession(el.dataset.sid));
  });
}
window.switchSession = switchSession;

// ── Message rendering ───────────────────────────────────────────────────
function renderMessages() {
  const wrap = DOM.messages();
  if (!wrap) return;
  const sess = currentSession();
  if (!sess) return;

  if (!sess.messages.length) {
    wrap.innerHTML = welcomeHTML();
    return;
  }

  wrap.innerHTML = sess.messages.map(renderMessage).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

function welcomeHTML() {
  return `<div class="welcome">
    <div class="welcome-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    </div>
    <h1>Claude Chat</h1>
    <p>Free AI models via OpenRouter. Pick a model and start chatting.</p>
    <div class="suggestions">
      <button class="suggestion-chip" onclick="useSuggestion('Explain quantum computing simply')">Explain quantum computing</button>
      <button class="suggestion-chip" onclick="useSuggestion('Write a Python function to parse CSV files')">Parse CSV with Python</button>
      <button class="suggestion-chip" onclick="useSuggestion('What is in the news today?')">Today\'s news</button>
      <button class="suggestion-chip" onclick="useSuggestion('Summarise this text for me:')">Summarise text</button>
    </div>
  </div>`;
}
window.useSuggestion = function(text) {
  const ta = DOM.textarea();
  if (ta) { ta.value = text; ta.focus(); autoResizeTextarea(ta); }
};

function renderMessage(msg) {
  const isUser = msg.role === 'user';
  const time   = msg.ts ? new Date(msg.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
  const role   = isUser ? 'You' : (msg.model?.split('/').pop()?.replace(':free','') || 'AI');

  let bodyHtml = '';
  if (msg.imageUrls?.length) {
    bodyHtml += msg.imageUrls.map(u =>
      `<img class="msg-img" src="${escHtml(u)}" alt="Attached image" loading="lazy">`
    ).join('');
  }
  if (msg.fileNames?.length) {
    bodyHtml += msg.fileNames.map(n =>
      `<span class="msg-file-chip">📎 ${escHtml(n)}</span>`
    ).join('');
  }

  const content  = isUser ? `<p>${escHtml(msg.content || '')}</p>` : renderMd(msg.content || '');
  const webBadge = msg.searched ? `<span class="web-badge">🌐 web</span>` : '';

  return `<div class="msg ${isUser ? 'user' : 'assistant'}" data-id="${msg.id}">
    <div class="msg-avatar">${isUser ? 'U' : 'AI'}</div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-role">${escHtml(role)}</span>
        <span class="msg-time">${time}</span>
        ${webBadge}
      </div>
      <div class="msg-content">${bodyHtml}${content}</div>
      <div class="msg-actions">
        <button class="msg-act-btn" onclick="copyMsg('${msg.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>Copy
        </button>
      </div>
    </div>
  </div>`;
}

window.copyMsg = function(id) {
  const sess = currentSession();
  const msg  = sess?.messages.find(m => m.id === id);
  if (!msg) return;
  navigator.clipboard.writeText(msg.content || '').then(() => showToast('Copied!', 'success', 1800));
};

// ── Stats + token bar ──────────────────────────────────────────────────
function updateStats() {
  const sess     = currentSession();
  if (!sess) return;
  const msgCount = sess.messages.length;
  const tokens   = sess.tokenCount || 0;
  const modelId  = DOM.modelSelect()?.value || '';
  const ctxLimit = getModelCtx(modelId);
  const pct      = Math.min(100, (tokens / ctxLimit) * 100).toFixed(1);
  const ctxK     = Math.round(ctxLimit / 1000);

  const sm = DOM.statMsgs();    if (sm) sm.textContent    = msgCount;
  const st = DOM.statTokens();  if (st) st.textContent    = tokens.toLocaleString();
  const smod = DOM.statModel(); if (smod) smod.textContent = modelId.split('/').pop()?.replace(':free','') || '—';
  const tf = DOM.tokenFill();   if (tf) tf.style.width    = pct + '%';
  const tl = DOM.tokenLabel();  if (tl) tl.textContent    = `${tokens.toLocaleString()} / ${ctxK}k ctx`;
}

function updateTopbarBadge() {
  const badge   = DOM.topbarBadge();
  if (!badge) return;
  const modelId = DOM.modelSelect()?.value || '';
  const model   = state.models.find(m => m.id === modelId);
  const name    = model?.name || modelId.split('/').pop()?.replace(':free','') || 'Model';
  badge.textContent = name;
  badge.title       = modelId;
}

// ── File handling ────────────────────────────────────────────────────────
function handleFiles(fileList) {
  [...fileList].forEach(async file => {
    const lower = file.name.toLowerCase();

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => {
        state.pendingFiles.push({ type: 'image', name: file.name, dataUrl: e.target.result, mime: file.type });
        renderFileStrip();
      };
      reader.readAsDataURL(file);
      return;
    }

    if (window.AppFiles && (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls'))) {
      showToast('Parsing ' + file.name + '…');
      const result = await window.AppFiles.parseStructuredFile(file);
      if (result) {
        state.pendingFiles.push({ type: 'table', name: file.name, parsed: result });
        showToast('Ready: ' + file.name, 'success');
        renderFileStrip();
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      state.pendingFiles.push({ type: 'text', name: file.name, content: e.target.result });
      renderFileStrip();
    };
    reader.readAsText(file);
  });
}

function renderFileStrip() {
  const strip = DOM.fileStrip();
  if (!strip) return;

  if (!state.pendingFiles.length) {
    strip.innerHTML = '';
    strip.hidden    = true;
    return;
  }
  strip.hidden    = false;
  strip.innerHTML = state.pendingFiles.map((f, i) => {
    const imgTag = f.type === 'image'
      ? `<img src="${f.dataUrl}" alt="" width="22" height="22" style="border-radius:var(--r-sm);object-fit:cover;">`
      : '<span>📎</span>';
    return `<div class="file-preview">
      ${imgTag}
      <span class="file-preview-name">${escHtml(f.name)}</span>
      <button class="file-remove-btn" data-idx="${i}" aria-label="Remove ${escHtml(f.name)}">×</button>
    </div>`;
  }).join('');

  // Delegate remove clicks
  strip.querySelectorAll('.file-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.pendingFiles.splice(Number(btn.dataset.idx), 1);
      renderFileStrip();
    });
  });
}

// ── Build API messages ──────────────────────────────────────────────────
function buildApiMessages(sess, sysPrompt, userText) {
  const msgs = [];

  if (sysPrompt?.trim()) {
    msgs.push({ role: 'system', content: sysPrompt.trim() });
  }

  sess.messages
    .filter(m => m.role !== 'system')
    .forEach(m => msgs.push({ role: m.role, content: m.content }));

  let userContent = userText;
  state.pendingFiles
    .filter(f => f.type === 'table' || f.type === 'text')
    .forEach(f => {
      if (f.type === 'table' && f.parsed) {
        userContent += `\n\n---\n${f.parsed.summary}\n\n${f.parsed.previewMarkdown}`;
      } else if (f.type === 'text') {
        userContent += `\n\n---\nFile: ${f.name}\n\`\`\`\n${f.content.slice(0, 12000)}\n\`\`\``;
      }
    });

  msgs.push({ role: 'user', content: userContent });
  return msgs;
}

// ── Send message ───────────────────────────────────────────────────────
async function sendMessage() {
  if (state.streaming) return;

  const ta       = DOM.textarea();
  const userText = ta?.value?.trim() || '';
  if (!userText && !state.pendingFiles.length) return;

  const model     = DOM.modelSelect()?.value || FALLBACK_MODELS[0].id;
  const sysPrompt = DOM.sysPrompt()?.value || '';
  const sess      = currentSession();
  if (!sess) return;

  state.streaming = true;
  const btn = DOM.sendBtn();
  if (btn) btn.disabled = true;
  if (ta)  { ta.value = ''; autoResizeTextarea(ta); }
  if (btn) btn.disabled = true;

  const imageUrls = state.pendingFiles.filter(f => f.type === 'image').map(f => f.dataUrl);
  const fileNames = state.pendingFiles.filter(f => f.type !== 'image').map(f => f.name);

  const userMsg = {
    id: genId(), role: 'user', content: userText,
    ts: Date.now(), imageUrls, fileNames, model,
  };
  sess.messages.push(userMsg);
  if (sess.messages.length === 1) {
    sess.title = userText.slice(0, 40) || 'New chat';
    const tt = DOM.topbarTitle();
    if (tt) tt.textContent = sess.title;
  }
  sess.tokenCount = (sess.tokenCount || 0) + approxTokens(userText);
  renderMessages();

  // Build API messages
  let apiMessages = buildApiMessages(sess, sysPrompt, userText);

  // OCR / vision payloads
  if (window.AppOCR) {
    const { messages, hasImages } =
      await window.AppOCR.preparePayload(model, apiMessages, state.pendingFiles, userText);
    apiMessages = messages;
    if (!hasImages && imageUrls.length) {
      const last = apiMessages[apiMessages.length - 1];
      if (typeof last.content === 'string') {
        last.content += `\n\n[User attached image(s): ${imageUrls.map((_, i) => `image_${i+1}`).join(', ')} — this model does not support vision]`;
      }
    }
  }

  // Web search context
  let searched = false;
  if (window.AppSearch) {
    const doSearch = state.searchEnabled || window.AppSearch.needsSearch?.(userText);
    if (doSearch) {
      showToast('🔍 Searching the web…', '', 5000);
      const result = state.searchEnabled
        ? await window.AppSearch.forceSearch(userText)
        : await window.AppSearch.prepareContext(userText);
      if (result?.contextBlock) {
        const last = apiMessages[apiMessages.length - 1];
        if (typeof last.content === 'string') {
          last.content = result.contextBlock + '\n\n---\n\nUser question: ' + last.content;
        }
        searched = true;
      }
      showToast('');
    }
  }

  // Clear pending files AFTER building messages
  state.pendingFiles = [];
  renderFileStrip();

  // Streaming placeholder
  const aiMsgId = genId();
  const aiMsg   = { id: aiMsgId, role: 'assistant', content: '', ts: Date.now(), model, searched };
  sess.messages.push(aiMsg);
  renderMessages();

  const msgEl = document.querySelector(`[data-id="${aiMsgId}"] .msg-content`);
  if (msgEl) msgEl.innerHTML = '<span class="streaming-cursor"></span>';

  try {
    const resp = await fetch(`${PROXY_URL}/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model,
        messages:    apiMessages,
        stream:      true,
        temperature: 0.7,
        max_tokens:  4096,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => `HTTP ${resp.status}`);
      let errMsg = `HTTP ${resp.status}`;
      try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
      throw new Error(errMsg);
    }

    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';
    let   full    = '';

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break outer;
        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta?.content || '';
          full += delta;
          if (msgEl) {
            msgEl.innerHTML = renderMd(full) + '<span class="streaming-cursor"></span>';
            DOM.messages().scrollTop = DOM.messages().scrollHeight;
          }
        } catch { /* malformed SSE chunk — skip */ }
      }
    }

    // Finalise — remove streaming cursor
    aiMsg.content = full;
    if (msgEl) msgEl.innerHTML = renderMd(full);
    sess.tokenCount = (sess.tokenCount || 0) + approxTokens(full);

  } catch (err) {
    aiMsg.content = `⚠️ ${err.message || 'Failed to fetch'}`;
    if (msgEl) msgEl.innerHTML =
      `<span style="color:var(--tx3)">⚠️ ${escHtml(err.message || 'Failed to fetch')}</span>`;
    showToast(err.message || 'Request failed', 'error');
  }

  state.streaming = false;
  if (DOM.sendBtn()) DOM.sendBtn().disabled = !DOM.textarea()?.value?.trim();
  renderHistory();
  updateStats();
  saveState();
}

// ── Export chat ───────────────────────────────────────────────────────
function exportChat() {
  const sess = currentSession();
  if (!sess?.messages?.length) { showToast('Nothing to export', 'error'); return; }

  const lines = [
    `# ${sess.title}`,
    `Exported: ${new Date().toLocaleString()}`,
    '',
    ...sess.messages.map(m => {
      const role = m.role === 'user' ? '**You**' : `**AI (${m.model || 'Assistant'})**`;
      return `${role}\n\n${m.content}\n\n---`;
    }),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `chat-${sess.id}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Chat exported!', 'success');
}

// ── Persistence ────────────────────────────────────────────────────────
function saveState() {
  try {
    localStorage.setItem('cc_state', JSON.stringify({
      sessions:  state.sessions,
      currentId: state.currentId,
    }));
  } catch {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('cc_state');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.sessions)  state.sessions  = saved.sessions;
    if (saved.currentId && state.sessions[saved.currentId]) {
      state.currentId = saved.currentId;
    }
  } catch {}
}

// ── Textarea auto-resize ────────────────────────────────────────────────
function autoResizeTextarea(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
}

// ── API key validation ────────────────────────────────────────────────
function validateKey(key) {
  const status = DOM.keyStatus();
  if (!status) return;
  if (!key) { status.textContent = ''; status.className = 'key-status'; return; }
  if (key.startsWith('sk-or-') && key.length > 20) {
    status.textContent = '✓ Key looks valid';
    status.className   = 'key-status ok';
    localStorage.setItem('cc_key', key);
  } else {
    status.textContent = 'OpenRouter keys start with sk-or-…';
    status.className   = 'key-status err';
  }
}

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  loadState();

  if (!Object.keys(state.sessions).length || !state.currentId) {
    state.currentId = newSession();
  }

  const savedKey = localStorage.getItem('cc_key');
  if (savedKey && DOM.keyInput()) DOM.keyInput().value = savedKey;

  showToast('Loading models…', '', 5000);
  await loadModels();
  showToast('');

  // Model select
  DOM.modelSelect()?.addEventListener('change', () => {
    localStorage.setItem('selectedModel', DOM.modelSelect().value);
    updateTopbarBadge();
    updateStats();
  });

  // Send
  DOM.sendBtn()?.addEventListener('click', sendMessage);
  DOM.textarea()?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  DOM.textarea()?.addEventListener('input', e => {
    autoResizeTextarea(e.target);
    const btn = DOM.sendBtn();
    if (btn) btn.disabled = !e.target.value.trim() && !state.pendingFiles.length;
  });

  // Attach
  DOM.fileInput()?.addEventListener('change', e => {
    handleFiles(e.target.files);
    e.target.value = '';
  });
  DOM.attachBtn()?.addEventListener('click', () => DOM.fileInput()?.click());

  // API key
  DOM.keyInput()?.addEventListener('input', e => validateKey(e.target.value.trim()));
  document.querySelector('.key-vis-btn')?.addEventListener('click', () => {
    const inp = DOM.keyInput();
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // New chat
  DOM.newChatBtn()?.addEventListener('click', () => {
    state.currentId = newSession();
    switchSession(state.currentId);
    saveState();
  });

  // Sidebar collapse (inside sidebar) — closes sidebar
  DOM.sidebarToggle()?.addEventListener('click', closeSidebar);

  // Sidebar open (topbar hamburger) — opens sidebar
  DOM.sidebarOpen()?.addEventListener('click', openSidebar);

  // Backdrop tap — closes sidebar on mobile
  DOM.sidebarBackdrop()?.addEventListener('click', closeSidebar);

  // Theme
  DOM.themeToggle()?.addEventListener('click', toggleTheme);

  // Search toggle
  DOM.searchToggle()?.addEventListener('click', () => {
    state.searchEnabled = !state.searchEnabled;
    const btn = DOM.searchToggle();
    if (btn) {
      btn.setAttribute('aria-pressed',        String(state.searchEnabled));
      btn.setAttribute('data-search-active',  String(state.searchEnabled));
      btn.title = state.searchEnabled ? 'Web search ON' : 'Web search OFF';
    }
    showToast(state.searchEnabled ? '🌐 Web search enabled' : 'Web search off', '', 2000);
  });

  // Export
  $('exportBtn')?.addEventListener('click', exportChat);

  // Drag-and-drop
  const inputBox = document.querySelector('.input-box');
  inputBox?.addEventListener('dragover',  e => { e.preventDefault(); inputBox.classList.add('drag-over'); });
  inputBox?.addEventListener('dragleave', ()  => inputBox.classList.remove('drag-over'));
  inputBox?.addEventListener('drop',      e  => {
    e.preventDefault();
    inputBox.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  renderMessages();
  renderHistory();
  updateStats();
  updateTopbarBadge();
}

document.addEventListener('DOMContentLoaded', init);

})();
