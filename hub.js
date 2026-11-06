// 🧩 Agents spécialisés · 📒 Journal des actions · 🩺 Santé de Muse
// Agents : data/agents.json (écrit ici, lu par le cerveau). Journal et santé : deux discussions techniques
// (« 📒 Journal de Muse », « 🩺 Santé de Muse ») écrites par le cerveau ; l'état en direct des appareils passe par le relais (profil → code MUSE1).
(() => {
  const FILE = 'data/agents.json';
  const view = $('#autos'), mainEl = $('main');
  const q = (s) => esc(String(s == null ? '' : s)).replace(/"/g, '&quot;');
  const rid = () => 'a' + Array.from(crypto.getRandomValues(new Uint8Array(3)), (x) => x.toString(16).padStart(2, '0')).join('');
  const MODES = [['auto', 'Auto (Muse choisit)'], ['polyvalent', 'Recherche web et réflexion'], ['perso', 'Agenda et e-mails (Google)'], ['phone', 'Téléphone (+ navigateur du PC)'], ['ordi', 'Agent (ordinateur virtuel)'], ['dev', 'Dev / Odoo'], ['compagnon', 'Compagnon (discussion)'], ['creatif', 'Création']];
  const modeLabel = (v) => (MODES.find((m) => m[0] === v) || [v, v || 'Auto'])[1];
  // 🛠️ Quel métier → quelle animation de travail (accessoire 3D, petites icônes dans les cartes et la liste)
  const jobOf = (a) => {
    a = a || {}; if (['chef', 'mails', 'messages', 'gyoo', 'odoo', 'recherche'].includes(a.id)) return a.id;
    const k = `${a.name || ''} ${a.role || ''}`.toLowerCase();
    if (/chef|orchestre/.test(k)) return 'chef'; if (/mail|courrier|bo[iî]te/.test(k)) return 'mails'; if (/message|whatsapp|messenger/.test(k)) return 'messages';
    if (/odoo|code|d[ée]velop|python|react|docker/.test(k)) return 'odoo'; if (/film|vid[ée]o|contenu|gyoo|anime|cin[ée]ma/.test(k)) return 'gyoo'; if (/cherch|recherche|veille|prix|compar/.test(k)) return 'recherche';
    return 'star';
  };
  // 🔐 Permissions : ce que l'agent a le droit de faire (appliqué par le cerveau et les outils ; « lire » est toujours permis)
  const PERM_KEYS = [['draft', '✍️ Préparer', 'brouillons, écrire sans envoyer'], ['send', '📤 Envoyer', 'e-mails, messages, rendez-vous'], ['act', '👆 Agir', 'toucher l’écran, ouvrir des applis, cliquer dans le navigateur'], ['files', '🗂️ Ranger les fichiers', 'déplacer, copier, renommer'], ['delete', '🗑️ Supprimer', 'corbeille, rendez-vous'], ['autoCal', '⚡ Créer des rendez-vous sans confirmer', 'sans invités : créés tout de suite, sans « OUI » (il faut aussi « Envoyer »)']];
  const PERM_PRESETS = [['lecture', '🔒 Lecture seule', { draft: false, send: false, act: false, files: false, delete: false }], ['prudent', '✍️ Prudent', { draft: true, send: false, act: false, files: false, delete: false }], ['normal', '✅ Normal', { draft: true, send: true, act: true, files: true, delete: false }], ['tout', '🔓 Tout', { draft: true, send: true, act: true, files: true, delete: true }]];
  const routN = (a) => (st.routines || []).filter((m) => m.agent === a.id && m.enabled !== false).length;
  const permSame = (a, b) => PERM_KEYS.every(([k]) => !!a[k] === !!b[k]);
  const permName = (p) => { if (!p) return ''; const m = PERM_PRESETS.find(([, , v]) => permSame(p, v)); return m ? (m[0] === 'tout' ? '' : m[1]) : '🔐 Sur mesure'; };
  const COLORS = ['#7c5cff', '#2f80ed', '#22c55e', '#f06ab0', '#f59e0b', '#06b6d4', '#ef4444', '#64748b'];
  const TEMPLATES = [
    { id: 'chef', emoji: '🧭', name: 'Chef', color: '#7c5cff', mode: 'auto', role: 'Chef d’orchestre : organise mes journées, fixe les priorités, répartit le travail entre les autres agents et me fait un point clair et court.' },
    { id: 'mails', emoji: '📬', name: 'Boîte mail', color: '#2f80ed', mode: 'perso', role: 'Trie mes e-mails, résume ce qui compte, prépare des brouillons de réponse dans mon style, surveille factures, clients et rendez-vous.' },
    { id: 'messages', emoji: '💬', name: 'Messages', color: '#22c55e', mode: 'phone', role: 'Lit et répond à mes messages Messenger et WhatsApp dans mon ton, regarde les reels et vidéos reçus, me résume les conversations.' },
    { id: 'gyoo', emoji: '🎬', name: 'GYOO', color: '#f06ab0', mode: 'polyvalent', role: 'Veille et idées de contenus pour GYOO (films, anime, K-dramas, jeux, logiciels) pour un public malgache : scripts, légendes, calendrier de publication.' },
    { id: 'odoo', emoji: '🧑‍💻', name: 'Dev Odoo', color: '#f59e0b', mode: 'dev', role: 'Développeur Odoo 12 à 19, React, WordPress, Docker : code prêt à copier, revues, migrations, débogage, explications claires.' },
    { id: 'recherche', emoji: '🔎', name: 'Chercheur', color: '#06b6d4', mode: 'ordi', role: 'Recherches approfondies sur le web avec sources, comparatifs et prix à Madagascar, résultats vérifiés.' },
  ];
  const st = { items: [], sha: null, loaded: false, meta: {}, routines: [] };
  const MFILE = 'data/missions.json', MSFILE = 'data/missions-state.json';

  // ---------- Fichier des agents
  async function load() {
    try { const f = await gh(`/repos/${cfg.repo}/contents/${FILE}`); st.sha = f.sha; const d = JSON.parse(b64d(f.content)); st.items = Array.isArray(d.items) ? d.items : []; st.meta = d.meta || {}; }
    catch (e) { if (e.status !== 404) throw e; st.sha = null; st.items = []; }
    st.loaded = true;
    readJson(MFILE).then((m) => { st.routines = ((m.data && m.data.items) || []).filter((x) => x.agent); }).catch(() => {});   // ⏰ routines (missions rattachées à un agent)
  }
  async function save(msg) {
    const body = { message: msg, content: b64e(JSON.stringify({ version: 1, meta: st.meta || {}, items: st.items }, null, 2)), ...(st.sha ? { sha: st.sha } : {}) };
    try { st.sha = (await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify(body) })).content.sha; }
    catch (e) { if (e.status === 409 || e.status === 422) { await load().catch(() => {}); throw new Error('La liste des agents a changé entre-temps : elle est rechargée, refais ta modification.'); } throw e; }
  }
  // Discussion ↔ agent (pour que chaque message envoyé dans la discussion d'un agent lui soit adressé)
  window.museAgentOf = (n) => { const a = n && st.items.find((x) => Number(x.issue) === Number(n) && x.enabled !== false); return a ? a.id : ''; };
  window.museAgentMode = (n) => { const a = n && st.items.find((x) => Number(x.issue) === Number(n)); return a ? a.mode || 'auto' : ''; };
  setTimeout(() => { if (cfg.repo && cfg.token) load().then(async () => { loadList(); syncHeader(); await autoFix(); listLive(); }).catch(() => {}); }, 1500);
  // 🔧 Si la Veille proactive n'est pas encore chez le Chef (regroupement pas fait ou incomplet), on le refait tout seul
  async function autoFix() {
    try {
      const chef = st.items.find((a) => a.id === 'chef');
      const f = await gh(`/repos/${cfg.repo}/contents/data/missions.json`).catch(() => null); if (!f) return;
      const w = (JSON.parse(b64d(f.content)).items || []).find((m) => m.watch && m.enabled !== false);
      const l = await gh(`/repos/${cfg.repo}/issues?state=open&per_page=100`).catch(() => []);
      const stray = (l || []).some((i) => !i.pull_request && (/Veille proactive/.test(i.title) || (i.labels || []).some((x) => x.name === 'muse-checkin') || /^💬 Muse$/.test(i.title)) && (!chef || Number(i.number) !== Number(chef.issue)));
      if ((w && (!chef || Number(w.issue) !== Number(chef.issue))) || stray) { const r = await regroup(); loadList(); if (r.moved.length || r.archived) toast('Veille proactive et petits mots de Muse déplacés chez le Chef'); }
    } catch (e) { console.warn('regroupement auto', e.message); }
  }
  // 🟢 Liste des discussions : un agent qui travaille s'anime (halo, petits points, ce qu'il fait), puis une coche quand il a fini
  let prevWork = new Set(); const doneUntil = {};
  function decorateList() {
    const now = Date.now(), work = new Set();
    for (const a of st.items) { const s = stat[a.id] || {}; if (s.state === 'working' && s.since && now - Date.parse(s.since) < 20 * 60000) work.add(a.id); }
    for (const id of prevWork) if (!work.has(id)) doneUntil[id] = now + 3200;
    prevWork = work;
    { const ha = issueNo && st.items.find((x) => Number(x.issue) === Number(issueNo)); if (head && ha) head.busy(work.has(ha.id)); }   // l'avatar de l'en-tête sort son accessoire dès que l'agent travaille
    document.querySelectorAll('#list .item[data-n]').forEach((el) => {
      const a = st.items.find((x) => Number(x.issue) === Number(el.dataset.n));
      const w = a && work.has(a.id), done = a && !w && doneUntil[a.id] > now;
      el.classList.toggle('agWork', !!w); el.classList.toggle('agDone', !!done); if (a) el.dataset.job = jobOf(a);
      const b = el.querySelector('b'); if (!b) return;
      let wrap = el.querySelector('.nmW');
      if (w) {
        if (!wrap) { wrap = document.createElement('span'); wrap.className = 'nmW'; b.before(wrap); wrap.appendChild(b); }
        let ln = wrap.querySelector('.agLine'); if (!ln) { ln = document.createElement('small'); ln.className = 'agLine'; wrap.appendChild(ln); }
        ln.textContent = shortTask((stat[a.id] || {}).task);
        if (!el.querySelector('.agDots')) { const d = document.createElement('span'); d.className = 'agDots'; d.innerHTML = '<i></i><i></i><i></i>'; const m = el.querySelector('.more'); m ? m.before(d) : el.appendChild(d); }
      } else {
        if (wrap) { wrap.before(b); wrap.remove(); }
        const d = el.querySelector('.agDots'); if (d) d.remove();
      }
    });
    if (Object.values(doneUntil).some((t) => t > now)) setTimeout(decorateList, 3300);
  }
  // « Lis tes mails non lus de ce matin » → « lit tes mails… »
  function shortTask(t) {
    t = String(t || '').replace(/^Pour [^:]{1,40}:\s*/, '').trim();
    const k = t.toLowerCase();
    if (/reel|vid[ée]o/.test(k)) return 'regarde une vidéo…';
    if (/veille/.test(k)) return 'surveille tes mails et ton agenda…';
    if (/message re[çc]u|messenger|whatsapp|r[ée]pon/.test(k)) return 'répond à un message…';
    if (/mail|e-mail|inbox/.test(k)) return 'lit tes mails…';
    if (/agenda|rendez|calendrier/.test(k)) return 'regarde ton agenda…';
    if (/cherche|recherche|prix|compar/.test(k)) return 'cherche sur le web…';
    if (/code|odoo|module|bug/.test(k)) return 'écrit du code…';
    return t ? (t.length > 34 ? t.slice(0, 33) + '…' : t) : 'travaille…';
  }
  let listT = 0;
  function listLive() {
    clearInterval(listT);
    const tick = async () => { if (document.hidden || !st.items.length) return; await loadStatus(); decorateList(); };
    tick(); listT = setInterval(tick, 15000);
  }
  { const _ll = window.loadList; window.loadList = async function () { const r = await _ll.apply(this, arguments); decorateList(); badgeSync(); return r; }; }
  // 🔴 Chiffre rouge sur l'icône Muse du téléphone = nombre de discussions non lues.
  // Navigateur : API de badge (si le système la prend en charge). Téléphone : l'appli Android retire la notification des discussions lues ;
  // le lanceur (MIUI…) affiche sur l'icône « Muse » le nombre de discussions qui ont encore une réponse non lue.
  let badgeT = 0, lastBadge = '';
  function badgeSync() {
    clearTimeout(badgeT);
    badgeT = setTimeout(() => {
      const l = window.museLastList || []; let seen = {}; try { seen = JSON.parse(localStorage.getItem('muse_seen') || '{}') || {}; } catch {}
      let total = 0; const read = [];
      for (const i of l) { const s0 = Number(i.number) === Number(issueNo) ? i.comments : seen[i.number]; const un = s0 == null ? 0 : Math.max(0, (i.comments || 0) - s0); if (un) total++; else read.push(i.number); }
      try { if (navigator.setAppBadge) (total ? navigator.setAppBadge(total) : navigator.clearAppBadge()).catch(() => {}); } catch { /* pas pris en charge */ }
      const key = `${total}|${read.join(',')}`;
      if (key === lastBadge || !window.museRelay || !museRelay.linked()) return;
      lastBadge = key;
      museRelay.call('phone', 'badge', { count: total, seen: read.slice(0, 80) }, 8000).catch(() => {});
    }, 1500);
  }
  window.museBadgeSync = badgeSync;
  { const _ms = window.markSeen; if (_ms) window.markSeen = function () { const r = _ms.apply(this, arguments); badgeSync(); return r; }; }

  // ---------- Navigation (même écran que Automatisations / Missions)
  const side = $('#missBtn');
  const agBtn = document.createElement('button'); agBtn.id = 'agBtn'; agBtn.type = 'button'; agBtn.innerHTML = ic('users') + '<span>Agents</span>';
  const acBtn = document.createElement('button'); acBtn.id = 'actBtn'; acBtn.type = 'button'; acBtn.innerHTML = ic('heart') + '<span>Activité</span>';
  side.after(agBtn, acBtn);
  const offAll = () => ['#autoBtn', '#missBtn', '#agBtn', '#actBtn'].forEach((s) => $(s) && $(s).classList.remove('on'));
  const prevClose = window.autosClose;
  window.autosClose = () => { agBtn.classList.remove('on'); acBtn.classList.remove('on'); if (prevClose) prevClose(); };
  ['#autoBtn', '#missBtn'].forEach((s) => { const b = $(s); const o = b.onclick; b.onclick = (e) => { agBtn.classList.remove('on'); acBtn.classList.remove('on'); return o && o.call(b, e); }; });
  const close = () => window.autosClose && autosClose();
  function openShell(btn) {
    if (!need()) return false;
    stopTts(); pollId++; busy = false; $('#send').disabled = false; avatar('idle'); issueNo = null;
    offAll(); btn.classList.add('on'); syncHeader();
    mainEl.classList.add('autoview'); $('#side').classList.remove('open'); loadList();
    view.hidden = false; view.innerHTML = '<div class="ainner"><p class="hint">Chargement…</p></div>';
    return true;
  }
  agBtn.onclick = async () => { if (!openShell(agBtn)) return; try { await load(); await loadStatus(); renderAgents(); syncFaces().catch(() => {}); startLive(); if (!(st.meta && st.meta.merged) && !regroupTried) { regroupTried = true; runRegroup(); } } catch (e) { view.innerHTML = `<div class="ainner"><p class="hint">${esc('' + e.message)}</p></div>`; } };
  acBtn.onclick = () => { if (!openShell(acBtn)) return; renderActivity(tab); };

  let regroupTried = false, liveT = 0;
  function startLive() {   // l'onglet Agents se met à jour tout seul (statut, non lus) tant qu'il est ouvert
    clearInterval(liveT);
    liveT = setInterval(async () => {
      if (view.hidden || !agBtn.classList.contains('on') || document.hidden) { if (view.hidden || !agBtn.classList.contains('on')) clearInterval(liveT); return; }
      if (document.querySelector('#agDlg[open]')) return;
      await loadStatus(); const y = view.scrollTop; renderAgents(); view.scrollTop = y;
    }, 12000);
  }
  async function runRegroup() {
    const b = view.querySelector('#agMerge'); if (b) { b.disabled = true; b.textContent = '⏳ Regroupement…'; }
    try { const r = await regroup(); renderAgents(); loadList(); toast(r.moved.length ? `Regroupé : ${r.moved.length} élément${r.moved.length > 1 ? 's' : ''} déplacé${r.moved.length > 1 ? 's' : ''}, ${r.archived} ancienne${r.archived > 1 ? 's' : ''} discussion${r.archived > 1 ? 's' : ''} archivée${r.archived > 1 ? 's' : ''}` : 'Tout est déjà regroupé'); }
    catch (e) { toast('Regroupement : ' + e.message); if (b) { b.disabled = false; b.textContent = '🔀 Regrouper'; } }
  }
  // =====================================================================
  // 🧩 AGENTS
  // =====================================================================
  const A3 = window.Agent3D;
  const lookOf = (a) => (a && a.look) || (A3 && A3.PRESETS[a && a.id]) || (A3 && A3.DEF) || {};
  const img = (a, px = 128) => (A3 && A3.ok ? A3.snapshot(lookOf(a), px) : '');
  const av = (a, big) => { const u = img(a, big ? 160 : 112); return u ? `<img class="agAv3${big ? ' big' : ''}" src="${u}" alt="">` : `<span class="agAv${big ? ' big' : ''}" style="--c:${q(a.color || '#7c5cff')}">${esc(a.emoji || '🤖')}</span>`; };
  window.museAgentImg = (n) => { const a = n && st.items.find((x) => Number(x.issue) === Number(n)); return a ? img(a, 64) : ''; };
  // 🧸 Qui parle dans une discussion (pour l'étiquette au-dessus des réponses)
  window.museSpeaker = (n, body) => {
    const say = (String(body || '').match(/<!--agent-say:([\w-]+)-->/) || [])[1];
    const a = (say && st.items.find((x) => x.id === say)) || (n && st.items.find((x) => Number(x.issue) === Number(n)));
    return a ? { id: a.id, name: a.name, img: img(a, 64) } : null;
  };
  // 🖼️ Image de l'avatar déposée dans le dépôt (data/agents/<id>.png) : le cerveau la joint aux notifications du téléphone
  const lookKey = (a) => JSON.stringify(lookOf(a));
  async function uploadFace(a) {
    if (!A3 || !A3.ok || a.faceKey === lookKey(a)) return false;
    const url = A3.snapshot(lookOf(a), 96); if (!url) return false;
    const path = `data/agents/${a.id}.png`; let sha = null;
    try { sha = (await gh(`/repos/${cfg.repo}/contents/${path}`)).sha; } catch { /* nouvelle image */ }
    await gh(`/repos/${cfg.repo}/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message: `Avatar de ${a.name}`, content: url.split(',')[1], ...(sha ? { sha } : {}) }) });
    a.faceKey = lookKey(a); return true;
  }
  async function syncFaces() { let ch = false; for (const a of st.items) { try { if (await uploadFace(a)) ch = true; } catch (e) { console.warn('avatar', e.message); } } if (ch) await save('Avatars des agents').catch(() => {}); }
  // 🧠 Mémoire de l'agent : ce qu'il a appris de tes corrections (data/memory-agent-<id>.md), à relire, corriger, effacer
  let mdlg = null;
  async function memory(a) {
    const path = `data/memory-agent-${a.id}.md`;
    if (!mdlg) { mdlg = document.createElement('dialog'); mdlg.id = 'agMemDlg'; document.body.appendChild(mdlg); }
    mdlg.innerHTML = `<h3>🧠 Mémoire de ${esc(a.name)}</h3><p class="hint">Chargement…</p>`; mdlg.showModal();
    let sha = null, lines = [];
    try { const f = await gh(`/repos/${cfg.repo}/contents/${path}`); sha = f.sha; lines = b64d(f.content).split('\n').filter((l) => /^- /.test(l)).map((l) => l.slice(2)); } catch (e) { if (e.status !== 404) { mdlg.querySelector('.hint').textContent = '' + e.message; return; } }
    const draw = () => {
      const today = new Date().toISOString().slice(0, 10), fresh = lines.filter((l) => l.includes(`(${today})`)).length;
      mdlg.innerHTML = `<h3>🧠 Mémoire de ${esc(a.name)}</h3>
        <p class="hint">Ce que ${esc(a.name)} a appris en travaillant avec toi (quand tu corriges un brouillon ou un ton, il le note tout seul).${fresh ? ` <b>${fresh} appris aujourd’hui.</b>` : ''}</p>
        <ul class="memList">${lines.length ? lines.map((l, i) => `<li><span>${esc(l)}</span><button type="button" class="ghost memDel" data-i="${i}" title="Oublier">✕</button></li>`).join('') : '<li class="hint">Rien pour l’instant.</li>'}</ul>
        <div class="agRow"><input id="memNew" maxlength="200" placeholder="Ajouter une règle (ex. signe toujours « Cédric »)" style="flex:1"><button class="ghost" id="memAdd" type="button">Ajouter</button></div>
        <div id="memMsg" class="hint"></div>
        <div class="row"><button class="ghost" id="memClose" type="button">Fermer</button><button class="btn" id="memSave" type="button">Enregistrer</button></div>`;
      mdlg.querySelectorAll('.memDel').forEach((b) => (b.onclick = () => { lines.splice(+b.dataset.i, 1); draw(); }));
      mdlg.querySelector('#memAdd').onclick = () => { const v = mdlg.querySelector('#memNew').value.trim(); if (v) { lines.push(`${v} (${today})`); draw(); } };
      mdlg.querySelector('#memClose').onclick = () => mdlg.close();
      mdlg.querySelector('#memSave').onclick = async () => {
        const md = `# Mémoire de l'agent ${a.name}\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
        try { const r = await gh(`/repos/${cfg.repo}/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message: `Mémoire de ${a.name}`, content: b64e(md), ...(sha ? { sha } : {}) }) }); sha = r.content.sha; toast('Mémoire enregistrée'); mdlg.close(); }
        catch (e) { mdlg.querySelector('#memMsg').textContent = e.status === 409 ? 'La mémoire a changé entre-temps : rouvre-la.' : '' + e.message; }
      };
    };
    draw();
  }
  // 🟢 Statut vivant : écrit par le cerveau dans « 🩺 Santé de Muse » (un commentaire par agent)
  let stat = {}, missions = [], statAt = 0;
  async function loadStatus() {
    try {
      const l = await gh(`/repos/${cfg.repo}/issues?state=all&labels=muse-sante&per_page=1`);
      if (l && l[0]) { const cs = await gh(`/repos/${cfg.repo}/issues/${l[0].number}/comments?per_page=100`); stat = {}; for (const c of cs || []) { const m = c.body.match(/^<!--muse-ctl--><!--agent-status:([\w-]+)-->/); if (m) { try { stat[m[1]] = JSON.parse(c.body.slice(c.body.indexOf('\n') + 1)); } catch {} } } }
      if (Date.now() - statAt > 120000) { try { const f = await gh(`/repos/${cfg.repo}/contents/data/missions.json`); missions = (JSON.parse(b64d(f.content)).items || []).filter((m) => m.enabled); } catch { missions = []; } statAt = Date.now(); }
    } catch { /* statut facultatif */ }
  }
  const agoS = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
  function nextOf(a) {
    const m = missions.find((x) => Number(x.issue) === Number(a.issue)); if (!m) return '';
    const sc = m.schedule || {};
    const w = sc.kind === 'hours' ? `toutes les ${sc.every || 6} h` : sc.kind === 'weekdays' ? `en semaine à ${sc.time || '08:00'}` : sc.kind === 'once' ? 'une fois' : `chaque jour à ${sc.time || '08:00'}`;
    return `${m.watch ? '🔭 Veille' : '🔁 ' + m.name} · ${w}`;
  }
  function unreadOf(a) {
    const l = window.museLastList || [], i = l.find((x) => Number(x.number) === Number(a.issue)); if (!i) return 0;
    let seen = {}; try { seen = JSON.parse(localStorage.getItem('muse_seen') || '{}') || {}; } catch {}
    return seen[i.number] == null ? 0 : Math.max(0, (i.comments || 0) - seen[i.number]);
  }
  function statusHtml(a) {
    const s = stat[a.id] || {}, working = s.state === 'working' && s.since && Date.now() - Date.parse(s.since) < 20 * 60000;
    const line = working ? `<span class="agSt work"><i></i>Travaille : ${esc(s.task || '…')} <small>${agoS(s.since)}</small></span>`
      : s.last ? `<span class="agSt"><i></i>A fait : ${esc(s.last)} <small>${agoS(s.lastAt || s.at)}</small></span>` : `<span class="agSt idle"><i></i>Disponible</span>`;
    const nx = nextOf(a);
    return `${line}${nx ? `<span class="agNext">⏭️ ${esc(nx)}</span>` : ''}`;
  }
  window.museChefIssue = () => { const a = st.items.find((x) => x.id === 'chef' && x.enabled !== false); return a && a.issue ? Number(a.issue) : 0; };
  window.museAgentImgById = (id) => { const a = st.items.find((x) => x.id === id); return a ? img(a, 64) : ''; };
  function renderAgents() {
    const cards = st.items.map((a) => { const s = stat[a.id] || {}, wk = s.state === 'working' && s.since && Date.now() - Date.parse(s.since) < 20 * 60000, un = unreadOf(a); return `<article class="acard agCard${a.enabled === false ? ' off' : ''}${wk ? ' working' : ''}" data-id="${q(a.id)}" data-job="${jobOf(a)}">
      <div class="ahead"><div class="atitle"><span class="agAvW">${av(a)}<span class="agFx"></span>${un ? `<em class="agUn">${un > 9 ? '9+' : un}</em>` : ''}</span><div><b>${esc(a.name)}</b><small>${esc(modeLabel(a.mode))}</small></div></div>
        <label class="sw" title="${a.enabled === false ? 'En pause' : 'Actif'}"><input type="checkbox" class="aon" ${a.enabled === false ? '' : 'checked'}><span></span></label></div>
      <div class="agStatus">${statusHtml(a)}</div>
      ${permName(a.perms) || routN(a) ? `<div class="agBadges">${permName(a.perms) ? `<span class="agPermB" title="Permissions de cet agent">${esc(permName(a.perms))}</span>` : ''}${routN(a) ? `<span class="agPermB rt" title="Routines de cet agent">⏰ ${routN(a)} routine${routN(a) > 1 ? 's' : ''}</span>` : ''}</div>` : ''}
      <p class="ains">${esc(a.role || '')}</p>
      ${a.instructions ? `<p class="asum">📝 ${esc(a.instructions.slice(0, 160))}${a.instructions.length > 160 ? '…' : ''}</p>` : ''}
      <div class="aact"><button class="btn agTalk" type="button">💬 Discuter</button><button class="ghost agCallB" type="button" title="Appel vocal avec son avatar">📞 Appeler</button><button class="ghost agEdit" type="button">Modifier</button><button class="ghost agMem" type="button">🧠 Mémoire</button><button class="ghost agDel" type="button">Supprimer</button></div>
    </article>`; }).join('');
    const missing = TEMPLATES.filter((t) => !st.items.some((a) => a.id === t.id));
    const tpl = missing.map((t) => `<button type="button" class="agTpl" data-id="${t.id}">${av(t)}<span><b>${esc(t.name)}</b><small>${esc(t.role.slice(0, 70))}…</small></span>${ic('plus')}</button>`).join('');
    view.innerHTML = `<div class="ainner">
      <div class="atop"><div><h2>Agents</h2><p class="hint">Ton équipe : chaque agent a son nom, son métier, ses consignes et sa discussion. Le <b>Chef</b> peut confier une partie du travail aux autres : ils la font chacun dans leur discussion, et tu es prévenu.</p></div>
        <button class="btn" id="agNew" type="button">${ic('plus')}<span>Nouvel agent</span></button></div>
      ${st.items.length ? `<div class="agGrid">${cards}</div>` : `<div class="aempty"><span class="abolt big">${ic('users')}</span><h3>Aucun agent pour l’instant</h3><p>Ajoute-les en un clic ci-dessous : tu pourras tout modifier.</p></div>`}
      <div class="anote agMergeNote">${ic('users')}<span>${st.meta && st.meta.merged ? `✅ Regroupé : la <b>Veille proactive</b> et les petits mots de <b>💬 Muse</b> sont chez le <b>Chef</b>, l’agenda et les mails chez <b>Boîte mail</b>, Facebook et WhatsApp chez <b>Messages</b>.` : `Regrouper la <b>Veille proactive</b> et <b>💬 Muse</b> dans le <b>Chef</b>, l’<b>agenda</b> et les mails dans <b>Boîte mail</b>, <b>Facebook</b> et <b>WhatsApp</b> dans <b>Messages</b>.`}</span><button class="ghost" id="agMerge" type="button">${st.meta && st.meta.merged ? '🔀 Refaire' : '🔀 Regrouper'}</button></div>
      ${tpl ? `<h4 class="agH">Modèles prêts</h4><div class="agTpls">${tpl}</div>` : ''}
      <div class="anote">${ic('users')}<span>Muse reste là : les discussions normales marchent comme avant. Un agent n’est qu’une Muse spécialisée, avec <b>les mêmes garde-fous</b>.</span></div>
    </div>`;
    view.querySelector('#agNew').onclick = () => edit(null);
    const rg = view.querySelector('#agMerge'); if (rg) rg.onclick = runRegroup;
    view.querySelectorAll('.agTpl').forEach((b) => (b.onclick = () => addTemplate(TEMPLATES.find((t) => t.id === b.dataset.id))));
    view.querySelectorAll('.agCard').forEach((c) => {
      const a = st.items.find((x) => x.id === c.dataset.id);
      c.querySelector('.aon').onchange = async (e) => { const prev = a.enabled; a.enabled = e.target.checked; try { await save(`Agent ${a.name} ${a.enabled ? 'activé' : 'en pause'}`); renderAgents(); } catch (er) { a.enabled = prev; toast('' + er.message); renderAgents(); } };
      c.querySelector('.agTalk').onclick = () => talk(a);
      c.querySelector('.agCallB').onclick = () => callAgent(a);
      c.querySelector('.agEdit').onclick = () => edit(a);
      c.querySelector('.agMem').onclick = () => memory(a);
      c.querySelector('.agDel').onclick = () => remove(a);
    });
  }
  async function addTemplate(t) {
    if (!t) return;
    st.items.push({ ...t, look: { ...lookOf(t) }, instructions: '', enabled: true, created: new Date().toISOString() });
    try { await save(`Agent ajouté : ${t.name}`); syncFaces().catch(() => {}); toast(`${t.emoji} ${t.name} rejoint l’équipe`); renderAgents(); }
    catch (e) { st.items = st.items.filter((x) => x.id !== t.id); toast('' + e.message); renderAgents(); }
  }
  async function remove(a) {
    if (!confirm(`Retirer l’agent « ${a.name} » ? Sa discussion est gardée dans les archives.`)) return;
    const before = st.items.slice(); st.items = st.items.filter((x) => x.id !== a.id);
    try { await save(`Agent retiré : ${a.name}`); if ((st.routines || []).some((m) => m.agent === a.id)) mutateMissions((items) => items.filter((x) => x.agent !== a.id), `Routines de ${a.name} retirées`).catch(() => {}); if (a.issue) addLabel(a.issue, L_ARC, '9ca3af').catch(() => {}); renderAgents(); }
    catch (e) { st.items = before; toast('' + e.message); renderAgents(); }
  }
  // Discussion d'un agent (créée au besoin) — utilisée aussi par les automatisations et le regroupement
  async function ensureIssue(a) {
    if (a.issue) return Number(a.issue);
    const i = await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: a.name.slice(0, 120), body: `<!--agent:${a.id}-->\nDiscussion de l’agent ${a.name}.` }) });
    a.issue = i.number; addLabel(i.number, L_PIN, 'a78bfa').catch(() => {});
    return a.issue;
  }
  window.museAgentList = () => st.items.slice();
  window.museAgentIssue = async (id) => {
    if (!st.loaded) await load();
    const a = st.items.find((x) => x.id === id); if (!a) throw new Error('Agent introuvable');
    const had = a.issue, n = await ensureIssue(a); if (!had) await save(`Agent ${a.name} : discussion`);
    return n;
  };

  // 🔀 Regroupement : Veille proactive → Chef · Agenda / mails → Boîte mail · Facebook, Messenger, WhatsApp → Messages
  async function readJson(file) { try { const f = await gh(`/repos/${cfg.repo}/contents/${file}`); return { sha: f.sha, data: JSON.parse(b64d(f.content)) }; } catch (e) { if (e.status === 404) return { sha: null, data: null }; throw e; } }
  async function writeJson(file, sha, data, msg) { return gh(`/repos/${cfg.repo}/contents/${file}`, { method: 'PUT', body: JSON.stringify({ message: msg, content: b64e(JSON.stringify(data, null, 2)), ...(sha ? { sha } : {}) }) }); }
  async function archiveIssue(n, to) {
    if (!n) return;
    try {
      await gh(`/repos/${cfg.repo}/issues/${n}/comments`, { method: 'POST', body: JSON.stringify({ body: `<!--muse-ctl-->📦 Cette discussion continue maintenant chez l’agent **${to}**.` }) });
      await addLabel(n, L_ARC, '9ca3af').catch(() => {});
      await gh(`/repos/${cfg.repo}/issues/${n}/labels/${L_PIN}`, { method: 'DELETE' }).catch(() => {});
      await gh(`/repos/${cfg.repo}/issues/${n}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
    } catch { /* déjà archivée */ }
  }
  const RE_MSG = /(facebook|messenger|orca|katana|mlite|whatsapp|instagram|telegram|sms|messag)/i, RE_MAIL = /(agenda|calendar|calendrier|rendez|gmail|e-?mail|mail\b|inbox|outlook)/i;
  async function regroup() {
    if (!st.loaded) await load();
    for (const id of ['chef', 'mails', 'messages']) if (!st.items.some((a) => a.id === id)) { const t = TEMPLATES.find((x) => x.id === id); st.items.push({ ...t, look: { ...lookOf(t) }, instructions: '', enabled: true, created: new Date().toISOString() }); }
    const A = (id) => st.items.find((a) => a.id === id);
    for (const id of ['chef', 'mails', 'messages']) { A(id).enabled = true; await ensureIssue(A(id)); }
    await save('Agents : Chef, Boîte mail et Messages prêts');
    const chef = A('chef'), mails = A('mails'), msgs = A('messages'), moved = [], toArchive = [];
    // Missions : la veille va chez le Chef, les missions agenda / mails chez Boîte mail
    const M = await readJson('data/missions.json'), MS = await readJson('data/missions-state.json');
    if (M.data && Array.isArray(M.data.items)) {
      for (const m of M.data.items) {
        const old = Number(m.issue || (MS.data && MS.data.items && MS.data.items[m.id] && MS.data.items[m.id].issue) || 0);
        const to = m.watch ? chef : RE_MAIL.test(`${m.name} ${m.goal}`) ? mails : RE_MSG.test(`${m.name} ${m.goal}`) ? msgs : null;
        if (!to || old === Number(to.issue)) continue;
        m.issue = Number(to.issue); moved.push(`${m.watch ? '🔭 Veille proactive' : '🔁 ' + m.name} → ${to.name}`); if (old) toArchive.push([old, to.name]);
      }
      await writeJson('data/missions.json', M.sha, M.data, 'Missions regroupées dans les agents');
    }
    // Automatisations : Facebook / Messenger / WhatsApp → Messages · Agenda / mails → Boîte mail
    const Au = await readJson('data/automations.json');
    if (Au.data && Array.isArray(Au.data.items)) {
      for (const r of Au.data.items) {
        const txt = `${r.name || ''} ${JSON.stringify(r.trigger || {})}`;
        const to = RE_MSG.test(txt) ? msgs : RE_MAIL.test(txt) ? mails : null;
        if (!to || Number(r.issue) === Number(to.issue)) continue;
        const old = Number(r.issue || 0), wasOwn = !r.dest || r.dest === 'own';
        r.dest = 'agent:' + to.id; r.issue = Number(to.issue); moved.push(`⚡ ${r.name} → ${to.name}`);
        if (old && wasOwn) toArchive.push([old, to.name]);
      }
      await writeJson('data/automations.json', Au.sha, Au.data, 'Automatisations regroupées dans les agents');
    }
    // Anciennes discussions : archivées (rien n'est perdu, elles restent dans « Archivées »)
    const done = new Set();
    for (const [n, to] of toArchive) { if (done.has(n) || [chef.issue, mails.issue, msgs.issue].map(Number).includes(n)) continue; done.add(n); await archiveIssue(n, to); }
    // La discussion « Veille proactive » elle-même (si elle n'était pas encore liée à la mission)
    try { const l = await gh(`/repos/${cfg.repo}/issues?state=open&per_page=100`); for (const i of l || []) if (!i.pull_request && (/Veille proactive/.test(i.title) || (i.labels || []).some((x) => x.name === 'muse-checkin') || /^💬 Muse$/.test(i.title)) && !done.has(i.number) && Number(i.number) !== Number(chef.issue)) { done.add(i.number); await archiveIssue(i.number, chef.name); } } catch {}
    st.meta = { ...(st.meta || {}), merged: new Date().toISOString() };
    await save('Regroupement dans les agents terminé');
    return { moved, archived: done.size };
  }

  async function talk(a) {
    try {
      if (!a.issue) {
        const i = await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: a.name.slice(0, 120), body: `<!--agent:${a.id}-->\nDiscussion de l’agent ${a.name}.` }) });
        a.issue = i.number; addLabel(i.number, L_PIN, 'a78bfa').catch(() => {});
        await save(`Agent ${a.name} : discussion`);
      }
      close(); await openConv(a.issue);
      if (a.mode && [...modeSel.options].some((o) => o.value === a.mode)) modeSel.value = a.mode;
      input.placeholder = `Écrire à ${a.name}…`; input.focus();
    } catch (e) { toast('' + e.message); }
  }
  // Formulaire : nom, métier, consignes, mode + atelier de l'avatar 3D (aperçu animé, on le fait tourner au doigt)
  let dlg = null, editing = null, look = null, prev = null;
  const chips = (key, list) => `<div class="agChips" data-k="${key}">${list.map(([v, l]) => `<button type="button" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
  function buildDlg() {
    const O = A3.OPTIONS;
    dlg = document.createElement('dialog'); dlg.id = 'agDlg';
    dlg.innerHTML = `<h3 id="agT">Nouvel agent</h3>
      <div class="agStudio">
        <div class="agStage"><canvas id="agCv" width="220" height="220"></canvas><button type="button" class="ghost" id="agRnd">🎲 Au hasard</button><button type="button" class="ghost" id="agWk">🛠️ Voir au travail</button><small class="hint">Fais-le tourner avec le doigt</small></div>
        <div class="agOpts">
          <label>Forme</label>${chips('shape', O.shape)}
          <label>Couleurs</label><div class="agPairs">${A3.PAIRS.map(([a, b], k) => `<button type="button" class="agPair" data-k="${k}" style="--a:${a};--b:${b}" aria-label="couleurs ${k + 1}"></button>`).join('')}<input type="color" id="agC1" title="Couleur du haut"><input type="color" id="agC2" title="Couleur du bas"></div>
          <label>Matière</label>${chips('mat', O.mat)}
          <label>Yeux</label>${chips('eyes', O.eyes)}
          <label>Bouche</label>${chips('mouth', O.mouth)}
          <label>Accessoire</label>${chips('acc', O.acc)}
          <div class="agRow2"><label class="agTog"><input type="checkbox" id="agCheeks"> Joues roses</label><label class="agTog">Couleur de l’accessoire <input type="color" id="agAccC"></label></div>
        </div>
      </div>
      <label for="agName">Nom</label><input id="agName" maxlength="40" placeholder="Boîte mail" autocomplete="off">
      <label for="agRole">Son métier</label><textarea id="agRole" rows="3" placeholder="Trie mes e-mails, résume ce qui compte…"></textarea>
      <label for="agIns">Consignes (facultatif)</label><textarea id="agIns" rows="3" placeholder="Tutoie mes clients, signe « Cédric », jamais de rendez-vous avant 9 h…"></textarea>
      <label for="agMode">Ce qu’il peut utiliser</label><select id="agMode">${MODES.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
      <label>Permissions <small class="hint">— ce que cet agent a le droit de faire</small></label>
      <div class="agChips" id="agPresets">${PERM_PRESETS.map(([k, l]) => `<button type="button" data-p="${k}">${esc(l)}</button>`).join('')}</div>
      <div class="agPerms">${PERM_KEYS.map(([k, l, h]) => `<label class="agTog"><input type="checkbox" data-perm="${k}"> <span><b>${esc(l)}</b> <small>${esc(h)}</small></span></label>`).join('')}</div>
      <label>⏰ Routines <small class="hint">— ce qu’il fait tout seul, à heure fixe (heure de Madagascar)</small></label>
      <div id="agRout" class="agRout"></div>
      <div id="agRForm" class="agRForm">
        <div class="agChips" id="agRIdeas"></div>
        <div class="agRRow"><select id="rKind"><option value="daily">Tous les jours</option><option value="weekdays">Lundi → vendredi</option><option value="weekly">Certains jours</option><option value="hours">Toutes les N heures</option></select>
          <input type="time" id="rTime" value="08:00"><input type="number" id="rEvery" min="1" max="168" value="6" title="Toutes les … heures"></div>
        <div class="agChips" id="rDays">${['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((d, i) => `<button type="button" data-d="${(i + 1) % 7}">${d}</button>`).join('')}</div>
        <textarea id="rGoal" rows="2" placeholder="Ce qu’il doit faire à chaque passage (ex. : résume mes mails importants et prépare les réponses)"></textarea>
        <button type="button" class="ghost" id="rAdd">➕ Ajouter cette routine</button>
      </div>
      <div id="agMsg" class="hint"></div>
      <div class="row"><button class="ghost" id="agCancel" type="button">Annuler</button><button class="btn" id="agSave" type="button">Enregistrer</button></div>`;
    document.body.appendChild(dlg);
    const $d = (x) => dlg.querySelector(x);
    $d('#agCancel').onclick = () => dlg.close();
    dlg.addEventListener('close', () => { if (prev) { prev.dispose(); prev = null; } });
    $d('#agSave').onclick = saveForm;
    dlg.querySelectorAll('.agChips[data-k]').forEach((g) => g.querySelectorAll('button').forEach((b) => (b.onclick = () => { look[g.dataset.k] = b.dataset.v; paint(); })));
    dlg.querySelectorAll('.agPair').forEach((b) => (b.onclick = () => { [look.c1, look.c2] = A3.PAIRS[+b.dataset.k]; paint(); }));
    $d('#agC1').oninput = (e) => { look.c1 = e.target.value; paint(); };
    $d('#agC2').oninput = (e) => { look.c2 = e.target.value; paint(); };
    $d('#agAccC').oninput = (e) => { look.accColor = e.target.value; paint(); };
    $d('#agCheeks').onchange = (e) => { look.cheeks = e.target.checked; paint(); };
    $d('#agWk').onclick = () => { if (!prev) return; prev.job(jobOf({ id: editing && editing.id, name: $d('#agName').value, role: $d('#agRole').value })); prev.busy(true); clearTimeout(wkT); wkT = setTimeout(() => prev && prev.busy(false), 5000); };
    $d('#rKind').onchange = routUi;
    $d('#rAdd').onclick = addRoutine;
    dlg.querySelectorAll('#rDays button').forEach((b) => (b.onclick = () => b.classList.toggle('on')));
    dlg.querySelectorAll('#agPresets button').forEach((b) => (b.onclick = () => { perm = { ...PERM_PRESETS.find((x) => x[0] === b.dataset.p)[2] }; paintPerm(); }));
    dlg.querySelectorAll('[data-perm]').forEach((c) => (c.onchange = () => { perm[c.dataset.perm] = c.checked; paintPerm(); }));
    $d('#agRnd').onclick = () => { look = A3.random(); paint(); if (prev) prev.state('happy'); };
  }
  let paintT = 0, wkT = 0, perm = { ...PERM_PRESETS[3][2] };
  function paint() {
    const $d = (x) => dlg.querySelector(x);
    dlg.querySelectorAll('.agChips[data-k]').forEach((g) => g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', look[g.dataset.k] === b.dataset.v)));
    dlg.querySelectorAll('.agPair').forEach((b) => { const [x, y] = A3.PAIRS[+b.dataset.k]; b.classList.toggle('on', x === look.c1 && y === look.c2); });
    $d('#agC1').value = look.c1; $d('#agC2').value = look.c2; $d('#agAccC').value = look.accColor; $d('#agCheeks').checked = !!look.cheeks;
    clearTimeout(paintT); paintT = setTimeout(() => { if (prev) prev.set(look); }, 40);
  }
  // ⏰ Routines de l'agent : des missions (data/missions.json) rattachées à l'agent ; elles tournent dans SA discussion
  const DAYN = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const IDEAS = {
    chef: [['🌆 Point du soir', 'Fais-moi un point court : ce que l’équipe a fait aujourd’hui, ce qui reste ou bloque, et les 3 priorités de demain.', 'weekdays', '18:30'], ['☀️ Priorités du matin', 'Regarde mon agenda et ce qui est en cours, et donne-moi les 3 priorités du jour en quelques lignes.', 'weekdays', '07:45']],
    mails: [['☀️ Résumé du matin', 'Regarde mes e-mails reçus depuis hier : liste les importants (clients, factures, rendez-vous), prépare des brouillons de réponse pour ceux qui en demandent une, ignore les newsletters.', 'weekdays', '08:00'], ['📅 Agenda du jour', 'Regarde mon agenda d’aujourd’hui, repère les conflits et dis-moi ce qui demande de la préparation.', 'daily', '07:30']],
    messages: [['💬 Messages en attente', 'Regarde mes notifications Messenger et WhatsApp : résume ce qui attend une réponse et prépare les réponses dans mon ton.', 'daily', '12:00']],
    gyoo: [['🎬 Idées du jour', 'Cherche sur le web les nouveautés (films, séries, animes, K-dramas, jeux) pour mon public malgache et propose 3 idées de contenus.', 'daily', '09:00']],
    odoo: [['🧰 Veille Odoo', 'Cherche les nouveautés Odoo 19 (versions, bugs connus, modules utiles) pour mes projets et résume en 5 points.', 'weekly', '09:00', [1]]],
    recherche: [['📈 Mes recherches', 'Relance mes recherches de prix en cours et dis-moi ce qui a changé depuis la dernière fois.', 'weekly', '09:00', [1]]],
    star: [['🌅 Point du matin', 'Fais le point sur ton domaine : ce qui est nouveau, ce qui demande mon attention aujourd’hui.', 'weekdays', '08:00']],
  };
  const whenOf = (m) => { const s = m.schedule || {}, t = s.time || '08:00'; return s.kind === 'daily' ? `Tous les jours à ${t}` : s.kind === 'weekdays' ? `Lun → ven à ${t}` : s.kind === 'weekly' ? `${(s.days || [1]).map((d) => DAYN[d]).join(', ')} à ${t}` : s.kind === 'hours' ? `Toutes les ${s.every || 6} h` : s.kind === 'once' ? 'Une fois' : ''; };
  let rState = {};
  async function mutateMissions(fn, msg) {
    for (let i = 0; i < 3; i++) {
      const cur = await readJson(MFILE), items = (cur.data && Array.isArray(cur.data.items)) ? cur.data.items : [];
      const out = fn(items) || items;
      try { await writeJson(MFILE, cur.sha, { version: 1, items: out }, msg); st.routines = out.filter((x) => x.agent); return; }
      catch (e) { if (!(e.status === 409 || e.status === 422) || i === 2) throw e; }
    }
  }
  function routUi() {
    const k = dlg.querySelector('#rKind').value;
    dlg.querySelector('#rTime').hidden = k === 'hours'; dlg.querySelector('#rEvery').hidden = k !== 'hours'; dlg.querySelector('#rDays').hidden = k !== 'weekly';
  }
  function renderRout() {
    const box = dlg.querySelector('#agRout'), form = dlg.querySelector('#agRForm');
    if (!editing) { box.innerHTML = '<p class="hint">Enregistre d’abord cet agent, puis rouvre-le avec « Modifier » pour lui ajouter des routines.</p>'; form.hidden = true; return; }
    form.hidden = false;
    const mine = (st.routines || []).filter((m) => m.agent === editing.id);
    box.innerHTML = mine.length ? mine.map((m) => { const s = (rState.items || {})[m.id] || {}; return `<div class="agRI${m.enabled === false ? ' off' : ''}" data-id="${q(m.id)}"><div class="agRT"><b>⏰ ${esc(whenOf(m))}</b><small>${esc(String(m.goal || '').slice(0, 130))}</small>${s.lastRun ? `<small class="agRL">Dernier passage ${ago(s.lastRun)} ${s.status === 'error' ? '❌' : s.status === 'running' ? '⏳' : '✅'}</small>` : '<small class="agRL">Pas encore passé</small>'}</div>
        <label class="sw" title="Actif / en pause"><input type="checkbox" class="rOn" ${m.enabled === false ? '' : 'checked'}><span></span></label><button class="ghost rDel" type="button" aria-label="Supprimer">🗑️</button></div>`; }).join('') : '<p class="hint">Aucune routine pour l’instant.</p>';
    box.querySelectorAll('.agRI').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('.rOn').onchange = async (e) => { try { await mutateMissions((items) => { const m = items.find((x) => x.id === id); if (m) m.enabled = e.target.checked; }, `Routine ${e.target.checked ? 'activée' : 'en pause'}`); renderRout(); renderAgents(); } catch (er) { dlg.querySelector('#agMsg').textContent = '' + er.message; } };
      row.querySelector('.rDel').onclick = async () => { if (!confirm('Supprimer cette routine ?')) return; try { await mutateMissions((items) => items.filter((x) => x.id !== id), 'Routine supprimée'); renderRout(); renderAgents(); } catch (er) { dlg.querySelector('#agMsg').textContent = '' + er.message; } };
    });
    const ideas = (IDEAS[jobOf(editing)] || IDEAS.star), ib = dlg.querySelector('#agRIdeas');
    ib.innerHTML = ideas.map((x, i) => `<button type="button" data-i="${i}">${esc(x[0])}</button>`).join('');
    ib.querySelectorAll('button').forEach((b) => (b.onclick = () => { const x = ideas[+b.dataset.i]; dlg.querySelector('#rKind').value = x[2]; dlg.querySelector('#rTime').value = x[3]; dlg.querySelector('#rGoal').value = x[1]; dlg.querySelectorAll('#rDays button').forEach((d) => d.classList.toggle('on', (x[4] || [1]).includes(+d.dataset.d))); routUi(); }));
    routUi();
  }
  async function loadRout() {
    renderRout();
    try {
      const [m, s] = await Promise.all([readJson(MFILE), readJson(MSFILE).catch(() => ({ data: null }))]);
      st.routines = ((m.data && m.data.items) || []).filter((x) => x.agent); rState = s.data || {}; if (dlg.open) renderRout();
    } catch {}
  }
  async function addRoutine() {
    const $d = (x) => dlg.querySelector(x), msg = $d('#agMsg'), goal = $d('#rGoal').value.trim(), kind = $d('#rKind').value;
    if (!editing) return;
    if (!goal) { msg.textContent = 'Écris ce que l’agent doit faire à chaque passage.'; return; }
    const schedule = { kind };
    if (kind !== 'hours') schedule.time = $d('#rTime').value || '08:00';
    if (kind === 'hours') schedule.every = Math.max(1, Math.min(168, parseInt($d('#rEvery').value, 10) || 6));
    if (kind === 'weekly') { schedule.days = [...dlg.querySelectorAll('#rDays button.on')].map((b) => +b.dataset.d); if (!schedule.days.length) { msg.textContent = 'Choisis au moins un jour.'; return; } }
    const b = $d('#rAdd'); b.disabled = true; msg.textContent = '';
    try {
      const had = editing.issue; await ensureIssue(editing); if (!had) await save(`Agent ${editing.name} : discussion`);
      const m = { id: 'r' + Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, '0')).join(''), name: `${editing.name} · ${goal.replace(/\s+/g, ' ').slice(0, 40)}`, goal, agent: editing.id, issue: editing.issue, mode: editing.mode && editing.mode !== 'auto' ? editing.mode : 'polyvalent', schedule, enabled: true, created: new Date().toISOString() };
      await mutateMissions((items) => { items.push(m); }, `Routine ajoutée : ${editing.name}`);
      $d('#rGoal').value = ''; renderRout(); renderAgents(); toast('Routine ajoutée');
    } catch (e) { msg.textContent = '' + e.message; }
    b.disabled = false;
  }
  function paintPerm() {
    dlg.querySelectorAll('[data-perm]').forEach((c) => { c.checked = !!perm[c.dataset.perm]; });
    dlg.querySelectorAll('#agPresets button').forEach((b) => b.classList.toggle('on', permSame(perm, PERM_PRESETS.find((x) => x[0] === b.dataset.p)[2])));
  }
  function edit(a) {
    if (!A3 || !A3.ok) { toast('3D indisponible sur cet appareil'); }
    if (!dlg) buildDlg();
    editing = a; const $d = (x) => dlg.querySelector(x);
    $d('#agT').textContent = a ? `Modifier ${a.name}` : 'Nouvel agent';
    $d('#agName').value = a ? a.name : '';
    $d('#agRole').value = a ? a.role || '' : ''; $d('#agIns').value = a ? a.instructions || '' : ''; $d('#agMode').value = a ? a.mode || 'auto' : 'auto';
    look = A3.norm(a ? lookOf(a) : A3.random());
    perm = a && a.perms ? { ...a.perms } : { ...PERM_PRESETS[a ? 3 : 2][2] };   // agent existant sans réglage = tout permis (comme avant) · nouvel agent = « Normal »
    paintPerm(); rState = {}; loadRout();
    $d('#agMsg').textContent = ''; dlg.showModal();
    // Un canvas WebGL dont le contexte a été fermé ne peut plus servir : on en recrée un tout neuf à chaque ouverture
    if (prev) { prev.dispose(); prev = null; }
    const old = $d('#agCv'), cv = document.createElement('canvas');
    cv.id = 'agCv'; cv.width = cv.height = 220; old.replaceWith(cv);
    prev = A3.live(cv, look, 220, jobOf(a));
    if (!prev) $d('#agMsg').textContent = 'Aperçu 3D indisponible sur cet appareil (WebGL).';
    paint();
  }
  async function saveForm() {
    const $d = (x) => dlg.querySelector(x), name = $d('#agName').value.trim(), role = $d('#agRole').value.trim();
    if (!name || !role) { $d('#agMsg').textContent = 'Donne au moins un nom et un métier.'; return; }
    const data = { name, role, perms: { draft: !!perm.draft, send: !!perm.send, act: !!perm.act, files: !!perm.files, delete: !!perm.delete, ...(perm.autoCal ? { autoCal: true } : {}) }, look: { ...look }, color: look.c1, instructions: $d('#agIns').value.trim(), mode: $d('#agMode').value };
    const before = st.items.map((x) => ({ ...x }));
    if (editing) { Object.assign(editing, data); delete editing.emoji; } else st.items.push({ id: rid(), ...data, enabled: true, created: new Date().toISOString() });
    const b = $d('#agSave'); b.disabled = true;
    try { await save(editing ? `Agent modifié : ${name}` : `Agent créé : ${name}`); syncFaces().catch(() => {}); if (editing && editing.issue) gh(`/repos/${cfg.repo}/issues/${editing.issue}`, { method: 'PATCH', body: JSON.stringify({ title: name }) }).catch(() => {}); dlg.close(); renderAgents(); loadList(); syncHeader(); }
    catch (e) { st.items = before; $d('#agMsg').textContent = '' + e.message; }
    b.disabled = false;
  }

  // 📞 Appeler un agent : conversation vocale avec SON avatar 3D (page Muse Live du PC), et tout l'appel est écrit dans SA discussion.
  // Sur le PC : la page locale du démon. Sur le téléphone : le code Muse Live (MUSEV…, le même que dans l'appli Muse Tél.), gardé sur cet appareil.
  const HANDSET = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h3.5l1.6 4.2-2.2 1.4a11 11 0 0 0 6.5 6.5l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/></svg>';
  function liveLink() {
    try {
      const c = (localStorage.getItem('muse_live_code') || '').trim(); if (!c.startsWith('MUSEV.')) return null;
      const b = c.slice(6).replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
      const j = JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4)))));
      return /^wss?:\/\/[\w.:-]+/.test(j.u || '') && String(j.t || '').length >= 20 ? j : null;
    } catch { return null; }
  }
  // Le démon du PC publie lui-même son lien dans « 🩺 Santé de Muse » : l'appli le récupère toute seule (plus de code à coller)
  async function fetchLiveLink() {
    try {
      const it = await techIssue('muse-sante'); if (!it) return null;
      const c = (await tailComments(it, 200)).find((x) => x.body.startsWith('<!--muse-ctl--><!--live-link-->')); if (!c) return null;
      const j = JSON.parse(c.body.slice(c.body.indexOf('\n') + 1)); if (!/^wss?:\/\/[\w.:-]+/.test(j.u || '') || String(j.t || '').length < 20) return null;
      const code = 'MUSEV.' + btoa(unescape(encodeURIComponent(JSON.stringify({ u: j.u, t: j.t })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      try { localStorage.setItem('muse_live_code', code); } catch {}
      return liveLink();
    } catch { return null; }
  }
  let cdlg = null;
  function askLiveCode(a) {
    if (!cdlg) {
      cdlg = document.createElement('dialog'); cdlg.id = 'liveCodeDlg';
      cdlg.innerHTML = `<h3>📞 Relier les appels</h3><p class="hint">Pour appeler tes agents depuis cet appareil, il faut le lien de ton PC. D’habitude il arrive <b>tout seul</b> : allume le PC (démon Muse lancé, Tailscale connecté), attends une minute, puis retouche « Appeler ». Sinon, colle ici ton code <code>MUSEV.…</code> (le même que dans Muse Tél.).</p>
        <input id="lcIn" placeholder="MUSEV.…" autocomplete="off" spellcheck="false"><div id="lcMsg" class="hint"></div>
        <div class="row"><button class="ghost" id="lcNo" type="button">Annuler</button><button class="btn" id="lcOk" type="button">Enregistrer et appeler</button></div>`;
      document.body.appendChild(cdlg);
      cdlg.querySelector('#lcNo').onclick = () => cdlg.close();
    }
    cdlg.querySelector('#lcIn').value = ''; cdlg.querySelector('#lcMsg').textContent = '';
    cdlg.querySelector('#lcOk').onclick = () => {
      const v = cdlg.querySelector('#lcIn').value.trim();
      try { localStorage.setItem('muse_live_code', v); } catch {}
      if (!liveLink()) { try { localStorage.removeItem('muse_live_code'); } catch {} cdlg.querySelector('#lcMsg').textContent = 'Code invalide : il doit commencer par MUSEV. (copie-le en entier).'; return; }
      cdlg.close(); callAgent(a);
    };
    cdlg.showModal();
  }
  async function callAgent(a) {
    if (!a) return;
    try { if (!a.issue) { await ensureIssue(a); await save(`Agent ${a.name} : discussion`); } } catch (e) { toast('' + e.message); return; }
    if (CALL.on) return endCall('Appel terminé.');
    const L = (await fetchLiveLink()) || liveLink();
    if (L) return startCall(a, L);   // 📞 c'est la mascotte de l'agent, ici, qui répond
    if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) { const u = 'http://127.0.0.1:8790/avatar' + `?agent=${encodeURIComponent(a.id)}&issue=${encodeURIComponent(a.issue)}`; if (!window.open(u, '_blank', 'noopener')) location.href = u; return; }   // secours : page du PC
    askLiveCode(a);
  }
  window.museCallAgent = (id) => callAgent(st.items.find((x) => x.id === id));
  const callBtn = (() => {
    const tr = document.querySelector('#top .tr') || document.querySelector('.tr'); if (!tr) return null;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'agCall'; b.className = 'agCall'; b.hidden = true;
    b.innerHTML = `${HANDSET}<span>Appeler</span>`; b.title = 'Appeler cet agent (conversation vocale avec son avatar)';
    b.oncontextmenu = (e) => { e.preventDefault(); const a = issueNo && st.items.find((x) => Number(x.issue) === Number(issueNo)); if (a) askLiveCode(a); };   // clic droit / appui long : changer le code
    b.onclick = () => { const a = issueNo && st.items.find((x) => Number(x.issue) === Number(issueNo)); callAgent(a); };
    tr.prepend(b); return b;
  })();

  // ---------- 🎭 En-tête : dans la discussion d'un agent, c'est SON avatar 3D qui s'affiche (et bouge selon ce qu'il fait)
  let head = null, headFor = '';
  const wrapEl = $('#avatarWrap'), museCv = $('#avatar'), nameEl = $('#whoName b');
  function syncHeader() {
    const a = issueNo && st.items.find((x) => Number(x.issue) === Number(issueNo));
    if (callBtn) { callBtn.hidden = !(a && a.enabled !== false); callBtn.classList.toggle('on', !!CALL.on); callBtn.querySelector('span').textContent = CALL.on ? 'Raccrocher' : 'Appeler'; }   // 📞 seulement dans la discussion d'un agent
    if (CALL.on) return;   // pendant l'appel, la grande mascotte reste
    const key = a ? a.id + JSON.stringify(lookOf(a)) : '';
    if (key === headFor) { if (a && nameEl) nameEl.textContent = a.name; return; }
    headFor = key;
    if (head) { head.dispose(); head = null; }
    const old = wrapEl && wrapEl.querySelector('#agHeadCv'); if (old) old.remove();
    if (!a || !A3 || !A3.ok || !wrapEl) { if (museCv) museCv.style.display = ''; if (nameEl) nameEl.textContent = 'Muse'; return; }
    const cv = document.createElement('canvas'); cv.id = 'agHeadCv'; cv.width = cv.height = 88; cv.title = a.name;
    museCv.style.display = 'none'; wrapEl.appendChild(cv);
    head = A3.live(cv, lookOf(a), 88, jobOf(a));
    if (!head) { cv.remove(); museCv.style.display = ''; return; }
    if (nameEl) nameEl.textContent = a.name;
    cv.onclick = () => head && head.state('happy');
  }
  // l'avatar de l'agent suit les mêmes états que Muse (réfléchit, travaille, content, souci)
  if (window.MuseAvatar) { const set = MuseAvatar.setState.bind(MuseAvatar); MuseAvatar.setState = (s, ms) => { set(s, ms); if (head) head.state(s); }; }

  // =====================================================================
  // 📞 APPEL DANS L'APPLI : c'est la mascotte de l'agent, en haut de sa discussion, qui répond à la voix
  // (bouche synchronisée sur la voix, visage selon l'humeur, petites mains qui font des gestes, accessoire du métier pendant un outil,
  //  minuteur à côté de son nom). Le son et la voix viennent du démon du PC (Muse Live) ; tout l'appel est écrit dans la discussion.
  // =====================================================================
  const CALL = { on: false };
  const SRc = window.SpeechRecognition || window.webkitSpeechRecognition;
  const C_HALT = /^(?:hé |eh |ok )?(attends?|stop|arr[êe]te|chut|tais[- ]toi|une seconde|deux secondes|pause)\b/i;
  const C_QUIT = /^(au revoir|raccroche|c'est tout|bonne nuit|à plus|merci,? (c'est tout|au revoir))\b/i;
  const C_JOBS = ['chef', 'mails', 'messages', 'gyoo', 'odoo', 'recherche'];
  const C_MOOD_G = { joie: 'hop', pense: 'think', triste: 'tilt', surprise: 'tilt', taquine: 'tilt', inquiete: 'tilt' };
  const C_TOOLJOB = (n) => /gmail|calendar|drive|mail|agenda/i.test(n) ? 'mails' : /phone_notif|whatsapp|messenger|notif_reply|phone_type/i.test(n) ? 'messages' : /web|search|fetch|pc_web|video/i.test(n) ? 'recherche' : /files|pc_/i.test(n) ? 'odoo' : '';
  let cbar = null;
  function callBarUi(a) {
    if (cbar && !cbar.querySelector('.cbEnd')) resetBar();
    if (!cbar) {
      cbar = document.createElement('div'); cbar.id = 'callBar';
      cbar.innerHTML = `<div class="cbTop"><span class="cbDot"></span><b class="cbName"></b><span class="cbClock">00:00</span><span class="cbState"></span></div>
        <div class="cbSub"></div><div class="cbYou"></div><div class="cbTasks"></div>
        <div class="cbBtns"><button type="button" class="cbBarge on" title="Le couper simplement en parlant">✋ Couper en parlant</button><button type="button" class="cbMic" title="Parler / le couper">🎙️</button><button type="button" class="cbEnd" title="Raccrocher">${HANDSET}</button></div>`;
      document.body.appendChild(cbar);
      cbar.querySelector('.cbEnd').onclick = () => endCall('Appel terminé.');
      cbar.querySelector('.cbMic').onclick = () => { cctx(); if (CALL.speaking || CALL.thinking) cInterrupt(); else if (CALL.listening) { cStopListening(); cState('idle', 'Micro en pause'); } else cListen(); };
      cbar.querySelector('.cbBarge').onclick = (e) => { CALL.barge = !CALL.barge; CALL.bargeFail = false; e.currentTarget.classList.toggle('on', CALL.barge); try { localStorage.setItem('museCallBarge', CALL.barge ? '1' : '0'); } catch {} };
    }
    cbar.querySelector('.cbName').textContent = `Appel · ${a.name}`;
    cbar.querySelector('.cbSub').textContent = ''; cbar.querySelector('.cbYou').textContent = ''; cbar.querySelector('.cbTasks').innerHTML = '';
    cbar.querySelector('.cbBarge').classList.toggle('on', CALL.barge);
    cbar.hidden = false; document.body.classList.add('inCall'); placeBar();
  }
  // la barre d'appel se centre sur la zone de discussion (pas sur toute la fenêtre)
  function placeBar() { if (!cbar) return; const m = $('#msgs') || $('main'); const r = m ? m.getBoundingClientRect() : null; const c = r && r.width ? r.left + r.width / 2 : innerWidth / 2; cbar.style.left = `${Math.max(12, Math.round(c - cbar.offsetWidth / 2))}px`; }
  addEventListener('resize', placeBar);
  const cState = (s, label) => {
    CALL.state = s; if (cbar) { cbar.dataset.s = s; cbar.querySelector('.cbState').textContent = label || ''; }
    if (head) head.state(s === 'listen' ? 'listening' : s === 'think' ? 'thinking' : 'idle');
    cUi('state', { text: label, on: s });
  };
  const cUi = (ev, extra) => { try { if (CALL.ws && CALL.ws.readyState === 1) CALL.ws.send(JSON.stringify(Object.assign({ type: 'ui', ev }, extra || {}))); } catch {} };
  // 🧸 La mascotte de l'en-tête grandit et sort ses mains pendant l'appel
  function bigHead(a) {
    if (head) { head.dispose(); head = null; }
    const old = wrapEl && wrapEl.querySelector('#agHeadCv'); if (old) old.remove();
    const cv = document.createElement('canvas'); cv.id = 'agHeadCv'; cv.className = 'calling'; cv.title = a.name;
    if (museCv) museCv.style.display = 'none'; wrapEl.appendChild(cv);
    head = A3.live(cv, lookOf(a), 150, jobOf(a), { hands: true });
    headFor = 'call';   // l'en-tête ne se reconstruit pas pendant l'appel
    $('#who').classList.add('calling');
    if (head) head.gesture('wave');
  }
  // 🔊 Audio : phrases jouées dans l'ordre ; le niveau du son fait bouger la bouche
  const cctx = () => {
    if (!CALL.actx) { const A = new (window.AudioContext || window.webkitAudioContext)(); CALL.actx = A; CALL.gain = A.createGain(); CALL.an = A.createAnalyser(); CALL.an.fftSize = 1024; CALL.buf = new Float32Array(1024); CALL.gain.connect(CALL.an); CALL.an.connect(A.destination); }
    if (CALL.actx.state === 'suspended') CALL.actx.resume();
    return CALL.actx;
  };
  function cGestureFor(t) {
    if (!head) return; t = String(t || '').toLowerCase();
    if (/^(oui|exactement|d'accord|bien sûr|parfait|tout à fait|absolument|carrément)\b/.test(t)) return head.gesture('nod');
    if (/^(non|pas du tout|surtout pas|malheureusement)\b/.test(t)) return head.gesture('shake');
    if (/\b(bonjour|salut|coucou|allô|à plus|bonne (journée|soirée|nuit))\b/.test(t)) return head.gesture('wave');
    if (/\b(bravo|génial|super|top|félicitations|youpi|incroyable)\b/.test(t)) return head.gesture('cheer');
    if (/\b(je ne sais pas|aucune idée|peut-être|ça dépend)\b/.test(t)) return head.gesture('shrug');
    if (/\?\s*$/.test(t) && Math.random() < 0.6) return head.gesture('tilt');
  }
  function cPlay(m) {
    const A = cctx(), bin = atob(m.b64), n = bin.length >> 1, buf = A.createBuffer(1, n, m.sr), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; ch[i] = v / 32768; }
    const src = A.createBufferSource(); src.buffer = buf; src.connect(CALL.gain);
    const at = Math.max(A.currentTime + 0.05, CALL.playAt || 0); src.start(at); CALL.playAt = at + buf.duration;
    CALL.sources.push(src);
    if (!CALL.speaking) { CALL.speaking = true; cBargeWatch(); }
    const txt = m.text || ''; setTimeout(() => { if (CALL.sources.includes(src) && cbar) { cbar.querySelector('.cbSub').textContent = txt; cGestureFor(txt); } }, Math.max(0, (at - A.currentTime) * 1000));
    src.onended = () => { CALL.sources = CALL.sources.filter((x) => x !== src); if (!CALL.sources.length) cAfterSpeech(); };
  }
  function cSpeakFallback(text) {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; CALL.speaking = true; CALL.fake = true; if (cbar) cbar.querySelector('.cbSub').textContent = text; cGestureFor(text);
    u.onend = () => { CALL.fake = false; CALL.speaking = false; cAfterSpeech(); }; speechSynthesis.speak(u); cBargeWatch();
  }
  function cStopPlayback() {
    CALL.sources.forEach((s) => { try { s.onended = null; s.stop(); } catch {} }); CALL.sources = []; CALL.playAt = 0; CALL.speaking = false; CALL.fake = false;
    try { speechSynthesis.cancel(); } catch {}
    cVadStop(); if (head) head.talk(0);
  }
  // ✋ Le couper en parlant (micro avec annulation d'écho) ; sinon les mots « attends / stop »
  function cBargeWatch() { if (!CALL.on) return; if (CALL.barge && !CALL.bargeFail) cVadStart(); else cGuard(); }
  async function cVadStart() {
    if (CALL.vad) return; if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { CALL.bargeFail = true; return cGuard(); }
    CALL.vad = { pending: true };
    try {
      const st2 = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
      if (!CALL.speaking || !CALL.on || !CALL.vad) { st2.getTracks().forEach((t) => t.stop()); CALL.vad = null; return; }
      const A = cctx(), src = A.createMediaStreamSource(st2), an = A.createAnalyser(); an.fftSize = 1024; src.connect(an);
      CALL.vad = { st: st2, src, an, buf: new Float32Array(1024), floor: 0, t0: performance.now(), over: 0, last: performance.now() };
    } catch { CALL.vad = null; CALL.bargeFail = true; cGuard(); }
  }
  function cVadStop() { const v = CALL.vad; CALL.vad = null; if (v && v.st) { try { v.src.disconnect(); v.st.getTracks().forEach((t) => t.stop()); } catch {} } }
  function cVadTick(now) {
    const v = CALL.vad; if (!v || !v.an || !CALL.speaking) return;
    v.an.getFloatTimeDomainData(v.buf); let s = 0; for (let i = 0; i < v.buf.length; i++) s += v.buf[i] * v.buf[i];
    const rms = Math.sqrt(s / v.buf.length), dt = now - v.last; v.last = now;
    if (now - v.t0 < 700) { v.floor = v.floor ? v.floor * 0.85 + rms * 0.15 : rms; return; }
    v.over = rms > Math.max(0.035, v.floor * 2.8) ? v.over + dt : Math.max(0, v.over - dt * 0.5);
    if (v.over > 300) { cUi('heard', { text: '…', on: true }); cInterrupt(); }
  }
  function cGuard() {
    if (!SRc || CALL.guard || CALL.listening || !CALL.on) return;
    try {
      const g = new SRc(); g.lang = 'fr-FR'; g.interimResults = true; g.continuous = true; CALL.guard = g;
      g.onresult = (e) => { const r = e.results[e.results.length - 1], t = (r && r[0] ? r[0].transcript : '').trim(); if (t && t.length < 32 && C_HALT.test(t)) { cUi('heard', { text: t, on: true }); cInterrupt(); } };
      g.onerror = () => {}; g.onend = () => { CALL.guard = null; if (CALL.speaking && CALL.on && !CALL.listening && !CALL.vad) setTimeout(cGuard, 200); };
      g.start();
    } catch { CALL.guard = null; }
  }
  function cStopGuard() { const g = CALL.guard; CALL.guard = null; try { if (g) { g.onend = null; g.abort(); } } catch {} }
  function cInterrupt() {
    cStopGuard(); cStopPlayback(); try { CALL.ws.send(JSON.stringify({ type: 'stop' })); } catch {}
    CALL.thinking = false; CALL.doneSeen = true; if (head) head.gesture('nod'); cState('idle', 'Je t’écoute'); setTimeout(cListen, 280);
  }
  function cAfterSpeech() {
    if (!CALL.doneSeen || CALL.sources.length || !CALL.on) return;
    cStopGuard(); cVadStop(); CALL.speaking = false; CALL.thinking = false; cState('idle', 'À toi'); cListen();
  }
  // 👂 Écoute
  function cListen() {
    if (!SRc) { cState('idle', 'Ce navigateur ne sait pas écouter : utilise Chrome.'); return; }
    if (CALL.listening || !CALL.on || CALL.thinking || CALL.speaking) return;
    cStopGuard(); cVadStop();
    try {
      const r = new SRc(); r.lang = 'fr-FR'; r.interimResults = true; r.continuous = false; CALL.rec = r;
      r.onresult = (e) => { let t = '', fin = false; for (let i = 0; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) fin = true; } if (cbar) cbar.querySelector('.cbYou').textContent = t; cUi('heard', { text: t, on: fin }); if (fin && t.trim()) cSend(t.trim()); };
      r.onerror = (e) => { if (e.error === 'not-allowed') cState('idle', 'Micro refusé : autorise-le pour ce site.'); };
      r.onend = () => { CALL.listening = false; if (cbar) cbar.querySelector('.cbMic').classList.remove('on'); if (CALL.on && !CALL.speaking && !CALL.thinking && CALL.state === 'listen') { setTimeout(cListen, 300); } };
      r.start(); CALL.listening = true; if (cbar) cbar.querySelector('.cbMic').classList.add('on'); cState('listen', 'Je t’écoute…');
    } catch { CALL.listening = false; }
  }
  function cStopListening() { try { if (CALL.rec) CALL.rec.abort(); } catch {} CALL.listening = false; }
  function cSend(t) {
    if (C_QUIT.test(t) && !Object.values(CALL.tasks).some((x) => !x.done)) { endCall('À plus tard !'); return; }
    cStopListening(); cStopGuard(); cStopPlayback(); CALL.doneSeen = false; CALL.thinking = true;
    if (head) head.gesture('nod'); cState('think', 'Il réfléchit…');
    try { CALL.ws.send(JSON.stringify({ type: 'say', text: t })); } catch {}
  }
  function cTasks() {
    if (!cbar) return; const l = Object.values(CALL.tasks).slice(-4);
    cbar.querySelector('.cbTasks').innerHTML = l.map((t) => `<span class="cbTask${t.done ? ' done' : ''}">${t.done ? (t.ok ? '✅' : '⚠️') : '⏳'} ${esc(t.title)}</span>`).join('');
  }
  // 🔁 bouche + minuteur + détection de voix
  function cLoop(now) {
    if (!CALL.on) return;
    let lvl = 0;
    if (CALL.an && CALL.sources.length) { CALL.an.getFloatTimeDomainData(CALL.buf); let s = 0; for (let i = 0; i < CALL.buf.length; i += 2) s += CALL.buf[i] * CALL.buf[i]; lvl = Math.min(1, Math.max(0, (Math.sqrt(s / 512) - 0.012) * 7)); }
    else if (CALL.fake) lvl = 0.25 + Math.abs(Math.sin(now / 90)) * 0.45;
    if (head) head.talk(lvl);
    cVadTick(now);
    if (CALL.t0) { const s = Math.floor((Date.now() - CALL.t0) / 1000), mm = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); if (CALL.clock !== mm) { CALL.clock = mm; if (cbar) cbar.querySelector('.cbClock').textContent = mm; const stEl = $('#status'); if (stEl) stEl.textContent = '📞 ' + mm; } }
    requestAnimationFrame(cLoop);
  }
  async function startCall(a, L) {
    if (CALL.on) return;
    if (Number(issueNo) !== Number(a.issue)) await openConv(a.issue);
    let barge = true; try { barge = localStorage.getItem('museCallBarge') !== '0'; } catch {}
    Object.assign(CALL, { on: true, a, ws: null, rec: null, guard: null, vad: null, sources: [], playAt: 0, speaking: false, thinking: false, listening: false, fake: false, doneSeen: true, t0: 0, clock: '', tasks: {}, barge, bargeFail: false, state: '' });
    cctx(); bigHead(a); callBarUi(a); cState('think', 'Je joins ton PC…'); syncHeader();
    $('#who').dataset.call = '1'; if (nameEl) nameEl.textContent = a.name;
    requestAnimationFrame(cLoop);
    // 🔎 D'abord : le PC est-il joignable depuis cet appareil ? (sinon on explique précisément quoi faire)
    const base = L.u.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/live\/?$/, '');
    let ping = null;
    try { const r = await fetch(base + '/ping', { cache: 'no-store', signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }); ping = await r.json(); } catch { ping = null; }
    if (!CALL.on) return;
    if (!ping || !ping.ok) return callFail('unreach', base);
    CALL.pinged = true;
    const ws = new WebSocket(L.u.replace(/\/live\/?$/, '') + '/live?t=' + encodeURIComponent(L.t)); CALL.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', role: 'talk', avatar: true, agent: a.id, issue: a.issue }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (!CALL.on || CALL.ws !== ws) return;
      if (m.type === 'ready') { cState('think', 'Ça sonne…'); setTimeout(() => { if (CALL.on && !CALL.t0) { CALL.t0 = Date.now(); cState('idle', 'En ligne'); cListen(); } }, 3000); }   // démon plus ancien : pas de « agent »
      else if (m.type === 'agent') { CALL.t0 = Date.now(); cState('idle', 'En ligne'); if (head) { head.gesture('wave'); head.job(C_JOBS.includes(m.id) ? m.id : jobOf(a)); } }
      else if (m.type === 'state') { if (m.s === 'speak') { CALL.thinking = false; if (head) head.busy(false); cState('speak', m.task ? 'Il te donne le résultat' : 'Il parle'); } else if (m.s === 'think') cState('think', 'Il réfléchit…'); }
      else if (m.type === 'audio') { cStopListening(); cPlay(m); }
      else if (m.type === 'speak') { cStopListening(); cSpeakFallback(m.text); }
      else if (m.type === 'done') { CALL.doneSeen = true; CALL.thinking = false; if (head) head.busy(false); if (!CALL.sources.length && !CALL.speaking) cAfterSpeech(); }
      else if (m.type === 'mood') { if (head) { head.mood(String(m.m || 'calme')); const g = C_MOOD_G[m.m]; if (g) head.gesture(g); } }
      else if (m.type === 'tool') { const j = C_TOOLJOB(m.name || ''); if (head) { if (j) head.job(j); head.busy(true); } if (m.label && cbar) cbar.querySelector('.cbState').textContent = m.label; }
      else if (m.type === 'task') { CALL.tasks[m.id] = { title: String(m.title || m.text || '').slice(0, 60), done: false }; cTasks(); }
      else if (m.type === 'task-done') { const t = CALL.tasks[m.id]; if (t) { t.done = true; t.ok = m.ok !== false; cTasks(); } if (head) head.gesture(m.ok === false ? 'shrug' : 'cheer'); }
      else if (m.type === 'cmd' && m.c === 'close') endCall('Appel repris sur un autre appareil.');
      else if (m.type === 'error') { CALL.thinking = false; if (head) { head.busy(false); head.mood('inquiete'); } cState('idle', m.msg || 'Erreur'); }
    };
    ws.onerror = () => {};
    ws.onclose = () => { if (CALL.on && CALL.ws === ws) { if (CALL.t0) endCall('Appel coupé : le PC ne répond plus.'); else callFail('refused', base); } };
  }
  // ❌ L'appel n'a pas pu commencer : on garde la barre ouverte avec l'explication et des boutons pour régler ça
  function callFail(kind, base) {
    const a = CALL.a; CALL.on = false;
    cStopListening(); cStopGuard(); cStopPlayback(); try { if (CALL.ws) CALL.ws.close(); } catch {}
    const host = base.replace(/^https?:\/\//, '');
    const txt = kind === 'unreach'
      ? `📵 Cet appareil n'arrive pas à joindre ton PC (${host}). Vérifie : ① l'appli Tailscale de cet appareil est activée (« Connected ») ; ② le PC est allumé, avec le démon Muse lancé ; ③ Chrome a le droit d'accéder aux appareils du réseau local (🔒 à gauche de l'adresse → Autorisations).`
      : `🔐 Ton PC répond, mais il refuse l'appel (lien expiré ou démon pas à jour). Sur le PC : systemctl --user restart muse-daemon, attends une minute, puis réessaie.`;
    if (cbar) {
      cbar.dataset.s = 'fail'; cbar.querySelector('.cbState').textContent = 'Appel impossible';
      cbar.querySelector('.cbSub').textContent = txt; cbar.querySelector('.cbYou').textContent = '';
      cbar.querySelector('.cbBtns').innerHTML = `<button type="button" class="cbTest">🔎 Tester le lien</button><button type="button" class="cbRetry">🔁 Réessayer</button><button type="button" class="cbClose">Fermer</button>`;
      cbar.querySelector('.cbTest').onclick = () => window.open(base + '/ping', '_blank', 'noopener');
      cbar.querySelector('.cbRetry').onclick = () => { resetBar(); callAgent(a); };
      cbar.querySelector('.cbClose').onclick = () => { resetBar(); cbar.hidden = true; document.body.classList.remove('inCall'); };
    }
    $('#who').classList.remove('calling'); delete $('#who').dataset.call; headFor = ''; syncHeader();
    const st3 = $('#status'); if (st3) st3.textContent = 'en ligne';
  }
  function resetBar() { if (!cbar) return; cbar.remove(); cbar = null; }   // la barre sera recréée proprement au prochain appel
  function endCall(msg) {
    if (!CALL.on) return;
    const a = CALL.a, ws = CALL.ws; CALL.on = false;
    cStopListening(); cStopGuard(); cStopPlayback();
    try { if (ws && ws.readyState === 1) { ws.send(JSON.stringify({ type: 'stop' })); ws.close(); } } catch {}
    if (head) head.gesture('wave');
    if (cbar) { cbar.querySelector('.cbState').textContent = msg || ''; setTimeout(() => { if (!CALL.on && cbar) { cbar.hidden = true; document.body.classList.remove('inCall'); } }, 1600); }
    toast(msg || 'Appel terminé.');
    setTimeout(() => { $('#who').classList.remove('calling'); delete $('#who').dataset.call; headFor = ''; syncHeader(); const st3 = $('#status'); if (st3) st3.textContent = 'en ligne'; if (a && Number(issueNo) === Number(a.issue)) openConv(a.issue); }, 1700);   // la discussion se recharge : l'appel y est écrit
  }

  const _open = window.openConv; window.openConv = async function (n) { const r = await _open.apply(this, arguments); syncHeader(); return r; };
  const _new = window.newChat; window.newChat = function () { if (CALL.on) endCall('Appel terminé.'); const r = _new.apply(this, arguments); syncHeader(); return r; };
  const _close = window.autosClose; window.autosClose = function () { const r = _close && _close.apply(this, arguments); syncHeader(); return r; };

  // =====================================================================
  // 📒 JOURNAL · 🩺 SANTÉ
  // =====================================================================
  let tab = 'journal', filt = 'all';
  async function techIssue(label) {
    const l = await gh(`/repos/${cfg.repo}/issues?state=all&labels=${label}&per_page=1`);
    return l && l[0] ? l[0] : null;
  }
  async function tailComments(it, max = 200) {
    const n = it.comments || 0; if (!n) return [];
    const last = Math.max(1, Math.ceil(n / 100)), pages = [last, last - 1].filter((p) => p >= 1).slice(0, Math.ceil(max / 100));
    const parts = await Promise.all(pages.map((p) => gh(`/repos/${cfg.repo}/issues/${it.number}/comments?per_page=100&page=${p}`).catch(() => [])));
    return parts.reverse().flat();
  }
  function renderActivity(t) {
    tab = t || 'journal';
    view.innerHTML = `<div class="ainner">
      <div class="atop"><div><h2>Activité</h2><p class="hint">Tout ce que Muse a fait, et l’état de tes appareils et connexions.</p></div></div>
      <div class="acTabs"><button type="button" data-t="journal" class="${tab === 'journal' ? 'on' : ''}">📒 Journal</button><button type="button" data-t="health" class="${tab === 'health' ? 'on' : ''}">🩺 Santé</button></div>
      <div id="acBody"><p class="hint">Chargement…</p></div></div>`;
    view.querySelectorAll('.acTabs button').forEach((b) => (b.onclick = () => renderActivity(b.dataset.t)));
    (tab === 'journal' ? journal() : health()).catch((e) => { const b = view.querySelector('#acBody'); if (b) b.innerHTML = `<p class="hint">${esc('' + e.message)}</p>`; });
  }

  // ---------- 📒 Journal
  const KIND = { send: ['✉️', 'Envoi'], type: ['⌨️', 'Saisie'], tap: ['👆', 'Bouton'], files: ['📁', 'Fichiers'], agenda: ['📅', 'Agenda'], mail: ['📧', 'E-mail'], video: ['🎬', 'Vidéo'], web: ['🌐', 'Web'], open: ['🔗', 'Lien'] };
  const FILTERS = [['all', 'Tout'], ['send', 'Envois'], ['files', 'Fichiers'], ['agenda', 'Agenda'], ['video', 'Vidéos'], ['err', 'Échecs']];
  const dayKey = (d) => { const t = new Date(d), n = new Date(), y = new Date(Date.now() - 864e5); const k = t.toDateString(); return k === n.toDateString() ? 'Aujourd’hui' : k === y.toDateString() ? 'Hier' : t.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); };
  const hm = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  async function journal() {
    const body = view.querySelector('#acBody');
    const it = await techIssue('muse-journal');
    if (!it) { body.innerHTML = `<div class="aempty"><span class="abolt big">📒</span><h3>Rien pour l’instant</h3><p>Dès que Muse envoie un message, écrit, range des fichiers ou touche à ton agenda, ça apparaît ici, avec un bouton pour annuler.</p></div>`; return; }
    const entries = (await tailComments(it)).map((c) => { try { return JSON.parse(c.body.slice(c.body.indexOf('\n') + 1)); } catch { return null; } }).filter((e) => e && Array.isArray(e.acts)).reverse();
    const keep = (e) => filt === 'all' ? true : filt === 'err' ? e.acts.some((a) => !a.ok) : e.acts.some((a) => a.kind === filt || (filt === 'send' && a.kind === 'mail'));
    const list = entries.filter(keep);
    const sent = entries.filter((e) => Date.now() - Date.parse(e.at) < 864e5).reduce((n, e) => n + e.acts.filter((a) => a.ok && a.kind === 'send').length, 0);
    let html = `<div class="acSum">Dernières 24 h : <b>${sent}</b> envoi${sent > 1 ? 's' : ''} · <b>${entries.filter((e) => Date.now() - Date.parse(e.at) < 864e5).length}</b> tâche${entries.filter((e) => Date.now() - Date.parse(e.at) < 864e5).length > 1 ? 's' : ''} avec des actions</div>
      <div class="acFilt">${FILTERS.map(([k, l]) => `<button type="button" data-f="${k}" class="${filt === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    if (!list.length) html += '<p class="hint">Rien à afficher pour ce filtre.</p>';
    let day = '';
    for (const [i, e] of list.slice(0, 120).entries()) {
      const d = dayKey(e.at); if (d !== day) { day = d; html += `<h4 class="acDay">${esc(d)}</h4>`; }
      const undo = e.acts.some((a) => a.ok && a.undo);
      html += `<article class="acard acEntry" data-i="${i}">
        <div class="acHead"><span class="acTime">${hm(e.at)}</span>${e.agent ? `<span class="acWho">${window.museAgentImgById(e.agent.id) ? `<img class="ciAv" src="${window.museAgentImgById(e.agent.id)}" alt="">` : esc(e.agent.emoji || '')} ${esc(e.agent.name)}</span>` : ''}<a href="#" class="acConv">${esc(e.title || `Discussion n°${e.issue}`)}</a></div>
        <ul class="acActs">${e.acts.map((a) => `<li class="${a.ok ? '' : 'ko'}"><span class="acK" title="${q((KIND[a.kind] || ['•', ''])[1])}">${(KIND[a.kind] || ['•'])[0]}</span><span><b>${esc(a.label || a.tool)}</b>${a.detail ? `<em>« ${esc(a.detail)} »</em>` : ''}${a.ok ? '' : `<small>✗ ${esc(a.err || 'échec')}</small>`}</span><span class="acT">${hm(a.t)}</span></li>`).join('')}</ul>
        <div class="aact"><button class="ghost acOpen" type="button">Ouvrir la discussion</button>${undo ? '<button class="ghost acUndo" type="button">↩️ Annuler</button>' : ''}</div>
      </article>`;
    }
    body.innerHTML = html;
    body.querySelectorAll('.acFilt button').forEach((b) => (b.onclick = () => { filt = b.dataset.f; journal().catch(() => {}); }));
    body.querySelectorAll('.acEntry').forEach((c) => {
      const e = list[+c.dataset.i];
      const go = (ev) => { if (ev) ev.preventDefault(); close(); openConv(e.issue); };
      c.querySelector('.acConv').onclick = go; c.querySelector('.acOpen').onclick = () => go();
      const u = c.querySelector('.acUndo'); if (u) u.onclick = () => undo(e);
    });
  }
  async function undo(e) {
    const acts = e.acts.filter((a) => a.ok && a.undo);
    if (!confirm(`Demander à Muse d’annuler :\n\n${acts.map((a) => `• ${a.label}`).join('\n')}\n\nUn message envoyé ne peut parfois être que supprimé de la discussion.`)) return;
    const list = acts.map((a) => `- ${a.label}${a.detail ? ` (« ${a.detail} »)` : ''} — à faire : ${a.undo}`).join('\n');
    try {
      const c = await gh(`/repos/${cfg.repo}/issues/${e.issue}/comments`, { method: 'POST', body: JSON.stringify({ body: `↩️ **Annule ce que tu as fait** à ${hm(e.at)} :\n${list}\n\nUtilise tes outils pour revenir en arrière (fichiers : pc_files_undo ; rendez-vous : supprime-le ; message : supprime-le dans l’appli si c’est possible), puis dis-moi en 2 lignes ce qui est annulé et ce qui ne peut pas l’être.\n\n<!--mode:${e.mode || 'auto'}-->${e.agent ? `<!--agent:${e.agent.id}-->` : ''}` }) });
      close(); await openConv(e.issue); toast('Annulation demandée');
      if (!busy) wait(e.issue, c.created_at);
    } catch (er) { toast('' + er.message); }
  }

  // ---------- 🩺 Santé
  const ago = (iso) => { if (!iso) return ''; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
  const DIRB = 'cd ~/Téléchargements/muse-cloud/muse-brain && ';
  const cmd = (s, here) => `<code class="acCmd" title="Copier">${esc((here ? '' : DIRB) + s)}</code>`;
  function card(icon, title, state, lines, fixes = [], extra = '') {
    const cls = state === 'ok' ? 'ok' : state === 'warn' ? 'warn' : state === 'wait' ? 'wait' : 'ko';
    const badge = { ok: '✅ OK', warn: '⚠️ À vérifier', wait: '⏳ Test…', ko: '❌ Problème' }[cls];
    return `<article class="acard hCard ${cls}"><div class="ahead"><div class="atitle"><span class="hIc">${icon}</span><b>${esc(title)}</b></div><span class="hBadge">${badge}</span></div>
      ${lines.filter(Boolean).map((l) => `<p class="asum">${l}</p>`).join('')}
      ${fixes.length ? `<div class="hFix"><b>Pour réparer</b>${fixes.map((f) => `<p>${f}</p>`).join('')}</div>` : ''}${extra}</article>`;
  }
  let live = {};
  async function health(refresh) {
    const body = view.querySelector('#acBody');
    const linked = window.museRelay && museRelay.linked();
    let cloud = {}, stt = null, sIssue = null;
    try { const it = await techIssue('muse-sante'); sIssue = it; if (it) { const cs = await tailComments(it, 100); const c = cs.find((x) => x.body.startsWith('<!--muse-ctl--><!--health:cloud-->')); if (c) cloud = JSON.parse(c.body.slice(c.body.indexOf('\n') + 1)); const t = cs.find((x) => x.body.startsWith('<!--muse-ctl--><!--selftest-->')); if (t) stt = JSON.parse(t.body.slice(t.body.indexOf('\n') + 1)); } } catch {}
    // 🧪 Auto-test de la nuit (écrit par le cerveau : GitHub Actions « Muse - auto-test »)
    const selftestHtml = () => {
      const btn = '<div class="aact"><button class="ghost" id="hTest" type="button">▶️ Lancer un auto-test maintenant</button></div>';
      if (!stt) return `<h4 class="agH">🧪 Auto-test</h4><p class="hint">Pas encore lancé. Chaque nuit à 02 h 30, Muse se teste toute seule (cerveau, chaque agent, téléphone, PC, Google) et te prévient le matin à 07 h 30 <b>seulement</b> s’il reste un problème. Tu peux le lancer maintenant : résultat en 2 à 3 minutes.</p>${btn}`;
      const bad = (stt.checks || []).filter((c) => !c.ok && !c.warn).length + (stt.agents || []).filter((a) => !a.ok).length;
      const row = (ic, name, msg, fix) => `<li><span class="stI">${ic}</span><div><b>${esc(name)}</b> <span class="stM">${esc(msg || '')}</span>${fix ? `<small class="stF">👉 ${esc(fix)}</small>` : ''}</div></li>`;
      const rows = (stt.checks || []).map((c) => row(c.skip ? '➖' : c.ok ? '✅' : c.warn ? '⚠️' : '❌', c.label, c.msg, c.ok ? '' : c.fix));
      const ag = (stt.agents || []).map((a) => row(a.ok ? (a.degraded ? '⚠️' : '✅') : '❌', a.name, `${a.ok ? `${Math.max(1, Math.round((a.ms || 0) / 1000))} s · ` : ''}${a.msg || ''}${a.degraded ? ` · gêné : ${a.degraded.join(', ')} indisponible` : ''}`));
      const dots = (stt.history || []).map((h) => `<i class="${h.ok ? 'ok' : 'ko'}" title="${esc(ago(h.at))}${h.ok ? '' : ` · ${h.n} problème(s)`}"></i>`).join('');
      return `<h4 class="agH">🧪 Auto-test</h4><div class="hSum ${bad ? 'ko' : 'ok'}">${bad ? `⚠️ ${bad} point${bad > 1 ? 's' : ''} à régler` : '✅ Tout allait bien'} <small>· ${stt.mode === 'morning' ? 'matin' : stt.mode === 'now' ? 'à la demande' : 'cette nuit'}, ${esc(ago(stt.at))}</small><span class="stDots">${dots}</span></div>
        <ul class="stList">${rows.join('')}${ag.length ? `<li class="stSep">Agents</li>${ag.join('')}` : ''}</ul>${btn}`;
    };
    async function runSelftest() {
      const b = view.querySelector('#hTest'); if (b) { b.disabled = true; b.textContent = '⏳ Test lancé… (2 à 3 minutes)'; }
      try {
        let n = sIssue && sIssue.number;
        if (!n) {
          await gh(`/repos/${cfg.repo}/labels`, { method: 'POST', body: JSON.stringify({ name: 'muse-sante', color: '22c55e' }) }).catch(() => {});
          n = (await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: '🩺 Santé de Muse', body: 'État des appareils et des connexions de Muse. Lu par l’appli : onglet Activité → Santé.', labels: ['muse-sante'] }) })).number;
        }
        const t0 = Date.now(), before = stt && stt.at;
        await gh(`/repos/${cfg.repo}/issues/${n}/comments`, { method: 'POST', body: JSON.stringify({ body: '<!--muse-ctl--><!--selftest-now-->' }) });
        toast('Auto-test lancé : résultat dans 2 à 3 minutes');
        const poll = async () => {
          if (tab !== 'health' || !view.querySelector('#acBody') || Date.now() - t0 > 8 * 60000) return;
          try { const it = await techIssue('muse-sante'); const cs = await tailComments(it, 100); const t = cs.find((x) => x.body.startsWith('<!--muse-ctl--><!--selftest-->')); if (t) { const j = JSON.parse(t.body.slice(t.body.indexOf('\n') + 1)); if (j.at !== before) { stt = j; sIssue = it; draw(); toast('Auto-test terminé'); return; } } } catch {}
          setTimeout(poll, 15000);
        };
        setTimeout(poll, 30000);
      } catch (e) { toast('' + e.message); if (b) { b.disabled = false; b.textContent = '▶️ Lancer un auto-test maintenant'; } }
    }
    const draw = () => {
      const cards = [], problems = [];
      // 📱 Téléphone
      const ph = live.phone, phC = cloud.phone || {};
      if (!linked) cards.push(card('📱', 'Téléphone', 'warn', ['Appli non reliée : colle ton code de liaison MUSE1 dans le profil (touche l’avatar en haut) pour voir l’état en direct.']));
      else if (!ph) cards.push(card('📱', 'Téléphone', 'wait', ['Test en cours…']));
      else if (ph.state === 'ok') cards.push(card('📱', 'Téléphone', phC.state === 'locked' && Date.now() - Date.parse(phC.at || 0) < 3600e3 ? 'warn' : 'ok', [`En ligne · ${esc(ph.data.model || '')} · Android ${esc(ph.data.android || '?')} · répond en ${Math.round((ph.ms || 0) / 1000)} s`, phC.state && phC.state !== 'ok' ? `Dernière action : ${esc(phC.msg || phC.state)} (${ago(phC.at)})` : '']));
      else { problems.push('Téléphone'); cards.push(card('📱', 'Téléphone', 'ko', ['Ne répond pas.'], ['Ouvre l’appli <b>Muse Tél.</b>, vérifie que l’<b>accessibilité Muse</b> est activée et que l’<b>économie de batterie</b> ne la met pas en veille.'])); }
      // 🖥️ PC et 🛰️ serveur
      for (const [k, icon, name] of [['pc', '🖥️', 'Ordinateur'], ['server', '🛰️', 'Serveur 24 h/24']]) {
        const d = live[k];
        if (!linked) continue;
        if (!d) { cards.push(card(icon, name, 'wait', ['Test en cours…'])); continue; }
        if (d.state === 'none') { cards.push(card(icon, name, k === 'server' ? 'warn' : 'ko', [k === 'server' ? 'Pas encore installé. Il garde Facebook, Messenger, WhatsApp et les vidéos disponibles même PC éteint.' : 'Pas encore relié.'], [k === 'server' ? `Sur la machine toujours allumée (Raspberry Pi, vieux portable, VPS), dans le dossier muse-brain : ${cmd('cd muse-brain && bash pc/server-setup.sh', true)}` : cmd('node pc/muse-pc.mjs --setup')])); continue; }
        if (d.state !== 'ok') { if (k === 'pc') problems.push('PC'); cards.push(card(icon, name, k === 'pc' ? 'warn' : 'ko', ['Ne répond pas : éteint, en veille, ou Muse PC arrêté.', k === 'pc' && live.server && live.server.state === 'ok' ? '🛰️ Le serveur prend le relais pour le navigateur et les vidéos.' : ''], [cmd(k === 'pc' ? 'systemctl --user restart muse-pc muse-daemon' : 'systemctl --user restart muse-server', true)])); continue; }
        const x = d.data || {}, fixes = [], lines = [`En ligne · ${esc(x.host || '')}${x.version ? ` · v${esc(x.version)}` : ''}${x.locked ? ' · écran verrouillé' : ''}${x.paused ? ' · en pause' : ''}`];
        lines.push(`Navigateur : ${x.web ? '✅' : '❌'} · Vidéos : ${x.video ? '✅' : '❌'}`);
        const sites = x.sites || {};
        for (const [s, lab] of [['facebook', 'Facebook'], ['messenger', 'Messenger']]) { const v = sites[s]; if (v) lines.push(`${lab} : ${v.ok ? '✅ connecté' : v.state === 'login' ? '❌ demande une connexion' : '⚠️ ' + esc(v.msg || v.state)} <small>(vérifié ${ago(v.at)})</small>`); }
        if (!x.web) fixes.push(cmd('node pc/muse-pc.mjs --setup-web'));
        if (!x.video) fixes.push(cmd('bash pc/video-setup.sh'));
        if (Object.values(sites).some((v) => v && v.state === 'login')) fixes.push(k === 'pc' ? `Reconnecte Facebook (avec le code reçu par SMS) : ${cmd('systemctl --user stop muse-pc && node pc/muse-pc.mjs --login https://www.facebook.com ; systemctl --user start muse-pc')}` : `Reconnecte sur le PC puis recopie le profil : ${cmd('bash pc/profile-export.sh')}`);
        if (x.paused) fixes.push('Muse PC est en pause : menu des applications → « Muse PC : pause / reprise ».');
        if (fixes.length) problems.push(name);
        cards.push(card(icon, name, fixes.length ? 'ko' : 'ok', lines, fixes, x.web ? `<div class="aact"><button class="ghost hSites" data-k="${k}" type="button">🔄 Vérifier Facebook maintenant</button></div>` : ''));
      }
      // 🔐 Google
      const g = cloud.google;
      if (g) { const bad = !g.ok; if (bad) problems.push('Google'); cards.push(card('🔐', 'Google (Gmail, Agenda, Drive)', bad ? 'ko' : 'ok', [bad ? `${g.state === 'expired' ? 'Connexion expirée' : 'Erreur'} : ${esc(g.msg || '')}` : 'Connecté', `Vu ${ago(g.at)}`], bad ? ['Touche l’avatar en haut → <b>Applications</b> → <b>Gmail</b> → touche le compte « Connexion expirée ».'] : []));
      } else cards.push(card('🔐', 'Google (Gmail, Agenda, Drive)', 'warn', ['Pas encore vérifié : l’état apparaîtra après la prochaine demande qui touche aux mails ou à l’agenda.']));
      const sum = !linked ? '' : problems.length ? `<div class="hSum ko">⚠️ ${problems.length} point${problems.length > 1 ? 's' : ''} à régler : ${esc(problems.join(', '))}</div>` : Object.keys(live).length >= 3 ? '<div class="hSum ok">✅ Tout fonctionne : Muse peut travailler sans blocage.</div>' : '';
      body.innerHTML = `${sum}<div class="hGrid">${cards.join('')}</div>${selftestHtml()}<div class="aact"><button class="ghost" id="hRe" type="button">🔄 Tout retester</button></div>`;
      const tb = body.querySelector('#hTest'); if (tb) tb.onclick = runSelftest;
      body.querySelector('#hRe').onclick = () => { live = {}; health(true); };
      body.querySelectorAll('.acCmd').forEach((c) => (c.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(c.textContent).then(() => toast('Commande copiée'), () => {}); }));
      body.querySelectorAll('.hSites').forEach((b) => (b.onclick = async () => { b.disabled = true; b.textContent = '⏳ Vérification (≈ 30 s)…'; const r = await museRelay.call(b.dataset.k, 'site_check', {}, 90000).catch(() => null); if (r && r.state === 'ok' && live[b.dataset.k] && live[b.dataset.k].data) live[b.dataset.k].data.sites = r.data.sites || {}; draw(); }));
    };
    draw();
    if (!linked) return;
    if (!refresh && Object.keys(live).length) return;
    const ask = (k, op) => museRelay.call(k, op).then((r) => { live[k] = r; }, () => { live[k] = { state: 'offline' }; }).then(() => { if (tab === 'health' && view.querySelector('#acBody')) draw(); });
    await Promise.all([ask('phone', 'ping'), ask('pc', 'status'), ask('server', 'status')]);
  }
})();

