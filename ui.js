// Muse — couche d'interactions « Aurora » (chargée en dernier).
// Elle n'appelle aucune fonction interne de app.js : elle observe le DOM et l'enrichit.
// Si ce fichier échoue, l'appli fonctionne exactement comme avant.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const desk = () => innerWidth > 760;
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } } };
  const svg = (p, w = 2) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:${w}">${p}</svg>`;
  const IC = {
    side: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    down: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  const msgs = $('#msgs'), main = $('main'), form = $('#f'), input = $('#in'), side = $('#side');
  if (!msgs || !main || !form || !input) return;

  // ---------- 1. Aurore d'ambiance + état de Muse
  const aura = document.createElement('div');
  aura.id = 'aura'; aura.setAttribute('aria-hidden', 'true');
  aura.innerHTML = '<i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="grain"></i>';
  document.body.prepend(aura);
  const who = $('#who');
  const sync = () => { root.dataset.muse = (who && who.dataset.state) || 'idle'; };
  if (who) new MutationObserver(sync).observe(who, { attributes: true, attributeFilter: ['data-state'] });
  sync();

  // ---------- 2. Barre latérale : logo, repli (Ctrl+B), recherche (Ctrl+K)
  const head = side && $('header', side);
  if (head) {
    head.innerHTML = '<span class="logo" aria-hidden="true"></span><span class="wm">Muse</span>';
    const t = document.createElement('button');
    t.type = 'button'; t.className = 'ib sideTgl'; t.title = `Masquer la barre (${mod} B)`; t.setAttribute('aria-label', 'Masquer la barre latérale');
    t.innerHTML = svg(IC.side, 1.7);
    t.onclick = () => toggleSide();
    if (desk()) head.appendChild(t);
  }
  const toggleSide = (force) => {
    if (!desk()) { $('#menu')?.click(); return; }
    const off = force ?? !document.body.classList.contains('sideOff');
    document.body.classList.toggle('sideOff', off); ls.set('muse_side_off', off ? '1' : '0');
  };
  if (ls.get('muse_side_off') === '1' && desk()) document.body.classList.add('sideOff');
  // Sur ordinateur, le bouton ☰ rouvre la barre repliée (sinon : comportement mobile d'origine)
  $('#menu')?.addEventListener('click', (e) => { if (desk() && document.body.classList.contains('sideOff')) { e.stopImmediatePropagation(); toggleSide(false); } }, true);

  const list = $('#list');
  let q = '';
  if (side && list) {
    const box = document.createElement('label');
    box.className = 'sideSearch';
    box.innerHTML = `${svg(IC.search, 1.8)}<input type="search" name="muse-conv-q" placeholder="Rechercher" aria-label="Rechercher une discussion" autocomplete="off" autocorrect="off" spellcheck="false" readonly data-lpignore="true" data-1p-ignore data-form-type="other"><kbd>${mod} K</kbd>`;
    const sect = $('.sect', side);
    side.insertBefore(box, sect || list);
    const si = $('input', box);
    // Chrome prend ce champ pour un « nom d'utilisateur » (il y a un champ mot de passe dans les Réglages) et y colle le nom du dépôt.
    // Parade : le champ reste en lecture seule (donc jamais pré-rempli) tant que Cédric ne clique pas dedans, et toute valeur collée par le navigateur est effacée.
    const unlock = () => { si.readOnly = false; };
    si.addEventListener('focus', unlock); si.addEventListener('pointerdown', unlock);
    si.addEventListener('blur', () => { if (!si.value) si.readOnly = true; });
    let typed = false;
    si.addEventListener('keydown', () => { typed = true; });
    si.addEventListener('paste', () => { typed = true; });
    const wipe = () => { if (!typed && si.value) { si.value = ''; q = ''; apply(); } };
    [100, 600, 1500, 3000].forEach((t) => setTimeout(wipe, t));
    si.addEventListener('change', wipe);
    const apply = () => {
      const items = [...list.querySelectorAll('.item')];
      let n = 0;
      items.forEach((it) => { const hit = !q || norm(it.textContent).includes(q); it.classList.toggle('hidden-q', !hit); if (hit) n++; });
      list.querySelectorAll('.lhead').forEach((h) => { h.style.display = q ? 'none' : ''; });
      let e = $('.listEmpty', list);
      if (q && !n) { if (!e) { e = document.createElement('div'); e.className = 'listEmpty'; list.prepend(e); } e.textContent = `Aucune discussion « ${si.value.trim()} »`; }
      else if (e) e.remove();
    };
    si.addEventListener('input', () => { q = norm(si.value.trim()); apply(); });
    si.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { si.value = ''; q = ''; apply(); si.blur(); e.stopPropagation(); }
      if (e.key === 'Enter') { const first = [...list.querySelectorAll('.item:not(.hidden-q)')][0]; if (first) { first.click(); si.blur(); } }
    });
    new MutationObserver(() => { if (q) apply(); }).observe(list, { childList: true });
    window.museFocusSearch = () => { if (!desk()) { if (!side.classList.contains('open')) $('#menu')?.click(); } else toggleSide(false); setTimeout(() => si.focus(), 60); };
  }

  // ---------- 3. Accueil : date, titre mot à mot, cartes avec icône, lumière qui suit le doigt
  const CHIP_IC = ['☀️', '🧩', '✨', '🗓️', '💬', '📱'];
  const stamp = () => {
    const d = new Date();
    const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return day.charAt(0).toUpperCase() + day.slice(1) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };
  function enhanceEmpty(el) {
    if (el.dataset.ux) return; el.dataset.ux = '1';
    const eb = document.createElement('div');
    eb.className = 'eyebrow'; eb.innerHTML = '<i>✦</i><span></span>';
    eb.lastChild.textContent = stamp();
    el.prepend(eb);
    const tick = setInterval(() => { if (!eb.isConnected) return clearInterval(tick); eb.lastChild.textContent = stamp(); }, 20000);
    const h1 = $('h1', el);
    if (h1 && !reduce) {
      let i = 0; const out = document.createDocumentFragment();
      [...h1.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) { out.appendChild(document.createTextNode(w)); return; }
            const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = w; out.appendChild(s);
          });
        } else { n.classList.add('w'); n.style.setProperty('--i', i++); out.appendChild(n); }
      });
      h1.textContent = ''; h1.appendChild(out);
    }
    el.querySelectorAll('.chip').forEach((c, k) => {
      c.style.setProperty('--i', k);
      const b = document.createElement('span'); b.className = 'cic'; b.textContent = CHIP_IC[k % CHIP_IC.length]; b.setAttribute('aria-hidden', 'true');
      c.prepend(b);
    });
    if (!touch) {
      const h = document.createElement('div'); h.className = 'kbdHint';
      h.innerHTML = `<span><kbd>/</kbd> écrire</span><span><kbd>${mod}</kbd><kbd>K</kbd> rechercher</span><span><kbd>?</kbd> tous les raccourcis</span>`;
      el.appendChild(h);
    }
  }
  // lumière et légère inclinaison 3D sous le pointeur
  if (!touch) {
    document.addEventListener('pointermove', (e) => {
      const t = e.target.closest && e.target.closest('.chip, #new');
      if (!t) return;
      const r = t.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      t.style.setProperty('--mx', x + 'px'); t.style.setProperty('--my', y + 'px');
      if (t.classList.contains('chip') && !reduce) { t.style.setProperty('--ry', ((x / r.width - 0.5) * 6).toFixed(2) + 'deg'); t.style.setProperty('--rx', ((0.5 - y / r.height) * 6).toFixed(2) + 'deg'); }
    }, { passive: true });
    document.addEventListener('pointerout', (e) => { const t = e.target.closest && e.target.closest('.chip'); if (t && !t.contains(e.relatedTarget)) { t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); } }, { passive: true });
  }

  // ---------- 4. Messages : entrée animée, copie, blocs de code
  let pend = null;
  const copyText = async (txt, btn) => {
    try { await navigator.clipboard.writeText(txt); }
    catch { const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch { /* rien */ } ta.remove(); }
    if (btn) { const old = btn.innerHTML; btn.classList.add('done'); btn.innerHTML = svg(IC.check) + (btn.classList.contains('cpy') ? 'Copié' : ''); setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = old; }, 1500); }
    if (navigator.vibrate && touch) navigator.vibrate(8);
  };
  function enhanceBot(d) {
    if (d.dataset.ux || d.classList.contains('wait') || d.classList.contains('live')) return;
    d.dataset.ux = '1';
    d.querySelectorAll('pre').forEach((pre) => {
      if (pre.parentElement.classList.contains('codebox')) return;
      const box = document.createElement('div'); box.className = 'codebox';
      pre.replaceWith(box); box.appendChild(pre);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cpy'; b.innerHTML = svg(IC.copy, 1.8) + 'Copier';
      b.onclick = () => copyText(pre.innerText, b);
      box.appendChild(b);
    });
    if (!d.dataset.raw) return;
    let row = [...d.children].find((c) => c.classList.contains('tools'));
    if (!row) { row = document.createElement('div'); row.className = 'tools'; d.appendChild(row); }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mact'; b.title = 'Copier la réponse'; b.setAttribute('aria-label', 'Copier la réponse');
    b.innerHTML = svg(IC.copy, 1.8);
    b.onclick = () => copyText(d.dataset.raw, b);
    row.appendChild(b);
  }
  const flush = () => { pend = null; msgs.querySelectorAll('.m.bot:not([data-ux])').forEach(enhanceBot); };
  new MutationObserver((recs) => {
    const added = [];
    recs.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType === 1) added.push(n); }));
    if (!added.length) return;
    const ms = added.filter((n) => n.classList.contains('m'));
    const big = ms.length > 1;
    ms.forEach((n, k) => { if (!reduce) { n.style.setProperty('--d', big ? Math.min(k * 40, 360) + 'ms' : '0ms'); n.classList.add('in'); } });
    added.forEach((n) => { if (n.id === 'empty') enhanceEmpty(n); });
    clearTimeout(pend); pend = setTimeout(flush, 250);
    onScroll();
  }).observe(msgs, { childList: true });
  const e0 = $('#empty', msgs); if (e0) enhanceEmpty(e0);

  // ---------- 5. Défilement : en-tête vitré + bouton « revenir en bas »
  const tb = document.createElement('button');
  tb.id = 'toBottom'; tb.type = 'button'; tb.title = 'Revenir en bas'; tb.setAttribute('aria-label', 'Revenir au dernier message');
  tb.innerHTML = svg(IC.down);
  tb.onclick = () => msgs.scrollTo({ top: msgs.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  main.appendChild(tb);
  let raf = 0;
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      main.classList.toggle('scrolled', msgs.scrollTop > 6);
      tb.classList.toggle('on', msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight > 420);
    });
  }
  msgs.addEventListener('scroll', onScroll, { passive: true });

  // ---------- 6. Zone de saisie : bouton actif seulement avec du texte, idées qui défilent, aide clavier
  const sendBtn = $('#send');
  const hasText = () => form.classList.toggle('noText', !input.value.trim() && !($('#pending') && !$('#pending').hidden));
  ['input', 'change', 'keyup', 'focus', 'blur'].forEach((ev) => input.addEventListener(ev, hasText));
  setInterval(hasText, 400);          // la valeur est aussi vidée par le code (après l'envoi)
  hasText();
  const IDEAS = ['Écrire à Muse', 'Résume mes e-mails non lus…', 'Trouve un resto pas cher près de moi…', 'Qu’ai-je à faire demain ?', 'Réponds au dernier message d’Elena…', 'Range mon dossier Téléchargements…', 'Explique-moi ce module Odoo…', 'Des idées de vidéos pour GYOO…'];
  let ii = 0;
  if (!reduce) setInterval(() => {
    if (input.value || document.activeElement === input || document.hidden) return;
    form.classList.add('phFade');
    setTimeout(() => { ii = (ii + 1) % IDEAS.length; input.placeholder = IDEAS[ii]; form.classList.remove('phFade'); }, 350);
  }, 4200);
  if (!touch) {
    const h = document.createElement('div'); h.className = 'composerHint';
    h.innerHTML = '<span><kbd>Entrée</kbd> envoyer</span><span><kbd>⇧</kbd><kbd>Entrée</kbd> nouvelle ligne</span><span><kbd>Échap</kbd> quitter</span>';
    form.appendChild(h);
  }
  form.addEventListener('submit', () => { if (navigator.vibrate && touch) navigator.vibrate(10); }, true);
  sendBtn && sendBtn.addEventListener('click', () => { if (navigator.vibrate && touch) navigator.vibrate(10); });

  // ---------- 7. Glisser-déposer : grand cadre d'accueil des fichiers
  const dz = document.createElement('div');
  dz.id = 'dropZone'; dz.innerHTML = '<div><i>📎</i>Dépose tes fichiers ici<small>Photos, PDF, Word, Excel, code…</small></div>';
  document.body.appendChild(dz);
  let dragN = 0;
  const isFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  document.addEventListener('dragenter', (e) => { if (!isFiles(e)) return; dragN++; dz.classList.add('on'); });
  document.addEventListener('dragleave', (e) => { if (!isFiles(e)) return; dragN = Math.max(0, dragN - 1); if (!dragN) dz.classList.remove('on'); });
  document.addEventListener('drop', () => { dragN = 0; dz.classList.remove('on'); }, true);

  // ---------- 8. Thème : bascule en cercle qui s'étend depuis le bouton
  const tbtn = $('#themeBtn');
  if (tbtn && typeof tbtn.onclick === 'function' && document.startViewTransition && !reduce) {
    const orig = tbtn.onclick;
    tbtn.onclick = function (e) {
      const r = tbtn.getBoundingClientRect();
      const x = e && e.clientX ? e.clientX : r.left + r.width / 2, y = e && e.clientY ? e.clientY : r.top + r.height / 2;
      root.style.setProperty('--vx', x + 'px'); root.style.setProperty('--vy', y + 'px');
      root.style.setProperty('--vr', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
      try { document.startViewTransition(() => orig.call(tbtn, e)); } catch { orig.call(tbtn, e); }
    };
  }

  // ---------- 9. Raccourcis clavier
  const dlg = document.createElement('dialog');
  dlg.id = 'kbDlg';
  const K = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join('');
  dlg.innerHTML = `<h3>Raccourcis clavier</h3><p class="hint">Pour aller plus vite avec Muse.</p><ul>
    <li><span>Écrire à Muse</span><span>${K('/')}</span></li>
    <li><span>Envoyer</span><span>${K('Entrée')}</span></li>
    <li><span>Nouvelle ligne</span><span>${K('⇧', 'Entrée')}</span></li>
    <li><span>Rechercher une discussion</span><span>${K(mod, 'K')}</span></li>
    <li><span>Nouvelle discussion</span><span>${K(mod, '⇧', 'O')}</span></li>
    <li><span>Afficher / masquer la barre</span><span>${K(mod, 'B')}</span></li>
    <li><span>Arrêter Muse pendant qu'elle travaille</span><span>${K('Échap')}</span></li>
    <li><span>Cette aide</span><span>${K('?')}</span></li></ul>
    <div class="row"><button class="btn" type="button">Compris</button></div>`;
  document.body.appendChild(dlg);
  $('button', dlg).onclick = () => dlg.close();
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  const typing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  const anyOpen = () => document.querySelector('dialog[open]') || ['#profile', '#apps'].some((s) => { const x = $(s); return x && !x.hidden; });
  document.addEventListener('keydown', (e) => {
    const k = e.key, c = e.ctrlKey || e.metaKey;
    if (c && !e.shiftKey && k.toLowerCase() === 'k') { e.preventDefault(); window.museFocusSearch && window.museFocusSearch(); return; }
    if (c && e.shiftKey && k.toLowerCase() === 'o') { e.preventDefault(); $('#new')?.click(); setTimeout(() => input.focus(), 80); return; }
    if (c && !e.shiftKey && k.toLowerCase() === 'b') { e.preventDefault(); toggleSide(); return; }
    if (k === 'Escape' && document.activeElement === input) {
      if (sendBtn && sendBtn.classList.contains('stop') && !input.value) { sendBtn.click(); return; }   // Échap = Stop
      input.blur(); return;
    }
    if (typing(document.activeElement) || anyOpen() || c || e.altKey) return;
    if (k === '/') { e.preventDefault(); input.focus(); }
    else if (k === '?') { e.preventDefault(); dlg.showModal(); }
  });

  // ---------- 10. Petites finitions
  // Le bouton « Nouvelle discussion » ramène le curseur dans la zone de saisie (ordinateur)
  $('#new')?.addEventListener('click', () => { if (!touch) setTimeout(() => input.focus(), 120); });
  // Couleur de la barre du navigateur (mobile) accordée au fond
  const meta = $('meta[name=theme-color]');
  const fixMeta = () => { if (meta) meta.content = root.dataset.theme === 'dark' ? '#0A0913' : '#FAF9FF'; };
  new MutationObserver(fixMeta).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  fixMeta();
})();
