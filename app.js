// Muse — PWA : le chat vit dans les issues d'un dépôt privé GitHub ; une GitHub Action répond.
const $ = (s) => document.querySelector(s);
const msgs = $('#msgs'), input = $('#in'), modeSel = $('#mode');
const REPLY = '<!--muse-reply-->', ERROR = '<!--muse-error-->';
const API = localStorage.getItem('muse_api') || 'https://api.github.com';
let cfg = { repo: localStorage.getItem('muse_repo') || '', token: localStorage.getItem('muse_token') || '' };
let issueNo = null, busy = false, pollId = 0;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '').trim();
function render(text) {
  let h = esc(text);
  h = h.replace(/```(\w*)\n([\s\S]*?)(```|$)/g, (_, l, c) => `<pre><code>${c}</code></pre>`);
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|\n)#{1,4} ([^\n]+)/g, '$1<b>$2</b>');
  h = h.replace(/\b(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  return h;
}
function add(role, text, cls = '') {
  const d = document.createElement('div');
  d.className = `m ${role} ${cls}`; d.innerHTML = render(text);
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
}
const avatar = (s) => { try { window.MuseAvatar && window.MuseAvatar.setState(s); } catch {} };
const toast = (t) => { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2800); };

async function gh(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
  });
  if (!r.ok) { const e = new Error(r.status === 401 ? 'Token invalide ou expiré' : r.status === 404 ? 'Dépôt introuvable (vérifie le nom et les droits du token)' : `GitHub ${r.status}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}
const need = () => { if (!cfg.repo || !cfg.token) { openCfg(); return false; } return true; };

function empty() {
  msgs.innerHTML = `<div id="empty"><h1>✨ Salut Cédric</h1><div>Je suis Muse, propulsée par Claude. Je te réponds dès que tu es connecté, même PC éteint.</div>
  <div class="chips">${['💡 Idées de contenu pour GYOO', '💻 Aide-moi sur un module Odoo', '🎯 Planifie ma semaine', '💬 Juste discuter un peu']
    .map((t) => `<button class="ghost chip">${t}</button>`).join('')}</div></div>`;
  document.querySelectorAll('.chip').forEach((b) => (b.onclick = () => { input.value = b.textContent; send(); }));
}

async function loadList() {
  if (!cfg.repo || !cfg.token) return;
  try {
    const l = (await gh(`/repos/${cfg.repo}/issues?state=open&sort=updated&per_page=50`)).filter((i) => !i.pull_request);
    $('#list').innerHTML = '';
    l.forEach((i) => {
      const d = document.createElement('div'); d.className = 'item' + (i.number === issueNo ? ' on' : '');
      d.innerHTML = `<b>${esc(i.title)}</b><i title="Supprimer">✕</i>`;
      d.onclick = () => openConv(i.number);
      d.querySelector('i').onclick = async (e) => {
        e.stopPropagation();
        await gh(`/repos/${cfg.repo}/issues/${i.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }) });
        if (i.number === issueNo) newChat(); loadList();
      };
      $('#list').appendChild(d);
    });
  } catch (e) { toast('⚠️ ' + e.message); }
}

async function fetchComments(n, since) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const part = await gh(`/repos/${cfg.repo}/issues/${n}/comments?per_page=100&page=${page}${since ? '&since=' + encodeURIComponent(since) : ''}`);
    out.push(...part); if (part.length < 100) break;
  }
  return out;
}
function show(c) {
  if (c.body.includes(REPLY)) return add('bot', strip(c.body));
  if (c.body.includes(ERROR)) return add('bot', strip(c.body), 'err');
  return add('user', strip(c.body));
}

async function openConv(n) {
  if (!need()) return;
  pollId++; busy = false; $('#send').disabled = false; avatar('idle'); issueNo = n; msgs.innerHTML = ''; $('#side').classList.remove('open');
  try {
    const cs = await fetchComments(n);
    cs.forEach(show);
    const mode = [...cs].reverse().map((c) => (c.body.match(/<!--mode:(\w+)-->/) || [])[1]).find(Boolean);
    if (mode) modeSel.value = mode;
    const last = cs[cs.length - 1];
    // Une réponse est peut-être encore en préparation : on reprend l'attente.
    if (last && !last.body.includes(REPLY) && !last.body.includes(ERROR) && Date.now() - new Date(last.created_at) < 10 * 60 * 1000) wait(n, last.created_at);
  } catch (e) { add('bot', '⚠️ ' + e.message, 'err'); }
  loadList();
}
function newChat() { pollId++; busy = false; $('#send').disabled = false; avatar('idle'); issueNo = null; empty(); $('#side').classList.remove('open'); loadList(); }

