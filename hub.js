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
  const st = { items: [], sha: null, loaded: false };

  // ---------- Fichier des agents
  async function load() {
    try { const f = await gh(`/repos/${cfg.repo}/contents/${FILE}`); st.sha = f.sha; const d = JSON.parse(b64d(f.content)); st.items = Array.isArray(d.items) ? d.items : []; }
    catch (e) { if (e.status !== 404) throw e; st.sha = null; st.items = []; }
    st.loaded = true;
  }
  async function save(msg) {
    const body = { message: msg, content: b64e(JSON.stringify({ version: 1, items: st.items }, null, 2)), ...(st.sha ? { sha: st.sha } : {}) };
    try { st.sha = (await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify(body) })).content.sha; }
    catch (e) { if (e.status === 409 || e.status === 422) { await load().catch(() => {}); throw new Error('La liste des agents a changé entre-temps : elle est rechargée, refais ta modification.'); } throw e; }
  }
  // Discussion ↔ agent (pour que chaque message envoyé dans la discussion d'un agent lui soit adressé)
  window.museAgentOf = (n) => { const a = n && st.items.find((x) => Number(x.issue) === Number(n) && x.enabled !== false); return a ? a.id : ''; };
  window.museAgentMode = (n) => { const a = n && st.items.find((x) => Number(x.issue) === Number(n)); return a ? a.mode || 'auto' : ''; };
  setTimeout(() => { if (cfg.repo && cfg.token) load().catch(() => {}); }, 1500);

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
    offAll(); btn.classList.add('on');
    mainEl.classList.add('autoview'); $('#side').classList.remove('open'); loadList();
    view.hidden = false; view.innerHTML = '<div class="ainner"><p class="hint">Chargement…</p></div>';
    return true;
  }
  agBtn.onclick = async () => { if (!openShell(agBtn)) return; try { await load(); renderAgents(); } catch (e) { view.innerHTML = `<div class="ainner"><p class="hint">${esc('' + e.message)}</p></div>`; } };
  acBtn.onclick = () => { if (!openShell(acBtn)) return; renderActivity(tab); };

  // =====================================================================
  // 🧩 AGENTS
  // =====================================================================
  const av = (a, big) => `<span class="agAv${big ? ' big' : ''}" style="--c:${q(a.color || '#7c5cff')}">${esc(a.emoji || '🤖')}</span>`;
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
      ${tpl ? `<h4 class="agH">Modèles prêts</h4><div class="agTpls">${tpl}</div>` : ''}
      <div class="anote">${ic('users')}<span>Muse reste là : les discussions normales marchent comme avant. Un agent n’est qu’une Muse spécialisée, avec <b>les mêmes garde-fous</b>.</span></div>
    </div>`;
    view.querySelector('#agNew').onclick = () => edit(null);
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
    st.items.push({ ...t, instructions: '', enabled: true, created: new Date().toISOString() });
    try { await save(`Agent ajouté : ${t.name}`); toast(`${t.emoji} ${t.name} rejoint l’équipe`); renderAgents(); }
    catch (e) { st.items = st.items.filter((x) => x.id !== t.id); toast('' + e.message); renderAgents(); }
  }
  async function remove(a) {
    if (!confirm(`Retirer l’agent « ${a.name} » ? Sa discussion est gardée dans les archives.`)) return;
    const before = st.items.slice(); st.items = st.items.filter((x) => x.id !== a.id);
    try { await save(`Agent retiré : ${a.name}`); if (a.issue) addLabel(a.issue, L_ARC, '9ca3af').catch(() => {}); renderAgents(); }
    catch (e) { st.items = before; toast('' + e.message); renderAgents(); }
  }
  async function talk(a) {
    try {
      if (!a.issue) {
        const i = await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: `${a.emoji || '🤖'} ${a.name}`.slice(0, 120), body: `<!--agent:${a.id}-->\nDiscussion de l’agent ${a.name}.` }) });
        a.issue = i.number; addLabel(i.number, L_PIN, 'a78bfa').catch(() => {});
        await save(`Agent ${a.name} : discussion`);
      }
      close(); await openConv(a.issue);
      if (a.mode && [...modeSel.options].some((o) => o.value === a.mode)) modeSel.value = a.mode;
      input.placeholder = `Écrire à ${a.name}…`; input.focus();
    } catch (e) { toast('' + e.message); }
  }
  // Formulaire
  let dlg = null, editing = null, pickColor = COLORS[0];
  function buildDlg() {
    dlg = document.createElement('dialog'); dlg.id = 'agDlg';
    dlg.innerHTML = `<h3 id="agT">Nouvel agent</h3>
      <div class="agRow"><div><label for="agEmoji">Emoji</label><input id="agEmoji" maxlength="4" style="width:70px;text-align:center;font-size:22px"></div>
        <div style="flex:1"><label for="agName">Nom</label><input id="agName" maxlength="40" placeholder="Boîte mail" autocomplete="off"></div></div>
      <label>Couleur</label><div class="agColors">${COLORS.map((c) => `<button type="button" class="agC" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}</div>
      <label for="agRole">Son métier</label><textarea id="agRole" rows="3" placeholder="Trie mes e-mails, résume ce qui compte…"></textarea>
      <label for="agIns">Consignes (facultatif)</label><textarea id="agIns" rows="3" placeholder="Tutoie mes clients, signe « Cédric », jamais de rendez-vous avant 9 h…"></textarea>
      <label for="agMode">Ce qu’il peut utiliser</label><select id="agMode">${MODES.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
      <div id="agMsg" class="hint"></div>
      <div class="row"><button class="ghost" id="agCancel" type="button">Annuler</button><button class="btn" id="agSave" type="button">Enregistrer</button></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('#agCancel').onclick = () => dlg.close();
    dlg.querySelector('#agSave').onclick = saveForm;
    dlg.querySelectorAll('.agC').forEach((b) => (b.onclick = () => { pickColor = b.dataset.c; dlg.querySelectorAll('.agC').forEach((x) => x.classList.toggle('on', x === b)); }));
  }
  function edit(a) {
    if (!dlg) buildDlg();
    editing = a; const $d = (x) => dlg.querySelector(x);
    $d('#agT').textContent = a ? `Modifier ${a.name}` : 'Nouvel agent';
    $d('#agEmoji').value = a ? a.emoji || '🤖' : '🤖'; $d('#agName').value = a ? a.name : '';
    $d('#agRole').value = a ? a.role || '' : ''; $d('#agIns').value = a ? a.instructions || '' : ''; $d('#agMode').value = a ? a.mode || 'auto' : 'auto';
    pickColor = (a && a.color) || COLORS[st.items.length % COLORS.length];
    dlg.querySelectorAll('.agC').forEach((x) => x.classList.toggle('on', x.dataset.c === pickColor));
    $d('#agMsg').textContent = ''; dlg.showModal();
  }
  async function saveForm() {
    const $d = (x) => dlg.querySelector(x), name = $d('#agName').value.trim(), role = $d('#agRole').value.trim();
    if (!name || !role) { $d('#agMsg').textContent = 'Donne au moins un nom et un métier.'; return; }
    const data = { name, role, emoji: $d('#agEmoji').value.trim() || '🤖', color: pickColor, instructions: $d('#agIns').value.trim(), mode: $d('#agMode').value };
    const before = st.items.map((x) => ({ ...x }));
    if (editing) Object.assign(editing, data); else st.items.push({ id: rid(), ...data, enabled: true, created: new Date().toISOString() });
    const b = $d('#agSave'); b.disabled = true;
    try { await save(editing ? `Agent modifié : ${name}` : `Agent créé : ${name}`); if (editing && editing.issue) gh(`/repos/${cfg.repo}/issues/${editing.issue}`, { method: 'PATCH', body: JSON.stringify({ title: `${data.emoji} ${name}` }) }).catch(() => {}); dlg.close(); renderAgents(); }
    catch (e) { st.items = before; $d('#agMsg').textContent = '' + e.message; }
    b.disabled = false;
  }

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
        <div class="acHead"><span class="acTime">${hm(e.at)}</span>${e.agent ? `<span class="acWho">${esc(e.agent.emoji || '')} ${esc(e.agent.name)}</span>` : ''}<a href="#" class="acConv">${esc(e.title || `Discussion n°${e.issue}`)}</a></div>
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
