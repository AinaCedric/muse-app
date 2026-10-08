// ⚡ Onglet « Automatisations » : des consignes permanentes que Muse exécute toute seule quand un événement se produit sur le téléphone.
// Les règles vivent dans data/automations.json (dépôt cerveau). L'appli Muse Tél. les lit, surveille les notifications, puis prévient Muse
// en postant un commentaire dans l'issue de la règle (« ⚡ nom ») : c'est aussi l'historique de l'automatisation.
(() => {
  const FILE = 'data/automations.json';
  const APPS = [
    ['', 'Toutes les applis'],
    ['whatsapp', 'WhatsApp'],
    ['orca,mlite,messenger', 'Messenger'],
    ['messag,mms,sms', 'SMS (Messages)'],
    ['telegram', 'Telegram'],
    ['instagram', 'Instagram'],
    ['__custom', 'Autre appli…'],
  ];
  const BYS = [['sender', 'Nom de l’expéditeur (conseillé)'], ['text', 'Un mot dans le message'], ['any', 'L’un ou l’autre']];
  let st = { items: [], sha: null, loaded: false };
  const view = $('#autos'), mainEl = $('main');
  const q = (s) => esc(String(s == null ? '' : s)).replace(/"/g, '&quot;');
  const appLabel = (v) => (APPS.find((a) => a[0] === v) || [v, v])[1];
  const rid = () => 'a' + Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => x.toString(16).padStart(2, '0')).join('');

  async function load() {
    try {
      const f = await gh(`/repos/${cfg.repo}/contents/${FILE}`);
      st.sha = f.sha;
      const j = JSON.parse(b64d(f.content));
      st.items = Array.isArray(j.items) ? j.items : [];
    } catch (e) {
      if (e.status === 404) { st.sha = null; st.items = []; } else throw e;
    }
    st.loaded = true;
  }
  async function save(msg) {
    const body = { message: msg, content: b64e(JSON.stringify({ version: 1, items: st.items }, null, 2)), ...(st.sha ? { sha: st.sha } : {}) };
    try {
      const r = await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify(body) });
      st.sha = r.content.sha;
    } catch (e) {
      if (e.status === 409 || e.status === 422) { await load().catch(() => {}); render(); throw new Error('Les automatisations ont changé entre-temps : la liste est rechargée, refais ta modification.'); }
      throw e;
    }
  }

  const summary = (r) => {
    const t = r.trigger || {}, who = `« ${esc(t.match || '…')} »`;
    const when = t.by === 'text' ? `Quand un message contient ${who}` : t.by === 'any' ? `Quand ${who} apparaît dans une notification` : `Quand ${who} m’écrit`;
    const app = t.app ? ` sur ${esc(appLabel(t.app))}` : '';
    return `${when}${app} → ${r.autoReply ? 'Muse répond seule' : 'Muse te résume le message'}`;
  };

  function render() {
    const cards = st.items.map((r) => `
      <article class="acard${r.enabled ? '' : ' off'}" data-id="${q(r.id)}">
        <div class="ahead">
          <div class="atitle"><span class="abolt">${ic('bolt')}</span><b>${esc(r.name || 'Sans nom')}</b></div>
          <label class="sw" title="${r.enabled ? 'Active' : 'En pause'}"><input type="checkbox" class="aon" ${r.enabled ? 'checked' : ''}><span></span></label>
        </div>
        <p class="asum">${summary(r)}</p>
        <p class="ains">${r.instruction ? esc(r.instruction.slice(0, 220)) : 'Muse lit la conversation, l’analyse, puis répond comme toi.'}</p>
        <div class="aact">
          <button class="ghost aedit" type="button">Modifier</button>
          <button class="ghost atest" type="button">Tester</button>
          <button class="ghost ahist" type="button">Historique</button>
          <button class="ghost adel" type="button" aria-label="Supprimer">${ic('trash')}</button>
        </div>
      </article>`).join('');
    view.innerHTML = `
      <div class="ainner">
        <div class="atop">
          <div><h2>Automatisations</h2><p class="hint">Des consignes que Muse exécute toute seule, sans que tu aies à lui écrire.</p></div>
          <button class="btn" id="autoNew" type="button">${ic('plus')}<span>Nouvelle</span></button>
        </div>
        <div class="anote">${ic('phone')}<span>Pour surveiller les notifications, l’appli <b>Muse Tél. 2.2</b> doit avoir accès aux notifications (étape 9) et le code Cerveau doit être collé (étape 7). Une nouvelle règle est prise en compte en moins d’une minute.</span></div>
        ${st.items.length ? cards : `<div class="aempty"><span class="abolt big">${ic('bolt')}</span><h3>Aucune automatisation</h3><p>Exemple : « Quand Elena Salvatore m’écrit sur WhatsApp, lis son message et réponds-lui que je la rappelle. »</p><button class="btn" id="autoNew2" type="button">Créer ma première automatisation</button></div>`}
      </div>`;
    view.querySelectorAll('#autoNew,#autoNew2').forEach((b) => (b.onclick = () => edit(null)));
    view.querySelectorAll('.acard').forEach((c) => {
      const r = st.items.find((x) => x.id === c.dataset.id);
      c.querySelector('.aon').onchange = (e) => toggle(r, e.target.checked, e.target);
      c.querySelector('.aedit').onclick = () => edit(r);
      c.querySelector('.atest').onclick = () => testIt(r);
      c.querySelector('.ahist').onclick = () => (r.issue ? openConv(r.issue) : toast('Pas encore d’historique.'));
      c.querySelector('.adel').onclick = () => remove(r);
    });
  }

  async function toggle(r, on, box) {
    const prev = r.enabled; r.enabled = on;
    try { await save(`Automatisation ${on ? 'activée' : 'mise en pause'} : ${r.name}`); toast(on ? 'Automatisation activée' : 'Automatisation en pause'); render(); }
    catch (e) { r.enabled = prev; if (box) box.checked = prev; toast('' + e.message); }
  }

  async function remove(r) {
    if (!confirm(`Supprimer l’automatisation « ${r.name} » ?`)) return;
    const before = st.items.slice();
    st.items = st.items.filter((x) => x.id !== r.id);
    try {
      await save(`Automatisation supprimée : ${r.name}`);
      if (r.issue) gh(`/repos/${cfg.repo}/issues/${r.issue}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }) }).catch(() => {});
      toast('Automatisation supprimée'); render(); loadList();
    } catch (e) { st.items = before; toast('' + e.message); render(); }
  }

  // ---- Formulaire
  const dlg = document.getElementById('autoDlg'), tdlg = document.getElementById('autoTestDlg');
  let editing = null;
  function fillApps() {
    $('#aApp').innerHTML = APPS.map(([v, l]) => `<option value="${q(v)}">${esc(l)}</option>`).join('');
    $('#aBy').innerHTML = BYS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  }
  function edit(r) {
    editing = r;
    fillApps();
    const t = (r && r.trigger) || {};
    $('#autoDlgTitle').textContent = r ? 'Modifier l’automatisation' : 'Nouvelle automatisation';
    $('#aName').value = r ? r.name : '';
    $('#aMatch').value = t.match || '';
    $('#aBy').value = t.by || 'sender';
    const known = APPS.some((a) => a[0] === (t.app || ''));
    $('#aApp').value = known ? t.app || '' : '__custom';
    $('#aAppCustom').value = known ? '' : t.app || '';
    $('#aAppCustom').hidden = $('#aApp').value !== '__custom';
    $('#aAuto').checked = r ? !!r.autoReply : true;
    $('#aMax').value = r ? r.maxPerHour || 6 : 6;
    $('#aMsg').textContent = '';
    dlg.showModal();
  }
  $('#aApp').onchange = () => { $('#aAppCustom').hidden = $('#aApp').value !== '__custom'; if (!$('#aAppCustom').hidden) $('#aAppCustom').focus(); };
  $('#aCancel').onclick = () => dlg.close();
  $('#aSave').onclick = async () => {
    const name = $('#aName').value.trim(), match = $('#aMatch').value.trim();
    const app = $('#aApp').value === '__custom' ? $('#aAppCustom').value.trim() : $('#aApp').value;
    const max = Math.max(1, Math.min(60, parseInt($('#aMax').value, 10) || 6));
    if (!name || !match) { $('#aMsg').textContent = 'Le nom et le déclencheur (nom ou mot) sont obligatoires.'; return; }
    if ($('#aApp').value === '__custom' && !app) { $('#aMsg').textContent = 'Indique un morceau du nom de l’appli (ex. « signal »).'; return; }
    const btn = $('#aSave'); btn.disabled = true;
    const data = { name, enabled: editing ? editing.enabled : true, instruction: editing ? editing.instruction || '' : '', autoReply: $('#aAuto').checked, maxPerHour: max, trigger: { type: 'notification', match, by: $('#aBy').value, app } };
    try {
      if (editing) {
        Object.assign(editing, data);
        if (editing.issue) gh(`/repos/${cfg.repo}/issues/${editing.issue}`, { method: 'PATCH', body: JSON.stringify({ title: `⚡ ${name}`.slice(0, 120) }) }).catch(() => {});
        await save(`Automatisation modifiée : ${name}`);
      } else {
        const id = rid();
        const iss = await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: `⚡ ${name}`.slice(0, 120), body: `<!--auto:${id}-->\nHistorique de l’automatisation « ${name} » : les messages reçus et les réponses de Muse apparaissent ici.` }) });
        const item = { id, issue: iss.number, created: new Date().toISOString(), ...data };
        st.items.push(item);
        try { await save(`Automatisation créée : ${name}`); }
        catch (e) { st.items.pop(); gh(`/repos/${cfg.repo}/issues/${iss.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }) }).catch(() => {}); throw e; }
      }
      dlg.close(); toast('Automatisation enregistrée'); render(); loadList();
    } catch (e) { $('#aMsg').textContent = '' + e.message; }
    btn.disabled = false;
  };

  // ---- Test : Muse décrit ce qu'elle répondrait, sans rien envoyer ni toucher au téléphone
  let testing = null;
  function testIt(r) {
    testing = r;
    $('#tName').textContent = r.name;
    $('#tMsg').value = 'Salut ! Tu es dispo ce soir ?';
    tdlg.showModal();
  }
  $('#tCancel').onclick = () => tdlg.close();
  $('#tGo').onclick = async () => {
    const r = testing, msg = $('#tMsg').value.trim();
    if (!r || !msg) return;
    if (!r.issue) { toast('Cette automatisation n’a pas d’historique : enregistre-la à nouveau.'); return; }
    $('#tGo').disabled = true;
    try {
      const body = `<!--auto:${r.id}-->\n<!--autotest-->\n🧪 **Test** (rien n’est envoyé)\n\nMessage simulé de ${r.trigger.match} :\n\`\`\`\n${msg.replace(/```/g, "'''").replace(/-->/g, '- >')}\n\`\`\`\n<!--mode:phone-->`;
      await gh(`/repos/${cfg.repo}/issues/${r.issue}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
      tdlg.close(); await openConv(r.issue);
    } catch (e) { toast('' + e.message); }
    $('#tGo').disabled = false;
  };

  // ---- Navigation
  async function openView() {
    if (!need()) return;
    stopTts(); pollId++; busy = false; $('#send').disabled = false; avatar('idle'); issueNo = null;
    mainEl.classList.add('autoview'); $('#side').classList.remove('open'); loadList();
    view.hidden = false;
    if (!st.loaded) view.innerHTML = '<div class="ainner"><p class="hint">Chargement…</p></div>';
    try { await load(); render(); } catch (e) { view.innerHTML = `<div class="ainner"><p class="hint">${esc('' + e.message)}</p></div>`; }
  }
  window.autosClose = () => { mainEl.classList.remove('autoview'); view.hidden = true; $('#autoBtn').classList.remove('on'); };
  const btn = $('#autoBtn');
  btn.innerHTML = ic('bolt') + '<span>Automatisations</span>';
  btn.onclick = () => { btn.classList.add('on'); openView(); };
})();
