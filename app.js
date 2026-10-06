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
    cache: 'no-store', // GitHub impose max-age=60 : sans ça, la réponse de Muse n'apparaît qu'après 60 s
    ...opts,
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
  });
  if (!r.ok) { const e = new Error(r.status === 401 ? 'Token invalide ou expiré' : r.status === 404 ? 'Dépôt introuvable (vérifie le nom et les droits du token)' : `GitHub ${r.status}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}
const need = () => { if (!cfg.repo || !cfg.token) { openCfg(); return false; } return true; };

function empty() {
  msgs.innerHTML = `<div id="empty"><h1>✨ Salut Cédric</h1><div>Je suis Muse, propulsée par Claude. Je te réponds dès que tu es connecté, même PC éteint.</div>
  <div class="chips">${[['💡', 'Idées de contenu pour GYOO'], ['💻', 'Aide-moi sur un module Odoo'], ['🎯', 'Planifie ma semaine'], ['💬', 'Juste discuter un peu']]
    .map(([i, t]) => `<button class="chip" data-q="${t}"><span>${i}</span>${t}</button>`).join('')}</div></div>`;
  document.querySelectorAll('.chip').forEach((b) => (b.onclick = () => { input.value = b.dataset.q; send(); }));
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
const attsIn = (body) => [...body.matchAll(/<!--att:([^|>]+)\|([^|>]*)\|([^>]*?)-->/g)].map((m) => ({ path: m[1].trim(), name: m[2].trim(), type: m[3].trim() }));
function show(c) {
  if (c.body.includes(REPLY)) { const d = add('bot', strip(c.body));
    if (/Code de confirmation\s*:\s*[0-9a-f]{6}/i.test(c.body)) { // boutons de validation humaine
      const row = document.createElement('div'); row.className = 'confirm';
      const mk = (label, cls, text) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost ' + cls; b.textContent = label; b.onclick = () => { row.remove(); input.value = text; send(); }; row.appendChild(b); };
      mk('✅ OUI, confirme', 'yes', 'OUI'); mk('❌ Non, annule', 'no', 'Non, annule'); d.appendChild(row);
    } const a = attsIn(c.body); if (a.length) { d.appendChild(attsBox(a)); d.classList.add('hasAtts'); } return d; }
  if (c.body.includes(ERROR)) return add('bot', strip(c.body), 'err');
  return addUser(strip(c.body), attsIn(c.body));
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
    if (last && !last.body.includes(REPLY) && !last.body.includes(ERROR) && Date.now() - new Date(last.created_at) < 20 * 60 * 1000) wait(n, last.created_at);
  } catch (e) { add('bot', '⚠️ ' + e.message, 'err'); }
  loadList();
}
function newChat() { pollId++; busy = false; $('#send').disabled = false; avatar('idle'); issueNo = null; empty(); $('#side').classList.remove('open'); loadList(); }

async function wait(n, since) {
  const my = ++pollId; busy = true; $('#send').disabled = true; avatar('thinking');
  const ordi = modeSel.value === 'ordi', perso = modeSel.value === 'perso', phone = modeSel.value === 'phone', auto = modeSel.value === 'auto', MAXW = (ordi || phone || auto ? 18 : 5) * 60 * 1000, label = ordi ? '🖥️ Muse travaille sur son ordinateur…' : perso ? '📬 Muse consulte tes outils…' : phone ? '📱 Muse utilise ton téléphone…' : auto ? '✨ Muse choisit ses outils et réfléchit…' : '🧠 Muse réfléchit…';
  const bubble = add('bot', label, 'wait'); const t0 = Date.now();
  while (my === pollId && Date.now() - t0 < MAXW) {
    await new Promise((r) => setTimeout(r, 2000));
    if (my !== pollId) return;
    bubble.textContent = `${label} ${Math.round((Date.now() - t0) / 1000)} s`;
    try {
      const cs = (await fetchComments(n, since)).filter((c) => (c.body.includes(REPLY) || c.body.includes(ERROR)) && new Date(c.created_at) >= new Date(since));
      if (cs.length) { bubble.remove(); cs.forEach(show); avatar(cs.some((c) => c.body.includes(ERROR)) ? 'sad' : 'happy'); break; }
    } catch { /* réseau coupé : on réessaie */ }
  }
  if (my === pollId) {
    if (Date.now() - t0 >= MAXW) { bubble.className = 'm bot err'; bubble.textContent = '⏳ Pas de réponse pour l’instant. Rouvre cette discussion dans un moment : Muse répondra dès que possible.'; avatar('sad'); }
    busy = false; $('#send').disabled = false; loadList();
  }
}

async function send() {
  const message = input.value.trim();
  if ((!message && !pending.length) || busy || !need()) return;
  const files = pending.splice(0); renderPending();
  input.value = ''; input.style.height = 'auto'; busy = true; $('#send').disabled = true;
  try {
    if (!issueNo) {
      const i = await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: (message || '📎 ' + files[0].name).slice(0, 60), body: '💬 Discussion Muse' }) });
      issueNo = i.number; msgs.innerHTML = '';
    }
    addUser(message, files.map((f) => ({ name: f.name, type: f.type, url: f.url })));
    let markers = '';
    if (files.length) {
      const up = add('bot', '📤 Envoi des pièces jointes…', 'wait');
      markers = await upload(issueNo, files, (k) => { up.textContent = `📤 Envoi des pièces jointes… ${k}/${files.length}`; });
      up.remove();
    }
    const c = await gh(`/repos/${cfg.repo}/issues/${issueNo}/comments`, { method: 'POST', body: JSON.stringify({ body: `${message || '(pièce jointe)'}${markers}\n\n<!--mode:${modeSel.value}-->` }) });
    wait(issueNo, c.created_at);
  } catch (e) { add('bot', '⚠️ ' + e.message, 'err'); busy = false; $('#send').disabled = false; avatar('sad'); }
}

// ---- Pièces jointes
const MAX_FILES = 5, MAX_IMG = 4.5e6, MAX_FILE = 20e6, ZIP_ENTRY = 8e6;
const ZIP_IGNORE = /(^|\/)(node_modules|\.git|\.venv|venv|__pycache__|dist|build|\.next|\.cache|\.idea|\.vscode|__MACOSX|\.DS_Store)(\/|$)/i;
const ZIP_SECRET = /(^|\/)(\.env(\.[^/]*)?|id_rsa[^/]*|[^/]*\.(pem|key|p12|pfx|kdbx))$/i;
const iconOf = (name, kind) => {
  if (kind === 'img') return '🖼️';
  const e = (name.match(/\.(\w+)$/) || [])[1]?.toLowerCase() || '';
  if (e === 'pdf') return '📕';
  if (/^docx?$/.test(e)) return '📝';
  if (/^(xlsx?|ods|csv|tsv)$/.test(e)) return '📊';
  if (/^pptx?$/.test(e)) return '📽️';
  if (e === 'zip') return '📦';
  if (/^(js|mjs|ts|tsx|jsx|py|php|java|c|cpp|cs|go|rs|sh|sql|html|css|json|xml|ya?ml)$/.test(e)) return '💻';
  return '📄';
};
// Dossier -> .zip (dans le navigateur) ; items = [{ path, file }]
async function zipFolder(items) {
  if (!window.JSZip) { toast('⚠️ Module dossier indisponible, recharge la page'); return null; }
  const root = (items[0]?.path.split('/')[0]) || 'dossier';
  const z = new JSZip(); let n = 0, skipped = 0, total = 0;
  for (const { path, file } of items) {
    if (ZIP_IGNORE.test(path) || ZIP_SECRET.test(path) && !/\.example$/i.test(path)) { skipped++; continue; }
    if (file.size > ZIP_ENTRY || total + file.size > MAX_FILE) { skipped++; continue; }
    z.file(path, file); n++; total += file.size;
  }
  if (!n) { toast('📁 Aucun fichier utilisable dans ce dossier'); return null; }
  const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  toast(`📁 « ${root} » : ${n} fichiers${skipped ? ` (${skipped} ignorés : node_modules, secrets, gros fichiers…)` : ''}`);
  return new File([blob], safeName(root) + '.zip', { type: 'application/zip' });
}
async function addFolder(fileList) {
  const items = [...fileList].map((f) => ({ path: f.webkitRelativePath || f.name, file: f }));
  if (!items.length) return;
  const zf = await zipFolder(items); if (zf) addFiles([zf]);
}
async function readEntry(en, base = '') {
  if (en.isFile) return [await new Promise((ok, ko) => en.file((f) => ok({ path: base + en.name, file: f }), ko))];
  if (!en.isDirectory || ZIP_IGNORE.test(base + en.name + '/')) return [];
  const rd = en.createReader(), out = [];
  for (;;) { const batch = await new Promise((ok, ko) => rd.readEntries(ok, ko)); if (!batch.length) break; for (const c of batch) { out.push(...await readEntry(c, base + en.name + '/')); if (out.length > 3000) return out; } }
  return out;
}
async function handleDrop(dt) {
  const entries = [...(dt.items || [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.some((e) => e.isDirectory)) { addFiles(dt.files); return; }
  const loose = [];
  for (const en of entries) {
    if (en.isDirectory) { const zf = await zipFolder(await readEntry(en)); if (zf) loose.push(zf); }
    else loose.push(await new Promise((ok) => en.file(ok)));
  }
  addFiles(loose);
}
let pending = []; // { name, type, blob, url, kind }
const blobCache = new Map();
const safeName = (n) => (n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(-60)) || 'fichier';
const label = (n) => n.replace(/[|<>\r\n]+/g, ' ').trim().slice(0, 80) || 'fichier';
const fmtSize = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1e3)) + ' Ko');

async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file; // gif / autres : tel quel
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
async function addFiles(list) {
  for (const f0 of [...list]) {
    if (pending.length >= MAX_FILES) { toast(`📎 Maximum ${MAX_FILES} fichiers par message`); break; }
    const isImg = /^image\//i.test(f0.type) || /\.(jpe?g|png|webp|gif)$/i.test(f0.name);
    const f = isImg ? await shrink(f0) : f0;
    if (f.size > (isImg ? MAX_IMG : MAX_FILE)) { toast(`📎 « ${f0.name} » est trop lourd (${fmtSize(f.size)}, max ${isImg ? '4,5' : '20'} Mo)`); continue; }
    pending.push({ name: label(f.name || f0.name || 'photo.jpg'), type: f.type || 'application/octet-stream', blob: f, url: URL.createObjectURL(f), kind: isImg ? 'img' : 'file' });
  }
  renderPending();
}
function renderPending() {
  const box = $('#pending'); box.innerHTML = ''; box.hidden = !pending.length;
  pending.forEach((p, i) => {
    const d = document.createElement('div'); d.className = 'pchip';
    d.innerHTML = (p.kind === 'img' ? `<img src="${p.url}" alt="">` : `<span class="pfile">${iconOf(p.name)} ${esc(p.name)}<small>${fmtSize(p.blob.size)}</small></span>`) + '<button type="button" title="Retirer">✕</button>';
    d.querySelector('button').onclick = () => { URL.revokeObjectURL(p.url); pending.splice(i, 1); renderPending(); };
    box.appendChild(d);
  });
}
const toB64 = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(blob); });
async function upload(n, files, progress) {
  let markers = '';
  for (let i = 0; i < files.length; i++) {
    const f = files[i], p = `uploads/${n}/${Date.now()}-${i}-${safeName(f.name)}`;
    await gh(`/repos/${cfg.repo}/contents/${p}`, { method: 'PUT', body: JSON.stringify({ message: '📎 pièce jointe', content: await toB64(f.blob) }) });
    markers += `\n<!--att:${p}|${label(f.name)}|${f.type}-->`;
    progress(i + 1);
  }
  return markers;
}
async function fetchBlob(p) {
  if (blobCache.has(p)) return blobCache.get(p);
  const r = await fetch(`${API}/repos/${cfg.repo}/contents/${p.split('/').map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github.raw+json' } });
  if (!r.ok) throw new Error('GitHub ' + r.status);
  const url = URL.createObjectURL(await r.blob()); blobCache.set(p, url); return url;
}
function attsBox(atts) {
  const box = document.createElement('div'); box.className = 'atts';
  atts.forEach((a) => {
    const isImg = /^image\//i.test(a.type) || /\.(jpe?g|png|webp|gif)$/i.test(a.name);
    const open = async () => {
      try {
        const u = a.url || await fetchBlob(a.path);
        if (isImg) window.open(u, '_blank');
        else { const l = document.createElement('a'); l.href = u; l.download = a.name.split('/').pop(); document.body.appendChild(l); l.click(); l.remove(); }
      } catch { toast('⚠️ Fichier introuvable'); }
    };
    if (isImg) {
      const im = document.createElement('img'); im.alt = a.name; im.title = a.name; im.onclick = open; box.appendChild(im);
      if (a.url) im.src = a.url; else fetchBlob(a.path).then((u) => (im.src = u)).catch(() => { im.replaceWith(Object.assign(document.createElement('span'), { className: 'fchip', textContent: '🖼️ ' + a.name })); });
    } else {
      const s = document.createElement('span'); s.className = 'fchip'; s.textContent = iconOf(a.name) + ' ' + a.name + ' ⬇'; s.title = 'Télécharger'; s.onclick = open; box.appendChild(s);
    }
  });
  return box;
}
function addUser(text, atts = []) {
  const d = add('user', text);
  if (!text) d.innerHTML = '';
  if (atts.length) d.appendChild(attsBox(atts));
  msgs.scrollTop = msgs.scrollHeight; return d;
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
const pop = $('#plusMenu');
const closePop = () => { pop.hidden = true; };
$('#plusBtn').onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; };
document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) closePop(); });
if (/Android|iPhone|iPad/i.test(navigator.userAgent)) $('#optDir').hidden = true; // pas de sélecteur de dossier sur mobile : zipper
$('#optFile').onclick = () => { closePop(); $('#fileIn').click(); };
$('#optPhoto').onclick = () => { closePop(); $('#photoIn').click(); };
$('#optCam').onclick = () => { closePop(); $('#camIn').click(); };
$('#optDir').onclick = () => { closePop(); $('#dirIn').click(); };
['#fileIn', '#photoIn', '#camIn'].forEach((id) => { $(id).onchange = (e) => { addFiles(e.target.files); e.target.value = ''; }; });
$('#dirIn').onchange = (e) => { addFolder(e.target.files); e.target.value = ''; };
document.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
document.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length || e.dataTransfer?.items?.length) { e.preventDefault(); handleDrop(e.dataTransfer); } });
input.addEventListener('paste', (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
$('#f').onsubmit = (e) => { e.preventDefault(); send(); };
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !/Android|iPhone|iPad/i.test(navigator.userAgent)) { e.preventDefault(); send(); } });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; });
$('#new').onclick = newChat; $('#menu').onclick = () => $('#side').classList.toggle('open');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
empty(); if (cfg.repo && cfg.token) loadList(); else setTimeout(openCfg, 300);

