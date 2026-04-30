// ═══ PROXY CONFIG ══════════════════════════════════════════
// Set this to your Cloudflare Worker URL or Netlify function URL.
// Leave as "" to use direct OpenRouter API (requires sidebar key).
//
// Cloudflare Worker (GitHub Pages):  "https://YOUR-WORKER.workers.dev"
// Netlify function:                  "/api/chat"  (works automatically)
//
const PROXY_URL = "https://dark-feather-5042.insightfulscroll.workers.dev";

const MODEL_CAPS = {
  'baidu/qianfan-ocr-fast:free': { kind: 'ocr', multimodal: true },
  'tencent/hy3-preview:free': { kind: 'multimodal', multimodal: true },
  'minimax/minimax-m2.5:free': { kind: 'text', multimodal: false },
  'nvidia/nemotron-nano-12b-v2-vl:free': { kind: 'vision', multimodal: true },
  'google/gemma-4-31b-it:free': { kind: 'multimodal', multimodal: true },
  'google/gemma-4-26b-a4b-it:free': { kind: 'multimodal', multimodal: true },
  'google/gemma-3-27b-it:free': { kind: 'multimodal', multimodal: true },
  'google/gemma-3-12b-it:free': { kind: 'multimodal', multimodal: true },
  'google/gemma-3-4b-it:free': { kind: 'multimodal', multimodal: true },
  'google/gemma-3n-e4b-it:free': { kind: 'multimodal', multimodal: true },
  'google/gemma-3n-e2b-it:free': { kind: 'multimodal', multimodal: true },
};

function getSelectedModelMeta() {
  return MODEL_CAPS[ms?.value] || { kind: 'text', multimodal: false };
}

const OR_DIRECT = "https://openrouter.ai/api/v1/chat/completions";
const CTX_LIMIT  = 128000;

// ═══ STATE ════════════════════════════════════════════════
const state = {
  sessions: [],
  activeId: null,
  isStreaming: false,
  pendingFiles: [],
  lastRespMs: null,
  apiKey: ''
};

// ═══ DOM ══════════════════════════════════════════════════
const $   = id => document.getElementById(id);
const mw  = $('messages-wrap');
const ci  = $('chat-input');
const sb  = $('send-btn');
const ms  = $('model-select');
const hl  = $('chat-history');
const ncb = $('new-chat-btn');
const clb = $('clear-btn');
const sid = document.querySelector('.sidebar');
const stg = $('sidebar-toggle');
const atb = $('attach-btn');
const fi  = $('file-input');
const fs  = $('file-strip');
const ibx = $('input-box');
const tbt = $('topbar-title');
const tbm = $('topbar-model');
const exp = $('export-btn');
const syp = $('sys-prompt');
const aki = $('api-key-input');
const kvb = $('key-vis-btn');
const kst = $('key-status');
const smg = $('stat-msgs');
const stk = $('stat-tokens');
const sch = $('stat-chars');
const stm = $('stat-time');
const tb  = $('token-bar');
const tbl = $('token-bar-label');

// ═══ KEY RESOLUTION ════════════════════════════════════════
// Priority: PROXY_URL > config.js > sidebar input
function getApiKey() {
  if (PROXY_URL) return '__proxy__';
  if (window.APP_CONFIG?.OPENROUTER_API_KEY) return window.APP_CONFIG.OPENROUTER_API_KEY;
  return state.apiKey;
}
function isProxyMode() { return !!PROXY_URL; }
function hasValidKey() {
  if (isProxyMode()) return true;
  const k = getApiKey();
  return k && k.length > 10;
}

