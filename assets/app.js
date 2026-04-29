// ── State ────────────────────────────────────────────────
const state = { sessions:[], activeId:null, isStreaming:false, pendingFiles:[], lastRespMs:null };
const CTX_LIMIT = 200000;

// ── DOM ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const messagesWrap=$('messages-wrap'), chatInput=$('chat-input'), sendBtn=$('send-btn');
const modelSelect=$('model-select'), historyList=$('chat-history');
const newChatBtn=$('new-chat-btn'), clearBtn=$('clear-btn');
const sidebarEl=document.querySelector('.sidebar'), sidebarToggle=$('sidebar-toggle');
const attachBtn=$('attach-btn'), fileInput=$('file-input'), fileStrip=$('file-strip'), inputBox=$('input-box');
const topbarTitle=$('topbar-title'), topbarModel=$('topbar-model'), exportBtn=$('export-btn'), sysPrompt=$('sys-prompt');
const statMsgs=$('stat-msgs'), statTokens=$('stat-tokens'), statChars=$('stat-chars'), statTime=$('stat-time');
const tokenBar=$('token-bar'), tokenBarLbl=$('token-bar-label');

// ── Theme ────────────────────────────────────────────────
(function(){
  const btn=document.getElementById('theme-toggle'), root=document.documentElement;
  let dark=root.getAttribute('data-theme')==='dark'||(window.matchMedia('(prefers-color-scheme:dark)').matches&&!root.getAttribute('data-theme'));
  const SUN=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
  const MOON=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const upd=()=>{root.setAttribute('data-theme',dark?'dark':'light');btn.innerHTML=dark?SUN:MOON;btn.setAttribute('aria-label',`Switch to ${dark?'light':'dark'} mode`);};
  upd(); btn.addEventListener('click',()=>{dark=!dark;upd();});
})();

// ── Sidebar ───────────────────────────────────────────────
sidebarToggle.addEventListener('click',()=>{
  sidebarEl.classList.toggle('collapsed');
  sidebarToggle.setAttribute('aria-expanded',String(!sidebarEl.classList.contains('collapsed')));
});

// ── Sessions ──────────────────────────────────────────────
function createSession(){
  const id=Date.now().toString(36);
  const s={id,title:'New Chat',messages:[],tokenEst:0,charCount:0};
  state.sessions.unshift(s); state.activeId=id; return s;
}
function getSession(){ return state.sessions.find(s=>s.id===state.activeId)||createSession(); }

function renderHistory(){
  historyList.innerHTML='';
  state.sessions.forEach(s=>{
    const el=document.createElement('div');
    el.className='history-item'+(s.id===state.activeId?' active':'');
    el.textContent=s.title; el.title=s.title; el.setAttribute('role','listitem');
    el.addEventListener('click',()=>{state.activeId=s.id;renderHistory();renderMessages();updateStats();});
    historyList.appendChild(el);
  });
}

// ── Stats ─────────────────────────────────────────────────
function updateStats(){
  const s=getSession();
  const chars=s.charCount||0, tokens=s.tokenEst||0;
  statMsgs.textContent=s.messages.length;
  statChars.textContent=chars>=1000?(chars/1000).toFixed(1)+'k':chars;
  statTokens.textContent=tokens>=1000?(tokens/1000).toFixed(1)+'k':tokens;
  statTime.textContent=state.lastRespMs!=null?state.lastRespMs+'s':'—';
  const pct=Math.min((tokens/CTX_LIMIT)*100,100);
  tokenBar.style.width=pct+'%';
  if(pct>80) tokenBar.style.background='linear-gradient(90deg,#f6ad55,#e53e3e)';
  else if(pct>50) tokenBar.style.background='linear-gradient(90deg,var(--accent),#f6ad55)';
  else tokenBar.style.background='linear-gradient(90deg,var(--accent),color-mix(in oklab,var(--accent) 60%,#ff6b35))';
  tokenBarLbl.textContent=`${tokens>=1000?(tokens/1000).toFixed(1)+'k':tokens} / 200k ctx`;
  topbarTitle.textContent=s.title;
  topbarModel.textContent=(modelSelect.options[modelSelect.selectedIndex]?.text||'').replace(' ⭐','').replace(' ⚡','');
}
modelSelect.addEventListener('change',updateStats);

