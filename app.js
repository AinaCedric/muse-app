// Muse — PWA : le chat vit dans les issues d'un dépôt privé GitHub ; une GitHub Action répond.
const $ = (s) => document.querySelector(s);
// Icônes au trait (pas d'emojis dans l'interface)
const ICON = {
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  edit: '<path d="M12 20h8"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2.5Z"/><path d="M8 7h7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  speaker: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m16 9 5 6M21 9l-5 6"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 9"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  out: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6Z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;
document.querySelectorAll('[data-icon]').forEach((e) => { e.outerHTML = ic(e.dataset.icon); });
const msgs = $('#msgs'), input = $('#in'), modeSel = $('#mode');
const REPLY = '<!--muse-reply-->', ERROR = '<!--muse-error-->', LIVE = '<!--muse-live-->';
const API = localStorage.getItem('muse_api') || 'https://api.github.com';
let cfg = { repo: localStorage.getItem('muse_repo') || '', token: localStorage.getItem('muse_token') || '' };
let issueNo = null, busy = false, pollId = 0;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '').trim();
function srcHtml(inner) {
  const list = inner.split(/\s*;\s*/).map((x) => { const [n, u] = x.split('|').map((y) => (y || '').trim()); const url = (u || n || '').replace(/&amp;/g, '&'); return /^https?:\/\//.test(url) ? { name: u ? n : '', url } : null; }).filter(Boolean).slice(0, 6);
  if (!list.length) return '';
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const q = (t) => String(t).replace(/["<>]/g, '');
  const s0 = list[0], nm = q(s0.name || host(s0.url)), short = nm.length > 18 ? nm.slice(0, 17) + '…' : nm;
  return `<a class="schip" href="${q(s0.url)}" target="_blank" rel="noopener" title="${q(list.map((x) => x.name || host(x.url)).join(' · '))}"><img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host(s0.url))}&amp;sz=32" alt="" referrerpolicy="no-referrer" onerror="this.remove()"><span>${short}</span>${list.length > 1 ? `<small>+${list.length - 1}</small>` : ''}</a>`;
}
function render(text) {
  let h = esc(text);
  h = h.replace(/```(\w*)\n([\s\S]*?)(```|$)/g, (_, l, c) => `<pre><code>${c}</code></pre>`);
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|\n)# ([^\n]+)\n?/g, '$1<span class="h1">$2</span>').replace(/(^|\n)## ([^\n]+)\n?/g, '$1<span class="h2">$2</span>').replace(/(^|\n)#{3,4} ([^\n]+)/g, '$1<b>$2</b>');
  h = h.replace(/(^|\n)[ \t]*[-*•][ \t]+([^\n]*)/g, '$1<span class="li">$2</span>').replace(/(<span class="li">[^\n]*<\/span>)\n/g, '$1');
  const srcs = [];
  h = h.replace(/\[\[SRC:([^\]]+)\]\]/g, (_, inner) => { srcs.push(inner); return `\u0000${srcs.length - 1}\u0000`; });
  h = h.replace(/\b(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/\u0000(\d+)\u0000/g, (_, i) => srcHtml(srcs[+i]));
  return h;
}
// ---- Galerie d'images : Muse écrit [[IMG:adresse_image|adresse_page|légende]] ; on les montre en vignettes, un clic les agrandit
const IMG_RE = /[ \t]*\[\[IMG:([^\]]*)\]\][ \t]*/g;
const okUrl = (u) => { try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; } };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
// Découpe la réponse : morceaux de texte et images placées JUSTE là où Muse les a écrites (plusieurs images de suite = une seule rangée)
function parseImg(inner) {
  const [img = '', page = '', ...rest] = inner.split('|').map((x) => x.trim());
  const local = rest.find((x) => /^uploads\/[\w./-]+$/.test(x)) || '';
  const cap = rest.filter((x) => x !== local).join(' ');
  if (!okUrl(img) && !local) return null;
  return { img: okUrl(img) ? img : '', page: okUrl(page) ? page : '', cap, local };
}
function splitParts(text) {
  const parts = [], all = [], re = /\[\[IMG:([^\]]*)\]\]/g;
  const pushText = (t) => { t = t.replace(/^\s*\n|\n\s*$/g, ''); if (t.trim()) parts.push({ t }); };
  let group = null, pos = 0, m;
  while ((m = re.exec(text))) {
    const between = text.slice(pos, m.index);
    if (!(group && !between.trim())) { if (group) { parts.push({ imgs: group }); group = null; } pushText(between); }
    const it = all.length < 8 ? parseImg(m[1]) : null;
    if (it) { (group = group || []).push(it); all.push(it); }
    pos = re.lastIndex;
  }
  if (group) parts.push({ imgs: group });
  pushText(text.slice(pos));
  return { parts, all, plain: text.replace(/\[\[IMG:[^\]]*\]\]/g, '').replace(/\n{3,}/g, '\n\n').trim() };
}

// ---- 🧩 Interfaces interactives : Muse écrit un bloc ```muse-ui … ``` ; on l'affiche comme un mini-outil vivant dans une bulle isolée
const UI_RE = /```[ \t]*(muse-ui|muse-cards|muse-map)[ \t]*\r?\n([\s\S]*?)(```|$)/g;
const UI_VARS = ['bg', 'panel', 'soft', 'txt', 'mut', 'acc', 'acc-soft', 'bd', 'code', 'ok', 'err'];
function uiTheme() {
  const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue('--' + n).trim();
  return { bg: v('panel'), card: v('bg'), txt: v('txt'), mut: v('mut'), acc: v('acc'), acc2: v('ok'), bd: v('bd'), soft: v('soft'), err: v('err'), dark: document.documentElement.dataset.theme === 'dark' };
}
function uiDoc(code, id) {
  const t = uiTheme();
  const vars = Object.entries(t).filter(([k]) => k !== 'dark').map(([k, val]) => `--${k}:${val}`).join(';');
  const csp = "default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src data: blob: https:; connect-src 'none'; form-action 'none'";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>:root{${vars};color-scheme:${t.dark ? 'dark' : 'light'}}*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}body{padding:12px}
