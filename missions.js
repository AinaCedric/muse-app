// 🔁 Onglet « Missions » : des objectifs récurrents que Muse exécute seule, en tâche de fond (« chaque matin à 8 h, surveille mes mails »).
// Définitions : data/missions.json (écrites ici) · état et derniers rapports : data/missions-state.json (écrit par le cerveau).
// Chaque mission a sa discussion « 🔁 nom » : un rapport par passage, et une notification sur le téléphone.
(() => {
  const FILE = 'data/missions.json', SFILE = 'data/missions-state.json', TZ = 3;   // Antananarivo = UTC+3
  const MODES = [['polyvalent', 'Recherche web et réflexion'], ['perso', 'Agenda et e-mails (Google)'], ['ordi', 'Agent (ordinateur virtuel)'], ['phone', 'Téléphone'], ['dev', 'Dev / Odoo']];
  const KINDS = [['daily', 'Tous les jours'], ['weekdays', 'Du lundi au vendredi'], ['hours', 'Toutes les N heures'], ['once', 'Une seule fois']];
  const IDEAS = [
    ['☀️ Mails du matin', 'Chaque matin, regarde mes e-mails reçus depuis hier : liste les importants (clients, factures, rendez-vous), prépare un brouillon de réponse pour ceux qui en demandent une, et ignore les newsletters.', 'perso', 'weekdays', '08:00'],
    ['📅 Agenda de la semaine', 'Chaque lundi matin, regarde mon agenda de la semaine, repère les conflits ou les trous, et dis-moi ce qui demande de la préparation.', 'perso', 'daily', '07:30'],
    ['🎬 Veille GYOO', 'Chaque jour, cherche sur le web les nouveautés (films, séries, animes, K-dramas, jeux) qui peuvent intéresser mon public malgache, et propose 3 idées de contenus.', 'polyvalent', 'daily', '09:00'],
  ];
  let st = { items: [], sha: null, state: {}, loaded: false };
  const view = $('#autos'), mainEl = $('main'), btn = $('#missBtn');
  const q = (s) => esc(String(s == null ? '' : s)).replace(/"/g, '&quot;');
  const rid = () => 'm' + Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, '0')).join('');
  const modeLabel = (v) => (MODES.find((m) => m[0] === v) || [v, v])[1];

  async function readFile(file) {
    try { const f = await gh(`/repos/${cfg.repo}/contents/${file}`); return { sha: f.sha, data: JSON.parse(b64d(f.content)) }; }
    catch (e) { if (e.status === 404) return { sha: null, data: null }; throw e; }
  }
  async function load() {
    const [d, s] = await Promise.all([readFile(FILE), readFile(SFILE).catch(() => ({ data: null }))]);
    st.sha = d.sha; st.items = Array.isArray(d.data?.items) ? d.data.items : []; st.state = s.data?.items || {}; st.loaded = true;
  }
  async function save(msg) {
    const body = { message: msg, content: b64e(JSON.stringify({ version: 1, items: st.items }, null, 2)), ...(st.sha ? { sha: st.sha } : {}) };
    try { st.sha = (await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify(body) })).content.sha; }
    catch (e) { if (e.status === 409 || e.status === 422) { await load().catch(() => {}); render(); throw new Error('Les missions ont changé entre-temps : la liste est rechargée, refais ta modification.'); } throw e; }
  }

  // ---- Planning (même logique que le cerveau)
  const hhmm = (m) => String((m.schedule || {}).time || '08:00');
  function nextRun(m) {
    if (!m.enabled) return null;
    const s = m.schedule || {}, now = Date.now(), T = (x) => (x ? Date.parse(x) || 0 : 0), last = T((st.state[m.id] || {}).lastRun) || T(m.created) || now;
    if (s.kind === 'once') return (st.state[m.id] || {}).lastRun ? null : T(s.at) || null;
    if (s.kind === 'hours') {
      let t = Math.max(now, last + Math.max(1, Number(s.every) || 6) * 3600e3);
      if (m.active) { const from = Number(m.active.from ?? 7), to = Number(m.active.to ?? 21); for (let i = 0; i < 30; i++) { const h = new Date(t + TZ * 3600e3).getUTCHours(); if (from < to ? (h >= from && h < to) : (h >= from || h < to)) break; t += 15 * 60e3; } }
      return t;
    }
    const [h, mi] = hhmm(m).split(':').map((x) => parseInt(x, 10) || 0), loc = new Date(now + TZ * 3600e3);
    for (let i = 0; i < 9; i++) {
      const d = new Date(Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate() + i, h, mi)), dow = d.getUTCDay(), t = d.getTime() - TZ * 3600e3;
      if (s.kind === 'weekdays' && (dow === 0 || dow === 6)) continue;
      if (t > now || (t > last && now - t < 18 * 3600e3)) return Math.max(t, now);
    }
    return null;
  }
  const rel = (t) => {
    const d = t - Date.now(), a = Math.abs(d), m = Math.round(a / 60000);
    const txt = m < 1 ? 'à l’instant' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} j`;
    return m < 1 ? txt : d > 0 ? `dans ${txt}` : `il y a ${txt}`;
  };
  const dayHour = (t) => new Date(t).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function when(m) {
    const s = m.schedule || {};
    if (s.kind === 'daily') return `Tous les jours à ${hhmm(m)}`;
    if (s.kind === 'weekdays') return `Du lundi au vendredi à ${hhmm(m)}`;
    if (s.kind === 'hours') return `Toutes les ${Math.max(1, Number(s.every) || 6)} h`;
    if (s.kind === 'once') return `Une fois, le ${s.at ? dayHour(Date.parse(s.at)) : '…'}`;
    return '';
  }

  // ---- 🔭 Veille proactive : une mission spéciale (id « veille »), silencieuse tant que rien d'important ne se passe
  const WID = 'veille';
  const watchOf = () => st.items.find((m) => m.id === WID && m.watch) || null;
  const hrOpts = (list, cur, suf) => list.map((h) => `<option value="${h}"${Number(cur) === h ? ' selected' : ''}>${h}${suf}</option>`).join('');
  function watchCard() {
    const w = watchOf(), on = !!(w && w.enabled), s = (w && st.state[w.id]) || {}, nx = w && on ? nextRun(w) : null;
    const every = (w && w.schedule && w.schedule.every) || 2, from = (w && w.active && w.active.from) ?? 7, to = (w && w.active && w.active.to) ?? 21;
    const phone = !!(w && w.mode === 'prive');
    const alerted = s.last && !/^RAS/.test(s.last);
    const last = s.lastRun ? `${s.status === 'running' ? '⏳ Vérification en cours' : s.status === 'error' ? '⚠️ Échec' : alerted ? '🔔 A signalé' : '✅ Rien d’important'} · ${rel(Date.parse(s.lastRun))}` : 'Pas encore de vérification';
    return `<article class="acard watch${on ? '' : ' off'}" id="watchCard">
      <div class="ahead"><div class="atitle"><span class="abolt">${ic('search')}</span><b>Veille proactive</b></div>
        <label class="sw" title="${on ? 'Active' : 'Désactivée'}"><input type="checkbox" id="wOn" ${on ? 'checked' : ''}><span></span></label></div>
      <p class="asum">Muse surveille <b>tes mails, ton agenda${phone ? ' et les notifications du téléphone' : ''}</b> et ne te prévient que si quelque chose compte (mail important, conflit d’agenda, rendez-vous qui approche…). Si tout est calme : silence total.</p>
      <p class="asum" style="margin-top:6px">${esc(last)}${on && nx ? ` · prochaine : <b>${esc(rel(nx))}</b>` : ''}${alerted ? ` — <span style="color:var(--mut)">${esc(s.last.slice(0, 140))}</span>` : ''}</p>
      <div class="wrow" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px">
        <label style="display:flex;gap:6px;align-items:center">Toutes les <select id="wEvery">${hrOpts([1, 2, 3, 4, 6], every, ' h')}</select></label>
        <label style="display:flex;gap:6px;align-items:center">de <select id="wFrom">${hrOpts([5, 6, 7, 8, 9, 10], from, ' h')}</select> à <select id="wTo">${hrOpts([18, 19, 20, 21, 22, 23], to, ' h')}</select></label>
      </div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="wPhone" ${phone ? 'checked' : ''}> Surveiller aussi les notifications du téléphone</label>
      <input id="wFocus" maxlength="200" placeholder="À surveiller en priorité (optionnel) : clients Odoo, mails de Mr Patrick, factures…" value="${q((w && w.focus) || '')}" autocomplete="off" style="width:100%;margin-top:10px">
      <div class="aact"><button class="ghost" id="wSave" type="button">Enregistrer</button><button class="ghost" id="wNow" type="button">🔭 Vérifier maintenant</button><button class="ghost" id="wHist" type="button">Alertes</button></div>
    </article>`;
  }
  // La discussion unique de la veille : créée une fois, épinglée, toujours la même
  async function ensureWatchIssue(w) {
    let n = w.issue || (st.state[w.id] || {}).issue;
    if (n) return n;
    n = (await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: '🔭 Veille proactive', body: `<!--mission:${w.id}-->\nTes alertes de veille proactive, au même endroit. Réponds ici pour agir : « 1 prépare la réponse », « ignore 2 », « décale ce rendez-vous »…` }) })).number;
    w.issue = n; try { await addLabel(n, L_PIN, 'a78bfa'); } catch { /* épinglage facultatif */ }
    return n;
  }
  async function watchSave(on) {
    const g = (id) => view.querySelector(id), now = new Date().toISOString();
    const item = { id: WID, name: 'Veille proactive', goal: 'Veille proactive : surveille mes mails, mon agenda et mes notifications, et préviens-moi seulement si c’est important.', watch: true,
      mode: g('#wPhone').checked ? 'prive' : 'perso', schedule: { kind: 'hours', every: +g('#wEvery').value || 2 }, active: { from: +g('#wFrom').value, to: +g('#wTo').value }, focus: g('#wFocus').value.trim(), enabled: on };
    const old = watchOf(), before = st.items.slice();
    if (old) Object.assign(old, item, { created: old.created }); else st.items.push({ ...item, created: now });
    try { if (on) await ensureWatchIssue(watchOf()); await save(`Veille proactive ${on ? 'activée' : 'désactivée'}`); toast(on ? 'Veille activée : tes alertes arriveront dans la discussion « Veille proactive »' : 'Veille désactivée'); render(); if (on) loadList(); }
    catch (e) { st.items = before; toast('' + e.message); render(); }
  }
  async function watchNow() {
    const w = watchOf(); if (!w) { toast('Active d’abord la veille.'); return; }
    try {
      const had = w.issue || (st.state[w.id] || {}).issue, n = await ensureWatchIssue(w); if (!had) await save('Veille : discussion').catch(() => {});
      await gh(`/repos/${cfg.repo}/issues/${n}/comments`, { method: 'POST', body: JSON.stringify({ body: `🔭 **Veille proactive** — vérification lancée à la main. Regarde mes mails, mon agenda${w.mode === 'prive' ? ' et mes notifications' : ''} et dis-moi ce qui compte.${w.focus ? `\n\nÀ surveiller en priorité : ${w.focus}` : ''}\n\n<!--mode:${w.mode || 'perso'}--><!--mission:${w.id}--><!--watch-now-->` }) });
      close(); await openConv(n); toast('Vérification lancée');
    } catch (e) { toast('' + e.message); }
  }
  function bindWatch() {
    const g = (id) => view.querySelector(id); if (!g('#wOn')) return;
    g('#wOn').onchange = (e) => { e.target.checked ? watchSave(true) : (watchOf() ? watchSave(false) : null); };
    g('#wSave').onclick = () => watchSave(!!(watchOf() && watchOf().enabled) || g('#wOn').checked);
    g('#wNow').onclick = watchNow;
    g('#wHist').onclick = () => { const w = watchOf(), n = w && (w.issue || (st.state[w.id] || {}).issue); n ? (close(), openConv(n)) : toast('Aucune alerte pour l’instant.'); };
  }

  function render() {
    const cards = st.items.filter((m) => !m.watch).map((m) => {
      const s = st.state[m.id] || {}, nx = nextRun(m);
      const last = s.lastRun ? `${s.status === 'running' ? '⏳ En cours' : s.status === 'error' ? '⚠️ Échec' : '✅ Fait'} · ${rel(Date.parse(s.lastRun))}` : 'Pas encore lancée';
      return `<article class="acard${m.enabled ? '' : ' off'}" data-id="${q(m.id)}">
        <div class="ahead"><div class="atitle"><span class="abolt">${ic('repeat')}</span><b>${esc(m.name || 'Sans nom')}</b></div>
          <label class="sw" title="${m.enabled ? 'Active' : 'En pause'}"><input type="checkbox" class="aon" ${m.enabled ? 'checked' : ''}><span></span></label></div>
        <p class="asum">${esc(when(m))} · ${esc(modeLabel(m.mode))}${nx ? ` · prochaine : <b>${esc(rel(nx))}</b>` : ''}</p>
        <p class="ains">${esc((m.goal || '').slice(0, 220))}</p>
        <p class="asum" style="margin-top:6px">${last}${s.last ? ` — <span style="color:var(--mut)">${esc(s.last.slice(0, 160))}</span>` : ''}</p>
        <div class="aact"><button class="ghost aedit" type="button">Modifier</button><button class="ghost arun" type="button">▶ Lancer maintenant</button><button class="ghost ahist" type="button">Rapports</button><button class="ghost adel" type="button" aria-label="Supprimer">${ic('trash')}</button></div>
      </article>`;
    }).join('');
    const ideas = IDEAS.map((x, i) => `<button type="button" class="ghost midea" data-i="${i}">${esc(x[0])}</button>`).join(' ');
    view.innerHTML = `<div class="ainner">
      <div class="atop"><div><h2>Missions</h2><p class="hint">Des objectifs que Muse exécute toute seule, à heure fixe, en tâche de fond. Chaque passage laisse un rapport et te prévient sur le téléphone.</p></div>
        <button class="btn" id="missNew" type="button">${ic('plus')}<span>Nouvelle</span></button></div>
      <div class="anote">${ic('repeat')}<span>Les missions tournent sur <b>le démon de ton PC</b> (précis à la minute) ou, s’il est éteint, sur GitHub (toutes les 15 min). Elles ne font jamais d’envoi, de suppression ni de paiement : elles <b>préparent</b>, tu valides.</span></div>
      ${watchCard()}
      ${st.items.some((m) => !m.watch) ? cards : `<div class="aempty"><span class="abolt big">${ic('repeat')}</span><h3>Aucune mission</h3><p>Choisis une idée pour démarrer :</p><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px">${ideas}</div></div>`}
    </div>`;
    bindWatch();
    view.querySelector('#missNew').onclick = () => edit(null);
    view.querySelectorAll('.midea').forEach((b) => (b.onclick = () => edit(null, IDEAS[+b.dataset.i])));
    view.querySelectorAll('.acard:not(.watch)').forEach((c) => {
      const m = st.items.find((x) => x.id === c.dataset.id);
      c.querySelector('.aon').onchange = (e) => toggle(m, e.target.checked, e.target);
      c.querySelector('.aedit').onclick = () => edit(m);
      c.querySelector('.arun').onclick = () => runNow(m);
      c.querySelector('.ahist').onclick = () => { const n = m.issue || (st.state[m.id] || {}).issue; n ? (close(), openConv(n)) : toast('Pas encore de rapport.'); };
      c.querySelector('.adel').onclick = () => remove(m);
    });
  }
  const close = () => window.autosClose && autosClose();

  async function toggle(m, on, box) {
    const prev = m.enabled; m.enabled = on;
    try { await save(`Mission ${on ? 'activée' : 'mise en pause'} : ${m.name}`); toast(on ? 'Mission activée' : 'Mission en pause'); render(); }
    catch (e) { m.enabled = prev; if (box) box.checked = prev; toast('' + e.message); }
  }
  async function remove(m) {
    if (!confirm(`Supprimer la mission « ${m.name} » ?`)) return;
    const before = st.items.slice(); st.items = st.items.filter((x) => x.id !== m.id);
    try { await save(`Mission supprimée : ${m.name}`); const n = m.issue || (st.state[m.id] || {}).issue; if (n) gh(`/repos/${cfg.repo}/issues/${n}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }) }).catch(() => {}); toast('Mission supprimée'); render(); loadList(); }
    catch (e) { st.items = before; toast('' + e.message); render(); }
  }
  // ▶ Lancer maintenant : message de Cédric dans la discussion de la mission → traité comme n'importe quel message (démon ou GitHub)
  async function runNow(m) {
    try {
      let n = m.issue || (st.state[m.id] || {}).issue;
      if (!n) { n = (await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: `🔁 ${m.name}`.slice(0, 120), body: `<!--mission:${m.id}-->\nRapports de la mission « ${m.name} ».` }) })).number; m.issue = n; await save(`Mission : discussion de « ${m.name} »`).catch(() => {}); }
      const c = await gh(`/repos/${cfg.repo}/issues/${n}/comments`, { method: 'POST', body: JSON.stringify({ body: `🔁 **Mission « ${m.name} »** — lancée à la main.\n\n${m.goal}\n\n<!--mode:${m.mode || 'polyvalent'}--><!--mission:${m.id}-->` }) });
      close(); await openConv(n); toast('Mission lancée');
    } catch (e) { toast('' + e.message); }
  }

  // ---- Formulaire (créé ici : pas de HTML à ajouter)
  let dlg = document.getElementById('missDlg'), editing = null;
  function buildDlg() {
    dlg = document.createElement('dialog'); dlg.id = 'missDlg';
    dlg.innerHTML = `<h3 id="mTitle">Nouvelle mission</h3>
      <p class="hint">Décris l’objectif comme tu le dirais à quelqu’un : Muse s’en charge à l’heure choisie.</p>
      <label for="mName">Nom</label><input id="mName" maxlength="80" placeholder="Mails du matin" autocomplete="off">
      <label for="mGoal">Objectif</label><textarea id="mGoal" rows="5" style="width:100%" placeholder="Chaque matin, regarde mes e-mails importants et prépare les réponses…"></textarea>
      <label for="mMode">Ce que Muse peut utiliser</label><select id="mMode"></select>
      <h4>Quand…</h4>
      <label for="mKind">Fréquence</label><select id="mKind"></select>
      <div id="mTimeRow"><label for="mTime">Heure (Madagascar)</label><input id="mTime" type="time" value="08:00"></div>
      <div id="mEveryRow"><label for="mEvery">Toutes les combien d’heures</label><input id="mEvery" type="number" min="1" max="168" value="6"></div>
      <div id="mAtRow"><label for="mAt">Date et heure</label><input id="mAt" type="datetime-local"></div>
      <div id="mMsg" class="hint"></div>
      <div class="row"><button class="ghost" id="mCancel" type="button">Annuler</button><button class="btn" id="mSave" type="button">Enregistrer</button></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('#mMode').innerHTML = MODES.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
    dlg.querySelector('#mKind').innerHTML = KINDS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
    dlg.querySelector('#mKind').onchange = kindUi;
    dlg.querySelector('#mCancel').onclick = () => dlg.close();
    dlg.querySelector('#mSave').onclick = saveForm;
  }
  const kindUi = () => { const k = dlg.querySelector('#mKind').value; dlg.querySelector('#mTimeRow').hidden = !(k === 'daily' || k === 'weekdays'); dlg.querySelector('#mEveryRow').hidden = k !== 'hours'; dlg.querySelector('#mAtRow').hidden = k !== 'once'; };
  function edit(m, idea) {
    if (!dlg) buildDlg();
    editing = m; const s = (m && m.schedule) || {}, $d = (x) => dlg.querySelector(x);
    $d('#mTitle').textContent = m ? 'Modifier la mission' : 'Nouvelle mission';
    $d('#mName').value = m ? m.name : idea ? idea[0].replace(/^\S+\s/, '') : '';
    $d('#mGoal').value = m ? m.goal || '' : idea ? idea[1] : '';
    $d('#mMode').value = m ? m.mode || 'polyvalent' : idea ? idea[2] : 'polyvalent';
    $d('#mKind').value = m ? s.kind || 'daily' : idea ? idea[3] : 'daily';
    $d('#mTime').value = m ? s.time || '08:00' : idea ? idea[4] : '08:00';
    $d('#mEvery').value = s.every || 6;
    $d('#mAt').value = s.at ? new Date(Date.parse(s.at) - new Date().getTimezoneOffset() * -60000).toISOString().slice(0, 16) : '';
    $d('#mMsg').textContent = ''; kindUi(); dlg.showModal();
  }
  async function saveForm() {
    const $d = (x) => dlg.querySelector(x), name = $d('#mName').value.trim(), goal = $d('#mGoal').value.trim(), kind = $d('#mKind').value;
    if (!name || !goal) { $d('#mMsg').textContent = 'Donne un nom et un objectif.'; return; }
    const schedule = { kind };
    if (kind === 'daily' || kind === 'weekdays') schedule.time = $d('#mTime').value || '08:00';
    if (kind === 'hours') schedule.every = Math.max(1, Math.min(168, parseInt($d('#mEvery').value, 10) || 6));
    if (kind === 'once') { const v = $d('#mAt').value; if (!v) { $d('#mMsg').textContent = 'Choisis la date et l’heure.'; return; } schedule.at = new Date(v).toISOString(); }
    const b = $d('#mSave'); b.disabled = true;
    const data = { name, goal, mode: $d('#mMode').value, schedule };
    try {
      if (editing) {
        Object.assign(editing, data);
        const n = editing.issue || (st.state[editing.id] || {}).issue;
        if (n) gh(`/repos/${cfg.repo}/issues/${n}`, { method: 'PATCH', body: JSON.stringify({ title: `🔁 ${name}`.slice(0, 120) }) }).catch(() => {});
        await save(`Mission modifiée : ${name}`);
      } else {
        const id = rid();
        const iss = await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: `🔁 ${name}`.slice(0, 120), body: `<!--mission:${id}-->\nRapports de la mission « ${name} » : un message par passage.` }) });
        st.items.push({ id, issue: iss.number, created: new Date().toISOString(), enabled: true, ...data });
        try { await save(`Mission créée : ${name}`); }
        catch (e) { st.items.pop(); gh(`/repos/${cfg.repo}/issues/${iss.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }) }).catch(() => {}); throw e; }
      }
      dlg.close(); toast('Mission enregistrée'); render(); loadList();
    } catch (e) { $d('#mMsg').textContent = '' + e.message; }
    b.disabled = false;
  }

  // ---- Navigation (même écran que les automatisations)
  async function openView() {
    if (!need()) return;
    stopTts(); pollId++; busy = false; $('#send').disabled = false; avatar('idle'); issueNo = null;
    $('#autoBtn').classList.remove('on');
    mainEl.classList.add('autoview'); $('#side').classList.remove('open'); loadList();
    view.hidden = false;
    view.innerHTML = '<div class="ainner"><p class="hint">Chargement…</p></div>';
    try { await load(); render(); } catch (e) { view.innerHTML = `<div class="ainner"><p class="hint">${esc('' + e.message)}</p></div>`; }
  }
  const prevClose = window.autosClose;
  window.autosClose = () => { btn.classList.remove('on'); if (prevClose) prevClose(); };
  btn.innerHTML = ic('repeat') + '<span>Missions</span>';
  btn.onclick = () => { btn.classList.add('on'); openView(); };
  const ab = $('#autoBtn'); const ao = ab.onclick; ab.onclick = (e) => { btn.classList.remove('on'); return ao && ao.call(ab, e); };
  window.museMissions = { open: () => btn.click() };
})();
