// 🧠 Écran « Mémoire » : ce que Muse sait de toi, rangé par thèmes. Chercher, ajouter, supprimer, réorganiser (Claude fusionne les doublons).
// Fichier : data/memory.md (format : « ## Thème » puis « - fait (AAAA-MM-JJ) »).
(() => {
  const FILE = 'data/memory.md', SECS = ['Identité', 'Projets', 'Préférences', 'Personnes', 'Décisions', 'Divers'];
  const ICONS = { Identité: '🪪', Projets: '🚀', Préférences: '⭐', Personnes: '👥', Décisions: '🧭', Divers: '🗂️' };
  const dlg = $('#dlg'); let sha = null, meta = '', secs = new Map(), query = '', textMode = false, busy = false;
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const canon = (t) => SECS.find((s) => strip(s) === strip(t)) || (t.trim() ? t.trim().replace(/^./, (c) => c.toUpperCase()) : 'Divers');
  function parse(md) {
    const m = new Map(); let cur = 'Divers'; meta = (md.match(/^<!--\s*muse-memory v2\s*·?\s*(.*?)\s*-->/m) || [, ''])[1];
    for (const raw of md.split('\n')) {
      const line = raw.trim(); if (!line || /^<!--.*-->$/.test(line)) continue;
      const h = line.match(/^#{1,3}\s+(.+)$/); if (h) { cur = canon(h[1]); continue; }
      const t = (line.match(/^[-*•]\s+(.+)$/) || [, line])[1].trim(); if (!t) continue;
      const d = t.match(/\s*\((\d{4}-\d{2}-\d{2})\)\s*$/);
      if (!m.has(cur)) m.set(cur, []); m.get(cur).push({ text: d ? t.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '') : t, date: d ? d[1] : '' });
    }
    return m;
  }
  function ser() {
    const order = [...SECS, ...[...secs.keys()].filter((k) => !SECS.includes(k))], out = [`<!-- muse-memory v2${meta ? ' · ' + meta : ''} -->`];
    for (const k of order) { const a = secs.get(k) || []; if (a.length) out.push('', `## ${k}`, ...a.map((i) => `- ${i.text}${i.date ? ` (${i.date})` : ''}`)); }
    return out.join('\n') + '\n';
  }
  const total = () => [...secs.values()].reduce((n, a) => n + a.length, 0);
  async function load() {
    try { const f = await gh(`/repos/${cfg.repo}/contents/${FILE}`); sha = f.sha; secs = parse(b64d(f.content)); }
    catch (e) { if (e.status === 404) { sha = null; secs = new Map(); } else throw e; }
  }
  async function put(md, msg) {
    const r = await gh(`/repos/${cfg.repo}/contents/${FILE}`, { method: 'PUT', body: JSON.stringify({ message: msg, content: b64e(md), ...(sha ? { sha } : {}) }) });
    sha = r.content.sha;
  }
  async function commit(msg) {
    try { await put(ser(), msg); }
    catch (e) { if (e.status === 409 || e.status === 422) { await load().catch(() => {}); render(); throw new Error('La mémoire a changé entre-temps (Muse vient peut-être de retenir quelque chose) : je l’ai rechargée, refais ta modification.'); } throw e; }
  }
  const root = document.createElement('div'); root.id = 'memUi'; dlg.appendChild(root);
  const hideOld = (on) => [...dlg.children].forEach((c) => { if (c !== root) c.style.display = on ? 'none' : ''; });

  function render() {
    if (textMode) {
      root.innerHTML = `<h3>Ce que Muse sait de toi</h3><p class="hint">Mode texte : modifie librement, un fait par ligne sous un titre « ## Thème ».</p><textarea id="memTxt2" style="width:100%;min-height:340px"></textarea>
        <div class="row"><button class="ghost" id="mmBack" type="button">← Retour</button><button class="btn" id="mmSaveTxt" type="button">Enregistrer</button></div>`;
      $('#memTxt2').value = ser();
      $('#mmBack').onclick = () => { textMode = false; render(); };
      $('#mmSaveTxt').onclick = async () => { try { const t = $('#memTxt2').value; await put(t, 'Mémoire modifiée depuis l’app'); secs = parse(t); toast('Mémoire enregistrée'); textMode = false; render(); } catch (e) { toast('' + (e.status === 409 || e.status === 422 ? 'La mémoire a changé entre-temps, rouvre-la' : e.message)); } };
      return;
    }
    const qn = strip(query), order = [...SECS, ...[...secs.keys()].filter((k) => !SECS.includes(k))];
    const body = order.map((k) => {
      const items = (secs.get(k) || []).filter((i) => !qn || strip(i.text).includes(qn));
      if (!items.length) return '';
      return `<section class="mmSec"><h4>${ICONS[k] || '🗂️'} ${esc(k)} <span>${items.length}</span></h4>${items.map((i) => `<div class="mmItem"><span>${esc(i.text)}${i.date ? `<small> · ${esc(i.date)}</small>` : ''}</span><button type="button" class="mmDel" data-k="${esc(k)}" data-t="${esc(i.text).replace(/"/g, '&quot;')}" aria-label="Oublier" title="Oublier">✕</button></div>`).join('')}</section>`;
    }).join('');
    root.innerHTML = `<h3>Ce que Muse sait de toi</h3>
      <p class="hint">${total()} souvenir${total() > 1 ? 's' : ''}${meta ? ` · ${esc(meta)}` : ''}. Muse retient toute seule ce qui compte ; tu peux ajouter, oublier ou lui demander de ranger.</p>
      <input id="mmQ" type="search" placeholder="Chercher dans la mémoire…" value="${esc(query).replace(/"/g, '&quot;')}" autocomplete="off">
      <div class="mmBody">${body || `<p class="hint" style="text-align:center;margin:26px 0">${total() ? 'Aucun souvenir ne correspond.' : 'Rien pour l’instant. Dis « retiens que… » à Muse, ou ajoute un souvenir ci-dessous.'}</p>`}</div>
      <div class="mmAdd"><select id="mmCat">${SECS.map((s) => `<option>${s}</option>`).join('')}</select><input id="mmNew" placeholder="Ajouter un souvenir…" maxlength="300" autocomplete="off"><button class="btn" id="mmAdd" type="button">Ajouter</button></div>
      <div class="row"><button class="ghost" id="mmTidy" type="button">🧹 Réorganiser</button><button class="ghost" id="mmTxt" type="button">Mode texte</button><button class="ghost" id="mmClose" type="button">Fermer</button></div>`;
    const qi = $('#mmQ'); qi.oninput = () => { query = qi.value; const pos = qi.selectionStart; render(); const n = $('#mmQ'); n.focus(); n.setSelectionRange(pos, pos); };
    root.querySelectorAll('.mmDel').forEach((b) => (b.onclick = async () => {
      const k = b.dataset.k, t = b.dataset.t, prev = secs.get(k).slice();
      secs.set(k, secs.get(k).filter((i) => i.text !== t)); render();
      try { await commit('Mémoire : souvenir oublié'); toast('Oublié'); } catch (e) { secs.set(k, prev); render(); toast('' + e.message); }
    }));
    const add = async () => {
      const t = $('#mmNew').value.trim(), k = $('#mmCat').value; if (!t) return;
      if ([...secs.values()].flat().some((i) => strip(i.text) === strip(t))) { toast('Déjà dans la mémoire'); return; }
      if (!secs.has(k)) secs.set(k, []); const it = { text: t, date: new Date().toISOString().slice(0, 10) }; secs.get(k).push(it); query = ''; render();
      try { await commit('Mémoire : souvenir ajouté'); toast('Retenu'); } catch (e) { secs.set(k, secs.get(k).filter((x) => x !== it)); render(); toast('' + e.message); }
    };
    $('#mmAdd').onclick = add; $('#mmNew').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    $('#mmTxt').onclick = () => { textMode = true; render(); };
    $('#mmClose').onclick = () => dlg.close();
    $('#mmTidy').onclick = tidy;
  }

  // 🧹 Demande à Muse de ranger : un message spécial dans la discussion « 🧠 Mémoire » ; le cerveau répond quand c'est fait
  async function tidy() {
    if (busy) return; busy = true;
    const b = $('#mmTidy'); b.disabled = true; b.textContent = '🧹 Muse range…';
    try {
      const list = await gh(`/repos/${cfg.repo}/issues?state=open&per_page=100`);
      let iss = (list || []).find((i) => !i.pull_request && i.title === '🧠 Mémoire');
      if (!iss) iss = await gh(`/repos/${cfg.repo}/issues`, { method: 'POST', body: JSON.stringify({ title: '🧠 Mémoire', body: 'Journal des réorganisations de la mémoire de Muse.' }) });
      const c = await gh(`/repos/${cfg.repo}/issues/${iss.number}/comments`, { method: 'POST', body: JSON.stringify({ body: '🧹 Réorganisation de la mémoire demandée.\n\n<!--muse-setup:memory-->' }) });
      const t0 = Date.now(); let done = null;
      while (Date.now() - t0 < 4 * 60 * 1000 && !done) {
        await new Promise((r) => setTimeout(r, 3000));
        const cs = await gh(`/repos/${cfg.repo}/issues/${iss.number}/comments?per_page=100&since=${encodeURIComponent(c.created_at)}`);
        done = (cs || []).find((x) => x.body.includes('<!--memdone-->') || x.body.includes('<!--muse-error-->'));
        if (!dlg.open) break;
      }
      if (done) { await load(); render(); toast(done.body.includes('<!--muse-error-->') ? 'Échec du rangement' : 'Mémoire réorganisée'); }
      else if (dlg.open) toast('Muse met du temps : rouvre la mémoire dans un instant.');
    } catch (e) { toast('' + e.message); }
    busy = false; if ($('#mmTidy')) { $('#mmTidy').disabled = false; $('#mmTidy').textContent = '🧹 Réorganiser'; }
  }

  $('#memBtn').onclick = async () => {
    if (!need()) return;
    try { await load(); } catch (e) { return toast('' + e.message); }
    query = ''; textMode = false; hideOld(true); render(); $('#side').classList.remove('open');
    if (!dlg.open) dlg.showModal();
  };
})();