async function wait(n, since) {
  const my = ++pollId; busy = true; $('#send').disabled = true; avatar('thinking');
  const bubble = add('bot', '🧠 Muse réfléchit…', 'wait'); const t0 = Date.now();
  while (my === pollId && Date.now() - t0 < 5 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 3000));
    if (my !== pollId) return;
    bubble.textContent = `🧠 Muse réfléchit… ${Math.round((Date.now() - t0) / 1000)} s`;
    try {
      const cs = (await fetchComments(n, since)).filter((c) => (c.body.includes(REPLY) || c.body.includes(ERROR)) && new Date(c.created_at) >= new Date(since));
      if (cs.length) { bubble.remove(); cs.forEach(show); avatar(cs.some((c) => c.body.includes(ERROR)) ? 'sad' : 'happy'); break; }
    } catch { /* réseau coupé : on réessaie */ }
  }
  if (my === pollId) {
    if (Date.now() - t0 >= 5 * 60 * 1000) { bubble.className = 'm bot err'; bubble.textContent = '⏳ Pas de réponse pour l’instant. Rouvre cette discussion dans un moment : Muse répondra dès que possible.'; avatar('sad'); }
    busy = false; $('#send').disabled = false; loadList();
  }
}

async function send() {
  const message = input.value.trim(); if (!message || busy || !need()) return;
  input.value = ''; input.style.height = 'auto'; busy = true; $('#send').disabled = true;
  try {
    if (!issueNo) {
      const i = await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: message.slice(0, 60), body: '💬 Discussion Muse' }) });
      issueNo = i.number; msgs.innerHTML = '';
    }
    add('user', message);
    const c = await gh(`/repos/${cfg.repo}/issues/${issueNo}/comments`, { method: 'POST', body: JSON.stringify({ body: `${message}\n\n<!--mode:${modeSel.value}-->` }) });
    wait(issueNo, c.created_at);
  } catch (e) { add('bot', '⚠️ ' + e.message, 'err'); busy = false; $('#send').disabled = false; avatar('sad'); }
}

// ---- Réglages
function openCfg() { $('#cfgRepo').value = cfg.repo; $('#cfgTok').value = cfg.token; $('#cfgMsg').textContent = ''; $('#cfg').showModal(); }
$('#cfgBtn').onclick = openCfg; $('#cfgCancel').onclick = () => $('#cfg').close();
$('#cfgSave').onclick = async () => {
  const repo = $('#cfgRepo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, ''), token = $('#cfgTok').value.trim();
  const prev = cfg; cfg = { repo, token };
  try {
    const r = await gh(`/repos/${repo}`);
    if (!r.private) { $('#cfgMsg').textContent = '⚠️ Ce dépôt est public : tes discussions seraient visibles par tout le monde. Utilise un dépôt privé.'; cfg = prev; return; }
    localStorage.setItem('muse_repo', repo); localStorage.setItem('muse_token', token);
    $('#cfg').close(); toast('✅ Connecté'); loadList();
  } catch (e) { cfg = prev; $('#cfgMsg').textContent = '⚠️ ' + e.message; }
};

// ---- Mémoire (data/memory.md dans le dépôt)
let memSha = null;
const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
const b64e = (s) => { const b = new TextEncoder().encode(s); let x = ''; b.forEach((c) => (x += String.fromCharCode(c))); return btoa(x); };
$('#memBtn').onclick = async () => {
  if (!need()) return;
  try {
    const f = await gh(`/repos/${cfg.repo}/contents/data/memory.md`); memSha = f.sha; $('#memTxt').value = b64d(f.content);
  } catch (e) { if (e.status === 404) { memSha = null; $('#memTxt').value = ''; } else return toast('⚠️ ' + e.message); }
  $('#dlg').showModal(); $('#side').classList.remove('open');
};
$('#memCancel').onclick = () => $('#dlg').close();
$('#memSave').onclick = async () => {
  try {
    await gh(`/repos/${cfg.repo}/contents/data/memory.md`, { method: 'PUT', body: JSON.stringify({ message: '🧠 Mémoire modifiée depuis l’app', content: b64e($('#memTxt').value), ...(memSha ? { sha: memSha } : {}) }) });
    $('#dlg').close(); toast('🧠 Mémoire enregistrée');
  } catch (e) { toast('⚠️ ' + (e.status === 409 || e.status === 422 ? 'La mémoire a changé entre-temps, rouvre-la' : e.message)); }
};

// ---- Divers
$('#f').onsubmit = (e) => { e.preventDefault(); send(); };
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !/Android|iPhone|iPad/i.test(navigator.userAgent)) { e.preventDefault(); send(); } });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; });
$('#new').onclick = newChat; $('#menu').onclick = () => $('#side').classList.toggle('open');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
empty(); if (cfg.repo && cfg.token) loadList(); else setTimeout(openCfg, 300);