// ── Markdown ──────────────────────────────────────────────
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function renderMd(text){
  const blocks=[]; 
  text=text.replace(/```(\w*)\n?([\s\S]*?)```/g,(_,lang,code)=>{
    const i=blocks.length; blocks.push({lang:lang||'code',code:code.trim(),id:`cb_${i}`});
    return `\x00BLK${i}\x00`;
  });
  text=text.replace(/`([^`\n]+)`/g,(_,c)=>`<code>${esc(c)}</code>`);
  text=text.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  text=text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  text=text.replace(/\*(.+?)\*/g,'<em>$1</em>');
  text=text.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  text=text.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  text=text.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  text=text.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
  text=text.replace(/^---$/gm,'<hr>');
  text=text.replace(/^(\s*[-*+] .+)/gm,l=>`<li>${l.replace(/^\s*[-*+] /,'')}</li>`);
  text=text.replace(/(<li>[\s\S]+?<\/li>)/g,'<ul>$1</ul>');
  text=text.split(/\n{2,}/).map(b=>{
    b=b.trim(); if(!b) return '';
    if(/^\x00BLK/.test(b)||/^<(h[1-3]|ul|ol|li|hr|blockquote)/.test(b)) return b;
    return `<p>${b.replace(/\n/g,'<br>')}</p>`;
  }).join('');
  blocks.forEach(({lang,code},i)=>{
    const btn=`<button class="copy-code-btn" onclick="copyCode(this,${i})">Copy</button>`;
    const html=`<pre><div class="code-header"><span class="code-lang">${lang}</span>${btn}</div><code id="cb_${i}">${esc(code)}</code></pre>`;
    text=text.replace(`\x00BLK${i}\x00`,html);
  });
  return text;
}
window.copyCode=function(btn,i){
  const el=document.getElementById('cb_'+i); if(!el) return;
  navigator.clipboard.writeText(el.textContent).then(()=>{btn.textContent='Copied!';setTimeout(()=>btn.textContent='Copy',1500);});
};

// ── Render messages ───────────────────────────────────────
function renderMessages(){
  const s=getSession(); messagesWrap.innerHTML='';
  if(!s.messages.length){messagesWrap.appendChild(buildWelcome());return;}
  s.messages.forEach(m=>messagesWrap.appendChild(buildMsg(m.role,m.content,m.files)));
  scrollBottom();
}

function buildWelcome(){
  const d=document.createElement('div'); d.className='welcome';
  d.innerHTML=`<div class="welcome-icon"><svg width="52" height="52" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--accent)"/><path d="M10 22L16 10L22 22" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 18H19.5" stroke="white" stroke-width="2" stroke-linecap="round"/></svg></div>
  <h1>What can I help with?</h1>
  <p>Free unlimited Claude via Puter.js — attach files, images, code & more.</p>
  <div class="suggestions">
    <button class="suggestion-chip">Write a Python data cleaning script</button>
    <button class="suggestion-chip">Debug my Google Apps Script</button>
    <button class="suggestion-chip">Explain this regex pattern</button>
    <button class="suggestion-chip">Review my code</button>
    <button class="suggestion-chip">Write a SQL query</button>
    <button class="suggestion-chip">Summarize a document</button>
  </div>`;
  d.querySelectorAll('.suggestion-chip').forEach(b=>b.addEventListener('click',()=>{chatInput.value=b.textContent;adjustTextarea();updateSendBtn();sendMessage();}));
  return d;
}

function buildMsg(role,content,files=[]){
  const wrap=document.createElement('div'); wrap.className=`msg ${role}`;
  const av=document.createElement('div'); av.className='msg-avatar'; av.setAttribute('aria-hidden','true'); av.textContent=role==='user'?'U':'C';
  const body=document.createElement('div'); body.className='msg-body';
  const meta=document.createElement('div'); meta.className='msg-meta';
  const roleEl=document.createElement('span'); roleEl.className='msg-role'; roleEl.textContent=role==='user'?'You':'Claude';
  const timeEl=document.createElement('span'); timeEl.className='msg-time'; timeEl.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  meta.append(roleEl,timeEl);
  const contentEl=document.createElement('div'); contentEl.className='msg-content';
  if(files&&files.length) files.forEach(f=>{
    if(f.type==='image'){const img=document.createElement('img');img.src=f.dataUrl;img.className='msg-img';img.alt=f.name;img.loading='lazy';contentEl.appendChild(img);}
    else{const chip=document.createElement('div');chip.className='msg-file-chip';chip.innerHTML=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${esc(f.name)}`;contentEl.appendChild(chip);}
  });
  const td=document.createElement('div'); td.innerHTML=content?renderMd(content):''; contentEl.appendChild(td);
  const acts=document.createElement('div'); acts.className='msg-actions';
  const copyBtn=document.createElement('button'); copyBtn.className='msg-act-btn';
  copyBtn.innerHTML=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
  copyBtn.addEventListener('click',()=>{navigator.clipboard.writeText(content).then(()=>{copyBtn.innerHTML=`✓ Copied!`;setTimeout(()=>{copyBtn.innerHTML=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;},1600);});});
  acts.appendChild(copyBtn);
  body.append(meta,contentEl,acts); wrap.append(av,body); return wrap;
}

