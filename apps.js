// Applications de Muse : intégrations toujours actives (Google, web, cartes…) + applis du téléphone que Cédric « ajoute ».
// Le choix est enregistré dans data/apps.json : Muse utilise en priorité les applis ajoutées et n'ouvre pas les autres
// applis du catalogue sans que Cédric le demande. Banques, paiements et gestionnaires de mots de passe : jamais.
(() => {
  const FILE = 'data/apps.json';
  const h = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // [id, nom, catégorie, couleur, lettre(s), description]
  const BUILTIN = [
    ['web', 'Recherche web', 'prod', '#5b3fd6', 'W', 'Chercher, comparer, vérifier'],
    ['cartes', 'Cartes', 'voyage', '#2f9e44', 'C', 'Lieux proches, itinéraires, carte 3D'],
    ['images', 'Images', 'video', '#8e4ec6', 'I', 'Photos pour illustrer les réponses'],
  ];
  // Connectées avec un seul toucher (un même compte Google pour les trois)
  const GOOGLE = [
    ['gmail', 'Gmail', 'prod', '#ea4335', 'M', 'Lire, trier et préparer tes e-mails'],
    ['agenda', 'Google Agenda', 'prod', '#1a73e8', '31', 'Ton programme, tes rendez-vous'],
    ['drive', 'Google Drive', 'prod', '#0f9d58', 'D', 'Retrouver et lire tes documents'],
  ];
  const PHONE = [
    ['whatsapp', 'WhatsApp', 'msg', '#25d366', 'W', 'Lire et répondre à tes conversations'],
    ['messenger', 'Messenger', 'msg', '#0a7cff', 'M', 'Messages Facebook'],
    ['telegram', 'Telegram', 'msg', '#229ed9', 'T', 'Lire et écrire tes messages'],
    ['messages', 'Messages (SMS)', 'msg', '#1a73e8', 'S', 'Tes SMS'],
    ['facebook', 'Facebook', 'social', '#1877f2', 'f', 'Fil, pages et publications'],
    ['instagram', 'Instagram', 'social', '#d62976', 'Ig', 'Publications, reels et messages'],
    ['tiktok', 'TikTok', 'social', '#111111', 'Tk', 'Vidéos et tendances'],
    ['linkedin', 'LinkedIn', 'social', '#0a66c2', 'in', 'Profil, réseau et offres'],
    ['youtube', 'YouTube', 'video', '#ff0000', '▶', 'Vidéos, chaînes et recherches'],
    ['spotify', 'Spotify', 'video', '#1db954', 'S', 'Musique et podcasts'],
    ['photos', 'Galerie / Photos', 'video', '#f9ab00', 'P', 'Retrouver tes photos'],
    ['camera', 'Appareil photo', 'video', '#5f6368', '◉', 'Prendre une photo'],
    ['maps', 'Google Maps', 'voyage', '#34a853', 'G', 'Lieux, avis, photos et trajets'],
    ['chrome', 'Chrome', 'prod', '#4285f4', 'C', 'Naviguer sur ton téléphone'],
    ['notes', 'Notes / Keep', 'prod', '#fbbc04', 'N', 'Lire et écrire tes notes'],
    ['fichiers', 'Fichiers', 'prod', '#1967d2', 'F', 'Tes fichiers sur le téléphone'],
    ['horloge', 'Horloge', 'prod', '#5f6368', '⏰', 'Alarmes et minuteurs'],
    ['contacts', 'Contacts', 'prod', '#1a73e8', 'Ct', 'Retrouver un numéro'],
    ['chatgpt', 'ChatGPT', 'ia', '#10a37f', 'G', 'Créer des images, demander un avis'],
    ['gemini', 'Gemini', 'ia', '#4e7cf6', '✦', 'Créer des images, demander un avis'],
    ['copilot', 'Copilot', 'ia', '#0078d4', 'Co', 'Créer des images'],
    ['meta ai', 'Meta AI', 'ia', '#0866ff', 'AI', 'Créer des images'],
  ];
  const CATS = [['all', 'Tout'], ['msg', 'Messagerie'], ['social', 'Réseaux sociaux'], ['prod', 'Productivité'], ['voyage', 'Voyage'], ['video', 'Photo, vidéo, musique'], ['ia', 'IA']];
  const DEFAULT = ['whatsapp', 'messenger', 'youtube', 'maps', 'chatgpt', 'photos'];
  const byId = Object.fromEntries([...BUILTIN, ...GOOGLE, ...PHONE].map((a) => [a[0], a]));
  let st = { added: null, sha: null, loaded: false }, view = 'all', cat = 'all', q = '', saveT = null;

  async function load() {
    if (st.loaded) return;
    try {
      const f = await gh(`/repos/${cfg.repo}/contents/${FILE}`); st.sha = f.sha;
      const j = JSON.parse(b64d(f.content)); st.added = (j.added || []).map((x) => x.id || x).filter((id) => byId[id]);
    } catch (e) { if (e.status === 404) { st.sha = null; st.added = DEFAULT.slice(); } else throw e; }
    st.loaded = true;
  }
  // Muse lit ce fichier : noms lisibles des applis ajoutées et de celles du catalogue NON ajoutées
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      const body = { updated: new Date().toISOString(), added: st.added.map((id) => ({ id, name: byId[id][1] })), not_added: PHONE.filter((a) => !st.added.includes(a[0])).map((a) => ({ id: a[0], name: a[1] })) };
      try {
        const r = await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify({ message: '📱 Applications de Muse', content: b64e(JSON.stringify(body, null, 2)), ...(st.sha ? { sha: st.sha } : {}) }) });
        st.sha = r.content?.sha || st.sha;
      } catch (e) {
        if (e.status === 409 || e.status === 422) { st.loaded = false; toast('La liste a changé ailleurs : je la recharge'); await load().catch(() => {}); draw(); }
        else toast('Enregistrement impossible : ' + e.message);
      }
    }, 700);
  }
  // Vraies icônes des marques : chargées depuis leurs sites officiels (service d'icônes de Google), pastille en secours
  const DOMAIN = {
    gmail: 'mail.google.com', agenda: 'calendar.google.com', drive: 'drive.google.com',
    whatsapp: 'whatsapp.com', messenger: 'messenger.com', telegram: 'telegram.org', messages: 'messages.google.com',
    facebook: 'facebook.com', instagram: 'instagram.com', tiktok: 'tiktok.com', linkedin: 'linkedin.com',
    youtube: 'youtube.com', spotify: 'spotify.com', photos: 'photos.google.com', maps: 'maps.google.com',
    chrome: 'google.com/chrome', notes: 'keep.google.com', fichiers: 'files.google.com', contacts: 'contacts.google.com',
    chatgpt: 'chatgpt.com', gemini: 'gemini.google.com', copilot: 'copilot.microsoft.com', 'meta ai': 'meta.ai',
  };
  const logo = (id) => DOMAIN[id] ? `https://www.google.com/s2/favicons?sz=128&domain_url=https://${DOMAIN[id]}` : '';
  const icon = (a) => { const u = logo(a[0]); return `<span class="apIc${u ? ' hasLogo' : ''}">${u ? `<img src="${u}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('hasLogo');this.remove()">` : ''}<i style="background:${a[3]}">${h(a[4])}</i></span>`; };
  const gOk = () => window.museGoogle?.state === 'ok';
  const addedCount = () => BUILTIN.length + (gOk() ? GOOGLE.length : 0) + (st.added || []).length;
  // Ligne d'une appli Google : « + » = connecter · ✓ = connectée · ! = à reconnecter
  const gSub = (a) => { const g = window.museGoogle, s = g?.state, n = (g?.accounts || []).filter((x) => x.state === 'ok').length; return s === 'ok' ? (n > 1 ? `${n} comptes connectés` : `Connecté · ${g.email}`) : s === 'expired' ? 'Connexion expirée : touche pour reconnecter' : a[5]; };

  function draw() {
    const body = $('#apBody');
    if (!st.loaded) { body.innerHTML = '<div class="pfEmpty">Chargement…</div>'; return; }
    if (view.startsWith('google:')) { drawGoogle(view.slice(7)); return; }
    if (view === 'added') {
      $('#apTitle').textContent = 'Applications ajoutées';
      const ph = st.added.map((id) => byId[id]);
      const gl = gOk() ? GOOGLE : [];
      body.innerHTML = `<div class="apSecT">Toujours actives</div><div class="apCard">${BUILTIN.map((a) => `<div class="apItem">${icon(a)}<span class="apTx"><b>${h(a[1])}<em>intégrée</em></b><small>${h(a[5])}</small></span></div>`).join('')}</div>
        ${gl.length ? `<div class="apSecT">Compte Google</div><div class="apCard">${gl.map((a) => `<div class="apItem gRow" data-gid="${a[0]}" role="button" tabindex="0">${icon(a)}<span class="apTx"><b>${h(a[1])}<em>connectée</em></b><small>${h(gSub(a))}</small></span>${ic('right')}</div>`).join('')}</div>` : ''}
        <div class="apSecT">Sur ton téléphone</div>
        ${ph.length ? `<div class="apCard">${ph.map((a) => `<button type="button" class="apItem" data-id="${a[0]}">${icon(a)}<span class="apTx"><b>${h(a[1])}</b><small>${h(a[5])}</small></span>${ic('right')}</button>`).join('')}</div>` : '<div class="pfEmpty">Aucune appli du téléphone. Ajoute-en depuis la liste.</div>'}
        <p class="apNote">Muse les ouvre sur ton téléphone quand c’est utile, avec la bulle qui montre ce qu’elle fait. Envoyer, publier ou supprimer demande toujours ta confirmation.</p>`;
      body.querySelectorAll('.apItem[data-id]').forEach((b) => (b.onclick = (e) => itemMenu(b.dataset.id, e)));
      body.querySelectorAll('.apItem[data-gid]').forEach((r) => (r.onclick = () => gOpen(r.dataset.gid)));
      return;
    }
    $('#apTitle').textContent = 'Applications';
    const nq = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const match = (a) => (nq || cat === 'all' || a[2] === cat) && (!nq || `${a[1]} ${a[5]}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(nq));
    const list = [...GOOGLE.filter(match), ...PHONE.filter(match)], built = BUILTIN.filter(match);
    body.innerHTML = `<label class="apSearch">${ic('search')}<input id="apQ" placeholder="Rechercher des applications" autocomplete="off" value="${h(q)}"></label>
      <button type="button" class="apAdded" id="apAddedBtn"><span class="bx">${ic('cube')}</span><span><b>Applications ajoutées</b><small>${addedCount()} applications</small></span><span class="mini"></span></button>
      <div class="apChips">${CATS.map(([k, t]) => `<button type="button" data-c="${k}" class="${cat === k ? 'on' : ''}">${h(t)}</button>`).join('')}</div>
      ${list.length ? `<div class="apCard">${list.map((a) => {
        if (GOOGLE.includes(a)) { const gs = window.museGoogle?.state, on = gs === 'ok', exp = gs === 'expired'; return `<div class="apItem gRow" data-gid="${a[0]}" role="button" tabindex="0">${icon(a)}<span class="apTx"><b>${h(a[1])}</b><small>${h(gSub(a))}</small></span><span class="apAdd ${on ? 'on' : exp ? 'warn' : ''}">${exp ? '!' : ic(on ? 'check' : 'plus')}</span></div>`; }
        const on = st.added.includes(a[0]); return `<div class="apItem">${icon(a)}<span class="apTx"><b>${h(a[1])}</b><small>${h(a[5])}</small></span><button type="button" class="apAdd ${on ? 'on' : ''}" data-id="${a[0]}" aria-label="${on ? 'Retirer' : 'Ajouter'} ${h(a[1])}">${ic(on ? 'check' : 'plus')}</button></div>`; }).join('')}</div>` : ''}
      ${built.length ? `<div class="apSecT">Intégrées à Muse</div><div class="apCard">${built.map((a) => `<div class="apItem">${icon(a)}<span class="apTx"><b>${h(a[1])}<em>intégrée</em></b><small>${h(a[5])}</small></span></div>`).join('')}</div>` : ''}
      ${!list.length && !built.length ? '<div class="pfEmpty">Aucune application ne correspond.</div>' : ''}
      <p class="apNote">🔒 Banques, paiements, mobile money et gestionnaires de mots de passe ne sont jamais proposés : Muse n’y touche pas.</p>`;
    const qi = $('#apQ');
    qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; draw(); const n = $('#apQ'); n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* rien */ } };
    $('#apAddedBtn').onclick = () => { view = 'added'; push(); draw(); };
    body.querySelectorAll('.apChips button').forEach((b) => (b.onclick = () => { cat = b.dataset.c; draw(); }));
    const chip = body.querySelector('.apChips button.on'); if (chip) chip.scrollIntoView({ inline: 'center', block: 'nearest' });
    body.querySelectorAll('.apAdd[data-id]').forEach((b) => (b.onclick = () => toggle(b.dataset.id)));
    body.querySelectorAll('.apItem[data-gid]').forEach((r) => (r.onclick = () => gOpen(r.dataset.gid)));
  }
  async function gOpen(id) {
    const g = window.museGoogle; if (!g) return;
    if (g.state === 'unknown') await g.check();
    if (g.state === 'none') { g.connect(); return; }      // aucun compte : direct vers la connexion Google
    view = 'google:' + id; push(); draw();
  }
  const G_INFO = {
    gmail: ['Accédez, recherchez, organisez et répondez facilement à vos e-mails avec Muse pour améliorer votre productivité.', 'Lire et rechercher tes e-mails · préparer des brouillons · envoyer seulement après ton OUI et un code de confirmation'],
    agenda: ['Consultez votre programme, trouvez des créneaux et gérez vos rendez-vous avec Muse.', 'Lire ton agenda · créer, modifier ou supprimer un événement seulement après ton OUI et un code de confirmation'],
    drive: ['Retrouvez et lisez vos documents Google avec Muse, sans jamais les modifier.', 'Chercher et lire tes fichiers Drive (lecture seule : rien n’est écrit ni supprimé)'],
  };
  const avatar = (a) => a.picture ? `<span class="apAv"><img src="${h(a.picture)}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.textContent='${h((a.email || '?')[0].toUpperCase())}'"></span>` : `<span class="apAv">${h((a.email || '?')[0].toUpperCase())}</span>`;
  function drawGoogle(id) {
    const g = window.museGoogle, a = byId[id] || GOOGLE[0], info = G_INFO[id] || G_INFO.gmail, list = g?.accounts || [];
    $('#apTitle').textContent = '';
    $('#apBody').innerHTML = `<div class="apDet"><span class="apBig">${icon(a)}</span><h2>${h(a[1])}</h2><p>${h(info[0])}</p></div>
      <div class="apSecT">Comptes</div>
      <div class="apCard" id="gAccs">${list.map((x) => `<div class="apItem gAcc" data-e="${h(x.email)}">${avatar(x)}<span class="apTx"><b>${h(x.email)}</b><small>${x.state === 'expired' ? 'Connexion expirée : touche pour reconnecter' : x.state === 'ok' ? `Connecté${x.email === g.default ? ' · par défaut' : ''}` : `Vérification…${x.email === g.default ? ' · par défaut' : ''}`}</small></span><button type="button" class="apMore" data-e="${h(x.email)}" aria-label="Options">${ic('dots')}</button></div>`).join('')}
        <button type="button" class="apItem" id="gAdd"><span class="apPlus">${ic('plus')}</span><span class="apTx"><b>${list.length ? 'Connecter un autre compte' : 'Connecter un compte'}</b></span></button></div>
      <div class="apSecT">Détails</div>
      <div class="apCard">
        <div class="apItem"><span class="apTx"><b>Type d’application</b></span><span class="apVal">Intégration Google</span></div>
        <div class="apItem"><span class="apTx"><b>Ce que Muse peut faire</b><small class="wrap">${h(info[1])}</small></span></div>
        <a class="apItem" href="https://policies.google.com/privacy" target="_blank" rel="noopener"><span class="apTx"><b>Politique de confidentialité</b></span>${ic('out')}</a>
        <a class="apItem" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener"><span class="apTx"><b>Gérer l’accès sur mon compte Google</b></span>${ic('out')}</a>
      </div>
      <p class="apNote">Les comptes connectés servent pour Gmail, Agenda et Drive en même temps. Muse précise toujours quel compte elle utilise.</p>`;
    const body = $('#apBody');
    $('#gAdd').onclick = () => g.connect();
    body.querySelectorAll('.gAcc').forEach((r) => (r.onclick = (e) => { if (e.target.closest('.apMore')) return; const x = list.find((q) => q.email === r.dataset.e); if (x && x.state === 'expired') g.connect(x.email); }));
    body.querySelectorAll('.apMore').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); acctMenu(b.dataset.e, e); }));
  }
  function acctMenu(email, e) {
    const g = window.museGoogle;
    document.querySelectorAll('.cmenu.apm').forEach((m) => m.remove());
    const m = document.createElement('div'); m.className = 'cmenu apm';
    m.innerHTML = `<button type="button" data-a="re">${ic('bolt')}Reconnecter</button>${email !== g.default ? `<button type="button" data-a="def">${ic('check')}Compte par défaut</button>` : ''}<button type="button" data-a="out">${ic('trash')}Déconnecter</button><button type="button" data-a="cfg">${ic('gear')}Changer l’ID client Google</button>`;
    document.body.appendChild(m);
    const r = e.currentTarget.getBoundingClientRect();
    m.style.left = Math.max(10, Math.min(innerWidth - m.offsetWidth - 10, r.right - m.offsetWidth)) + 'px';
    m.style.top = Math.min(innerHeight - m.offsetHeight - 10, r.bottom + 4) + 'px';
    m.onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; m.remove(); ({ re: () => g.connect(email), def: () => g.setDefault(email), out: () => g.disconnect(email), cfg: () => g.reset() })[b.dataset.a](); };
    setTimeout(() => document.addEventListener('click', function off(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', off, true); } }, true), 0);
  }
  function toggle(id) {
    const i = st.added.indexOf(id);
    if (i >= 0) st.added.splice(i, 1); else st.added.push(id);
    toast(i >= 0 ? `${byId[id][1]} retirée` : `${byId[id][1]} ajoutée`);
    save(); draw(); count();
  }
  const TRY = {
    whatsapp: 'Ouvre WhatsApp sur mon téléphone et résume mes derniers messages non lus.',
    messenger: 'Ouvre Messenger et résume mes derniers messages.',
    telegram: 'Ouvre Telegram et résume mes derniers messages.',
    messages: 'Résume mes derniers SMS.',
    youtube: 'Ouvre YouTube sur mon téléphone et montre-moi les vidéos tendance du moment.',
    maps: 'Trouve les bons restaurants près de moi sur Google Maps.',
    chatgpt: 'Utilise ChatGPT sur mon téléphone pour créer une image d’un coucher de soleil à Antananarivo.',
    photos: 'Montre-moi mes 5 dernières photos.',
  };
  function itemMenu(id, e) {
    document.querySelectorAll('.cmenu.apm').forEach((m) => m.remove());
    const a = byId[id], m = document.createElement('div'); m.className = 'cmenu apm';
    m.innerHTML = `<button type="button" data-a="try">${ic('arrow')}Essayer avec Muse</button><button type="button" data-a="del">${ic('trash')}Retirer</button>`;
    document.body.appendChild(m);
    const r = e.currentTarget.getBoundingClientRect();
    m.style.left = Math.max(10, Math.min(innerWidth - m.offsetWidth - 10, r.right - m.offsetWidth - 12)) + 'px';
    m.style.top = Math.min(innerHeight - m.offsetHeight - 10, r.bottom - 6) + 'px';
    m.onclick = (ev) => {
      const b = ev.target.closest('button'); if (!b) return; m.remove();
      if (b.dataset.a === 'del') toggle(id);
      else { const depth = (view !== 'all' ? 2 : 1) + 1; close(true); window.museProfile?.close(true); try { history.go(-depth); } catch { /* rien */ } newChat(); modeSel.value = 'phone'; input.value = TRY[id] || `Ouvre ${a[1]} sur mon téléphone et montre-moi ce qu’il y a de nouveau.`; input.dispatchEvent(new Event('input')); input.focus(); }
    };
    setTimeout(() => document.addEventListener('click', function off(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', off, true); } }, true), 0);
  }

  async function count() {
    try { await load(); const n = $('#pfAppsN'); if (n) n.textContent = `${addedCount()}`; } catch { /* rien */ }
  }
  // Ouverture / retour (bouton retour d'Android compris)
  const P = $('#apps'); let isOpen = false;
  function push() { try { history.pushState({ museApps: view }, ''); } catch { /* rien */ } }
  async function open() {
    if (isOpen) return; isOpen = true; view = 'all'; cat = 'all'; q = '';
    P.hidden = false; requestAnimationFrame(() => P.classList.add('on')); push(); draw();
    window.museGoogle?.check(); window.museGoogle?.onChange?.(() => { if (isOpen) draw(); count(); });
    try { await load(); } catch (e) { $('#apBody').innerHTML = `<div class="pfEmpty">Impossible de charger (${h(e.message)}).</div>`; return; }
    draw();
  }
  function close(fromPop) {
    if (!isOpen) return; isOpen = false; P.classList.remove('on');
    setTimeout(() => { if (!isOpen) P.hidden = true; }, 240);
    if (!fromPop) { const back = view !== 'all' ? 2 : 1; try { history.go(-back); } catch { /* rien */ } }
  }
  $('#apBack').onclick = () => { if (view !== 'all') { history.back(); } else close(); };
  addEventListener('popstate', () => {
    if (!isOpen) return;
    const s = history.state?.museApps;
    if (s === 'all' && view !== 'all') { view = 'all'; draw(); }
    else if (!s) close(true);
  });
  async function openGoogle() { await open(); await window.museGoogle?.check(true); view = 'google:gmail'; push(); draw(); }
  window.museApps = { open, close, count, openGoogle };
})();
