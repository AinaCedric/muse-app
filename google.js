// Connexion Google (Gmail · Agenda · Drive) depuis l'appli, avec PLUSIEURS comptes possibles.
// Toucher « + » (ou « Connecter un autre compte ») ouvre la page de connexion Google ; au retour, l'appli enregistre l'autorisation
// dans le dépôt PRIVÉ (data/google.json). Une seule étape ponctuelle : enregistrer Muse comme application dans ta console Google.
(() => {
  const FILE = 'data/google.json';
  const SCOPES = [
    'openid', 'email', 'profile',
    'https://www.googleapis.com/auth/gmail.readonly',   // lire les emails
    'https://www.googleapis.com/auth/gmail.compose',    // brouillons + envoi (après confirmation dans le chat)
    'https://www.googleapis.com/auth/calendar.events',  // lire / créer / modifier des événements
    'https://www.googleapis.com/auth/drive.readonly',   // lire Drive (jamais écrire)
  ];
  const NEED = SCOPES.filter((s) => s.startsWith('https://'));
  const K_CFG = 'muse_gcfg', K_AUTH = 'muse_gauth';
  const ls = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* stockage indisponible */ } };
  const redirect = () => location.origin + location.pathname.replace(/index\.html$/, '');
  const rnd = (n = 24) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');
  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // S.file = { client_id, client_secret, accounts: [{ email, name, picture, refresh_token, at }], default }
  const S = { state: 'unknown', sha: null, file: null, st: {}, at: 0, busy: false };
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => { try { f(); } catch { /* écouteur en erreur */ } });

  const tokenCall = async (params) => {
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
    const j = await r.json().catch(() => ({})); return { ok: r.ok, j };
  };
  // Ancien format (un seul compte) → nouveau format
  const norm = (f) => {
    if (!f) return null;
    if (!Array.isArray(f.accounts)) f.accounts = f.refresh_token ? [{ email: f.email || '', refresh_token: f.refresh_token, at: f.at || '' }] : [];
    delete f.refresh_token; delete f.email;
    if (!f.default || !f.accounts.some((a) => a.email === f.default)) f.default = f.accounts[0]?.email || '';
    return f;
  };
  const accounts = () => (S.file?.accounts || []).map((a) => ({ ...a, state: S.st[a.email] || 'unknown' }));
  const overall = () => { const l = accounts(); if (!l.length) return 'none'; if (l.some((a) => a.state === 'ok')) return 'ok'; if (l.some((a) => a.state === 'expired')) return 'expired'; return 'unknown'; };

  // ---------- État : lit data/google.json, puis vérifie que Google accepte encore chaque jeton
  async function check(force) {
    if (!cfg.repo || !cfg.token) return S;
    if (S.busy || (!force && S.at && Date.now() - S.at < 5 * 60 * 1000)) return S;
    S.busy = true;
    try {
      let f;
      try { f = await gh(`/repos/${cfg.repo}/contents/${FILE}`); } catch (e) { if (e.status === 404) { Object.assign(S, { state: 'none', sha: null, file: null, st: {}, at: Date.now() }); return S; } throw e; }
      S.sha = f.sha; S.file = norm(JSON.parse(b64d(f.content)));
      if (S.file.client_id && !ls(K_CFG)) lsSet(K_CFG, JSON.stringify({ id: S.file.client_id, secret: S.file.client_secret }));
      await Promise.all(S.file.accounts.map(async (a) => {
        try {
          const t = await tokenCall({ client_id: S.file.client_id, client_secret: S.file.client_secret, refresh_token: a.refresh_token, grant_type: 'refresh_token' });
          S.st[a.email] = t.ok ? 'ok' : /invalid_grant/.test(t.j.error || '') ? 'expired' : 'unknown';
        } catch { S.st[a.email] = 'ok'; }   // pas de réseau / navigateur qui bloque la vérification : on garde l'état enregistré
      }));
      S.state = overall();
    } catch { /* GitHub injoignable : on garde l'état précédent */ }
    finally { S.busy = false; S.at = Date.now(); emit(); }
    return S;
  }
  async function saveFile(msg) {
    const f = S.file;
    if (!f || !f.accounts.length) {
      if (S.sha) await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'DELETE', body: JSON.stringify({ message: msg, sha: S.sha }) });
      S.sha = null; S.file = f && f.accounts.length ? f : null; return;
    }
    const r = await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify({ message: msg, content: b64e(JSON.stringify(f, null, 2)), ...(S.sha ? { sha: S.sha } : {}) }) });
    S.sha = r.content?.sha || S.sha;
  }

  // ---------- Écran d'aide (une seule fois) + départ vers Google
  const dlg = document.createElement('dialog'); dlg.id = 'ggDlg';
  dlg.innerHTML = `<h3>Connecter Google</h3>
    <p class="hint">Une seule fois : Google demande que Muse soit enregistrée comme application. Ensuite, chaque compte se connecte en un toucher.</p>
    <ol class="ggSteps">
      <li>Ouvre <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">console.cloud.google.com → Identifiants</a> → <b>Créer des identifiants → ID client OAuth → Application Web</b>.</li>
      <li>Dans « URI de redirection autorisés », ajoute exactement : <button type="button" class="ggCopy" id="ggUri"></button></li>
      <li>Active les API <b>Gmail</b>, <b>Google Agenda</b> et <b>Drive</b> (Bibliothèque), et <b>publie</b> l'écran de consentement (sinon la connexion expire après 7 jours).</li>
      <li>Une fois l'ID créé, touche <b>Télécharger le JSON</b> puis importe-le ici :</li>
    </ol>
    <button type="button" class="ghost ggImp" id="ggImp">📄 Importer le fichier JSON</button>
    <input type="file" id="ggFile" accept=".json,application/json" hidden>
    <details class="ggMan"><summary>ou coller l'ID et le secret à la main</summary>
      <input id="ggId" placeholder="ID client (…googleusercontent.com)" autocomplete="off" autocapitalize="off" spellcheck="false">
      <input id="ggSecret" type="password" placeholder="Code secret client (GOCSPX-…)" autocomplete="off" autocapitalize="off" spellcheck="false">
    </details>
    <div id="ggMsg" class="hint"></div>
    <div class="row"><button class="ghost" id="ggCancel" type="button">Annuler</button><button class="btn" id="ggGo" type="button">Continuer vers Google</button></div>`;
  document.body.appendChild(dlg);
  const $d = (s) => dlg.querySelector(s);
  $d('#ggUri').textContent = redirect();
  $d('#ggUri').onclick = () => { try { navigator.clipboard.writeText(redirect()); toast('Adresse copiée'); } catch { /* rien */ } };
  $d('#ggCancel').onclick = () => dlg.close();
  $d('#ggImp').onclick = () => $d('#ggFile').click();
  $d('#ggFile').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.installed && !j.web) { $d('#ggMsg').textContent = 'Ce fichier est de type « Application de bureau » : crée un ID client de type Application Web.'; return; }
      const w = j.web; if (!w?.client_id || !w?.client_secret) throw new Error('fichier inattendu');
      $d('#ggId').value = w.client_id; $d('#ggSecret').value = w.client_secret; $d('.ggMan').open = true;
      const uris = w.redirect_uris || [];
      $d('#ggMsg').textContent = uris.includes(redirect()) ? 'Fichier lu ✓ : touche « Continuer vers Google ».' : `Fichier lu, mais l'adresse ${redirect()} n'est pas dans ses redirections : ajoute-la dans la console Google (étape 2), puis continue.`;
    } catch { $d('#ggMsg').textContent = 'Ce fichier n\'est pas le JSON d\'un ID client Google.'; }
  };
  $d('#ggGo').onclick = async () => {
    const id = $d('#ggId').value.trim(), secret = $d('#ggSecret').value.trim();
    if (!/\.apps\.googleusercontent\.com$/.test(id)) { $d('#ggMsg').textContent = 'Importe le fichier JSON, ou colle l\'ID client (il se termine par .apps.googleusercontent.com).'; return; }
    if (secret.length < 10) { $d('#ggMsg').textContent = 'Colle aussi le code secret client.'; return; }
    lsSet(K_CFG, JSON.stringify({ id, secret })); dlg.close();
    await (async () => { try { let sha; try { sha = (await gh(`/repos/${cfg.repo}/contents/data/google-client.json`)).sha; } catch { /* nouveau */ }
      await gh(`/repos/${cfg.repo}/contents/data/google-client.json`, { method: 'PUT', body: JSON.stringify({ message: '🔑 Nouvel ID client Google', content: b64e(JSON.stringify({ client_id: id, client_secret: secret, from: 'appli' }, null, 2)), ...(sha ? { sha } : {}) }) }); } catch { /* facultatif */ } })();
    go(null, { id, secret });
  };

  async function go(hint, c) {
    if (!c) { try { c = JSON.parse(ls(K_CFG) || 'null'); } catch { /* rien */ } }
    if (!c?.id || !c?.secret) return;
    const state = rnd(16), verifier = rnd(32);
    const challenge = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    lsSet(K_AUTH, JSON.stringify({ state, verifier, at: Date.now() }));
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: c.id, redirect_uri: redirect(), response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account',
      include_granted_scopes: 'true', state, code_challenge: challenge, code_challenge_method: 'S256', ...(hint ? { login_hint: hint } : {}),
    });
  }
  // ID client Google : mémorisé ici, ou dans le dépôt privé (data/google.json · data/google-client.json)
  async function getClient() {
    try { const c = JSON.parse(ls(K_CFG) || 'null'); if (c?.id && c?.secret) return c; } catch { /* rien */ }
    for (const f of ['data/google.json', 'data/google-client.json']) {
      try { const j = JSON.parse(b64d((await gh(`/repos/${cfg.repo}/contents/${f}`)).content)); if (j.client_id && j.client_secret) { const c = { id: j.client_id, secret: j.client_secret }; lsSet(K_CFG, JSON.stringify(c)); return c; } } catch { /* absent */ }
    }
    return null;
  }
  // Première fois sur cet appareil : on demande au cerveau l'ID client déjà enregistré (secret MUSE_GOOGLE), sans rien afficher d'autre qu'une attente
  const wait = document.createElement('div'); wait.className = 'ggWait'; wait.hidden = true;
  wait.innerHTML = '<div><span class="mspin"></span><b>Connexion à Google…</b><small>Préparation (une seule fois, ~30 s)</small></div>';
  document.body.appendChild(wait);
  async function prepare() {
    wait.hidden = false;
    try {
      const iss = await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: '⚙️ Muse — préparation Google', body: '<!--muse-setup-->' }) });
      gh(`/repos/${cfg.repo}/issues/${iss.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }) }).catch(() => {});
      await gh(`/repos/${cfg.repo}/issues/${iss.number}/comments`, { method: 'POST', body: JSON.stringify({ body: '<!--muse-setup:google-->' }) });
      const t0 = Date.now();
      while (Date.now() - t0 < 150000) {
        await new Promise((r) => setTimeout(r, 3000));
        try { const j = JSON.parse(b64d((await gh(`/repos/${cfg.repo}/contents/data/google-client.json`)).content)); if (j.client_id && j.client_secret) { const c = { id: j.client_id, secret: j.client_secret }; lsSet(K_CFG, JSON.stringify(c)); return c; } } catch { /* pas encore */ }
        try { const cs = await gh(`/repos/${cfg.repo}/issues/${iss.number}/comments?per_page=10`); if (cs.some((x) => /<!--muse-setup:(none|error)-->/.test(x.body))) return null; } catch { /* réseau */ }
      }
      return null;
    } catch { return null; } finally { wait.hidden = true; }
  }
  // « + » / « Connecter un autre compte » / « Reconnecter » : DIRECT vers l'écran de Google
  let connecting = false;
  async function connect(hint) {
    if (!cfg.repo || !cfg.token) { openCfg(); return; }
    if (connecting) return; connecting = true;
    try {
      const c = (await getClient()) || (await prepare());
      if (c) { go(hint, c); return; }
      $d('#ggMsg').textContent = ''; dlg.showModal();   // seulement si aucun ID client Google n'a jamais été enregistré
    } finally { setTimeout(() => { connecting = false; }, 1500); }
  }
  function reset() { lsSet(K_CFG, null); $d('#ggMsg').textContent = ''; dlg.showModal(); }

  async function disconnect(email) {
    try {
      const a = S.file?.accounts.find((x) => x.email === email); if (!a) return;
      fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(a.refresh_token), { method: 'POST', mode: 'no-cors' }).catch(() => {});
      S.file.accounts = S.file.accounts.filter((x) => x.email !== email); delete S.st[email];
      if (S.file.default === email) S.file.default = S.file.accounts[0]?.email || '';
      await saveFile(`🔌 ${email} déconnecté`);
      S.state = overall(); S.at = Date.now(); emit(); toast(`${email} déconnecté`);
    } catch (e) { toast('Déconnexion impossible : ' + e.message); S.at = 0; check(true); }
  }
  async function setDefault(email) {
    try { S.file.default = email; await saveFile(`⭐ Compte par défaut : ${email}`); emit(); toast(`${email} est le compte par défaut`); }
    catch (e) { toast('Impossible : ' + e.message); }
  }

  // ---------- Retour de Google : ?code=…&state=… dans l'adresse de l'appli
  async function handleReturn() {
    const q = new URLSearchParams(location.search);
    if (!q.has('state') || !(q.has('code') || q.has('error'))) return;
    let a = null; try { a = JSON.parse(ls(K_AUTH) || 'null'); } catch { /* rien */ }
    const clean = () => { try { history.replaceState({}, '', location.pathname); } catch { /* rien */ } };
    if (!a || a.state !== q.get('state')) return;          // ce n'est pas notre demande : on n'y touche pas
    lsSet(K_AUTH, null); clean();
    const note = (t) => { try { toast(t); } catch { alert(t); } };
    if (q.get('error')) { note(q.get('error') === 'access_denied' ? 'Connexion annulée.' : 'Google a refusé : ' + q.get('error')); return; }
    if (!cfg.repo || !cfg.token) { note('Configure d’abord le dépôt dans Réglages.'); return; }
    let c = null; try { c = JSON.parse(ls(K_CFG) || 'null'); } catch { /* rien */ }
    try {
      note('Connexion à Google en cours…');
      const t = await tokenCall({ code: q.get('code'), client_id: c.id, client_secret: c.secret, redirect_uri: redirect(), grant_type: 'authorization_code', code_verifier: a.verifier });
      if (!t.ok) throw new Error(t.j.error_description || t.j.error || 'échange refusé');
      if (!t.j.refresh_token) throw new Error('Google n’a pas donné d’accès durable. Retire « Muse » sur myaccount.google.com/permissions puis recommence.');
      const granted = String(t.j.scope || '').split(' ');
      if (NEED.some((s) => !granted.includes(s))) throw new Error('Il manque des autorisations : à l’écran Google, laisse TOUTES les cases cochées.');
      let idt = {}; try { idt = JSON.parse(atob(t.j.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { /* sans profil */ }
      const email = idt.email || ('compte-' + rnd(3));
      // On relit le fichier actuel pour ajouter ce compte aux autres
      let sha = null, file = null;
      try { const f = await gh(`/repos/${cfg.repo}/contents/${FILE}`); sha = f.sha; file = norm(JSON.parse(b64d(f.content))); } catch { /* premier compte */ }
      file = file || { accounts: [], default: '' };
      file.client_id = c.id; file.client_secret = c.secret;
      const acc = { email, name: idt.name || '', picture: idt.picture || '', refresh_token: t.j.refresh_token, at: new Date().toISOString() };
      const i = file.accounts.findIndex((x) => x.email === email);
      if (i >= 0) file.accounts[i] = acc; else file.accounts.push(acc);
      if (!file.default) file.default = email;
      S.file = file; S.sha = sha; await saveFile(`🔗 Google connecté : ${email}`);
      S.st[email] = 'ok'; S.state = overall(); S.at = Date.now(); emit();
      note(`${email} connecté ✓`);
      setTimeout(() => window.museApps?.openGoogle?.(), 400);
    } catch (e) { note('Connexion Google impossible : ' + e.message); }
  }

  // ---------- Auto-réparation : bannière « Google à reconnecter » dès l'ouverture de l'appli
  // En mode « Test », Google coupe la connexion après 7 jours : on prévient dès qu'elle est expirée, ET dès le 6e jour pour renouveler avant la coupure.
  // Un seul toucher suffit (Google ouvre directement le compte) : l'autorisation elle-même ne peut pas être donnée à ta place.
  const K_SNZ = 'muse_gsnooze';
  const needFix = () => {
    const l = accounts();
    const exp = l.find((a) => a.state === 'expired'); if (exp) return { email: exp.email, why: 'expired' };
    const old = l.find((a) => a.state === 'ok' && a.at && Date.now() - Date.parse(a.at) > 6 * 864e5); if (old) return { email: old.email, why: 'soon' };
    return null;
  };
  const bar = document.createElement('div'); bar.id = 'ggFix'; bar.style.display = 'none';
  bar.style.cssText = 'position:fixed;left:12px;right:12px;top:max(12px,env(safe-area-inset-top));z-index:99999;gap:10px;align-items:center;padding:10px 12px;border-radius:14px;background:#1f2430;color:#fff;box-shadow:0 8px 30px rgba(0,0,0,.45);font:14px system-ui,sans-serif';
  bar.innerHTML = '<span id="ggFixT" style="flex:1"></span><button type="button" id="ggFixLater" style="background:none;border:0;color:#aab;padding:6px">Plus tard</button><button type="button" id="ggFixGo" style="background:#7c5cff;border:0;color:#fff;border-radius:10px;padding:8px 14px;font-weight:600">Reconnecter</button>';
  document.body.appendChild(bar);
  let fixFor = null;
  const refreshBar = () => {
    const n = needFix(), snz = Number(ls(K_SNZ) || 0);
    if (!n || Date.now() < snz) { bar.style.display = 'none'; return; }
    fixFor = n.email;
    bar.querySelector('#ggFixT').textContent = n.why === 'expired' ? '🔑 Gmail et Agenda sont coupés : Google demande de te reconnecter.' : '🔑 Ta connexion Google expire bientôt : renouvelle-la en un toucher.';
    bar.style.display = 'flex';
  };
  bar.querySelector('#ggFixGo').onclick = () => { bar.style.display = 'none'; connect(fixFor); };
  bar.querySelector('#ggFixLater').onclick = () => { lsSet(K_SNZ, String(Date.now() + 6 * 36e5)); bar.style.display = 'none'; };
  listeners.add(refreshBar);
  const autoCheck = () => { if (!location.search.includes('state=')) check(false).then(refreshBar); };
  setTimeout(autoCheck, 2500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) autoCheck(); });
  setInterval(autoCheck, 30 * 60 * 1000);

  window.museGoogle = {
    get state() { return S.state; }, get email() { return S.file?.default || ''; }, get accounts() { return accounts(); }, get default() { return S.file?.default || ''; },
    check, connect, reset, disconnect, setDefault, onChange: (f) => listeners.add(f), redirect,
  };
  // Dès que l'appli est prête (app.js a défini cfg, gh…), on traite un éventuel retour de Google
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(handleReturn, 0)); else setTimeout(handleReturn, 0);
})();