// ── File handling ─────────────────────────────────────────
const TEXT_EXTS=['.txt','.md','.csv','.json','.py','.js','.ts','.html','.css','.xml','.yaml','.yml','.sh','.sql'];
function readAsDataUrl(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(f);});}
function readAsText(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsText(f);});}

async function addFiles(files){
  for(const file of files){
    const ext='.'+file.name.split('.').pop().toLowerCase();
    if(file.type.startsWith('image/')){const d=await readAsDataUrl(file);state.pendingFiles.push({file,name:file.name,type:'image',dataUrl:d});}
    else if(TEXT_EXTS.includes(ext)||file.type==='text/plain'){const c=await readAsText(file);state.pendingFiles.push({file,name:file.name,type:'text',content:c});}
    else{try{const c=await readAsText(file);state.pendingFiles.push({file,name:file.name,type:'text',content:c});}catch{showToast('Unsupported: '+file.name,'error');}}
  }
  renderFileStrip(); updateSendBtn();
}

function renderFileStrip(){
  fileStrip.innerHTML='';
  if(!state.pendingFiles.length){fileStrip.hidden=true;return;}
  fileStrip.hidden=false;
  state.pendingFiles.forEach((f,i)=>{
    const chip=document.createElement('div'); chip.className='file-preview';
    if(f.type==='image'){const img=document.createElement('img');img.src=f.dataUrl;img.alt=f.name;chip.appendChild(img);}
    else chip.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    const name=document.createElement('span'); name.className='file-preview-name'; name.textContent=f.name;
    const rm=document.createElement('button'); rm.className='file-remove-btn'; rm.innerHTML='✕'; rm.setAttribute('aria-label','Remove '+f.name);
    rm.addEventListener('click',()=>{state.pendingFiles.splice(i,1);renderFileStrip();updateSendBtn();});
    chip.append(name,rm); fileStrip.appendChild(chip);
  });
}

attachBtn.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',()=>{addFiles(Array.from(fileInput.files));fileInput.value='';});
inputBox.addEventListener('dragover',e=>{e.preventDefault();inputBox.classList.add('drag-over');});
inputBox.addEventListener('dragleave',()=>inputBox.classList.remove('drag-over'));
inputBox.addEventListener('drop',e=>{e.preventDefault();inputBox.classList.remove('drag-over');addFiles(Array.from(e.dataTransfer.files));});
chatInput.addEventListener('paste',e=>{
  const img=Array.from(e.clipboardData?.items||[]).find(it=>it.type.startsWith('image/'));
  if(img){e.preventDefault();addFiles([img.getAsFile()]);}
});