// ═══ THEME ════════════════════════════════════════════════
(function () {
  const btn = $('theme-toggle');
  const root = document.documentElement;
  let dark = root.getAttribute('data-theme') === 'dark' ||
    (!root.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const SUN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  const MOON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  const upd = () => {
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    btn.innerHTML = dark ? SUN : MOON;
    btn.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  };

  upd();
  btn.addEventListener('click', () => {
    dark = !dark;
    upd();
  });
})();

// ═══ SIDEBAR TOGGLE ═══════════════════════════════════════
stg.addEventListener('click', () => {
  sid.classList.toggle('collapsed');
});

// ═══ KEY FIELD SETUP ══════════════════════════════════════
function setupKeyField() {
  const keyRow = $('key-row');
  if (!keyRow) return;

  if (isProxyMode()) {
    keyRow.hidden = true;
    kst.textContent = '🔒 Key secured via server proxy';
    kst.className = 'key-status ok';
    return;
  }

  if (window.APP_CONFIG?.OPENROUTER_API_KEY) {
    aki.value = '••••••••••••••••';
    kst.textContent = '✓ Key loaded from config.js';
    kst.className = 'key-status ok';
    aki.disabled = true;
  }
}

aki.addEventListener('input', () => {
  state.apiKey = aki.value.trim();
  if (!state.apiKey) {
    kst.textContent = '';
    kst.className = 'key-status';
  } else if (state.apiKey.startsWith('sk-or-')) {
    kst.textContent = '✓ Looks valid';
    kst.className = 'key-status ok';
  } else {
    kst.textContent = 'Key should start with sk-or-';
    kst.className = 'key-status err';
  }
  updateSendBtn();
  renderMessages();
});

kvb.addEventListener('click', () => {
  const show = aki.type === 'password';
  aki.type = show ? 'text' : 'password';
  kvb.innerHTML = show
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
});

// ═══ SESSIONS ════════════════════════════════════════════
function createSession() {
  const id = Date.now().toString(36);
  const s = { id, title: 'New Chat', messages: [], tokenEst: 0, charCount: 0 };
  state.sessions.unshift(s);
  state.activeId = id;
  return s;
}

function getSession() {
  return state.sessions.find(s => s.id === state.activeId) || createSession();
}

function renderHistory() {
  hl.innerHTML = '';
  state.sessions.forEach(s => {
    const el = document.createElement('div');
    el.className = 'history-item' + (s.id === state.activeId ? ' active' : '');
    el.textContent = s.title;
    el.title = s.title;
    el.setAttribute('role', 'listitem');
    el.addEventListener('click', () => {
      state.activeId = s.id;
      renderHistory();
      renderMessages();
      updateStats();
    });
    hl.appendChild(el);
  });
}

// ═══ STATS ═══════════════════════════════════════════════
function fmtNum(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

function updateStats() {
  const s = getSession();
  smg.textContent = s.messages.length;
  sch.textContent = fmtNum(s.charCount || 0);
  stk.textContent = fmtNum(s.tokenEst || 0);
  stm.textContent = state.lastRespMs != null ? state.lastRespMs + 's' : '—';

  const pct = Math.min(((s.tokenEst || 0) / CTX_LIMIT) * 100, 100);
  tb.style.width = pct + '%';

  if (pct > 80) tb.style.background = 'linear-gradient(90deg,#f59e0b,#ef4444)';
  else if (pct > 50) tb.style.background = 'linear-gradient(90deg,var(--ac),#f59e0b)';
  else tb.style.background = 'linear-gradient(90deg,var(--ac),#06b6d4)';

  tbl.textContent = `${fmtNum(s.tokenEst || 0)} / 128k ctx`;
  tbt.textContent = s.title;

  const modelLabel = ms.options[ms.selectedIndex]?.text || '';
  tbm.textContent = modelLabel.replace(' ⭐', '').replace('(free)', '').trim();
}
ms.addEventListener('change', updateStats);

// ═══ MARKDOWN ════════════════════════════════════════════
function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMd(raw) {
  const blocks = [];
  let text = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = blocks.length;
    const id = `cb_${Date.now()}_${i}`;
    blocks.push({ lang: lang || 'code', code: code.trim(), id });
    return `\x00BLK${i}\x00`;
  });

  text = text.replace(/`([^`\n]+)`/g, (_, c) => `<code>${esc(c)}</code>`);
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  text = text.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  text = text.replace(/^---$/gm, '<hr>');
  text = text.replace(/^(\s*[-*+] .+)/gm, l => `<li>${l.replace(/^\s*[-*+] /, '')}</li>`);
  text = text.replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>');

  text = text.split(/\n{2,}/).map(b => {
    b = b.trim();
    if (!b) return '';
    if (/^\x00BLK/.test(b) || /^<(h[1-3]|ul|ol|li|hr|blockquote)/.test(b)) return b;
    return `<p>${b.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  blocks.forEach(({ lang, code, id }, i) => {
    const btn = `<button class="copy-code-btn" data-target="${id}">Copy</button>`;
    const html = `<pre><div class="code-header"><span class="code-lang">${lang}</span>${btn}</div><code id="${id}">${esc(code)}</code></pre>`;
    text = text.replace(`\x00BLK${i}\x00`, html);
  });

  return text;
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.copy-code-btn');
  if (!btn) return;
  const t = document.getElementById(btn.dataset.target);
  if (!t) return;

  navigator.clipboard.writeText(t.textContent).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 1600);
  });
});

