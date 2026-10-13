// Connexion Google (Gmail · Agenda · Drive) depuis l'appli : le « + » d'une appli Google ouvre la page de connexion Google,
// puis l'appli enregistre l'autorisation dans le dépôt PRIVÉ (data/google.json). Plus aucun terminal.
// Une seule étape ponctuelle : créer un ID client « Application Web » dans la console Google (l'écran d'aide l'explique).
(() => {
  const FILE = 'data/google.json';
  const SCOPES = [
    'openid', 'email',
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
  const S = { state: 'unknown', email: '', sha: null, at: 0, file: null, busy: false };
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => { try { f(); } catch { /* écouteur en erreur */ } });

  const tokenCall = async (params) => {
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
    const j = await r.json().catch(() => ({})); return { ok: r.ok, j };
  };

  // ---------- État : lit data/google.json, puis vérifie que Google accepte encore le jeton
  async function check(force) {
    if (!cfg.repo || !cfg.token) return S;
    if (S.busy || (!force && S.at && Date.now() - S.at < 5 * 60 * 1000)) return S;
    S.busy = true;
    try {
      let f;
      try { f = await gh(`/repos/${cfg.repo}/contents/${FILE}`); } catch (e) { if (e.status === 404) { Object.assign(S, { state: 'none', email: '', sha: null, file: null, at: Date.now() }); return S; } throw e; }
      S.sha = f.sha; S.file = JSON.parse(b64d(f.content)); S.email = S.file.email || '';
      if (S.file.client_id && !ls(K_CFG)) lsSet(K_CFG, JSON.stringify({ id: S.file.client_id, secret: S.file.client_secret }));
      try {
        const t = await tokenCall({ client_id: S.file.client_id, client_secret: S.file.client_secret, refresh_token: S.file.refresh_token, grant_type: 'refresh_token' });
        S.state = t.ok ? 'ok' : /invalid_grant/.test(t.j.error || '') ? 'expired' : 'unknown';
      } catch { S.state = 'ok'; }    // pas de réseau / navigateur qui bloque la vérification : on garde l'état enregistré
    } catch { if (S.state === 'unknown') S.state = 'unknown'; }
    finally { S.busy = false; S.at = Date.now(); emit(); }
    return S;
  }

  // ---------- Écran d'aide (une seule fois) + départ vers Google
  const dlg = document.createElement('dialog'); dlg.id = 'ggDlg';
  dlg.innerHTML = `<h3>Connecter Google</h3>
    <p class="hint">Une seule fois : Google demande que Muse soit enregistrée comme application. Ensuite, chaque connexion = un seul toucher.</p>
    <ol class="ggSteps">
      <li>Ouvre <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">console.cloud.google.com → Identifiants</a> → <b>Créer des identifiants → ID client OAuth → Application Web</b>.</li>
      <li>Dans « URI de redirection autorisés », ajoute exactement : <button type="button" class="ggCopy" id="ggUri"></button></li>
      <li>Vérifie que les API <b>Gmail</b>, <b>Google Agenda</b> et <b>Drive</b> sont activées (Bibliothèque), et que l'écran de consentement est <b>publié</b> (sinon la connexion expire après 7 jours).</li>
      <li>Colle ici l'<b>ID client</b> et le <b>code secret client</b> :</li>
    </ol>
    <input id="ggId" placeholder="ID client (…googleusercontent.com)" autocomplete="off" autocapitalize="off" spellcheck="false">
    <input id="ggSecret" type="password" placeholder="Code secret client  (GOCSPX-…)" autocomplete="off" autocapitalize="off" spellcheck="false">
    <div id="ggMsg" class="hint"></div>
    <div class="row"><button class="ghost" id="ggCancel" type="button">Annuler</button><button class="btn" id="ggGo" type="button">Continuer vers Google</button></div>`;
  document.body.appendChild(dlg);
  const $d = (s) => dlg.querySelector(s);
  $d('#ggUri').textContent = redirect();
  $d('#ggUri').onclick = () => { try { navigator.clipboard.writeText(redirect()); toast('Adresse copiée'); } catch { /* rien */ } };
  $d('#ggCancel').onclick = () => dlg.close();
  $d('#ggGo').onclick = () => {
    const id = $d('#ggId').value.trim(), secret = $d('#ggSecret').value.trim();
    if (!/\.apps\.googleusercontent\.com$/.test(id)) { $d('#ggMsg').textContent = 'L’ID client se termine par .apps.googleusercontent.com'; return; }
    if (secret.length < 10) { $d('#ggMsg').textContent = 'Colle aussi le code secret client.'; return; }
    lsSet(K_CFG, JSON.stringify({ id, secret })); dlg.close(); go();
  };

  async function go() {
    let c = null; try { c = JSON.parse(ls(K_CFG) || 'null'); } catch { /* rien */ }
    if (!c?.id || !c?.secret) return;
    const state = rnd(16), verifier = rnd(32);
    const challenge = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    lsSet(K_AUTH, JSON.stringify({ state, verifier, at: Date.now() }));
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: c.id, redirect_uri: redirect(), response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account',
      include_granted_scopes: 'true', state, code_challenge: challenge, code_challenge_method: 'S256',
    });
    location.href = url;
  }
  function connect() {
    if (!cfg.repo || !cfg.token) { openCfg(); return; }
    let c = null; try { c = JSON.parse(ls(K_CFG) || 'null'); } catch { /* rien */ }
    if (c?.id && c?.secret) { toast('Ouverture de la connexion Google…'); go(); return; }
    $d('#ggMsg').textContent = ''; dlg.showModal();
  }
  // Changer d'ID client / de secret (ex. nouvelle application Google)
  function reset() { lsSet(K_CFG, null); connect(); }

  async function disconnect() {
    try {
      if (S.file?.refresh_token) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(S.file.refresh_token), { method: 'POST', mode: 'no-cors' }).catch(() => {});
      if (S.sha) await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'DELETE', body: JSON.stringify({ message: '🔌 Google déconnecté', sha: S.sha }) });
      Object.assign(S, { state: 'none', email: '', sha: null, file: null, at: Date.now() }); emit(); toast('Google déconnecté');
    } catch (e) { toast('Déconnexion impossible : ' + e.message); }
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
      const miss = NEED.filter((s) => !granted.includes(s));
      if (miss.length) throw new Error('Il manque des autorisations : à l’écran Google, laisse TOUTES les cases cochées.');
      let email = ''; try { email = JSON.parse(atob(t.j.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email || ''; } catch { /* sans e-mail */ }
      let sha; try { sha = (await gh(`/repos/${cfg.repo}/contents/${FILE}`)).sha; } catch { /* nouveau fichier */ }
      const body = { client_id: c.id, client_secret: c.secret, refresh_token: t.j.refresh_token, email, at: new Date().toISOString() };
      const r = await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify({ message: '🔗 Google connecté', content: b64e(JSON.stringify(body, null, 2)), ...(sha ? { sha } : {}) }) });
      Object.assign(S, { state: 'ok', email, sha: r.content?.sha || null, file: body, at: Date.now() }); emit();
      note(`Google connecté${email ? ' : ' + email : ''} ✓`);
      setTimeout(() => window.museApps?.open(), 400);
    } catch (e) { note('Connexion Google impossible : ' + e.message); }
  }

  window.museGoogle = { get state() { return S.state; }, get email() { return S.email; }, check, connect, reset, disconnect, onChange: (f) => listeners.add(f), redirect };
  // Dès que l'appli est prête (app.js a défini cfg, gh…), on traite un éventuel retour de Google
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(handleReturn, 0)); else setTimeout(handleReturn, 0);
})();