// ── Send message ──────────────────────────────────────────
async function sendMessage(){
  const text=chatInput.value.trim();
  if((!text&&!state.pendingFiles.length)||state.isStreaming) return;
  const session=getSession();
  const files=[...state.pendingFiles]; state.pendingFiles=[]; renderFileStrip();
  let apiContent=text;
  if(files.length){
    const txtFiles=files.filter(f=>f.type==='text');
    if(txtFiles.length) apiContent+='\n\n'+txtFiles.map(f=>`### File: ${f.name}\n\`\`\`\n${f.content.slice(0,12000)}\n\`\`\``).join('\n\n');
    const imgFiles=files.filter(f=>f.type==='image');
    if(imgFiles.length) apiContent+='\n\n[User attached '+imgFiles.length+' image(s): '+imgFiles.map(f=>f.name).join(', ')+']';
  }
  session.messages.push({role:'user',content:apiContent,files,displayContent:text});
  if(session.messages.length===1) session.title=text.slice(0,42)+(text.length>42?'…':'');
  chatInput.value=''; adjustTextarea(); sendBtn.disabled=true; state.isStreaming=true;
  const welcome=messagesWrap.querySelector('.welcome'); if(welcome) welcome.remove();
  messagesWrap.appendChild(buildMsg('user',text,files));
  renderHistory(); scrollBottom();
  const assistantEl=buildMsg('assistant','');
  const td=assistantEl.querySelector('.msg-content > div');
  td.className='streaming-cursor';
  messagesWrap.appendChild(assistantEl); scrollBottom();
  let fullText=''; const t0=Date.now();
  try{
    const model=modelSelect.value, sys=sysPrompt.value.trim();
    const apiMessages=[];
    if(sys) apiMessages.push({role:'system',content:sys});
    session.messages.forEach(m=>apiMessages.push({role:m.role,content:m.content}));
    const response=await puter.ai.chat(apiMessages,{model,stream:true});
    for await(const part of response){const c=part?.text||'';if(c){fullText+=c;td.innerHTML=renderMd(fullText);scrollBottom();}}
    td.classList.remove('streaming-cursor');
    session.messages.push({role:'assistant',content:fullText});
    state.lastRespMs=((Date.now()-t0)/1000).toFixed(1);
    const chars=session.messages.reduce((a,m)=>a+(m.content?.length||0),0);
    session.charCount=chars; session.tokenEst=Math.round(chars/4);
    updateStats();
  }catch(err){
    td.classList.remove('streaming-cursor');
    td.innerHTML=`<p style="color:var(--text-2)">⚠️ ${esc(err?.message||'API error. Try signing in to Puter.')}</p>`;
    session.messages.pop(); showToast(err?.message||'API call failed','error');
  }finally{state.isStreaming=false;updateSendBtn();renderHistory();scrollBottom();}
}

// ── Export ────────────────────────────────────────────────
exportBtn.addEventListener('click',()=>{
  const s=getSession();
  if(!s.messages.length){showToast('Nothing to export','error');return;}
  const md=`# ${s.title}\n\n`+s.messages.map(m=>`**${m.role==='user'?'You':'Claude'}:**\n\n${m.content}`).join('\n\n---\n\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([md],{type:'text/markdown'}));
  a.download=s.title.replace(/[^a-z0-9]/gi,'_').toLowerCase()+'.md'; a.click();
  showToast('Exported as Markdown ✓','success');
});

// ── Clear / New ───────────────────────────────────────────
newChatBtn.addEventListener('click',()=>{createSession();renderHistory();renderMessages();updateStats();chatInput.focus();});
clearBtn.addEventListener('click',()=>{const s=getSession();s.messages=[];s.title='New Chat';s.charCount=0;s.tokenEst=0;state.lastRespMs=null;renderHistory();renderMessages();updateStats();});

// ── Input helpers ─────────────────────────────────────────
function adjustTextarea(){chatInput.style.height='auto';chatInput.style.height=Math.min(chatInput.scrollHeight,160)+'px';}
function updateSendBtn(){sendBtn.disabled=(chatInput.value.trim()===''&&!state.pendingFiles.length)||state.isStreaming;}
chatInput.addEventListener('input',()=>{adjustTextarea();updateSendBtn();});
chatInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!sendBtn.disabled)sendMessage();}});
sendBtn.addEventListener('click',sendMessage);
function scrollBottom(){requestAnimationFrame(()=>messagesWrap.scrollTop=messagesWrap.scrollHeight);}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg,type=''){
  const t=$('toast');t.textContent=msg;t.className='toast'+(type?' '+type:'')+' show';
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),3500);
}

// ── GitHub Actions workflow ───────────────────────────────
// Create .github/workflows/deploy.yml with this content:
/*
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
*/

// ── Init ──────────────────────────────────────────────────
createSession(); renderHistory(); renderMessages(); updateStats(); chatInput.focus();