// ═══ RENDER MESSAGES ══════════════════════════════════════
function renderMessages() {
  const s = getSession();
  mw.innerHTML = '';
  if (!s.messages.length) {
    mw.appendChild(buildWelcome());
    return;
  }
  s.messages.forEach(m => mw.appendChild(buildMsg(m.role, m.content, m.files)));
  scrollBottom();
}

function buildWelcome() {
  const d = document.createElement('div');
  d.className = 'welcome';
  const needsKey = !isProxyMode() && !hasValidKey();

  d.innerHTML = `
    <div class="welcome-icon">
      <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
        <rect x="2" y="2" width="28" height="28" rx="8" fill="var(--ac)"/>
        <circle cx="16" cy="13" r="4" fill="white" opacity="0.9"/>
        <path d="M8 25c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.9"/>
      </svg>
    </div>
    <h1>Free AI Chat</h1>
    <p>20+ free models via OpenRouter — $0 per message.</p>
    ${needsKey ? `<div class="no-key-banner">⚠️ Paste your <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">OpenRouter API key</a> in the sidebar to start chatting.</div>` : ''}
    ${isProxyMode() ? `<div class="proxy-badge">🔒 Secured — key hidden via server proxy</div>` : ''}
    <div class="suggestions">
      <button class="suggestion-chip">Write a Python data cleaning script</button>
      <button class="suggestion-chip">Debug my Google Apps Script</button>
      <button class="suggestion-chip">Explain this regex pattern</button>
      <button class="suggestion-chip">Review my code</button>
      <button class="suggestion-chip">Write a SQL query</button>
      <button class="suggestion-chip">Summarize an attached document</button>
    </div>`;

  d.querySelectorAll('.suggestion-chip').forEach(b => b.addEventListener('click', () => {
    ci.value = b.textContent;
    adjustTA();
    updateSendBtn();
    sendMessage();
  }));

  return d;
}

function buildMsg(role, content, files = []) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;

  const av = document.createElement('div');
  av.className = 'msg-avatar';
  av.setAttribute('aria-hidden', 'true');
  av.textContent = role === 'user' ? 'U' : 'AI';

  const body = document.createElement('div');
  body.className = 'msg-body';

  const meta = document.createElement('div');
  meta.className = 'msg-meta';

  const roleEl = document.createElement('span');
  roleEl.className = 'msg-role';
  roleEl.textContent = role === 'user'
    ? 'You'
    : (ms.options[ms.selectedIndex]?.text || 'AI').replace(':free', '').replace('⭐', '').trim();

  const timeEl = document.createElement('span');
  timeEl.className = 'msg-time';
  timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  meta.append(roleEl, timeEl);

  const contentEl = document.createElement('div');
  contentEl.className = 'msg-content';

  if (files && files.length) {
    files.forEach(f => {
      if (f.type === 'image') {
        const img = document.createElement('img');
        img.src = f.dataUrl;
        img.className = 'msg-img';
        img.alt = f.name;
        img.loading = 'lazy';
        contentEl.appendChild(img);
      } else {

         const chip = document.createElement('div');
         chip.className = 'msg-file-chip';

        if (f.type === 'table') {
          chip.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>${esc(f.name)} <span style="opacity:0.6">(${f.rows}r × ${f.cols}c)</span>`;
        } else if (f.type === 'binary') {
          chip.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>${esc(f.name)}`;
        } else {
          chip.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${esc(f.name)}`;
      }
        

        contentEl.appendChild(chip);
      }
    });
  }

  const td = document.createElement('div');
  td.innerHTML = content ? renderMd(content) : '';
  contentEl.appendChild(td);

  const acts = document.createElement('div');
  acts.className = 'msg-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'msg-act-btn';
  copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(content).then(() => {
      copyBtn.innerHTML = '✓ Copied!';
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      }, 1600);
    });
  });

  acts.appendChild(copyBtn);
  body.append(meta, contentEl, acts);
  wrap.append(av, body);
  return wrap;
}