// 📲 Muse ouverte dans un onglet Chrome (barre d'adresse visible) : proposer de l'installer comme une vraie appli plein écran
(() => {
  const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  if (standalone()) return;
  let prompt = null;
  const show = () => {
    if (document.getElementById('instBar') || standalone()) return;
    try { if (Date.now() - Number(localStorage.getItem('muse_inst_no') || 0) < 3 * 864e5) return; } catch {}
    const b = document.createElement('div'); b.id = 'instBar';
    b.innerHTML = `<span>📲 Ouvre Muse en <b>plein écran</b>, sans la barre de Chrome</span><button type="button" class="btn" id="instGo">Installer</button><button type="button" class="ghost" id="instNo" aria-label="Plus tard">✕</button>`;
    document.body.appendChild(b);
    b.querySelector('#instNo').onclick = () => { b.remove(); try { localStorage.setItem('muse_inst_no', String(Date.now())); } catch {} };
    b.querySelector('#instGo').onclick = async () => {
      if (prompt) { prompt.prompt(); try { await prompt.userChoice; } catch {} prompt = null; b.remove(); }
      else toast('Dans Chrome : menu ⋮ → « Installer l’application » (pas « Ajouter à l’écran d’accueil »)');
    };
  };
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); prompt = e; show(); });
  window.addEventListener('appinstalled', () => { const b = document.getElementById('instBar'); if (b) b.remove(); toast('Muse est installée : ouvre-la depuis son icône'); });
  if (/Android/i.test(navigator.userAgent)) setTimeout(show, 4000);
})();
