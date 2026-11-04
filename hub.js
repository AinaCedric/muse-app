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
  const COLORS = ['#7c5cff', '#2f80ed', '#22c55e', '#f06ab0', '#f59e0b', '#06b6d4', '#ef4444', '#64748b'];
  const TEMPLATES = [
    { id: 'chef', emoji: '🧭', name: 'Chef', color: '#7c5cff', mode: 'auto', role: 'Chef d’orchestre : organise mes journées, fixe les priorités, répartit le travail entre les autres agents et me fait un point clair et court.' },
    { id: 'mails', emoji: '📬', name: 'Boîte mail', color: '#2f80ed', mode: 'perso', role: 'Trie mes e-mails, résume ce qui compte, prépare des brouillons de réponse dans mon style, surveille factures, clients et rendez-vous.' },
    { id: 'messages', emoji: '💬', name: 'Messages', color: '#22c55e', mode: 'phone', role: 'Lit et répond à mes messages Messenger et WhatsApp dans mon ton, regarde les reels et vidéos reçus, me résume les conversations.' },
    { id: 'gyoo', emoji: '🎬', name: 'GYOO', color: '#f06ab0', mode: 'polyvalent', role: 'Veille et idées de contenus pour GYOO (films, anime, K-dramas, jeux, logiciels) pour un public malgache : scripts, légendes, calendrier de publication.' },
    { id: 'odoo', emoji: '🧑‍💻', name: 'Dev Odoo', color: '#f59e0b', mode: 'dev', role: 'Développeur Odoo 12 à 19, React, WordPress, Docker : code prêt à copier, revues, migrations, débogage, explications claires.' },
    { id: 'recherche', emoji: '🔎', name: 'Chercheur', color: '#06b6d4', mode: 'ordi', role: 'Recherches approfondies sur le web avec sources, comparatifs et prix à Madagascar, résultats vérifiés.' },
  ];
  const st = { items: [], sha: null, loaded: false, meta: {} };

  // ---------- Fichier des agents
  async function load() {
    try { const f = await gh(`/repos/${cfg.repo}/contents/${FILE}`); st.sha = f.sha; const d = JSON.parse(b64d(f.content)); st.items = Array.isArray(d.items) ? d.items : []; st.meta = d.meta || {}; }
    catch (e) { if (e.status !== 404) throw e; st.sha = null; st.items = []; }
    st.loaded = true;
  }
  async function save(msg) {
    const body = { message: msg, content: b64e(JSON.stringify({ version: 1, meta: st.meta || {}, items: st.items }, null, 2)), ...(st.sha ? { sha: st.sha } : {}) };
    try { st.sha = (await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify(body) })).content.sha; }
    catch (e) { if (e.status === 409 || e.status === 422) { await load().catch(() => {}); throw new Error('La liste des agents a changé entre-temps : elle est rechargée, refais ta modification.'); } throw e; }
  }
  // Discussion ↔ agent (pour que chaque message envoyé dans la discussion d'un agent lui soit adressé)
  window.museAgentOf = (n) => { const a = n && st.items.find((x) => Number(x.issue) === Number(n) && x.enabled !== false); return a ? a.id : ''; };
  window.museAgentMode = (n) => { const a = n && st.items.find((x) => Number(x.issue) === Number(n)); return a ? a.mode || 'auto' : ''; };
  setTimeout(() => { if (cfg.repo && cfg.token) load().then(() => { loadList(); syncHeader(); }).catch(() => {}); }, 1500);

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
  agBtn.onclick = async () => { if (!openShell(agBtn)) return; try { await load(); renderAgents(); if (!(st.meta && st.meta.merged) && !regroupTried) { regroupTried = true; runRegroup(); } } catch (e) { view.innerHTML = `<div class="ainner"><p class="hint">${esc('' + e.message)}</p></div>`; } };
  acBtn.onclick = () => { if (!openShell(acBtn)) return; renderActivity(tab); };

  let regroupTried = false;
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
  window.museChefIssue = () => { const a = st.items.find((x) => x.id === 'chef' && x.enabled !== false); return a && a.issue ? Number(a.issue) : 0; };
  window.museAgentImgById = (id) => { const a = st.items.find((x) => x.id === id); return a ? img(a, 64) : ''; };
  function renderAgents() {
    const cards = st.items.map((a) => `<article class="acard agCard${a.enabled === false ? ' off' : ''}" data-id="${q(a.id)}">
      <div class="ahead"><div class="atitle">${av(a)}<div><b>${esc(a.name)}</b><small>${esc(modeLabel(a.mode))}</small></div></div>
        <label class="sw" title="${a.enabled === false ? 'En pause' : 'Actif'}"><input type="checkbox" class="aon" ${a.enabled === false ? '' : 'checked'}><span></span></label></div>
      <p class="ains">${esc(a.role || '')}</p>
      ${a.instructions ? `<p class="asum">📝 ${esc(a.instructions.slice(0, 160))}${a.instructions.length > 160 ? '…' : ''}</p>` : ''}
      <div class="aact"><button class="btn agTalk" type="button">💬 Discuter</button><button class="ghost agEdit" type="button">Modifier</button><button class="ghost agDel" type="button">Supprimer</button></div>
    </article>`).join('');
    const missing = TEMPLATES.filter((t) => !st.items.some((a) => a.id === t.id));
    const tpl = missing.map((t) => `<button type="button" class="agTpl" data-id="${t.id}">${av(t)}<span><b>${esc(t.name)}</b><small>${esc(t.role.slice(0, 70))}…</small></span>${ic('plus')}</button>`).join('');
    view.innerHTML = `<div class="ainner">
      <div class="atop"><div><h2>Agents</h2><p class="hint">Ton équipe : chaque agent a son nom, son métier, ses consignes et sa discussion. Le <b>Chef</b> peut confier une partie du travail aux autres : ils la font chacun dans leur discussion, et tu es prévenu.</p></div>
        <button class="btn" id="agNew" type="button">${ic('plus')}<span>Nouvel agent</span></button></div>
      ${st.items.length ? `<div class="agGrid">${cards}</div>` : `<div class="aempty"><span class="abolt big">${ic('users')}</span><h3>Aucun agent pour l’instant</h3><p>Ajoute-les en un clic ci-dessous : tu pourras tout modifier.</p></div>`}
      <div class="anote agMergeNote">${ic('users')}<span>${st.meta && st.meta.merged ? `✅ Regroupé : la <b>Veille proactive</b> est chez le <b>Chef</b>, l’agenda et les mails chez <b>Boîte mail</b>, Facebook et WhatsApp chez <b>Messages</b>.` : `Regrouper la <b>Veille proactive</b> dans le <b>Chef</b>, l’<b>agenda</b> et les mails dans <b>Boîte mail</b>, <b>Facebook</b> et <b>WhatsApp</b> dans <b>Messages</b>.`}</span><button class="ghost" id="agMerge" type="button">${st.meta && st.meta.merged ? '🔀 Refaire' : '🔀 Regrouper'}</button></div>
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
      c.querySelector('.agEdit').onclick = () => edit(a);
      c.querySelector('.agDel').onclick = () => remove(a);
    });
  }
  async function addTemplate(t) {
    if (!t) return;
    st.items.push({ ...t, look: { ...lookOf(t) }, instructions: '', enabled: true, created: new Date().toISOString() });
    try { await save(`Agent ajouté : ${t.name}`); toast(`${t.emoji} ${t.name} rejoint l’équipe`); renderAgents(); }
    catch (e) { st.items = st.items.filter((x) => x.id !== t.id); toast('' + e.message); renderAgents(); }
  }
  async function remove(a) {
    if (!confirm(`Retirer l’agent « ${a.name} » ? Sa discussion est gardée dans les archives.`)) return;
    const before = st.items.slice(); st.items = st.items.filter((x) => x.id !== a.id);
    try { await save(`Agent retiré : ${a.name}`); if (a.issue) addLabel(a.issue, L_ARC, '9ca3af').catch(() => {}); renderAgents(); }
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
    try { const l = await gh(`/repos/${cfg.repo}/issues?state=open&per_page=100`); for (const i of l || []) if (!i.pull_request && /Veille proactive/.test(i.title) && !done.has(i.number) && Number(i.number) !== Number(chef.issue)) { done.add(i.number); await archiveIssue(i.number, chef.name); } } catch {}
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
        <div class="agStage"><canvas id="agCv" width="220" height="220"></canvas><button type="button" class="ghost" id="agRnd">🎲 Au hasard</button><small class="hint">Fais-le tourner avec le doigt</small></div>
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
      <div id="agMsg" class="hint"></div>
      <div class="row"><button class="ghost" id="agCancel" type="button">Annuler</button><button class="btn" id="agSave" type="button">Enregistrer</button></div>`;
    document.body.appendChild(dlg);
    const $d = (x) => dlg.querySelector(x);
    $d('#agCancel').onclick = () => dlg.close();
    dlg.addEventListener('close', () => { if (prev) { prev.dispose(); prev = null; } });
    $d('#agSave').onclick = saveForm;
    dlg.querySelectorAll('.agChips').forEach((g) => g.querySelectorAll('button').forEach((b) => (b.onclick = () => { look[g.dataset.k] = b.dataset.v; paint(); })));
    dlg.querySelectorAll('.agPair').forEach((b) => (b.onclick = () => { [look.c1, look.c2] = A3.PAIRS[+b.dataset.k]; paint(); }));
    $d('#agC1').oninput = (e) => { look.c1 = e.target.value; paint(); };
    $d('#agC2').oninput = (e) => { look.c2 = e.target.value; paint(); };
    $d('#agAccC').oninput = (e) => { look.accColor = e.target.value; paint(); };
    $d('#agCheeks').onchange = (e) => { look.cheeks = e.target.checked; paint(); };
    $d('#agRnd').onclick = () => { look = A3.random(); paint(); if (prev) prev.state('happy'); };
  }
  let paintT = 0;
  function paint() {
    const $d = (x) => dlg.querySelector(x);
    dlg.querySelectorAll('.agChips').forEach((g) => g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', look[g.dataset.k] === b.dataset.v)));
    dlg.querySelectorAll('.agPair').forEach((b) => { const [x, y] = A3.PAIRS[+b.dataset.k]; b.classList.toggle('on', x === look.c1 && y === look.c2); });
    $d('#agC1').value = look.c1; $d('#agC2').value = look.c2; $d('#agAccC').value = look.accColor; $d('#agCheeks').checked = !!look.cheeks;
    clearTimeout(paintT); paintT = setTimeout(() => { if (prev) prev.set(look); }, 40);
  }
  function edit(a) {
    if (!A3 || !A3.ok) { toast('3D indisponible sur cet appareil'); }
    if (!dlg) buildDlg();
    editing = a; const $d = (x) => dlg.querySelector(x);
    $d('#agT').textContent = a ? `Modifier ${a.name}` : 'Nouvel agent';
    $d('#agName').value = a ? a.name : '';
    $d('#agRole').value = a ? a.role || '' : ''; $d('#agIns').value = a ? a.instructions || '' : ''; $d('#agMode').value = a ? a.mode || 'auto' : 'auto';
    look = A3.norm(a ? lookOf(a) : A3.random());
    $d('#agMsg').textContent = ''; dlg.showModal();
    if (!prev) prev = A3.live($d('#agCv'), look, 220);
    paint();
  }
  async function saveForm() {
    const $d = (x) => dlg.querySelector(x), name = $d('#agName').value.trim(), role = $d('#agRole').value.trim();
    if (!name || !role) { $d('#agMsg').textContent = 'Donne au moins un nom et un métier.'; return; }
    const data = { name, role, look: { ...look }, color: look.c1, instructions: $d('#agIns').value.trim(), mode: $d('#agMode').value };
    const before = st.items.map((x) => ({ ...x }));
    if (editing) { Object.assign(editing, data); delete editing.emoji; } else st.items.push({ id: rid(), ...data, enabled: true, created: new Date().toISOString() });
    const b = $d('#agSave'); b.disabled = true;
    try { await save(editing ? `Agent modifié : ${name}` : `Agent créé : ${name}`); if (editing && editing.issue) gh(`/repos/${cfg.repo}/issues/${editing.issue}`, { method: 'PATCH', body: JSON.stringify({ title: name }) }).catch(() => {}); dlg.close(); renderAgents(); loadList(); syncHeader(); }
    catch (e) { st.items = before; $d('#agMsg').textContent = '' + e.message; }
    b.disabled = false;
  }

  // ---------- 🎭 En-tête : dans la discussion d'un agent, c'est SON avatar 3D qui s'affiche (et bouge selon ce qu'il fait)
  let head = null, headFor = '';
  const wrapEl = $('#avatarWrap'), museCv = $('#avatar'), nameEl = $('#whoName b');
  function syncHeader() {
    const a = issueNo && st.items.find((x) => Number(x.issue) === Number(issueNo));
    const key = a ? a.id + JSON.stringify(lookOf(a)) : '';
    if (key === headFor) { if (a && nameEl) nameEl.textContent = a.name; return; }
    headFor = key;
    if (head) { head.dispose(); head = null; }
    const old = wrapEl && wrapEl.querySelector('#agHeadCv'); if (old) old.remove();
    if (!a || !A3 || !A3.ok || !wrapEl) { if (museCv) museCv.style.display = ''; if (nameEl) nameEl.textContent = 'Muse'; return; }
    const cv = document.createElement('canvas'); cv.id = 'agHeadCv'; cv.width = cv.height = 88; cv.title = a.name;
    museCv.style.display = 'none'; wrapEl.appendChild(cv);
    head = A3.live(cv, lookOf(a), 88);
    if (!head) { cv.remove(); museCv.style.display = ''; return; }
    if (nameEl) nameEl.textContent = a.name;
    cv.onclick = () => head && head.state('happy');
  }
  // l'avatar de l'agent suit les mêmes états que Muse (réfléchit, travaille, content, souci)
  if (window.MuseAvatar) { const set = MuseAvatar.setState.bind(MuseAvatar); MuseAvatar.setState = (s, ms) => { set(s, ms); if (head) head.state(s); }; }
  const _open = window.openConv; window.openConv = async function (n) { const r = await _open.apply(this, arguments); syncHeader(); return r; };
  const _new = window.newChat; window.newChat = function () { const r = _new.apply(this, arguments); syncHeader(); return r; };
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
    let cloud = {};
    try { const it = await techIssue('muse-sante'); if (it) { const cs = await tailComments(it, 100); const c = cs.find((x) => x.body.startsWith('<!--muse-ctl--><!--health:cloud-->')); if (c) cloud = JSON.parse(c.body.slice(c.body.indexOf('\n') + 1)); } } catch {}
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
      body.innerHTML = `${sum}<div class="hGrid">${cards.join('')}</div><div class="aact"><button class="ghost" id="hRe" type="button">🔄 Tout retester</button></div>`;
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