// ═══ SEND ════════════════════════════════════════════════
async function sendMessage() {
  const text = ci.value.trim();
  if ((!text && !state.pendingFiles.length) || state.isStreaming) return;

  if (!hasValidKey()) {
    showToast('Add your OpenRouter API key in the sidebar', 'error');
    aki.focus();
    return;
  }

  const session = getSession();
  const files = [...state.pendingFiles];
  state.pendingFiles = [];
  renderFileStrip();

  let apiContent = text;


    if (files.length) {
    const txtFiles = files.filter(f => f.type === 'text');
    if (txtFiles.length) {
      apiContent += '\n\n' + txtFiles
        .map(f => `### File: ${f.name}\n\`\`\`\n${f.content.slice(0, 14000)}\n\`\`\``)
        .join('\n\n');
    }

    const tableFiles = files.filter(f => f.type === 'table');
    if (tableFiles.length) {
      apiContent += '\n\n' + tableFiles.map(f => {
        const p = f.parsed;
        return [
          `### Data File: ${f.name}`,
          p.summary,
          '',
          `**Preview (first ${Math.min(p.rowCount, 25)} of ${p.rowCount} rows):**`,
          p.previewMarkdown
        ].join('\n');
      }).join('\n\n');
    }

    const binaryFiles = files.filter(f => f.type === 'binary');
    if (binaryFiles.length) {
      apiContent += '\n\n' + binaryFiles
        .map(f => `[Attached binary file: ${f.name} | type: ${f.ext}]`)
        .join('\n');
    }

    const imgFiles = files.filter(f => f.type === 'image');
    if (imgFiles.length) {
      apiContent += '\n\n[User attached image(s): ' + imgFiles.map(f => f.name).join(', ') + ']';
    }
  }


  session.messages.push({ role: 'user', content: apiContent, files, displayContent: text });

  if (session.messages.length === 1) {
    session.title = text.slice(0, 42) + (text.length > 42 ? '…' : '');
  }

  ci.value = '';
  adjustTA();
  sb.disabled = true;
  state.isStreaming = true;

  const welcome = mw.querySelector('.welcome');
  if (welcome) welcome.remove();

  mw.appendChild(buildMsg('user', text, files));
  renderHistory();
  scrollBottom();

  const aEl = buildMsg('assistant', '');
  const td = aEl.querySelector('.msg-content > div');
  td.className = 'streaming-cursor';
  mw.appendChild(aEl);
  scrollBottom();

  let fullText = '';
  const t0 = Date.now();

  try {
    const model = ms.value;
    const modelMeta = getSelectedModelMeta();

    if (/^google\/gemma-4-/i.test(model)) {
      showToast('Gemma 4 selected — if the provider pool is full, switch to Gemma 3 or GPT-OSS 120B', 'success');
    }
    if (modelMeta.kind === 'ocr') {
      showToast('OCR model selected — real OCR image payload routing comes in the next step', 'success');
    }

    const apiMessages = [];
    const sys = syp.value.trim();
    if (sys) apiMessages.push({ role: 'system', content: sys });
    session.messages.forEach(m => apiMessages.push({ role: m.role, content: m.content }));

    const endpoint = isProxyMode() ? PROXY_URL : OR_DIRECT;
    const headers = { 'Content-Type': 'application/json' };

    if (!isProxyMode()) {
      headers['Authorization'] = `Bearer ${getApiKey()}`;
      headers['HTTP-Referer'] = window.location.origin || 'http://localhost';
      headers['X-Title'] = 'AI Chat App';
    }

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: apiMessages,
        stream: true
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${resp.status}: ${resp.statusText}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            td.innerHTML = renderMd(fullText);
            scrollBottom();
          }
        } catch {}
      }
    }

    td.classList.remove('streaming-cursor');
    session.messages.push({ role: 'assistant', content: fullText });

    state.lastRespMs = ((Date.now() - t0) / 1000).toFixed(1);
    const chars = session.messages.reduce((a, m) => a + (m.content?.length || 0), 0);
    session.charCount = chars;
    session.tokenEst = Math.round(chars / 4);
    updateStats();
  } catch (err) {
    td.classList.remove('streaming-cursor');
    td.innerHTML = `<p style="color:var(--tx2)">⚠️ ${esc(err?.message || 'API error — check your key and model.')}</p>`;
    session.messages.pop();
    showToast(err?.message || 'Request failed', 'error');
  } finally {
    state.isStreaming = false;
    updateSendBtn();
    renderHistory();
    scrollBottom();
  }
}