// ---- Thème clair (comme le panneau de la bulle) / sombre
(() => {
  const root = document.documentElement, meta = document.querySelector('meta[name=theme-color]'), btn = $('#themeBtn');
  const apply = (t) => { root.dataset.theme = t; if (meta) meta.content = t === 'dark' ? '#14121f' : '#F8F7FF'; btn.textContent = t === 'dark' ? '☀️' : '🌙'; };
  apply(root.dataset.theme === 'dark' ? 'dark' : 'light');
  btn.onclick = () => { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; apply(t); try { localStorage.setItem('muse_theme', t); } catch { /* stockage indisponible */ } };
})();

// ---- Micro : dicter sa demande (reconnaissance vocale du navigateur, en français) ; la phrase est envoyée à la fin
(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $('#micBtn');
  if (!SR) { mic.hidden = true; return; }
  let rec = null, base = '', heard = false;
  const ERR = {
    'not-allowed': '🎤 Micro refusé : autorise-le pour ce site (cadenas de la barre d’adresse, ou Réglages → Applis → Muse → Autorisations).',
    'service-not-allowed': '🎤 La dictée est désactivée sur ce navigateur.',
    'no-speech': '🎤 Je n’ai rien entendu : réessaie.',
    'audio-capture': '🎤 Aucun micro détecté.',
    network: '🎤 La dictée a besoin d’internet.',
  };
  const panel = $('#listen'), wave = $('#wave'), hint = $('#listenHint');
  wave.innerHTML = Array.from({ length: 36 }, () => `<i style="--h:${25 + Math.random() * 70}%;--d:${(0.55 + Math.random() * 0.8).toFixed(2)}s;--l:-${(Math.random() * 1.2).toFixed(2)}s"></i>`).join('');
  const reset = () => { rec = null; mic.classList.remove('on'); mic.textContent = '🎤'; mic.title = 'Parler à Muse'; panel.classList.remove('on'); };
  mic.onclick = () => {
    if (rec) { try { rec.stop(); } catch { /* déjà arrêté */ } return; }
    if (busy) { toast('⏳ Muse travaille encore, attends sa réponse.'); return; }
    if (!need()) return;
    rec = new SR();
    rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    base = input.value.trim() ? input.value.replace(/\s*$/, ' ') : ''; heard = false;
    rec.onresult = (e) => {
      let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      heard = !!t.trim(); input.value = base + t; input.dispatchEvent(new Event('input')); if (t.trim()) hint.textContent = t;
    };
    rec.onerror = (e) => { if (ERR[e.error]) toast(ERR[e.error]); else if (e.error !== 'aborted') toast('🎤 Micro : ' + e.error); };
    rec.onend = () => { reset(); avatar('idle'); if (heard && input.value.trim() && !busy) send(); };
    try { rec.start(); hint.textContent = 'Parle, je t’écoute'; panel.classList.add('on'); mic.classList.add('on'); mic.textContent = '⏹'; mic.title = 'Arrêter et envoyer'; avatar('thinking'); }
    catch (e) { reset(); toast('🎤 Impossible de démarrer le micro : ' + e.message); }
  };
})();

// ---- Demande venue de la bulle Muse du téléphone (?ask=…&mode=…) : nouvelle discussion + envoi automatique
(() => {
  const u = new URL(location.href), q = u.searchParams.get('ask'), m = u.searchParams.get('mode');
  if (!q) return;
  history.replaceState(null, '', u.pathname);
  if (!(cfg.repo && cfg.token)) return;
  newChat();
  if (m && [...modeSel.options].some((o) => o.value === m && !o.disabled)) modeSel.value = m;
  input.value = q; input.dispatchEvent(new Event('input'));
  setTimeout(send, 500);
})();