input,select,textarea,button{font:inherit;color:inherit}input,select,textarea{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:9px 11px;min-height:40px;max-width:100%}
button{background:var(--acc);color:#fff;border:0;border-radius:999px;padding:9px 16px;min-height:40px;cursor:pointer}button.ghost{background:var(--soft);color:var(--txt)}
canvas,svg,img{max-width:100%}</style>
<script>
const museSend=(t)=>parent.postMessage({museUi:${id},send:String(t).slice(0,2000)},'*');const museCopy=(t)=>parent.postMessage({museUi:${id},copy:String(t).slice(0,20000)},'*');
addEventListener('message',(e)=>{const d=e.data||{};if(d.museTheme){for(const[k,v]of Object.entries(d.museTheme)){if(k!=='dark')document.documentElement.style.setProperty('--'+k,v)}document.documentElement.style.colorScheme=d.museTheme.dark?'dark':'light'}});
const __h=()=>parent.postMessage({museUi:${id},h:Math.ceil(document.documentElement.getBoundingClientRect().height)},'*');
addEventListener('load',__h);new ResizeObserver(__h).observe(document.documentElement);
addEventListener('error',(e)=>parent.postMessage({museUi:${id},err:String(e.message||e).slice(0,200)},'*'));
for(const k of ['alert','confirm','prompt','open'])window[k]=()=>null;
</script></head><body>${code}</body></html>`;
}
let uiSeq = 0;
const uiFrames = new Map();
function uiBox(code) {
  const id = ++uiSeq, box = document.createElement('div'); box.className = 'uibox';
  const bar = document.createElement('div'); bar.className = 'uibar';
  bar.innerHTML = '<span class="uitag">🧩 Interface interactive</span>';
  const fr = document.createElement('iframe');
  fr.setAttribute('sandbox', 'allow-scripts allow-forms'); fr.setAttribute('loading', 'lazy'); fr.title = 'Interface interactive de Muse';
  fr.srcdoc = uiDoc(code, id); fr.style.height = '220px';
  const btn = (label, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'uib'; b.textContent = label; b.title = title; b.onclick = fn; bar.appendChild(b); };
  btn('⛶', 'Plein écran', () => { box.classList.toggle('full'); document.body.classList.toggle('uifull', box.classList.contains('full')); });
  btn('↻', 'Réinitialiser', () => { fr.srcdoc = uiDoc(code, id); });
  btn('</>', 'Copier le code', async () => { try { await navigator.clipboard.writeText(code); toast('Code copié'); } catch { toast('Copie impossible'); } });
  btn('⤓', 'Télécharger en .html', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([uiDoc(code, 0)], { type: 'text/html' })); a.download = 'muse-outil.html'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
  box.append(bar, fr); uiFrames.set(id, fr);
  return box;
}
addEventListener('message', (e) => {
  const d = e.data || {}; const fr = d.museUi && uiFrames.get(d.museUi);
  if (!fr || e.source !== fr.contentWindow) return;
  if (d.h) fr.style.height = Math.min(Math.max(d.h, 60), 1600) + 'px';
  if (d.send) { input.value = d.send; input.focus(); input.dispatchEvent(new Event('input')); toast('Message prêt : appuie sur Envoyer'); }
  if (d.copy) navigator.clipboard.writeText(d.copy).then(() => toast('Copié'), () => toast('Copie impossible'));
  if (d.err) console.warn('Interface Muse :', d.err);
});
function uiThemeSync() { const t = uiTheme(); uiFrames.forEach((fr) => { if (fr.isConnected) fr.contentWindow?.postMessage({ museTheme: t }, '*'); else uiFrames.delete(fr); }); }
// Découpe une réponse en morceaux texte / interface
function splitUI(text) {
  const out = []; let pos = 0, m; UI_RE.lastIndex = 0;
  while ((m = UI_RE.exec(text))) {
    out.push({ t: text.slice(pos, m.index) });
    if (m[1] === 'muse-cards') out.push({ cards: m[2] });
    else if (m[1] === 'muse-map') out.push(m[3] ? { map: m[2] } : { t: '🗺️ _(carte incomplète : réponse coupée)_' });
    else if (m[3]) out.push({ ui: m[2] }); else out.push({ t: '🧩 _(interface incomplète : réponse coupée)_' });
    pos = UI_RE.lastIndex;
  }
  out.push({ t: text.slice(pos) });
  return out.filter((x) => x.ui || x.cards || x.map || x.t.trim());
}
// ---- 📰 Cartes d'actualités / résultats : bloc ```muse-cards (## Titre, puis badge:, img:, sources:, intérêt:, et le texte)
function parseCards(src) {
  const cards = []; let cur = null;
  for (const line of src.split(/\r?\n/)) {
    const h = line.match(/^\s*#{2,3}\s+(.+)/);
    if (h) { cur = { title: h[1].trim(), text: [], sources: [] }; cards.push(cur); continue; }
    if (!cur) continue;
    const kv = line.match(/^\s*(badge|img|image|sources?|int[ée]r[êe]t|note|style|date)\s*:\s*(.*)$/i);
    if (kv) {
      const k = kv[1].toLowerCase(), v = kv[2].trim();
      if (k === 'badge') cur.badge = v.slice(0, 30);
      else if (k === 'img' || k === 'image') { const m = v.match(/\[\[IMG:([^\]]*)\]\]/); cur.img = m ? parseImg(m[1]) : (okUrl(v) ? { img: v, page: '', cap: '' } : null); }
      else if (k.startsWith('source')) cur.sources = v.split(/\s*;\s*/).map((x) => { const [n, u] = x.split('|').map((y) => (y || '').trim()); return okUrl(u) ? { name: n || hostOf(u), url: u } : okUrl(n) ? { name: hostOf(n), url: n } : null; }).filter(Boolean).slice(0, 6);
      else if (k === 'date') cur.date = v.slice(0, 40);
      else { cur.note = v; cur.noteLabel = k === 'style' ? 'Style' : k === 'note' ? 'Note' : 'Intérêt'; }
      continue;
    }
    cur.text.push(line);
  }
  return cards.slice(0, 12);
}
function srcChip(sources) {
  const w = document.createElement('span'); w.className = 'schip';
  const s0 = sources[0], fav = document.createElement('img');
  fav.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(s0.url))}&sz=32`; fav.alt = ''; fav.referrerPolicy = 'no-referrer'; fav.onerror = () => fav.remove();
  const nm = document.createElement('span'); nm.textContent = s0.name.length > 18 ? s0.name.slice(0, 17) + '…' : s0.name;
  w.append(fav, nm);
  if (sources.length > 1) { const more = document.createElement('small'); more.textContent = '+' + (sources.length - 1); w.appendChild(more); }
  w.title = sources.map((x) => x.name).join(' · ');
  w.onclick = (e) => {
    e.stopPropagation();
    if (sources.length === 1) { window.open(s0.url, '_blank', 'noopener'); return; }
    const box = w.closest('.ncard').querySelector('.slist');
    if (box) { box.hidden = !box.hidden; return; }
  };
  return w;
}
function cardsBox(src) {
  const cards = parseCards(src), wrap = document.createElement('div'); wrap.className = 'ncards';
  const allImgs = cards.map((c) => c.img).filter(Boolean);
  cards.forEach((c, i) => {
    const art = document.createElement('article'); art.className = 'ncard';
    if (c.img) {
      const th = document.createElement('div'); th.className = 'nthumb';
      const g = gallery([c.img], allImgs); g.classList.add('nimg'); th.appendChild(g); art.appendChild(th);
    } else art.classList.add('noimg');
    const b = document.createElement('div'); b.className = 'nbody';
    const h = document.createElement('h4'); const tt = c.title.replace(/^\d+[.)]\s*/, ''); h.textContent = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|jour|[ée]tape|semaine|matin|midi|soir)\b/i.test(tt) ? tt : `${i + 1}. ${tt}`; b.appendChild(h);
    if (c.badge || c.date) { const r = document.createElement('div'); r.className = 'nmeta'; if (c.badge) { const p = document.createElement('span'); p.className = 'nbadge ' + (/(averse|pluie|orage|rumeur|attention|alerte|risque|retard|non confirm)/i.test(c.badge) ? 'warn' : /(°|%|ar\b|€|\$|\d)/i.test(c.badge) ? 'neutral' : ''); p.textContent = c.badge; r.appendChild(p); } if (c.date) { const d = document.createElement('span'); d.className = 'ndate'; d.textContent = c.date; r.appendChild(d); } b.appendChild(r); }
    const t = document.createElement('div'); t.className = 'ntext'; t.innerHTML = render(c.text.join('\n').trim());
    if (c.sources.length) t.appendChild(srcChip(c.sources));
    b.appendChild(t);
    if (c.note) { const n = document.createElement('div'); n.className = 'nnote'; n.textContent = (c.noteLabel || 'Intérêt') + ' : ' + c.note; b.appendChild(n); }
    if (c.sources.length > 1) {
      const l = document.createElement('div'); l.className = 'slist'; l.hidden = true;
      c.sources.forEach((x) => { const a = document.createElement('a'); a.href = x.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = `${x.name} ↗`; l.appendChild(a); });
      b.appendChild(l);
    }
    art.appendChild(b); wrap.appendChild(art);
  });
  return wrap;
}
const cardsPlain = (src) => parseCards(src).map((c, i) => `${i + 1}. ${c.title}. ${c.text.join(' ').trim()}`).join('\n');
// ---- 🗺️ Carte interactive : bloc ```muse-map (JSON) → vraie carte (Leaflet + OpenStreetMap), lieux, photos, itinéraire
// ---- 🗺️ Moteurs de carte : 3D (MapLibre + OpenFreeMap, sans clé) ; repli 2D (Leaflet + OpenStreetMap)
const loadScript = (src, css, test) => { if (test()) return Promise.resolve(); return new Promise((ok, ko) => { if (css) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = css; document.head.appendChild(l); } const s = document.createElement('script'); s.src = src; s.onload = () => (test() ? ok() : ko(new Error('chargement'))); s.onerror = () => ko(new Error('chargement')); document.head.appendChild(s); }); };
let mlP = null, lfP = null;
const loadMaplibre = () => (mlP = mlP || loadScript('./vendor/maplibre/maplibre-gl.js', './vendor/maplibre/maplibre-gl.css', () => !!window.maplibregl).catch((e) => { mlP = null; throw e; }));
const loadLeaflet = () => (lfP = lfP || loadScript('./vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css', () => !!window.L).catch((e) => { lfP = null; throw e; }));
const accColor = () => getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#5B3FD6';
const pinEl = (i, p) => {
  const e = document.createElement('div'); e.className = 'mpinw';
  const rate = p && p.rating != null ? `<span class="mrate">★ ${String(p.rating).replace('.', ',')}</span>` : '';
  e.innerHTML = `<div class="mpin"><b>${p ? catEmoji(p) : ''}</b><span>${i + 1}</span></div><div class="mlab">${rate}<span class="mname"></span></div>`;
  e.querySelector('.mname').textContent = p ? p.name : ''; return e;
};
const meEl = () => { const e = document.createElement('div'); e.className = 'mpinw'; e.innerHTML = '<div class="mme"><i></i></div>'; return e; };
function webglOk() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
async function engine3D(el, dark) {
  await loadMaplibre();
  const ml = window.maplibregl;
  const styles = dark ? ['https://tiles.openfreemap.org/styles/dark', 'https://tiles.openfreemap.org/styles/liberty'] : ['https://tiles.openfreemap.org/styles/liberty', 'https://tiles.openfreemap.org/styles/positron'];
  let map = null, last = null;
  for (const style of styles) {
    try {
      map = new ml.Map({ container: el, style, center: [47.5079, -18.8792], zoom: 13, pitch: 55, bearing: -18, maxPitch: 70, antialias: true, attributionControl: { compact: true }, cooperativeGestures: false, dragRotate: true });
      await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('délai')), 12000); map.once('load', () => { clearTimeout(t); ok(); }); map.once('error', (e) => { if (!map.loaded()) { clearTimeout(t); ko(e.error || new Error('style')); } }); });
      break;
    } catch (e) { last = e; try { map && map.remove(); } catch {} map = null; el.innerHTML = ''; }
  }
  if (!map) throw last || new Error('carte 3D indisponible');
  // Relief du terrain (Antananarivo est sur des collines) + ombrage, ciel, lumière : rendu façon Plans d'Apple / Google 3D
  const firstSymbol = (map.getStyle().layers.find((l) => l.type === 'symbol') || {}).id;
  try {
    const dem = { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Relief : Mapzen / AWS' };
    map.addSource('muse-dem', dem); map.addSource('muse-dem-shade', { ...dem });
    map.addLayer({ id: 'muse-hill', type: 'hillshade', source: 'muse-dem-shade', paint: { 'hillshade-exaggeration': dark ? 0.22 : 0.25, 'hillshade-shadow-color': dark ? '#0d0b1a' : '#6b6255', 'hillshade-highlight-color': dark ? '#5a5488' : '#ffffff', 'hillshade-accent-color': dark ? '#2c2850' : '#8f8778' } }, firstSymbol);
    map.setTerrain({ source: 'muse-dem', exaggeration: 1.35 });
  } catch { /* relief indisponible */ }
  try { map.setSky({ 'sky-color': dark ? '#1a1640' : '#7fb8ff', 'horizon-color': dark ? '#4a3f86' : '#eef4ff', 'fog-color': dark ? '#2a2550' : '#ffffff', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.35, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 0.2] }); } catch { /* ancien moteur */ }
  try { map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: dark ? 0.45 : 0.4, position: [1.3, 200, 35] }); } catch {}
  // Bâtiments en relief (ajoutés si le style n'en a pas)
  const hasExtr = map.getStyle().layers.some((l) => l.type === 'fill-extrusion');
  const src = Object.keys(map.getStyle().sources).find((k) => map.getStyle().sources[k].type === 'vector');
  if (!hasExtr && src) {
    try { map.addLayer({ id: 'muse-3d', type: 'fill-extrusion', source: src, 'source-layer': 'building', minzoom: 14, paint: { 'fill-extrusion-color': dark ? '#2b2747' : '#e4def6', 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 8], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.85 } }); } catch { /* pas de couche bâtiments */ }
  }
  // Bâtiments : dégradé de couleur selon la hauteur, éclairage vertical
  for (const l of map.getStyle().layers.filter((x) => x.type === 'fill-extrusion')) {
    try {
      const h = ['coalesce', ['get', 'render_height'], ['get', 'height'], 8];
      map.setPaintProperty(l.id, 'fill-extrusion-color', ['interpolate', ['linear'], h, 0, dark ? '#4a4668' : '#f4efe8', 25, dark ? '#5b5585' : '#e9e2d8', 80, dark ? '#7068a6' : '#dcd3c8']);
      map.setPaintProperty(l.id, 'fill-extrusion-vertical-gradient', true);
      map.setPaintProperty(l.id, 'fill-extrusion-opacity', 0.94);
    } catch {}
  }
  map.addControl(new ml.NavigationControl({ visualizePitch: true, showCompass: true }), 'bottom-right');
  const zoomCls = () => el.classList.toggle('mz', map.getZoom() >= 15.6); map.on('zoom', zoomCls); zoomCls();
  // Petite rotation de caméra au départ (s'arrête dès que Cédric touche la carte)
  let touched = false; ['mousedown', 'touchstart', 'wheel'].forEach((ev) => map.getCanvas().addEventListener(ev, () => { touched = true; try { map.stop(); } catch {} }, { passive: true }));
  const acc = accColor();
  map.addSource('muse-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'muse-route-glow', type: 'line', source: 'muse-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': acc, 'line-width': 16, 'line-opacity': 0.25, 'line-blur': 6 } });
  map.addLayer({ id: 'muse-route-case', type: 'line', source: 'muse-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9 } });
  map.addLayer({ id: 'muse-route', type: 'line', source: 'muse-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': acc, 'line-width': 5 } });
  map.addLayer({ id: 'muse-route-dash', type: 'line', source: 'muse-route', layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 2.5, 'line-opacity': 0.9, 'line-dasharray': [0, 4, 3] } });
  // Petits tirets qui avancent le long du chemin
  const steps = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
  let k = 0, alive = true;
  const tick = () => { if (!alive) return; if (document.visibilityState === 'visible' && el.isConnected) { try { map.setPaintProperty('muse-route-dash', 'line-dasharray', steps[k = (k + 1) % steps.length]); } catch {} } setTimeout(() => requestAnimationFrame(tick), 70); };
  tick();
  const markers = [];
  return {
    kind: '3d',
    pin(i, p, onClick) { const e = pinEl(i, p); e.addEventListener('click', (ev) => { ev.stopPropagation(); onClick(); }); const m = new ml.Marker({ element: e, anchor: 'bottom', offset: [0, 0] }).setLngLat([p.lng, p.lat]).addTo(map); markers[i] = e; return m; },
    popup(p, el) { if (this._pop) this._pop.remove(); this._pop = new ml.Popup({ offset: [0, -54], closeButton: false, closeOnClick: true, className: 'mpop', maxWidth: '320px', focusAfterOpen: false }).setLngLat([p.lng, p.lat]).setDOMContent(el).addTo(map); },
    orbit() { if (touched) return; map.easeTo({ bearing: map.getBearing() + 35, duration: 9000, easing: (t) => t }); },
    me(pos) { if (this._me) this._me.remove(); this._me = new ml.Marker({ element: meEl(), anchor: 'center' }).setLngLat([pos.lng, pos.lat]).addTo(map); },
    sel(i) { touched = true; markers.forEach((e, j) => { if (!e) return; e.classList.toggle('on', j === i); e.style.zIndex = j === i ? 5 : 1; }); },
    fly(p) { map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 16.4), pitch: 62, bearing: map.getBearing() - 15, speed: 0.8, curve: 1.4, padding: { top: 120, bottom: 0, left: 0, right: 0 }, essential: true }); },
    fit(pts, pad = 60) { if (!pts.length) return; if (pts.length === 1) return map.jumpTo({ center: [pts[0][1], pts[0][0]], zoom: 15.5 }); const b = new ml.LngLatBounds(); pts.forEach(([la, ln]) => b.extend([ln, la])); map.fitBounds(b, { padding: pad, pitch: 55, bearing: map.getBearing(), duration: 900, maxZoom: 16.5 }); },
    route(coords, straight) { if (this._pop) { this._pop.remove(); this._pop = null; } map.getSource('muse-route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords.map(([la, ln]) => [ln, la]) } }); map.setPaintProperty('muse-route', 'line-opacity', straight ? 0.6 : 1); this.fit(coords, 70); },
    clearRoute() { map.getSource('muse-route').setData({ type: 'FeatureCollection', features: [] }); },
    toggle3d() { const flat = map.getPitch() > 5; map.easeTo({ pitch: flat ? 0 : 60, bearing: flat ? 0 : -18, duration: 700 }); return !flat; },
    resize() { map.resize(); },
    dist(a, b) { return new ml.LngLat(a.lng, a.lat).distanceTo(new ml.LngLat(b.lng, b.lat)); },
    destroy() { alive = false; map.remove(); },
  };
}
async function engine2D(el) {
  await loadLeaflet();
  const L = window.L;
  const map = L.map(el, { zoomControl: false, scrollWheelZoom: false });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  map.on('click', () => map.scrollWheelZoom.enable());
  const markers = []; let line = null;
  return {
    kind: '2d',
    pin(i, p, onClick) { const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: pinEl(i, p).outerHTML, iconSize: [40, 48], iconAnchor: [20, 48] }) }).addTo(map); m.on('click', onClick); markers[i] = m; return m; },
    popup(p, el) { L.popup({ offset: [0, -44], closeButton: false, className: 'mpop', maxWidth: 320 }).setLatLng([p.lat, p.lng]).setContent(el).openOn(map); },
    orbit() {},
    me(pos) { if (this._me) this._me.remove(); this._me = L.marker([pos.lat, pos.lng], { icon: L.divIcon({ className: '', html: meEl().outerHTML, iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 1000 }).addTo(map); },
    sel(i) { markers.forEach((m, j) => { if (!m) return; const e = m.getElement() && m.getElement().querySelector('.mpinw'); if (e) e.classList.toggle('on', j === i); m.setZIndexOffset(j === i ? 800 : 0); }); },
    fly(p) { map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 15), { duration: 0.6 }); },
    fit(pts) { if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.2)); else if (pts.length) map.setView(pts[0], 15); else map.setView([-18.8792, 47.5079], 13); },
    route(coords, straight) { map.closePopup(); if (line) line.forEach((l) => l.remove()); line = [L.polyline(coords, { color: '#fff', weight: 9, opacity: 0.9 }).addTo(map), L.polyline(coords, { color: accColor(), weight: 5, className: 'mline' + (straight ? ' straight' : '') }).addTo(map)]; map.fitBounds(L.latLngBounds(coords).pad(0.25)); },
    clearRoute() { if (line) line.forEach((l) => l.remove()); line = null; },
    toggle3d() { toast('Vue 3D indisponible sur cet appareil'); return false; },
    resize() { map.invalidateSize(); },
    dist(a, b) { return L.latLng(a.lat, a.lng).distanceTo([b.lat, b.lng]); },
    destroy() { map.remove(); },
  };
}
function parseMap(src) {
  let d = null;
  try { d = JSON.parse(src); } catch { try { d = JSON.parse(src.replace(/\[\[IMG:[^\]]*\]\]/g, (x) => x.replace(/["\\]/g, ''))); } catch { return null; } }
  const num = (v) => (Number.isFinite(+v) ? +v : null);
  const places = (Array.isArray(d.places) ? d.places : []).slice(0, 12).map((p, i) => {
    const m = String(p.img || '').match(/\[\[IMG:([^\]]*)\]\]/);
    return { i, name: String(p.name || `Lieu ${i + 1}`).slice(0, 80), address: String(p.address || '').slice(0, 140), lat: num(p.lat), lng: num(p.lng), rating: num(p.rating), reviews: num(p.reviews), price: String(p.price || '').slice(0, 40), open: String(p.open || '').slice(0, 60), dist: String(p.dist || '').slice(0, 50), note: String(p.note || '').slice(0, 220), photo: String(p.photo || '').slice(0, 120), tags: Array.isArray(p.tags) ? p.tags.slice(0, 4).map((t) => String(t).slice(0, 20)) : [], img: m ? parseImg(m[1]) : (okUrl(p.img) ? { img: p.img, page: '', cap: '' } : null), approx: !!p.approx };
  });
  const me = d.me && num(d.me.lat) !== null && num(d.me.lng) !== null ? { lat: +d.me.lat, lng: +d.me.lng } : null;
  return { title: String(d.title || 'Carte').slice(0, 90), me, mode: d.mode === 'car' ? 'car' : 'foot', places };
}
const mapPlain = (src) => { const d = parseMap(src); return d ? `${d.title}. ` + d.places.map((p, i) => `${i + 1}. ${p.name}${p.price ? ', ' + p.price : ''}${p.dist ? ', ' + p.dist : ''}.`).join(' ') : ''; };
const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`);
const fmtDur = (s) => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
const gmapsDir = (p, mode) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat != null ? `${p.lat},${p.lng}` : encodeURIComponent(`${p.name} ${p.address}`)}&travelmode=${mode === 'car' ? 'driving' : 'walking'}`;
const CAT_EMOJI = [[/resto|restaurant|gargote|cuisine|malgache|pizza|grill|burger|snack|plat/i, '🍽️'], [/caf[ée]|coffee|salon de th[ée]|p[âa]tisserie|boulang/i, '☕'], [/bar\b|pub|cocktail|bi[èe]re/i, '🍹'], [/pharma/i, '💊'], [/h[ôo]tel|lodge|auberge|chambre/i, '🏨'], [/station|essence|carburant/i, '⛽'], [/banque|distributeur|atm/i, '🏧'], [/march[ée]|supermarch|magasin|boutique|shop/i, '🛍️'], [/h[ôo]pital|clinique|m[ée]decin/i, '🏥'], [/plage|parc|jardin|lac/i, '🌴'], [/mus[ée]e|monument|palais|[ée]glise|cath[ée]drale/i, '🏛️'], [/gym|sport|fitness|stade/i, '🏋️']];
const catEmoji = (p) => { const t = `${p.name} ${p.tags.join(' ')} ${p.note} ${p.ctx || ''}`; for (const [re, e] of CAT_EMOJI) if (re.test(t)) return e; return '📍'; };
function mapBox(src, atts = []) {
  const d = parseMap(src), box = document.createElement('div'); box.className = 'mapbox';
  if (!d || !d.places.length) { box.textContent = '🗺️ Carte illisible'; return box; }
  d.places.forEach((p) => { p.ctx = d.title; });
  const st = { mode: d.mode, me: d.me, sel: -1, eng: null, seq: 0 };
  box.innerHTML = `<div class="mhead"><b class="mtitle"></b><div class="mtools"><div class="mseg"><button type="button" data-m="foot">🚶 À pied</button><button type="button" data-m="car">🚗 Voiture</button></div><button type="button" class="mbtn m3d" title="Vue 3D / 2D">3D</button><button type="button" class="mbtn mnight" title="Carte de nuit">🌙</button><button type="button" class="mbtn mloc" title="Ma position">📍</button><button type="button" class="mbtn mfull" title="Plein écran">⛶</button></div></div>
    <div class="mmap"><div class="mload"><span class="mspin"></span>Chargement de la carte 3D…</div></div><div class="mroute" hidden></div><div class="mlist"></div>`;
  box.querySelector('.mtitle').textContent = '🗺️ ' + d.title;
  const list = box.querySelector('.mlist'), routeEl = box.querySelector('.mroute'), mapEl = box.querySelector('.mmap');
  const seg = () => box.querySelectorAll('.mseg button').forEach((b) => b.classList.toggle('on', b.dataset.m === st.mode));
  seg();
  const attByName = (n) => { if (!n) return null; const b = String(n).split('/').pop().toLowerCase(); return atts.find((a) => a.name.toLowerCase() === b || a.name.toLowerCase().endsWith(b)) || null; };
  d.places.forEach((p, i) => {
    const c = document.createElement('div'); c.className = 'mcard'; c.dataset.i = i;
    const ph = document.createElement('div'); ph.className = 'mph';
    const ph0 = document.createElement('div'); ph0.className = 'mph0'; ph0.innerHTML = `<b>${catEmoji(p)}</b><small></small>`; ph0.querySelector('small').textContent = p.name; ph.appendChild(ph0);
    const srcs = []; const shot = attByName(p.photo);
    if (shot) srcs.push(() => fetchBlob(shot.path, shot.type));
    if (p.img?.local) srcs.push(() => fetchBlob(p.img.local, ''));
    if (p.img?.img) srcs.push(async () => p.img.img);
    if (srcs.length) {
      const im = document.createElement('img'); im.alt = p.name; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.hidden = true;
      let k = 0; const nx = async () => { while (k < srcs.length) { try { im.src = await srcs[k++](); return; } catch { /* source suivante */ } } im.remove(); };
      im.onload = () => { im.hidden = false; ph0.remove(); p._src = im.src; }; im.onerror = nx; nx(); ph.appendChild(im);
      ph.onclick = (e) => { if (!im.hidden && im.isConnected) { e.stopPropagation(); openLightbox([{ img: im.src, cap: p.name, page: '' }], 0); } };
    }
    const n = document.createElement('span'); n.className = 'mnum'; n.textContent = i + 1; ph.appendChild(n);
    const b = document.createElement('div'); b.className = 'mbody';
    const h = document.createElement('b'); h.textContent = p.name; b.appendChild(h);
    const meta = document.createElement('div'); meta.className = 'mmeta';
    meta.textContent = [p.rating != null ? `★ ${String(p.rating).replace('.', ',')}${p.reviews ? ` (${p.reviews})` : ''}` : '', p.price, p.dist].filter(Boolean).join(' · ');
    b.appendChild(meta);
    if (p.open) { const o = document.createElement('div'); o.className = 'mopen' + (/^\s*ferm/i.test(p.open) ? ' closed' : ''); o.textContent = p.open; b.appendChild(o); }
    if (p.note) { const t = document.createElement('div'); t.className = 'mnote'; t.textContent = p.note; b.appendChild(t); }
    if (p.tags.length) { const tg = document.createElement('div'); tg.className = 'mtags'; p.tags.forEach((x) => { const s = document.createElement('span'); s.textContent = x; tg.appendChild(s); }); b.appendChild(tg); }
    c.append(ph, b); c.onclick = () => select(i, true); list.appendChild(c);
  });
  async function route(p) {
    const my = ++st.seq; routeEl.hidden = false;
    const go = `<a class="mgo" href="${gmapsDir(p, st.mode)}" target="_blank" rel="noopener">Ouvrir dans Google Maps ↗</a>`;
    if (!st.me || p.lat == null || !st.eng) { routeEl.innerHTML = `<span>${!st.me ? '📍 Touche « Ma position » pour tracer le chemin' : 'Position du lieu inconnue'}</span>${go}`; return; }
    routeEl.innerHTML = `<span class="mcalc">Calcul du chemin…</span>${go}`;
    let coords = null, dist = 0, dur = 0;
    try {
      const r = await fetch(`https://routing.openstreetmap.de/${st.mode === 'car' ? 'routed-car' : 'routed-foot'}/route/v1/driving/${st.me.lng},${st.me.lat};${p.lng},${p.lat}?overview=full&geometries=geojson`);
      const j = await r.json(); const rt = j.routes && j.routes[0];
      if (rt) { coords = rt.geometry.coordinates.map(([x, y]) => [y, x]); dist = rt.distance; dur = rt.duration; }
    } catch { /* hors ligne : ligne droite */ }
    if (my !== st.seq) return;
    const straight = !coords;
    if (straight) { coords = [[st.me.lat, st.me.lng], [p.lat, p.lng]]; dist = st.eng.dist(st.me, p); dur = dist / (st.mode === 'car' ? 8 : 1.3); }
    st.eng.route(coords, straight);
    routeEl.innerHTML = `<span><b>${fmtDur(dur)}</b> · ${fmtDist(dist)} ${st.mode === 'car' ? 'en voiture' : 'à pied'}${straight ? ' <small>(à vol d\'oiseau)</small>' : ''} → ${esc(p.name)}</span>${go}`;
  }
  function popCard(p) {
    const el = document.createElement('div'); el.className = 'mpc';
    const cat = p.tags[0] || ({ '🍽️': 'Restaurant', '☕': 'Café', '🍹': 'Bar', '💊': 'Pharmacie', '🏨': 'Hôtel', '⛽': 'Station', '🏧': 'Banque', '🛍️': 'Magasin', '🏥': 'Santé', '🌴': 'Nature', '🏛️': 'Culture', '🏋️': 'Sport' })[catEmoji(p)] || 'Lieu';
    el.innerHTML = `<div class="mpc-top"><div class="mpc-ph">${p._src ? '<img alt="">' : `<b>${catEmoji(p)}</b>`}</div><div class="mpc-tx"><b></b><span></span>${p.open ? `<small class="${/^\s*ferm/i.test(p.open) ? 'closed' : ''}"></small>` : ''}</div></div><div class="mpc-act"><button type="button" class="mpc-go">➤ Itinéraire</button><a class="mpc-gm" target="_blank" rel="noopener" title="Ouvrir dans Google Maps">↗</a></div>`;
    if (p._src) el.querySelector('img').src = p._src;
    el.querySelector('.mpc-tx b').textContent = p.name;
    el.querySelector('.mpc-tx span').textContent = [p.rating != null ? `★ ${String(p.rating).replace('.', ',')}${p.reviews ? ` (${p.reviews})` : ''}` : '', cat, p.price].filter(Boolean).join(' • ');
    if (p.open) el.querySelector('.mpc-tx small').textContent = p.open;
    el.querySelector('.mpc-gm').href = gmapsDir(p, st.mode);
    el.querySelector('.mpc-go').onclick = () => route(p);
    return el;
  }
  function select(i, scroll) {
    st.sel = i; const p = d.places[i];
    list.querySelectorAll('.mcard').forEach((c) => c.classList.toggle('on', +c.dataset.i === i));
    if (scroll) list.querySelector(`.mcard[data-i="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    if (st.eng && p.lat != null) { st.eng.sel(i); st.eng.fly(p); st.eng.popup(p, popCard(p)); }
    else if (p.lat == null) route(p);
  }
  box.querySelectorAll('.mseg button').forEach((b) => { b.onclick = () => { st.mode = b.dataset.m; seg(); if (st.sel >= 0 && !routeEl.hidden) route(d.places[st.sel]); }; });
  box.querySelector('.m3d').onclick = (e) => { if (st.eng) e.currentTarget.classList.toggle('on', st.eng.toggle3d()); };
  box.querySelector('.mloc').onclick = () => {
    if (!navigator.geolocation) return toast('Position indisponible sur cet appareil');
    toast('Recherche de ta position…');
    navigator.geolocation.getCurrentPosition((pos) => { st.me = { lat: pos.coords.latitude, lng: pos.coords.longitude }; if (st.eng) st.eng.me(st.me); if (st.sel >= 0) route(d.places[st.sel]); }, () => toast('Position refusée : autorise-la dans le navigateur'), { enableHighAccuracy: true, timeout: 12000 });
  };
  box.querySelector('.mfull').onclick = () => { box.classList.toggle('full'); document.body.classList.toggle('uifull', box.classList.contains('full')); setTimeout(() => st.eng && st.eng.resize(), 260); };
  // Style de la carte : JOUR par défaut (le plus détaillé, même si l'appli est en thème sombre) ; bouton 🌙/☀️ pour la nuit
  let night = false; try { night = localStorage.getItem('muse_map_night') === '1'; } catch {}
  const nb = box.querySelector('.mnight'); nb.textContent = night ? '☀️' : '🌙'; nb.title = night ? 'Carte de jour' : 'Carte de nuit';
  let warned = false;
  function boot() {
    mapEl.innerHTML = '<div class="mload"><span class="mspin"></span>Chargement de la carte 3D…</div>';
    (webglOk() ? engine3D(mapEl, night).catch(() => { mapEl.innerHTML = ''; return engine2D(mapEl); }) : engine2D(mapEl)).then((eng) => {
      st.eng = eng; mapEl.querySelector('.mload')?.remove();
      box.querySelector('.m3d').classList.toggle('on', eng.kind === '3d'); box.querySelector('.m3d').hidden = eng.kind !== '3d'; nb.hidden = eng.kind !== '3d';
      const pts = [];
      d.places.forEach((p, i) => { if (p.lat == null) return; eng.pin(i, p, () => select(i, true)); pts.push([p.lat, p.lng]); });
      if (st.me) { eng.me(st.me); pts.push([st.me.lat, st.me.lng]); }
      eng.fit(pts);
      const miss = d.places.filter((p) => p.lat == null).length;
      if (miss && !warned) { warned = true; const n = document.createElement('div'); n.className = 'mwarn'; n.textContent = `${miss} lieu${miss > 1 ? 'x' : ''} sans position exacte : utilise « Ouvrir dans Google Maps ».`; box.insertBefore(n, list); }
      if (st.sel >= 0) eng.sel(st.sel);
      setTimeout(() => eng.orbit(), 1200);
    }).catch(() => { mapEl.innerHTML = '<div class="mload">Carte indisponible hors ligne — la liste reste utilisable.</div>'; });
  }
  nb.onclick = () => {
    night = !night; try { localStorage.setItem('muse_map_night', night ? '1' : '0'); } catch {}
    nb.textContent = night ? '☀️' : '🌙'; nb.title = night ? 'Carte de jour' : 'Carte de nuit';
    if (st.eng) { try { st.eng.destroy(); } catch {} st.eng = null; }
    routeEl.hidden = true; boot();
  };
  boot();
  return box;
}
const lb = { el: null, list: [], i: 0 };
function lbShow(k) {
  if (!lb.list.length) return lbClose();
  lb.i = (k + lb.list.length) % lb.list.length;
  const it = lb.list[lb.i];
  lb.el.querySelector('img').src = it.img; lb.el.querySelector('img').alt = it.cap;
  lb.el.querySelector('.lb-t').textContent = it.cap || hostOf(it.page || it.img);
  const a = lb.el.querySelector('a'); a.hidden = !it.page; a.href = it.page || '#';
  lb.el.querySelectorAll('.lb-p,.lb-n').forEach((b) => (b.hidden = lb.list.length < 2));
  lb.el.querySelector('.lb-c').textContent = lb.list.length > 1 ? `${lb.i + 1} / ${lb.list.length}` : '';
}
function lbClose() { if (lb.el) { lb.el.hidden = true; lb.el.querySelector('img').removeAttribute('src'); } }
function openLightbox(list, k) {
  if (!lb.el) {
    lb.el = $('#lb');
    lb.el.onclick = (e) => { if (e.target === lb.el || e.target.closest('.lb-x')) lbClose(); };
    lb.el.querySelector('.lb-p').onclick = (e) => { e.stopPropagation(); lbShow(lb.i - 1); };
    lb.el.querySelector('.lb-n').onclick = (e) => { e.stopPropagation(); lbShow(lb.i + 1); };
    document.addEventListener('keydown', (e) => { if (lb.el.hidden) return; if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowLeft') lbShow(lb.i - 1); else if (e.key === 'ArrowRight') lbShow(lb.i + 1); });
    let x0 = null; lb.el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.el.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) lbShow(lb.i + (dx < 0 ? 1 : -1)); });
  }
  lb.list = list; lb.el.hidden = false; lbShow(k);
}
// Chaque image est cherchée dans l'ordre : copie gardée dans ton dépôt privé (jamais bloquée) → adresse d'origine → carte « voir la source »
function gallery(group, all) {
  const g = document.createElement('div'); g.className = 'gallery' + (group.length === 1 ? ' one' : '');
  group.forEach((it) => {
    const f = document.createElement('figure');
    const im = document.createElement('img'); im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.alt = it.cap || '';
    const c = document.createElement('figcaption'); c.textContent = it.cap || hostOf(it.page || it.img);
    const miss = () => {
      it.dead = true;
      if (!it.page) { f.remove(); if (!g.children.length) g.remove(); return; }
      f.className = 'miss'; f.onclick = null; f.textContent = '';
      const a = document.createElement('a'); a.href = it.page; a.target = '_blank'; a.rel = 'noopener'; a.textContent = `${it.cap || hostOf(it.page)} — voir la source ↗`; f.appendChild(a);
    };
    const srcs = []; if (it.local) srcs.push(() => fetchBlob(it.local, '')); if (it.img) srcs.push(async () => it.img);
    let i = 0;
    const tryNext = async () => { while (i < srcs.length) { try { im.src = await srcs[i++](); return; } catch { /* source suivante */ } } miss(); };
    im.onload = () => { it.shown = im.currentSrc || im.src; };
    im.onerror = tryNext;
    f.onclick = () => { const live = all.filter((x) => !x.dead); openLightbox(live.map((x) => ({ img: x.shown || x.img, cap: x.cap, page: x.page })), Math.max(0, live.indexOf(it))); };
    f.append(im, c); g.appendChild(f); tryNext();
  });
  return g;
}
function add(role, text, cls = '') {
  const d = document.createElement('div');
  d.className = `m ${role} ${cls}`; d.innerHTML = render(text);
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
}
const avatar = (s) => { try { window.MuseAvatar && window.MuseAvatar.setState(s); } catch {} };
const toast = (t) => { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2800); };

async function gh(path, opts = {}) {
  let r;
  try {
    r = await fetch(API + path, {
      cache: 'no-store', // GitHub impose max-age=60 : sans ça, la réponse de Muse n'apparaît qu'après 60 s
      ...opts,
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    });
  } catch (e) { const n = new Error('Connexion perdue pendant l’envoi (réseau ou GitHub injoignable). Réessaie dans un instant : ton message est conservé.'); n.network = true; throw n; }
  if (!r.ok) { const e = new Error(r.status === 401 ? 'Token invalide ou expiré' : r.status === 404 ? 'Dépôt introuvable (vérifie le nom et les droits du token)' : `GitHub ${r.status}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}
const need = () => { if (!cfg.repo || !cfg.token) { openCfg(); return false; } return true; };

function empty() {
  const h = new Date().getHours(), hello = h < 5 ? 'Encore debout' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  msgs.innerHTML = `<div id="empty"><h1>${hello}, <em>Cédric</em>.</h1><p>Demande-moi n’importe quoi : je m’occupe de ton agenda, de tes e-mails, de ton téléphone ou de ton code.</p>
  <div class="chips">${[['Mon programme du jour', 'Agenda et e-mails importants', 'Qu’ai-je à faire aujourd’hui ? Ajoute les e-mails importants non lus.'], ['Un module Odoo', 'Développement, revue, migration', 'Aide-moi sur un module Odoo'], ['Des idées pour GYOO', 'Contenus et publications', 'Idées de contenu pour GYOO cette semaine'], ['Planifier ma semaine', 'Priorités et créneaux', 'Planifie ma semaine']]
    .map(([t, sub, q]) => `<button class="chip" data-q="${q}"><span>${t}<small>${sub}</small></span>${ic('arrow')}</button>`).join('')}</div></div>`;
  document.querySelectorAll('.chip').forEach((b) => (b.onclick = () => { input.value = b.dataset.q; send(); }));
}

async function loadList() {
  if (!cfg.repo || !cfg.token) return;
  try {
    const l = (await gh(`/repos/${cfg.repo}/issues?state=open&sort=updated&per_page=50`)).filter((i) => !i.pull_request && !(i.body || '').startsWith('<!--auto:')); // les historiques d'automatisations vivent dans l'onglet ⚡
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
  } catch (e) { toast('' + e.message); }
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
  if (c.body.includes(LIVE)) return null;
  if (c.body.includes(REPLY)) {
    let txt = strip(c.body), meta = '';
    txt = txt.replace(/^[ \t]*🧭[^\n]*?Mode choisi\s*:\s*([^\n]*)$/m, (_, m) => { meta = m.replace(/[_*]/g, '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim(); return ''; }).trim();
    const d = add('bot', ''); const raws = [];
    splitUI(txt).forEach((seg) => {
      if (seg.ui) { d.appendChild(uiBox(seg.ui)); d.classList.add('hasUi'); raws.push("J'ai préparé une interface interactive."); return; }
      if (seg.map) { d.appendChild(mapBox(seg.map, attsIn(c.body))); d.classList.add('hasUi'); raws.push(mapPlain(seg.map)); return; }
      if (seg.cards) { d.appendChild(cardsBox(seg.cards)); d.classList.add('hasUi'); raws.push(cardsPlain(seg.cards)); return; }
      const { parts, all, plain } = splitParts(seg.t); raws.push(plain);
      parts.forEach((p) => (p.t !== undefined ? d.insertAdjacentHTML('beforeend', render(p.t)) : d.appendChild(gallery(p.imgs, all))));
    });
    d.dataset.raw = raws.filter(Boolean).join('\n\n').replace(/\[\[SRC:[^\]]*\]\]/g, '');
    if (meta) { const s = document.createElement('span'); s.className = 'meta'; s.textContent = 'Mode : ' + meta; d.appendChild(s); }
    addTts(d);
    if (c.body.includes('<!--propose-->')) { // proposition d'une automatisation : validation en un clic (ou écris ta version)
      const row = document.createElement('div'); row.className = 'confirm';
      const mk = (label, cls, text) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost ' + cls; b.textContent = label; b.onclick = () => { row.remove(); input.value = text; send(); }; row.appendChild(b); };
      mk('Envoyer tel quel', 'yes', 'Envoie ce message tel quel.'); mk('Ne pas répondre', 'no', 'Ne réponds pas à ce message.'); d.appendChild(row);
    }
    if (/Code de confirmation\s*:\s*[0-9a-f]{6}/i.test(c.body)) { // boutons de validation humaine
      const row = document.createElement('div'); row.className = 'confirm';
      const mk = (label, cls, text) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost ' + cls; b.textContent = label; b.onclick = () => { row.remove(); input.value = text; send(); }; row.appendChild(b); };
      mk('Confirmer', 'yes', 'OUI'); mk('Annuler', 'no', 'Non, annule'); d.appendChild(row);
    } const used = new Set(); for (const m of txt.matchAll(/```[ \t]*muse-map[ \t]*\r?\n([\s\S]*?)```/g)) { const pm = parseMap(m[1]); if (pm) pm.places.forEach((p) => p.photo && used.add(p.photo.toLowerCase())); }
    const a = attsIn(c.body).filter((x) => !used.has(x.name.toLowerCase())); if (a.length) { d.appendChild(attsBox(a)); d.classList.add('hasAtts'); } return d; }
  if (c.body.includes(ERROR)) return add('bot', strip(c.body), 'err');
  return addUser(strip(c.body), attsIn(c.body));
}

async function openConv(n) {
  if (!need()) return;
  if (window.autosClose) autosClose();
  stopTts(); pollId++; busy = false; $('#send').disabled = false; avatar('idle'); issueNo = n; msgs.innerHTML = ''; $('#side').classList.remove('open');
  try {
    const cs = await fetchComments(n);
    cs.forEach(show);
    const mode = [...cs].reverse().map((c) => (c.body.match(/<!--mode:(\w+)-->/) || [])[1]).find(Boolean);
    if (mode) modeSel.value = mode;
    const last = [...cs].reverse().find((c) => !c.body.includes(LIVE));
    // Une réponse est peut-être encore en préparation : on reprend l'attente.
    if (last && !last.body.includes(REPLY) && !last.body.includes(ERROR) && Date.now() - new Date(last.created_at) < 20 * 60 * 1000) wait(n, last.created_at);
  } catch (e) { add('bot', '' + e.message, 'err'); }
  loadList();
}
function newChat() { if (window.autosClose) autosClose(); stopTts(); pollId++; busy = false; $('#send').disabled = false; avatar('idle'); issueNo = null; empty(); $('#side').classList.remove('open'); loadList(); }

// 🖥️ Carte « Muse travaille » : dernière capture du navigateur, étape en cours, étapes déjà faites
function liveCard() {
  const d = document.createElement('div'); d.className = 'm bot live';
  d.innerHTML = '<div class="lv-head"><span class="lv-dot"></span><b>Muse travaille</b><span class="lv-t"></span></div>'
    + '<div class="lv-screen"><div class="lv-bar"><i></i><i></i><i></i><span class="lv-url"></span></div><div class="lv-view"><img alt="Capture du navigateur de Muse" hidden><div class="lv-ph"></div></div></div>'
    + '<div class="lv-now"></div><ul class="lv-steps"></ul>';
  const img = d.querySelector('img');
  img.onclick = () => openLightbox([{ img: img.src, cap: d.querySelector('.lv-now').textContent, page: d.dataset.url || '' }], 0);
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
}
function liveUpdate(d, o) {
  d.querySelector('.lv-now').textContent = o.label || '';
  d.querySelector('.lv-t').textContent = Math.max(0, Math.round((Date.now() - (o.t0 || Date.now())) / 1000)) + ' s';
  const img = d.querySelector('img'), ph = d.querySelector('.lv-ph');
  d.dataset.url = /^https?:/i.test(o.url || '') ? o.url : '';
  d.querySelector('.lv-url').textContent = o.masked ? 'Page de connexion' : (d.dataset.url ? hostOf(d.dataset.url) : '');
  if (o.img && /^[A-Za-z0-9+/=]+$/.test(o.img)) { const src = 'data:image/jpeg;base64,' + o.img; if (img.src !== src) img.src = src; img.hidden = false; ph.hidden = true; }
  else { img.hidden = true; ph.hidden = false; ph.textContent = o.masked ? 'Capture masquée : page de connexion' : 'Le navigateur démarre…'; }
  const ul = d.querySelector('.lv-steps'), steps = (o.steps || []).map(String);
  if (ul.dataset.n !== String(steps.length)) {
    ul.dataset.n = String(steps.length); ul.innerHTML = '';
    steps.forEach((t) => { const li = document.createElement('li'); li.textContent = t.replace(/…$/, ''); ul.appendChild(li); });
    ul.scrollTop = ul.scrollHeight;
  }
  d.classList.toggle('empty-steps', !steps.length);
  msgs.scrollTop = msgs.scrollHeight;
}
const liveOf = (cs) => { const c = [...cs].reverse().find((x) => x.body.includes(LIVE)); if (!c || Date.now() - new Date(c.updated_at || c.created_at) > 2 * 60 * 1000) return null; try { return JSON.parse(c.body.slice(c.body.indexOf(LIVE) + LIVE.length).trim()); } catch { return null; } };

async function wait(n, since) {
  const my = ++pollId; busy = true; $('#send').disabled = true;
  const ordi = modeSel.value === 'ordi', perso = modeSel.value === 'perso', phone = modeSel.value === 'phone', workMode = ordi || perso || phone, auto = modeSel.value === 'auto', MAXW = (ordi || phone || auto ? 18 : 5) * 60 * 1000, label = ordi ? 'Muse travaille sur son ordinateur' : perso ? 'Muse consulte ton agenda et tes e-mails' : phone ? 'Muse utilise ton téléphone' : 'Muse réfléchit';
  avatar(workMode ? 'working' : 'thinking');
  const bubble = add('bot', label, 'wait'); const t0 = Date.now(); let card = null;
  while (my === pollId && Date.now() - t0 < MAXW) {
    await new Promise((r) => setTimeout(r, 2000));
    if (my !== pollId) return;
    bubble.textContent = `${label} · ${Math.round((Date.now() - t0) / 1000)} s`;
    try {
      const all = await fetchComments(n, since);
      const cs = all.filter((c) => (c.body.includes(REPLY) || c.body.includes(ERROR)) && new Date(c.created_at) >= new Date(since));
      const lv = cs.length ? null : liveOf(all);
      if (lv) { if (!card) { card = liveCard(); bubble.style.display = 'none'; avatar('working'); } liveUpdate(card, lv); }
      else if (card && !cs.length) { card.remove(); card = null; bubble.style.display = ''; avatar(workMode ? 'working' : 'thinking'); }
      if (cs.length) { if (card) card.remove(); bubble.remove(); cs.forEach(show); autoRead(cs); avatar(cs.some((c) => c.body.includes(ERROR)) ? 'sad' : 'happy'); break; }
    } catch { /* réseau coupé : on réessaie */ }
  }
  if (my === pollId) {
    if (card) card.remove();
    if (Date.now() - t0 >= MAXW) { bubble.className = 'm bot err'; bubble.textContent = 'Pas de réponse pour l’instant. Rouvre cette discussion dans un moment : Muse répondra dès que possible.'; avatar('sad'); }
    busy = false; $('#send').disabled = false; loadList();
  }
}

async function send() {
  const message = input.value.trim();
  if ((!message && !pending.length) || busy || !need()) return;
  stopTts(); const files = pending.splice(0); renderPending();
  input.value = ''; input.style.height = 'auto'; busy = true; $('#send').disabled = true;
  let up = null, sent = false;
  try {
    if (!issueNo) {
      const i = await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: (message || files[0].name).slice(0, 60), body: 'Discussion Muse' }) });
      issueNo = i.number; msgs.innerHTML = '';
    }
    addUser(message, files.map((f) => ({ name: f.name, type: f.type, url: f.url })));
    let markers = '';
    if (files.length) {
      up = add('bot', 'Envoi des pièces jointes', 'wait');
      markers = await upload(issueNo, files, (k) => { up.textContent = `Envoi des pièces jointes · ${k}/${files.length}`; });
      up.remove();
    }
    const c = await gh(`/repos/${cfg.repo}/issues/${issueNo}/comments`, { method: 'POST', body: JSON.stringify({ body: `${message || '(pièce jointe)'}${markers}\n\n<!--mode:${modeSel.value}-->` }) });
    sent = true;
    wait(issueNo, c.created_at);
  } catch (e) {
    if (up) up.remove();
    if (!sent) { input.value = message; input.dispatchEvent(new Event('input')); pending.push(...files); renderPending(); } // rien n'est perdu : il suffit de renvoyer
    add('bot', '' + e.message, 'err'); busy = false; $('#send').disabled = false; avatar('sad'); }
}

// ---- Pièces jointes
const MAX_FILES = 5, MAX_IMG = 4.5e6, MAX_FILE = 20e6, ZIP_ENTRY = 8e6;
const ZIP_IGNORE = /(^|\/)(node_modules|\.git|\.venv|venv|__pycache__|dist|build|\.next|\.cache|\.idea|\.vscode|__MACOSX|\.DS_Store)(\/|$)/i;
const ZIP_SECRET = /(^|\/)(\.env(\.[^/]*)?|id_rsa[^/]*|[^/]*\.(pem|key|p12|pfx|kdbx))$/i;
const iconOf = (name, kind) => { if (kind === 'img') return '<span class="ext">IMG</span>'; const e = (String(name).split('.').pop() || '').toLowerCase().slice(0, 4); return `<span class="ext">${esc(e.toUpperCase() || 'FICHIER')}</span>`; };
// Dossier -> .zip (dans le navigateur) ; items = [{ path, file }]
async function zipFolder(items) {
  if (!window.JSZip) { toast('Module dossier indisponible, recharge la page'); return null; }
  const root = (items[0]?.path.split('/')[0]) || 'dossier';
  const z = new JSZip(); let n = 0, skipped = 0, total = 0;
  for (const { path, file } of items) {
    if (ZIP_IGNORE.test(path) || ZIP_SECRET.test(path) && !/\.example$/i.test(path)) { skipped++; continue; }
    if (file.size > ZIP_ENTRY || total + file.size > MAX_FILE) { skipped++; continue; }
    z.file(path, file); n++; total += file.size;
  }
  if (!n) { toast('Aucun fichier utilisable dans ce dossier'); return null; }
  const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  toast(`« ${root} » : ${n} fichiers${skipped ? ` (${skipped} ignorés : node_modules, secrets, gros fichiers…)` : ''}`);
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
    if (pending.length >= MAX_FILES) { toast(`Maximum ${MAX_FILES} fichiers par message`); break; }
    const isImg = /^image\//i.test(f0.type) || /\.(jpe?g|png|webp|gif)$/i.test(f0.name);
    const f = isImg ? await shrink(f0) : f0;
    if (f.size > (isImg ? MAX_IMG : MAX_FILE)) { toast(`« ${f0.name} » est trop lourd (${fmtSize(f.size)}, max ${isImg ? '4,5' : '20'} Mo)`); continue; }
    pending.push({ name: label(f.name || f0.name || 'photo.jpg'), type: f.type || 'application/octet-stream', blob: f, url: URL.createObjectURL(f), kind: isImg ? 'img' : 'file' });
  }
  renderPending();
}
function renderPending() {
  const box = $('#pending'); box.innerHTML = ''; box.hidden = !pending.length;
  pending.forEach((p, i) => {
    const d = document.createElement('div'); d.className = 'pchip';
    d.innerHTML = (p.kind === 'img' ? `<img src="${p.url}" alt="">` : `<span class="pfile"><span>${iconOf(p.name)}${esc(p.name)}</span><small>${fmtSize(p.blob.size)}</small></span>`) + '<button type="button" title="Retirer">✕</button>';
    d.querySelector('button').onclick = () => { URL.revokeObjectURL(p.url); pending.splice(i, 1); renderPending(); };
    box.appendChild(d);
  });
}
const toB64 = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(blob); });
async function upload(n, files, progress) {
  let markers = '';
  for (let i = 0; i < files.length; i++) {
    const f = files[i], p = `uploads/${n}/${Date.now()}-${i}-${safeName(f.name)}`;
    const body = JSON.stringify({ message: 'pièce jointe', content: await toB64(f.blob) });
    for (let t = 1; ; t++) { // une coupure réseau passagère ne doit pas faire perdre la pièce jointe : 3 essais
      try { await gh(`/repos/${cfg.repo}/contents/${p}`, { method: 'PUT', body }); break; }
      catch (e) {
        if (e.status === 422) break; // déjà déposée lors d'un essai précédent
        if (t >= 3 || !(e.network || e.status >= 500 || [403, 409, 429].includes(e.status))) throw e;
        await new Promise((r) => setTimeout(r, 900 * t));
      }
    }
    markers += `\n<!--att:${p}|${label(f.name)}|${f.type}-->`;
    progress(i + 1);
  }
  return markers;
}
const MIME_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf', mp4: 'video/mp4', txt: 'text/plain', csv: 'text/csv', json: 'application/json' };
async function fetchBlob(p, hint = '') {
  if (blobCache.has(p)) return blobCache.get(p);
  const r = await fetch(`${API}/repos/${cfg.repo}/contents/${p.split('/').map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github.raw+json' } });
  if (!r.ok) throw new Error('GitHub ' + r.status);
  // GitHub renvoie un type générique : on remet le vrai type (sinon l'image s'ouvre comme du texte)
  const type = /^[a-z]+\/[\w.+-]+$/i.test(hint) && hint !== 'application/octet-stream' ? hint : (MIME_EXT[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream');
  const url = URL.createObjectURL(new Blob([await r.arrayBuffer()], { type })); blobCache.set(p, url); return url;
}
function attsBox(atts) {
  const box = document.createElement('div'); box.className = 'atts';
  atts.forEach((a) => {
    const isImg = /^image\//i.test(a.type) || /\.(jpe?g|png|webp|gif)$/i.test(a.name);
    const open = async () => {
      try {
        const u = a.url || await fetchBlob(a.path, a.type);
        if (isImg) {
          const imgs = atts.filter((x) => /^image\//i.test(x.type) || /\.(jpe?g|png|webp|gif)$/i.test(x.name));
          const list = await Promise.all(imgs.map(async (x) => ({ img: x.url || await fetchBlob(x.path, x.type), cap: x.name.split('/').pop() })));
          openLightbox(list, Math.max(0, imgs.indexOf(a)));
        }
        else { const l = document.createElement('a'); l.href = u; l.download = a.name.split('/').pop(); document.body.appendChild(l); l.click(); l.remove(); }
      } catch { toast('Fichier introuvable'); }
    };
    if (isImg) {
      const im = document.createElement('img'); im.alt = a.name; im.title = a.name; im.onclick = open; box.appendChild(im);
      if (a.url) im.src = a.url; else fetchBlob(a.path, a.type).then((u) => (im.src = u)).catch(() => { im.replaceWith(Object.assign(document.createElement('span'), { className: 'fchip', textContent: a.name })); });
    } else {
      const s = document.createElement('span'); s.className = 'fchip'; s.innerHTML = iconOf(a.name) + esc(a.name) + ' ↓'; s.title = 'Télécharger'; s.onclick = open; box.appendChild(s);
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
$('#phoneCode').onclick = async () => {
  if (!cfg.repo || !cfg.token) { $('#cfgMsg').textContent = 'Renseigne d\'abord le dépôt et le token ci-dessus, puis enregistre.'; return; }
  const bytes = new TextEncoder().encode(JSON.stringify({ r: cfg.repo, t: cfg.token }));
  let bin = ''; bytes.forEach((c) => (bin += String.fromCharCode(c)));
  const code = 'MUSEB.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  try { await navigator.clipboard.writeText(code); $('#cfgMsg').textContent = 'Code copié. Ouvre l\'appli Muse Tél. → étape 7 → « Coller le code Cerveau ».'; }
  catch { window.prompt('Copie ce code :', code); }
};
$('#cfgBtn').onclick = openCfg; $('#cfgCancel').onclick = () => $('#cfg').close();
$('#cfgSave').onclick = async () => {
  const repo = $('#cfgRepo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, ''), token = $('#cfgTok').value.trim();
  const prev = cfg; cfg = { repo, token };
  try {
    const r = await gh(`/repos/${repo}`);
    if (!r.private) { $('#cfgMsg').textContent = 'Ce dépôt est public : tes discussions seraient visibles par tout le monde. Utilise un dépôt privé.'; cfg = prev; return; }
    localStorage.setItem('muse_repo', repo); localStorage.setItem('muse_token', token);
    $('#cfg').close(); toast('Connecté.'); loadList();
  } catch (e) { cfg = prev; $('#cfgMsg').textContent = '' + e.message; }
};

// ---- Mémoire (data/memory.md dans le dépôt)
let memSha = null;
const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
const b64e = (s) => { const b = new TextEncoder().encode(s); let x = ''; b.forEach((c) => (x += String.fromCharCode(c))); return btoa(x); };
$('#memBtn').onclick = async () => {
  if (!need()) return;
  try {
    const f = await gh(`/repos/${cfg.repo}/contents/data/memory.md`); memSha = f.sha; $('#memTxt').value = b64d(f.content);
  } catch (e) { if (e.status === 404) { memSha = null; $('#memTxt').value = ''; } else return toast('' + e.message); }
  $('#dlg').showModal(); $('#side').classList.remove('open');
};
$('#memCancel').onclick = () => $('#dlg').close();
$('#memSave').onclick = async () => {
  try {
    await gh(`/repos/${cfg.repo}/contents/data/memory.md`, { method: 'PUT', body: JSON.stringify({ message: 'Mémoire modifiée depuis l’app', content: b64e($('#memTxt').value), ...(memSha ? { sha: memSha } : {}) }) });
    $('#dlg').close(); toast('Mémoire enregistrée');
  } catch (e) { toast('' + (e.status === 409 || e.status === 422 ? 'La mémoire a changé entre-temps, rouvre-la' : e.message)); }
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
$('#new').onclick = newChat; const sideSet = on => { $('#side').classList.toggle('open', on); $('#scrim').classList.toggle('on', on); };
$('#menu').onclick = () => sideSet(!$('#side').classList.contains('open'));
$('#scrim').onclick = $('#sclose').onclick = () => sideSet(false);
document.addEventListener('keydown', e => { if (e.key === 'Escape') sideSet(false); });
{ let sx = null; const side = $('#side');
  side.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  side.addEventListener('touchend', e => { if (sx !== null && sx - e.changedTouches[0].clientX > 60) sideSet(false); sx = null; }, { passive: true }); }
new MutationObserver(() => $('#scrim').classList.toggle('on', $('#side').classList.contains('open'))).observe($('#side'), { attributes: true, attributeFilter: ['class'] });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
empty(); if (cfg.repo && cfg.token) loadList(); else setTimeout(openCfg, 300);

// ---- Thème clair (comme le panneau de la bulle) / sombre
(() => {
  const root = document.documentElement, meta = document.querySelector('meta[name=theme-color]'), btn = $('#themeBtn');
  const apply = (t) => { root.dataset.theme = t; if (meta) meta.content = t === 'dark' ? '#13111D' : '#F8F7FF'; btn.innerHTML = ic(t === 'dark' ? 'sun' : 'moon'); };
  apply(root.dataset.theme === 'dark' ? 'dark' : 'light');
  btn.onclick = () => { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; apply(t); setTimeout(uiThemeSync, 30); try { localStorage.setItem('muse_theme', t); } catch { /* stockage indisponible */ } };
})();

// ---- Lecture à voix haute des réponses de Muse (synthèse vocale du navigateur, hors-ligne, en français)
let readNext = false;
const TTS = (() => {
  const syn = window.speechSynthesis;
  if (!syn || !window.SpeechSynthesisUtterance) return null;
  const ls = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } };
  const T = { auto: ls('muse_tts_auto', '0') === '1', rate: parseFloat(ls('muse_tts_rate', '1')) || 1, voice: ls('muse_tts_voice', ''), id: 0, btn: null };

  // Texte « parlable » : sans markdown, emojis, liens, code ni lignes techniques
  T.clean = (md) => {
    let t = String(md || '')
      .replace(/<!--[\s\S]*?-->/g, ' ').replace(/\[\[IMG:[^\]]*\]\]/g, ' ').replace(/\[\[REMEMBER:[\s\S]*?\]\]/g, ' ')
      .replace(/^[ \t]*(🧭|ℹ️|🧠|📎)[^\n]*$/gm, ' ')
      .replace(/^[ \t]*Code de confirmation\s*:[^\n]*$/gim, ' ')
      .replace(/^[ \t]*Sources?\s*:[\s\S]*$/im, ' ')
      .replace(/```[\s\S]*?(```|$)/g, ' (bloc de code) ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\bhttps?:\/\/\S+/g, ' lien ')
      .replace(/`([^`]*)`/g, '$1').replace(/(\*\*|__|\*|~~)/g, '').replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:!?])/g, '$1$2')
      .replace(/^[ \t]*#{1,6}[ \t]*/gm, '').replace(/^[ \t]*>[ \t]?/gm, '').replace(/^[ \t]*[-*•][ \t]+/gm, '').replace(/^[ \t]*\|?[-: |]{3,}\|?[ \t]*$/gm, ' ')
      .replace(/\|/g, ', ')
      .replace(/[\p{Extended_Pictographic}‍️⃣]/gu, '')
      .replace(/([^.!?…:;,\s])[ \t]*\n+/g, '$1. ').replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
    return t;
  };
  T.chunks = (t) => {
    const out = []; let cur = '';
    for (const s of t.split(/(?<=[.!?…:;])\s+/)) {
      if ((cur + ' ' + s).length > 220 && cur) { out.push(cur.trim()); cur = s; } else cur += ' ' + s;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.flatMap((c) => (c.length > 260 ? c.match(/.{1,240}(\s|$)/g).map((x) => x.trim()) : [c])).filter(Boolean);
  };
  T.voices = () => syn.getVoices().filter((v) => /^fr/i.test(v.lang));
  T.pick = () => { const v = T.voices(); return v.find((x) => x.name === T.voice) || v.find((x) => /fr[-_]FR/i.test(x.lang) && x.localService) || v.find((x) => /fr[-_]FR/i.test(x.lang)) || v[0] || null; };
  T.setBtn = (b, on) => { if (!b) return; b.classList.toggle('on', on); b.innerHTML = on ? ic('stop') + 'Arrêter' : ic('speaker') + 'Écouter'; };
  T.stop = () => { T.id++; try { syn.cancel(); } catch { /* rien */ } T.setBtn(T.btn, false); T.btn = null; };
  T.speak = (text, btn) => {
    T.stop();
    const parts = T.chunks(T.clean(text));
    if (!parts.length) { toast('Rien à lire dans ce message.'); return; }
    const my = ++T.id; T.btn = btn || null; T.setBtn(btn, true);
    let i = 0;
    const next = () => {
      if (my !== T.id) return;
      if (i >= parts.length) { T.setBtn(btn, false); if (T.btn === btn) T.btn = null; return; }
      const u = new SpeechSynthesisUtterance(parts[i++]);
      u.lang = 'fr-FR'; u.rate = T.rate; const v = T.pick(); if (v) { u.voice = v; u.lang = v.lang; }
      u.onend = next;
      u.onerror = (e) => { if (my !== T.id) return; if (e.error === 'not-allowed') { toast('Touche d’abord l’écran puis réessaie (le navigateur bloque le son automatique).'); T.setBtn(btn, false); } else if (e.error !== 'interrupted' && e.error !== 'canceled') next(); };
      syn.speak(u);
    };
    next();
  };
  T.setAuto = (on) => { T.auto = on; set('muse_tts_auto', on ? '1' : '0'); const b = $('#ttsBtn'); b.classList.toggle('on', on); b.innerHTML = ic(on ? 'speaker' : 'mute'); b.title = 'Lecture à voix haute des réponses de Muse (' + (on ? 'activée' : 'désactivée') + ')'; };
  T.setAuto(T.auto);
  $('#ttsBtn').onclick = () => { const on = !T.auto; T.setAuto(on); if (!on) T.stop(); toast(on ? 'Muse lira ses réponses à voix haute.' : 'Lecture à voix haute coupée.'); };

  // Réglages : voix, vitesse, test
  const fill = () => {
    const sel = $('#ttsVoice'), v = T.voices(); const cur = T.pick();
    sel.innerHTML = v.length ? v.map((x) => `<option value="${x.name.replace(/"/g, '&quot;')}">${x.name} (${x.lang})</option>`).join('') : '<option value="">Voix du téléphone (par défaut)</option>';
    if (cur) sel.value = cur.name;
  };
  fill(); syn.addEventListener?.('voiceschanged', fill);
  $('#ttsVoice').onchange = (e) => { T.voice = e.target.value; set('muse_tts_voice', T.voice); };
  $('#ttsRate').value = T.rate; $('#ttsRateV').textContent = T.rate.toFixed(2).replace(/0$/, '') + '×';
  $('#ttsRate').oninput = (e) => { T.rate = parseFloat(e.target.value); set('muse_tts_rate', String(T.rate)); $('#ttsRateV').textContent = T.rate.toFixed(2).replace(/0$/, '') + '×'; };
  $('#ttsTest').onclick = () => T.speak('Bonjour Cédric. Voici comment je lis mes réponses.');
  return T;
})();
function stopTts() { if (TTS) TTS.stop(); }
function addTts(d) {
  if (!TTS) return;
  const row = document.createElement('div'); row.className = 'tools';
  const b = document.createElement('button'); b.type = 'button'; b.className = 'tts'; b.innerHTML = ic('speaker') + 'Écouter';
  b.onclick = () => { if (b.classList.contains('on')) TTS.stop(); else TTS.speak(d.dataset.raw || d.textContent, b); };
  row.appendChild(b); d.appendChild(row);
}
// Réponse reçue en direct : lue si la lecture automatique est active, ou si la demande a été dictée au micro
function autoRead(cs) {
  const want = TTS && (TTS.auto || readNext); readNext = false;
  if (!want) return;
  const last = [...cs].reverse().find((c) => c.body.includes(REPLY));
  if (!last) return;
  const bubbles = [...msgs.querySelectorAll('.m.bot[data-raw]')], d = bubbles[bubbles.length - 1];
  TTS.speak(strip(last.body), d && d.querySelector('.tts'));
}

// ---- Micro : dicter sa demande (reconnaissance vocale du navigateur, en français) ; la phrase est envoyée à la fin
(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $('#micBtn');
  mic.innerHTML = ic('mic');
  if (!SR) { mic.hidden = true; return; }
  let rec = null, base = '', heard = false;
  const ERR = {
    'not-allowed': 'Micro refusé : autorise-le pour ce site (cadenas de la barre d’adresse, ou Réglages → Applis → Muse → Autorisations).',
    'service-not-allowed': 'La dictée est désactivée sur ce navigateur.',
    'no-speech': 'Je n’ai rien entendu : réessaie.',
    'audio-capture': 'Aucun micro détecté.',
    network: 'La dictée a besoin d’internet.',
  };
  const panel = $('#listen'), wave = $('#wave'), hint = $('#listenHint');
  wave.innerHTML = Array.from({ length: 36 }, () => `<i style="--h:${25 + Math.random() * 70}%;--d:${(0.55 + Math.random() * 0.8).toFixed(2)}s;--l:-${(Math.random() * 1.2).toFixed(2)}s"></i>`).join('');
  const reset = () => { rec = null; mic.classList.remove('on'); mic.innerHTML = ic('mic'); mic.title = 'Parler à Muse'; panel.classList.remove('on'); };
  mic.onclick = () => {
    if (rec) { try { rec.stop(); } catch { /* déjà arrêté */ } return; }
    if (busy) { toast('Muse travaille encore, attends sa réponse.'); return; }
    if (!need()) return;
    rec = new SR();
    rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    base = input.value.trim() ? input.value.replace(/\s*$/, ' ') : ''; heard = false;
    rec.onresult = (e) => {
      let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      heard = !!t.trim(); input.value = base + t; input.dispatchEvent(new Event('input')); if (t.trim()) hint.textContent = t;
    };
    rec.onerror = (e) => { if (ERR[e.error]) toast(ERR[e.error]); else if (e.error !== 'aborted') toast('Micro : ' + e.error); };
    rec.onend = () => { reset(); avatar('idle'); if (heard && input.value.trim() && !busy) { readNext = true; send(); } };
    try { rec.start(); hint.textContent = 'Parle quand tu veux'; panel.classList.add('on'); mic.classList.add('on'); mic.innerHTML = ic('stop'); mic.title = 'Arrêter et envoyer'; avatar('thinking'); }
    catch (e) { reset(); toast('Impossible de démarrer le micro : ' + e.message); }
  };
})();

// ---- Demande venue de la bulle Muse du téléphone (?ask=…&mode=…) : nouvelle discussion + envoi automatique
(() => {
  const u = new URL(location.href), q = u.searchParams.get('ask'), m = u.searchParams.get('mode'), conv = parseInt(u.searchParams.get('c') || '', 10);
  if (conv > 0) { history.replaceState(null, '', u.pathname); if (cfg.repo && cfg.token) openConv(conv); return; } // touché depuis une notification
  if (!q) return;
  history.replaceState(null, '', u.pathname);
  if (!(cfg.repo && cfg.token)) return;
  newChat();
  if (m && [...modeSel.options].some((o) => o.value === m && !o.disabled)) modeSel.value = m;
  input.value = q; input.dispatchEvent(new Event('input'));
  setTimeout(send, 500);
})();