// ═══ FILES ════════════════════════════════════════════════
const TXT_EXT = ['.txt','.md','.csv','.json','.py','.js','.ts','.html','.css','.xml','.yaml','.yml','.sh','.sql','.jsx','.tsx','.vue','.rs','.go','.rb','.php','.java','.c','.cpp','.h','.hpp','.log','.ini','.toml'];
const BINARY_EXT = ['.pdf','.xlsx','.xls'];

const readDataUrl = f => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = e => res(e.target.result);
  r.onerror = rej;
  r.readAsDataURL(f);
});

const readText = f => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = e => res(e.target.result);
  r.onerror = rej;
  r.readAsText(f);
});

async function addFiles(files) {
  for (const file of files) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (file.type.startsWith('image/')) {
      const d = await readDataUrl(file);
      state.pendingFiles.push({
        file, name: file.name, type: 'image', dataUrl: d, mime: file.type || 'image/png'
      });
    }
    else if (['.csv', '.xlsx', '.xls'].includes(ext)) {
      showToast(`Parsing ${file.name}…`, '');
      try {
        const parsed = await window.AppFiles.parseStructuredFile(file);
        state.pendingFiles.push({
          file, name: file.name, type: 'table',
          ext, parsed,
          rows: parsed.rowCount, cols: parsed.colCount,
          headers: parsed.headers
        });
        showToast(`${file.name} parsed — ${parsed.rowCount} rows × ${parsed.colCount} cols`, 'success');
      } catch (e) {
        showToast(`Could not parse ${file.name}: ${e.message}`, 'error');
      }
    }
    else if (TXT_EXT.includes(ext) || file.type === 'text/plain') {
      const c = await readText(file);
      state.pendingFiles.push({ file, name: file.name, type: 'text', content: c });
    }
    else if (BINARY_EXT.includes(ext)) {
      state.pendingFiles.push({
        file, name: file.name, type: 'binary', ext,
        note: 'Binary file attached.'
      });
      showToast(`${file.name} attached`, 'success');
    }
    else {
      try {
        const c = await readText(file);
        state.pendingFiles.push({ file, name: file.name, type: 'text', content: c });
      } catch {
        showToast('Cannot read: ' + file.name, 'error');
      }
    }
  }
  renderFileStrip();
  updateSendBtn();
}

