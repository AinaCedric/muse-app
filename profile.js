// Profil de Muse : s'ouvre quand on touche l'avatar en haut. Appareils reliés (avec leur état en direct),
// configuration (instructions, mémoire, automatisations, réglages), intégrations et fichiers créés par Muse.
(() => {
  const P = $('#profile'), det = $('#pfDet'), tilesEl = $('#pfTiles');
  const LINK_K = 'muse_link';
  const ls = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage indisponible */ } };
  const h = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Icônes en couleur des tuiles
  const TI = {
    mail: '<svg viewBox="0 0 48 48"><defs><linearGradient id="gM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#2f80ed"/></linearGradient></defs><rect x="5" y="11" width="38" height="27" rx="5" fill="url(#gM)"/><path d="M6 14l18 13 18-13" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M14 5l10 8 10-8" fill="#1d2a44" opacity=".85"/></svg>',
    pc: '<svg viewBox="0 0 48 48"><defs><linearGradient id="gP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fd3ff"/><stop offset="1" stop-color="#2f6fed"/></linearGradient></defs><rect x="5" y="8" width="38" height="26" rx="4" fill="#1d2433"/><rect x="8" y="11" width="32" height="20" rx="2" fill="url(#gP)"/><path d="M20 15l9 5-4 1 3 5-2 1-3-5-3 3z" fill="#fff"/><rect x="18" y="35" width="12" height="4" fill="#1d2433"/><rect x="13" y="39" width="22" height="3" rx="1.5" fill="#1d2433"/></svg>',
    phone: '<svg viewBox="0 0 48 48"><defs><linearGradient id="gT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f55"/><stop offset="1" stop-color="#1e2233"/></linearGradient></defs><rect x="13" y="4" width="22" height="40" rx="5" fill="url(#gT)"/><rect x="15.5" y="8" width="17" height="31" rx="2" fill="#2b3150"/><g><rect x="17.5" y="11" width="4" height="4" rx="1" fill="#ff6b6b"/><rect x="22" y="11" width="4" height="4" rx="1" fill="#ffd166"/><rect x="26.5" y="11" width="4" height="4" rx="1" fill="#06d6a0"/><rect x="17.5" y="16.5" width="4" height="4" rx="1" fill="#4cc9f0"/><rect x="22" y="16.5" width="4" height="4" rx="1" fill="#b388ff"/><rect x="26.5" y="16.5" width="4" height="4" rx="1" fill="#f78c6b"/><rect x="17.5" y="22" width="4" height="4" rx="1" fill="#90be6d"/><rect x="22" y="22" width="4" height="4" rx="1" fill="#f15bb5"/></g></svg>',
    web: '<svg viewBox="0 0 48 48"><defs><linearGradient id="gW" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b79bff"/><stop offset="1" stop-color="#5b3fd6"/></linearGradient></defs><circle cx="24" cy="24" r="18" fill="url(#gW)"/><g fill="none" stroke="#fff" stroke-width="2.2" opacity=".95"><ellipse cx="24" cy="24" rx="7.5" ry="18"/><path d="M6 24h36M9 15h30M9 33h30"/></g></svg>',
  };

  // ---------- Liaison avec le dépôt-relais (pour voir si le téléphone et le PC sont en ligne)
  function link() {
    const c = ls(LINK_K); if (!c) return null;
    try { const j = JSON.parse(atob(c.slice(6).replace(/-/g, '+').replace(/_/g, '/'))); return j.r && j.t ? j : null; } catch { return null; }
  }
  async function rgh(L, path, opts = {}) {
    const r = await fetch(`${API}${path}`, { ...opts, cache: 'no-store', headers: { Authorization: `Bearer ${L.t}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } });
    if (!r.ok) { const e = new Error('Relais : GitHub ' + r.status); e.status = r.status; throw e; }
    return r.status === 204 ? null : r.json();
  }
  let pcIssue = 0;
  // Envoie un « ping » (aucune action sur l'appareil, la bulle ne bouge pas) et attend la réponse
  async function ping(L, which) {
    let no = which === 'phone' ? L.i : pcIssue;
    if (!no) {
      const l = await rgh(L, `/repos/${L.r}/issues?state=open&per_page=50`);
      const it = (l || []).find((i) => !i.pull_request && (which === 'phone' ? /relais/i.test(i.title) && !/relais pc/i.test(i.title) : /relais pc/i.test(i.title)));
      if (!it) return { state: 'none' };
      no = it.number; if (which === 'pc') pcIssue = no;
    }
    const id = Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, '0')).join('');
    const t0 = Date.now();
    const posted = await rgh(L, `/repos/${L.r}/issues/${no}/comments`, { method: 'POST', body: JSON.stringify({ body: `<!--cmd:${id}-->\n{"op":"ping"}` }) });
    let res = null;
    while (Date.now() - t0 < 25000 && !res) {
      await new Promise((r) => setTimeout(r, 2000));
      const cs = await rgh(L, `/repos/${L.r}/issues/${no}/comments?per_page=50&since=${encodeURIComponent(new Date(t0 - 60000).toISOString())}`).catch(() => []);
      res = (cs || []).find((c) => c.body.startsWith(`<!--res:${id}-->`));
    }
    for (const c of [posted, res].filter(Boolean)) rgh(L, `/repos/${L.r}/issues/comments/${c.id}`, { method: 'DELETE' }).catch(() => {});
    if (!res) return { state: 'offline' };
    try { const j = JSON.parse(res.body.slice(res.body.indexOf('-->') + 3)); return { state: j.ok ? 'ok' : 'offline', data: j.data || {}, ms: Date.now() - t0 }; } catch { return { state: 'offline' }; }
  }

  // ---------- Tuiles
  const dev = { phone: { state: 'unknown' }, pc: { state: 'unknown' }, at: 0 };
  let sel = '';
  const TILES = [
    { k: 'mail', name: 'Mail', sub: 'Agenda · Drive' },
    { k: 'pc', name: 'Ordinateur' },
    { k: 'phone', name: 'Téléphone' },
    { k: 'web', name: 'Agent web', sub: 'Ordinateur virtuel' },
  ];
  const SUB = { ok: 'en ligne', wait: 'vérification…', offline: 'hors ligne', none: 'à relier', unlinked: 'à relier', unknown: '' };
  function tileCls(k) {
    if (k !== 'pc' && k !== 'phone') return 'na';
    const s = dev[k].state;
    return s === 'ok' ? 'ok' : s === 'wait' ? 'wait' : s === 'none' || s === 'unlinked' ? 'off' : s === 'offline' ? 'down' : '';
  }
  function drawTiles() {
    tilesEl.innerHTML = TILES.map((t) => {
      const sub = t.k === 'pc' || t.k === 'phone' ? SUB[dev[t.k].state] : t.sub;
      return `<button type="button" class="pfTile ${tileCls(t.k)} ${sel === t.k ? 'sel' : ''}" data-k="${t.k}"><span class="tic">${TI[t.k]}<i class="tdot"></i></span>${h(t.name)}${sub ? `<small>${h(sub)}</small>` : ''}</button>`;
    }).join('');
    tilesEl.querySelectorAll('.pfTile').forEach((b) => (b.onclick = () => pick(b.dataset.k)));
  }
  async function refresh(force) {
    const L = link();
    if (!L) { dev.phone = { state: 'unlinked' }; dev.pc = { state: 'unlinked' }; drawTiles(); if (sel) pick(sel, true); return; }
    if (!force && Date.now() - dev.at < 60000) return;
    dev.at = Date.now();
    for (const k of ['phone', 'pc']) dev[k] = { state: 'wait' };
    drawTiles(); if (sel) pick(sel, true);
    await Promise.all(['phone', 'pc'].map(async (k) => {
      try { dev[k] = await ping(L, k); } catch (e) { dev[k] = { state: e.status === 401 || e.status === 404 ? 'unlinked' : 'offline', err: e.message }; }
      drawTiles(); if (sel === k) pick(k, true);
    }));
  }

  // ---------- Détail d'une tuile + actions rapides
  const yes = (v) => (v ? 'oui' : 'non');
  function ask(text, mode) {
    close(); newChat();
    if (mode) modeSel.value = mode;
    input.value = text; send();
  }
  function prep(mode, ph) { close(); newChat(); modeSel.value = mode; input.placeholder = ph; input.focus(); setTimeout(() => { input.placeholder = 'Écrire à Muse'; }, 20000); }
  const ACT = {
    mailToday: () => ask('Qu’ai-je à faire aujourd’hui ? Ajoute les e-mails importants non lus.', 'perso'),
    mailUnread: () => ask('Résume mes e-mails importants non lus.', 'perso'),
    pcShot: () => ask('Regarde l’écran de mon PC et dis-moi ce qui est ouvert.', 'phone'),
    pcDl: () => ask('Montre-moi les 15 fichiers les plus récents de mon dossier Téléchargements sur le PC.', 'phone'),
    phLoc: () => ask('Où suis-je en ce moment ? Montre-moi sur la carte.', 'phone'),
    phNotif: () => ask('Résume mes dernières notifications sur le téléphone.', 'phone'),
    agent: () => prep('ordi', 'Que dois-je chercher ou faire sur le web ?'),
    link: () => openLink(),
    retry: () => refresh(true),
  };
  function acts(list) { return `<div class="acts">${list.map(([a, t, pri]) => `<button type="button" data-a="${a}" class="${pri ? 'pri' : ''}">${h(t)}</button>`).join('')}</div>`; }
  function pick(k, keep) {
    if (!keep && sel === k) { sel = ''; det.innerHTML = ''; drawTiles(); return; }
    sel = k; drawTiles();
    let html = '';
    const d = dev[k] || {}, x = d.data || {};
    if (k === 'mail') {
      html = `<b>Gmail, Agenda et Drive</b><br>Muse lit tes e-mails, ton agenda et tes documents Google avec le compte relié à muse-brain. Elle ne supprime rien et demande toujours avant d’envoyer.${acts([['mailToday', 'Mon programme du jour', 1], ['mailUnread', 'E-mails non lus']])}`;
    } else if (k === 'web') {
      html = `<b>Agent web</b><br>Muse navigue toute seule dans un ordinateur virtuel (ou dans le Chrome invisible de ton PC quand il est allumé) et tu suis tout dans le panneau « Ordinateur de Muse ».${acts([['agent', 'Lancer une mission', 1]])}`;
    } else if (d.state === 'unlinked' || d.state === 'none') {
      html = d.state === 'none' && k === 'pc'
        ? `<b>PC pas encore relié</b><br>Sur ton PC, dans muse-brain : <code>node pc/muse-pc.mjs --setup</code>.${acts([['retry', 'Vérifier à nouveau', 1]])}`
        : `<b>Relie tes appareils</b><br>Colle ton code de liaison <b>MUSE1.…</b> pour voir ici, en direct, si ton téléphone et ton PC répondent.${acts([['link', 'Coller le code', 1]])}`;
    } else if (d.state === 'wait') {
      html = `<b>${k === 'pc' ? 'Ordinateur' : 'Téléphone'}</b><br>Je lui envoie un petit signal… (jusqu’à 25 s)`;
    } else if (d.state === 'offline') {
      html = k === 'pc'
        ? `<b>Ordinateur hors ligne</b><br>Il est éteint, en veille, ou « Muse PC » ne tourne pas. Relance-le : <code>node pc/muse-pc.mjs &amp;</code>${acts([['retry', 'Réessayer', 1]])}`
        : `<b>Téléphone hors ligne</b><br>Pas de réponse : vérifie Internet sur le téléphone, et que l’appli Muse Tél. n’est pas mise en veille (Xiaomi : « Démarrage automatique » activé, appli verrouillée dans les récentes).${acts([['retry', 'Réessayer', 1]])}`;
    } else if (d.state === 'ok' && k === 'phone') {
      const old = x.app && parseFloat(x.app) < 2.7;
      html = `<b>${h(x.model || 'Téléphone')}</b> · répond en ${(d.ms / 1000).toFixed(1)} s
        <div class="kv"><span>Android</span><span>${h(x.android || '?')}</span><span>Appli Muse Tél.</span><span>${h(x.app || '?')}${old ? ' · mise à jour disponible' : ''}</span>
        <span>Accessibilité</span><span>${x.a11y ? 'activée ✓' : '<b>désactivée</b> : réactive-la dans Réglages → Accessibilité'}</span><span>Notifications</span><span>${x.notif ? 'lues ✓' : 'non autorisées'}</span></div>
        ${acts([['phLoc', 'Où suis-je ?', 1], ['phNotif', 'Mes notifications']])}`;
    } else if (d.state === 'ok' && k === 'pc') {
      html = `<b>${h(x.host || 'Ordinateur')}</b> · répond en ${(d.ms / 1000).toFixed(1)} s
        <div class="kv"><span>Système</span><span>${h(x.os || '?')}${x.session ? ' · ' + h(x.session) : ''}</span><span>Muse PC</span><span>${h(x.version || '?')}${x.paused ? ' · <b>en pause</b>' : ''}</span>
        <span>Navigateur de Muse</span><span>${x.web ? 'prêt ✓' : 'non installé'}</span><span>Fichiers</span><span>${x.files ? 'accès autorisé ✓' : 'désactivé'}</span>
        ${x.battery ? `<span>Batterie</span><span>${h(x.battery)}</span>` : ''}${x.locked ? '<span>Écran</span><span>verrouillé</span>' : ''}</div>
        ${acts([['pcShot', 'Voir mon écran', 1], ['pcDl', 'Mes téléchargements']])}`;
    } else html = '';
    det.innerHTML = html ? `<div class="pfDet">${html}</div>` : '';
    det.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => ACT[b.dataset.a]?.()));
  }

  // ---------- Fichiers créés par Muse (uploads/<discussion>/out-…)
  const EXT_C = { pdf: '#e5484d', md: '#2f80ed', txt: '#6c6a80', doc: '#2b579a', docx: '#2b579a', xls: '#1d7044', xlsx: '#1d7044', csv: '#1d7044', ppt: '#c43e1c', pptx: '#c43e1c', png: '#8e4ec6', jpg: '#8e4ec6', jpeg: '#8e4ec6', webp: '#8e4ec6', zip: '#a07a1f', json: '#0f8a8a', html: '#e8590c', py: '#3572a5', js: '#c9a400' };
  let filesAt = 0;
  async function loadFiles() {
    if (Date.now() - filesAt < 120000) return;
    const box = $('#pfFiles');
    try {
      const t = await gh(`/repos/${cfg.repo}/git/trees/HEAD?recursive=1`);
      const fs = (t.tree || []).map((e) => { const m = e.type === 'blob' && e.path.match(/^uploads\/(\d+)\/out-(\d+)-\d+-(.+)$/); return m ? { path: e.path, conv: +m[1], at: +m[2], name: m[3], size: e.size } : null; })
        .filter((f) => f && !/^(lieu-|source-)/.test(f.name)).sort((a, b) => b.at - a.at).slice(0, 15);
      filesAt = Date.now();
      if (!fs.length) { box.innerHTML = '<div class="pfEmpty">Les documents, tableurs et images que Muse crée pour toi apparaîtront ici.</div>'; return; }
      box.innerHTML = fs.map((f, i) => {
        const ext = (f.name.split('.').pop() || '').toLowerCase().slice(0, 4);
        const when = new Date(f.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const kb = f.size > 1e6 ? (f.size / 1e6).toFixed(1) + ' Mo' : Math.max(1, Math.round(f.size / 1e3)) + ' Ko';
        return `<button type="button" class="pfRow" data-i="${i}"><span class="fic" style="background:${EXT_C[ext] || '#5b3fd6'}">${h(ext.toUpperCase())}</span><span class="lab">${h(f.name)}<small>${when} · ${kb} · discussion n°${f.conv}</small></span>${ic('right')}</button>`;
      }).join('');
      box.querySelectorAll('.pfRow').forEach((b) => (b.onclick = async () => {
        const f = fs[+b.dataset.i];
        try {
          b.style.opacity = '.5';
          const url = await fetchBlob(f.path);
          const a = document.createElement('a'); a.href = url;
          if (/\.(png|jpe?g|webp|gif|pdf|txt|md)$/i.test(f.name)) a.target = '_blank'; else a.download = f.name;
          document.body.appendChild(a); a.click(); a.remove();
        } catch (e) { toast('' + e.message); } finally { b.style.opacity = ''; }
      }));
    } catch (e) { box.innerHTML = `<div class="pfEmpty">Impossible de charger les fichiers (${h(e.message)}).</div>`; }
  }
  async function autosCount() {
    try { const f = await gh(`/repos/${cfg.repo}/contents/data/automations.json`); const it = JSON.parse(b64d(f.content)).items || []; const on = it.filter((x) => x.enabled).length; $('#pfAutoN').textContent = it.length ? `${on} active${on > 1 ? 's' : ''}` : ''; } catch { $('#pfAutoN').textContent = ''; }
  }

  // ---------- Instructions (data/instructions.md, lues par Muse avant chaque réponse)
  let insSha = null;
  async function openInstr() {
    try { const f = await gh(`/repos/${cfg.repo}/contents/data/instructions.md`); insSha = f.sha; $('#insTxt').value = b64d(f.content); }
    catch (e) { if (e.status === 404) { insSha = null; $('#insTxt').value = ''; } else return toast('' + e.message); }
    $('#insDlg').showModal();
  }
  $('#insCancel').onclick = () => $('#insDlg').close();
  $('#insSave').onclick = async () => {
    try {
      const r = await gh(`/repos/${cfg.repo}/contents/data/instructions.md`, { method: 'PUT', body: JSON.stringify({ message: 'Instructions modifiées depuis le profil', content: b64e($('#insTxt').value), ...(insSha ? { sha: insSha } : {}) }) });
      insSha = r.content?.sha || insSha; $('#insDlg').close(); toast('Instructions enregistrées : Muse les suivra dès la prochaine réponse');
    } catch (e) { toast('' + (e.status === 409 || e.status === 422 ? 'Les instructions ont changé entre-temps, rouvre-les' : e.message)); }
  };

  // ---------- Code de liaison
  function openLink() { $('#linkTxt').value = ls(LINK_K) || ''; $('#linkMsg').textContent = link() ? 'Code enregistré ✓' : ''; $('#linkDlg').showModal(); }
  $('#linkCancel').onclick = () => $('#linkDlg').close();
  $('#linkDel').onclick = () => { lsSet(LINK_K, null); $('#linkDlg').close(); linkVal(); refresh(true); };
  $('#linkSave').onclick = async () => {
    const c = $('#linkTxt').value.trim(); const prev = ls(LINK_K);
    if (!/^MUSE1\./.test(c)) { $('#linkMsg').textContent = 'Le code commence par MUSE1.'; return; }
    lsSet(LINK_K, c);
    const L = link(); if (!L) { lsSet(LINK_K, prev); $('#linkMsg').textContent = 'Code illisible : recopie-le en entier.'; return; }
    $('#linkMsg').textContent = 'Vérification…';
    try { await rgh(L, `/repos/${L.r}`); } catch (e) { lsSet(LINK_K, prev); $('#linkMsg').textContent = `Le relais ne répond pas (${e.message}).`; return; }
    $('#linkDlg').close(); toast('Appareils reliés'); linkVal(); refresh(true);
  };
  const linkVal = () => { $('#pfLinkV').textContent = link() ? 'Relié' : 'À relier'; };

  // ---------- Lignes de configuration
  const GO = {
    instr: openInstr,
    mem: () => $('#memBtn').click(),
    autos: () => { close(); $('#autoBtn').click(); },
    apps: () => window.museApps?.open(),
    cfg: () => openCfg(),
    link: openLink,
    google: () => { const g = window.museGoogle; if (!g || g.state === 'none' || g.state === 'unknown') g?.connect(); else window.museApps?.openGoogle(); },
  };
  P.querySelectorAll('.pfRow[data-go]').forEach((b) => (b.onclick = () => GO[b.dataset.go]()));

  // État de Google affiché sur la ligne « Google »
  const gLabel = () => { const g = window.museGoogle; if (!g) return; const set = () => { const v = $('#pfGoogleV'); if (v) v.textContent = { ok: 'Connecté', expired: 'À reconnecter', none: 'Connecter', unknown: '' }[g.state] || ''; }; set(); g.check().then(set); if (!gLabel.b) { gLabel.b = 1; g.onChange?.(set); } };

  // ---------- Menu ⋯
  const menu = $('#pfMenu');
  $('#pfMore').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  P.addEventListener('click', () => { menu.hidden = true; });
  menu.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
    menu.hidden = true;
    ({ theme: () => $('#themeBtn').click(), refresh: () => refresh(true), new: () => { close(); newChat(); }, cfg: () => openCfg() })[b.dataset.a]();
  }));

  // ---------- Ouverture / fermeture (le vrai Muse 3D vient se placer en grand dans le profil)
  const canvas = $('#avatar'), home = $('#avatarWrap'), who = $('#who');
  let isOpen = false, mo = null;
  function open() {
    if (isOpen) return;
    if (!cfg.repo || !cfg.token) { openCfg(); return; }
    isOpen = true; P.hidden = false; requestAnimationFrame(() => P.classList.add('on'));
    if (who.classList.contains('fallback') || !canvas) $('#pfAva').innerHTML = '<div class="pfImg"></div>';
    else { $('#pfAva').appendChild(canvas); window.MuseAvatar?.resize?.(168); }
    if (window.MuseAvatar?.state === 'idle') window.MuseAvatar.setState('happy', 1600);
    const sync = () => { $('#pfSt').textContent = $('#status').textContent || 'en ligne'; };
    sync(); mo = new MutationObserver(sync); mo.observe($('#status'), { childList: true, characterData: true, subtree: true });
    try { history.pushState({ museProfile: 1 }, ''); } catch { /* sans historique */ }
    $('#side').classList.remove('open'); $('#scrim').classList.remove('on');
    linkVal(); drawTiles(); refresh(false); loadFiles(); autosCount(); window.museApps?.count(); gLabel();
  }
  function close(fromPop) {
    if (!isOpen) return;
    isOpen = false; P.classList.remove('on'); menu.hidden = true;
    if (canvas && canvas.parentNode !== home) { home.appendChild(canvas); window.MuseAvatar?.resize?.(88); }
    mo?.disconnect();
    setTimeout(() => { if (!isOpen) P.hidden = true; }, 260);
    if (!fromPop && history.state?.museProfile) { try { history.back(); } catch { /* rien */ } }
  }
  window.museProfile = { open, close };
  who.addEventListener('click', open);
  $('#pfBack').onclick = () => close();
  addEventListener('popstate', () => { if (isOpen && !history.state?.museProfile && !history.state?.museApps) close(true); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen && !document.querySelector('dialog[open]')) close(); });
})();