function renderFileStrip() {
  fs.innerHTML = '';

  if (!state.pendingFiles.length) {
    fs.hidden = true;
    return;
  }

  fs.hidden = false;

  state.pendingFiles.forEach((f, i) => {
    const chip = document.createElement('div');
    chip.className = 'file-preview';

    if (f.type === 'image') {
      const img = document.createElement('img');
      img.src = f.dataUrl;
      img.alt = f.name;
      chip.appendChild(img);
    } else if (f.type === 'table') {
      chip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>`;
      chip.title = `${f.rows} rows × ${f.cols} cols`;
    } else if (f.type === 'binary') {
      chip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>`;
    } else {
      chip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    }

    const name = document.createElement('span');
    name.className = 'file-preview-name';
    name.textContent = f.name;

    const rm = document.createElement('button');
    rm.className = 'file-remove-btn';
    rm.innerHTML = '✕';
    rm.setAttribute('aria-label', 'Remove ' + f.name);
    rm.addEventListener('click', () => {
      state.pendingFiles.splice(i, 1);
      renderFileStrip();
      updateSendBtn();
    });

    chip.append(name, rm);
    fs.appendChild(chip);
  });
}

atb.addEventListener('click', () => fi.click());
fi.addEventListener('change', () => {
  addFiles(Array.from(fi.files));
  fi.value = '';
});
ibx.addEventListener('dragover', e => {
  e.preventDefault();
  ibx.classList.add('drag-over');
});
ibx.addEventListener('dragleave', () => ibx.classList.remove('drag-over'));
ibx.addEventListener('drop', e => {
  e.preventDefault();
  ibx.classList.remove('drag-over');
  addFiles(Array.from(e.dataTransfer.files));
});
ci.addEventListener('paste', e => {
  const img = Array.from(e.clipboardData?.items || []).find(it => it.type.startsWith('image/'));
  if (img) {
    e.preventDefault();
    addFiles([img.getAsFile()]);
  }
});

// ═══ EXPORT ═══════════════════════════════════════════════
exp.addEventListener('click', () => {
  const s = getSession();
  if (!s.messages.length) {
    showToast('Nothing to export', 'error');
    return;
  }

  const md = `# ${s.title}\n\n` + s.messages
    .map(m => `**${m.role === 'user' ? 'You' : 'AI'}:**\n\n${m.content}`)
    .join('\n\n---\n\n');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
  a.download = s.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.md';
  a.click();
  showToast('Exported ✓', 'success');
});

ncb.addEventListener('click', () => {
  createSession();
  renderHistory();
  renderMessages();
  updateStats();
  ci.focus();
});

clb.addEventListener('click', () => {
  const s = getSession();
  s.messages = [];
  s.title = 'New Chat';
  s.charCount = 0;
  s.tokenEst = 0;
  state.lastRespMs = null;
  renderHistory();
  renderMessages();
  updateStats();
});

function adjustTA() {
  ci.style.height = 'auto';
  ci.style.height = Math.min(ci.scrollHeight, 160) + 'px';
}

function updateSendBtn() {
  sb.disabled = (!ci.value.trim() && !state.pendingFiles.length) || state.isStreaming || !hasValidKey();
}

ci.addEventListener('input', () => {
  adjustTA();
  updateSendBtn();
});

ci.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function scrollBottom() {
  mw.scrollTo({ top: mw.scrollHeight, behavior: 'smooth' });
}

let _tt;
function showToast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(_tt);
  _tt = setTimeout(() => t.className = 'toast', 3200);
}

// ═══ INIT ═════════════════════════════════════════════════
setupKeyField();
createSession();
renderHistory();
renderMessages();
updateStats();
updateSendBtn();
