// 🧸 Avatars 3D des agents (personnages originaux, Three.js) : forme, couleurs, matière, yeux, bouche, joues, accessoire.
// API : Agent3D.snapshot(look, px) → image (mise en cache) · Agent3D.live(canvas, look, px, job) → { set(look), state(s), busy(on), job(j), dispose() }
// Au travail (state « working » ou busy), l'agent sort l'accessoire de son métier : chef, mails, messages, gyoo, odoo, recherche, star.
// Un seul moteur WebGL sert à toutes les images fixes ; une vue animée n'existe que là où on la regarde (en-tête, éditeur).
(function () {
  const T = window.THREE;
  const OPTIONS = {
    shape: [['bulle', 'Bulle'], ['goutte', 'Goutte'], ['cube', 'Cube doux'], ['capsule', 'Capsule'], ['oreilles', 'Petit chat']],
    mat: [['verre', 'Verre brillant'], ['doux', 'Peluche'], ['metal', 'Métal']],
    eyes: [['kawaii', 'Grands yeux'], ['rond', 'Ronds'], ['joyeux', 'Joyeux ^ ^'], ['pixel', 'Robot'], ['endormi', 'Rêveur']],
    mouth: [['sourire', 'Sourire'], ['o', 'Étonné'], ['chat', 'Chat ω'], ['aucune', 'Aucune']],
    acc: [['aucun', 'Aucun'], ['casque', 'Casque audio'], ['lunettes', 'Lunettes'], ['chapeau', 'Haut-de-forme'], ['casquette', 'Casquette'], ['antenne', 'Antenne'], ['noeud', 'Nœud papillon'], ['couronne', 'Couronne'], ['pousse', 'Petite pousse']],
  };
  const PAIRS = [['#a78bfa', '#5b21b6'], ['#7cc4ff', '#1d4ed8'], ['#86efac', '#15803d'], ['#ff9ad5', '#be185d'], ['#fde047', '#ea580c'], ['#67e8f9', '#0e7490'], ['#fca5a5', '#b91c1c'], ['#e2e8f0', '#475569'], ['#d9f99d', '#4d7c0f'], ['#fdba74', '#9a3412']];
  const DEF = { shape: 'bulle', c1: '#a78bfa', c2: '#5b21b6', mat: 'verre', eyes: 'kawaii', mouth: 'sourire', cheeks: true, acc: 'aucun', accColor: '#1f1b2e' };
  const PRESETS = {
    chef: { shape: 'bulle', c1: '#c4b5fd', c2: '#5b21b6', mat: 'verre', eyes: 'kawaii', mouth: 'sourire', cheeks: true, acc: 'chapeau', accColor: '#1f1b2e' },
    mails: { shape: 'cube', c1: '#93c5fd', c2: '#1d4ed8', mat: 'doux', eyes: 'rond', mouth: 'sourire', cheeks: true, acc: 'noeud', accColor: '#1e293b' },
    messages: { shape: 'goutte', c1: '#86efac', c2: '#15803d', mat: 'doux', eyes: 'joyeux', mouth: 'o', cheeks: true, acc: 'casque', accColor: '#111827' },
    gyoo: { shape: 'oreilles', c1: '#ff9ad5', c2: '#a21caf', mat: 'verre', eyes: 'kawaii', mouth: 'chat', cheeks: true, acc: 'couronne', accColor: '#fbbf24' },
    odoo: { shape: 'cube', c1: '#fde047', c2: '#ea580c', mat: 'doux', eyes: 'pixel', mouth: 'sourire', cheeks: false, acc: 'lunettes', accColor: '#111827' },
    recherche: { shape: 'capsule', c1: '#67e8f9', c2: '#0e7490', mat: 'metal', eyes: 'rond', mouth: 'o', cheeks: false, acc: 'antenne', accColor: '#f43f5e' },
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function random() {
    const [c1, c2] = pick(PAIRS);
    return { shape: pick(OPTIONS.shape)[0], c1, c2, mat: pick(OPTIONS.mat)[0], eyes: pick(OPTIONS.eyes)[0], mouth: pick(OPTIONS.mouth)[0], cheeks: Math.random() < 0.6, acc: pick(OPTIONS.acc)[0], accColor: pick(['#111827', '#fbbf24', '#f43f5e', '#ffffff', '#1e3a8a', '#16a34a']) };
  }
  const norm = (l) => ({ ...DEF, ...(l || {}) });

  // ---------- Construction du personnage
  const mats = (look) => {
    const base = { vertexColors: true };
    if (look.mat === 'doux') return new T.MeshStandardMaterial({ ...base, roughness: 0.85, metalness: 0 });
    if (look.mat === 'metal') return new T.MeshStandardMaterial({ ...base, roughness: 0.22, metalness: 0.65 });
    return new T.MeshPhysicalMaterial({ ...base, roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
  };
  function bodyGeo(shape) {
    if (shape === 'cube') {   // cube aux coins très arrondis
      const g = new T.BoxGeometry(1.7, 1.7, 1.7, 14, 14, 14), p = g.attributes.position, n = g.attributes.normal, h = 0.85, r = 0.42, v = new T.Vector3(), c = new T.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        c.set(Math.max(-(h - r), Math.min(h - r, v.x)), Math.max(-(h - r), Math.min(h - r, v.y)), Math.max(-(h - r), Math.min(h - r, v.z)));
        const d = v.clone().sub(c).normalize(); v.copy(c).addScaledVector(d, r);
        p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, d.x, d.y, d.z);
      }
      return g;
    }
    const g = new T.SphereGeometry(1, 56, 56), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (shape === 'goutte' && y > 0) { const k = 1 - 0.45 * Math.pow(y, 1.6); x *= k; z *= k; y *= 1.28; }
      if (shape === 'capsule') y = y * 0.85 + Math.sign(y) * 0.32;
      if (shape === 'oreilles') { y *= 0.92; x *= 1.06; }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  }
  // Surface avant (pour poser le visage)
  const frontZ = (shape, x, y) => shape === 'cube' ? 0.86 : shape === 'capsule' ? Math.sqrt(Math.max(0.05, 1 - x * x)) : Math.sqrt(Math.max(0.05, 1 - x * x - y * y));
  const topY = (shape) => shape === 'goutte' ? 1.28 : shape === 'capsule' ? 1.17 : shape === 'cube' ? 0.86 : shape === 'oreilles' ? 0.92 : 1;
  function build(look) {
    look = norm(look);
    const root = new T.Group(), head = new T.Group(); root.add(head);
    const g = bodyGeo(look.shape), p = g.attributes.position, cA = new T.Color(look.c1), cB = new T.Color(look.c2), tmp = new T.Color(), cols = [];
    for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, (-p.getY(i) * 0.7 + p.getX(i) * 0.45 + 1.1) / 2.2)); tmp.copy(cA).lerp(cB, t); cols.push(tmp.r, tmp.g, tmp.b); }
    g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    const body = new T.Mesh(g, mats(look)); head.add(body);
    const dark = new T.MeshPhysicalMaterial({ color: 0x14102a, roughness: 0.1, clearcoat: 1 });
    const white = new T.MeshBasicMaterial({ color: 0xffffff });
    const line = new T.MeshBasicMaterial({ color: 0x1a1430 });
    const acc = new T.MeshStandardMaterial({ color: new T.Color(look.accColor), roughness: 0.45, metalness: 0.1 });
    const S = look.shape, ey = S === 'goutte' ? 0.05 : 0.12, ex = S === 'cube' ? 0.34 : 0.36;
    // Yeux
    const eyes = new T.Group(); head.add(eyes);
    for (const sx of [-1, 1]) {
      const x = sx * ex, z = frontZ(S, x, ey) - 0.02, e = new T.Group(); e.position.set(x, ey, z); eyes.add(e);
      if (look.eyes === 'joyeux' || look.eyes === 'endormi') {
        const arc = new T.Mesh(new T.TorusGeometry(0.13, 0.035, 10, 24, Math.PI), line);
        if (look.eyes === 'endormi') arc.rotation.z = Math.PI; e.add(arc);
      } else if (look.eyes === 'pixel') {
        e.add(new T.Mesh(new T.BoxGeometry(0.13, 0.24, 0.06), dark));
        const gl = new T.Mesh(new T.BoxGeometry(0.04, 0.06, 0.02), white); gl.position.set(-0.03, 0.06, 0.04); e.add(gl);
      } else {
        const big = look.eyes === 'kawaii', r = big ? 0.19 : 0.13;
        const ball = new T.Mesh(new T.SphereGeometry(r, 24, 24), dark); ball.scale.z = 0.55; e.add(ball);
        if (big) { const iris = new T.Mesh(new T.CircleGeometry(r * 0.62, 24), new T.MeshBasicMaterial({ color: new T.Color(look.c2).lerp(new T.Color('#ffffff'), 0.25) })); iris.position.set(0, -r * 0.32, r * 0.5); e.add(iris); }
        const g1 = new T.Mesh(new T.CircleGeometry(r * 0.32, 16), white); g1.position.set(-r * 0.35, r * 0.38, r * 0.56); e.add(g1);
        if (big) { const g2 = new T.Mesh(new T.CircleGeometry(r * 0.14, 12), white); g2.position.set(r * 0.36, -r * 0.3, r * 0.57); e.add(g2); }
      }
      e.lookAt(e.position.clone().multiplyScalar(2.2));
    }
    // Bouche
    const my = ey - 0.3, mz = frontZ(S, 0, my) - 0.01, mouthG = new T.Group(); head.add(mouthG);
    if (look.mouth === 'sourire') { const m = new T.Mesh(new T.TorusGeometry(0.11, 0.028, 10, 24, Math.PI), line); m.rotation.z = Math.PI; m.position.set(0, my + 0.06, mz); mouthG.add(m); }
    else if (look.mouth === 'o') { const m = new T.Mesh(new T.TorusGeometry(0.055, 0.025, 10, 24), line); m.position.set(0, my, mz); mouthG.add(m); }
    else if (look.mouth === 'chat') { for (const sx of [-1, 1]) { const m = new T.Mesh(new T.TorusGeometry(0.06, 0.022, 8, 16, Math.PI), line); m.rotation.z = Math.PI; m.position.set(sx * 0.06, my + 0.03, mz); mouthG.add(m); } }
    // 👄 Bouche qui parle (s'ouvre au rythme de la voix) — cachée tant que l'avatar ne parle pas
    const open = new T.Group(); open.position.set(0, my + 0.02, frontZ(S, 0, my + 0.02) - 0.004); head.add(open);
    { const inner = new T.Mesh(new T.SphereGeometry(0.1, 22, 14), new T.MeshBasicMaterial({ color: 0x2a0f2e })); inner.scale.set(1.25, 1, 0.32); open.add(inner);
      const tongue = new T.Mesh(new T.SphereGeometry(0.06, 16, 10), new T.MeshBasicMaterial({ color: 0xff7a9a })); tongue.position.set(0, -0.05, 0.018); tongue.scale.set(1.3, 0.55, 0.45); open.add(tongue); }
    open.scale.set(1, 0.05, 1); open.visible = false;
    // 🤨 Sourcils (expressions : pense, alerte, triste, surprise…) — cachés au repos
    const brows = new T.Group(); head.add(brows); brows.visible = false;
    { const by = ey + (look.eyes === 'kawaii' ? 0.31 : 0.25); for (const sx of [-1, 1]) { const br = new T.Mesh(new T.BoxGeometry(0.2, 0.036, 0.03), line); br.position.set(sx * ex, by, frontZ(S, sx * ex, by) + 0.012); br.userData.y0 = by; brows.add(br); } }
    // Joues
    if (look.cheeks) for (const sx of [-1, 1]) { const x = sx * (ex + 0.16), y = ey - 0.22, c = new T.Mesh(new T.CircleGeometry(0.1, 20), new T.MeshBasicMaterial({ color: 0xff7aa8, transparent: true, opacity: 0.45, depthWrite: false })); c.position.set(x, y, frontZ(S, x, y) + 0.005); c.lookAt(c.position.clone().multiplyScalar(2)); head.add(c); }
    // Oreilles du petit chat
    if (S === 'oreilles') for (const sx of [-1, 1]) { const ear = new T.Mesh(new T.ConeGeometry(0.28, 0.5, 24), body.material); ear.geometry.setAttribute('color', new T.Float32BufferAttribute(new Array(ear.geometry.attributes.position.count).fill(0).flatMap(() => { const e = cA.clone().lerp(cB, 0.35); return [e.r, e.g, e.b]; }), 3)); ear.position.set(sx * 0.52, 0.98, 0.05); ear.rotation.z = -sx * 0.42; ear.scale.set(1, 1.15, 0.7); head.add(ear); }
    // Accessoire
    const ty = topY(S), A = look.acc;
    if (A === 'casque') {
      const band = new T.Mesh(new T.TorusGeometry(1.06, 0.07, 12, 40, Math.PI), acc); band.position.y = 0.05; head.add(band);
      for (const sx of [-1, 1]) { const cup = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.22, 28), acc); cup.rotation.z = Math.PI / 2; cup.position.set(sx * 1.02, 0.05, 0); head.add(cup); }
    } else if (A === 'lunettes') {
      for (const sx of [-1, 1]) { const r = new T.Mesh(new T.TorusGeometry(0.2, 0.03, 10, 32), acc); r.position.set(sx * ex, ey, frontZ(S, sx * ex, ey) + 0.06); head.add(r); }
      const br = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, ex * 2 - 0.4, 8), acc); br.rotation.z = Math.PI / 2; br.position.set(0, ey + 0.04, frontZ(S, 0, ey) + 0.06); head.add(br);
    } else if (A === 'chapeau') {
      const brim = new T.Mesh(new T.CylinderGeometry(0.62, 0.62, 0.05, 40), acc); brim.position.y = ty - 0.02; head.add(brim);
      const top = new T.Mesh(new T.CylinderGeometry(0.4, 0.42, 0.55, 40), acc); top.position.y = ty + 0.26; head.add(top);
      const ribbon = new T.Mesh(new T.CylinderGeometry(0.425, 0.425, 0.1, 40), new T.MeshStandardMaterial({ color: new T.Color(look.c1), roughness: 0.5 })); ribbon.position.y = ty + 0.06; head.add(ribbon);
    } else if (A === 'casquette') {
      const cap = new T.Mesh(new T.SphereGeometry(0.72, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), acc); cap.position.y = ty - 0.3; cap.scale.y = 0.8; head.add(cap);
      const visor = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.04, 32, 1, false, 0, Math.PI), acc); visor.position.set(0, ty - 0.28, 0.55); visor.rotation.y = -Math.PI / 2; visor.scale.x = 0.9; head.add(visor);
    } else if (A === 'antenne') {
      const st = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.5, 8), new T.MeshStandardMaterial({ color: 0x334155 })); st.position.y = ty + 0.22; head.add(st);
      const ball = new T.Mesh(new T.SphereGeometry(0.11, 20, 20), new T.MeshStandardMaterial({ color: new T.Color(look.accColor), emissive: new T.Color(look.accColor), emissiveIntensity: 0.5 })); ball.position.y = ty + 0.5; ball.name = 'blinker'; head.add(ball);
    } else if (A === 'noeud') {
      const y = -topY(S) * 0.92;
      for (const sx of [-1, 1]) { const w = new T.Mesh(new T.ConeGeometry(0.17, 0.32, 4), acc); w.rotation.z = sx * Math.PI / 2; w.position.set(sx * 0.17, y, 0.42); head.add(w); }
      const k = new T.Mesh(new T.SphereGeometry(0.08, 16, 16), acc); k.position.set(0, y, 0.46); head.add(k);
    } else if (A === 'couronne') {
      const ring = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.14, 32, 1, true), acc); ring.material.side = T.DoubleSide; ring.position.y = ty + 0.02; head.add(ring);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, c = new T.Mesh(new T.ConeGeometry(0.08, 0.2, 8), acc); c.position.set(Math.sin(a) * 0.42, ty + 0.18, Math.cos(a) * 0.42); head.add(c); }
    } else if (A === 'pousse') {
      const st = new T.Mesh(new T.CylinderGeometry(0.025, 0.03, 0.3, 8), new T.MeshStandardMaterial({ color: 0x15803d })); st.position.y = ty + 0.12; head.add(st);
      for (const sx of [-1, 1]) { const lf = new T.Mesh(new T.SphereGeometry(0.15, 16, 12), new T.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 })); lf.scale.set(1, 0.35, 0.6); lf.position.set(sx * 0.14, ty + 0.3, 0); lf.rotation.z = sx * 0.5; head.add(lf); }
    }
    return { root, head, eyes, look, mouthG, open, brows };
  }
  const lights = (scene) => {
    scene.add(new T.AmbientLight(0xffffff, 0.6));
    const k = new T.DirectionalLight(0xffffff, 0.95); k.position.set(-2.5, 3.5, 4); scene.add(k);
    const r = new T.DirectionalLight(0x8fd2ff, 0.8); r.position.set(3, -1, -3); scene.add(r);
    const f = new T.DirectionalLight(0xc4b5fd, 0.45); f.position.set(3, -2, 3); scene.add(f);
  };
  const frame = (cam, look) => { const tall = look.acc === 'chapeau' || look.acc === 'antenne' || look.acc === 'couronne' || look.acc === 'pousse' || look.shape === 'goutte'; cam.position.set(0, tall ? 0.3 : 0.12, tall ? 5.7 : 4.9); cam.lookAt(0, tall ? 0.26 : 0.02, 0); };
  const dispose = (o) => o.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) [].concat(m.material).forEach((x) => x.dispose()); });

  // ---------- Images fixes (un seul moteur, mises en cache)
  let snapR = null, snapScene = null, snapCam = null;
  const cache = new Map();
  function snapshot(look, px = 128) {
    look = norm(look);
    const key = JSON.stringify(look) + px;
    if (cache.has(key)) return cache.get(key);
    if (!T) return '';
    try {
      if (!snapR) {
        snapR = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        snapR.setClearColor(0x000000, 0); snapScene = new T.Scene(); lights(snapScene); snapCam = new T.PerspectiveCamera(34, 1, 0.1, 50);
      }
      snapR.setPixelRatio(1); snapR.setSize(px, px, false);
      const b = build(look); b.root.rotation.y = -0.32; b.root.rotation.x = 0.06; snapScene.add(b.root); frame(snapCam, look);
      snapR.render(snapScene, snapCam);
      const url = snapR.domElement.toDataURL('image/png');
      snapScene.remove(b.root); dispose(b.root);
      cache.set(key, url); return url;
    } catch { return ''; }
  }

  // ---------- 🛠️ Accessoires de travail : chaque métier a sa petite animation 3D quand l'agent travaille
  const JOBS = ['chef', 'mails', 'messages', 'gyoo', 'odoo', 'recherche', 'star'];
  const stdm = (c, e = 0.25, op = 1) => new T.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.1, emissive: c, emissiveIntensity: e, transparent: op < 1, opacity: op });
  function makeProps(job) {
    const g = new T.Group(), add = (geo, c, e, op) => { const m = new T.Mesh(geo, stdm(c, e, op)); g.add(m); return m; };
    const fade = (m, o) => { m.material.transparent = true; m.material.opacity = o; };
    let upd = () => {};
    if (job === 'chef') {          // baguette de chef d'orchestre + notes qui montent
      const pv = new T.Group(); pv.position.set(0.95, -0.25, 0.7); g.add(pv);
      const stick = new T.Mesh(new T.CylinderGeometry(0.025, 0.035, 0.9, 8), stdm(0xf5f5f4, 0.15)); stick.position.y = 0.45; pv.add(stick);
      const tip = new T.Mesh(new T.SphereGeometry(0.065, 12, 12), stdm(0xfbbf24, 0.7)); tip.position.y = 0.92; pv.add(tip);
      const notes = [0, 1, 2].map(() => { const n = add(new T.SphereGeometry(0.08, 12, 12), 0xc4b5fd, 0.6); n.scale.set(1.1, 0.8, 0.5); return n; });
      upd = (t) => { pv.rotation.z = -0.3 + Math.sin(t * 5) * 0.5; pv.rotation.x = Math.sin(t * 2.5) * 0.25; notes.forEach((n, i) => { const p = (t * 0.5 + i / 3) % 1; n.position.set(-1.05 + Math.sin(p * 6 + i * 2) * 0.16, -0.5 + p * 1.9, 0.6); fade(n, Math.sin(p * Math.PI)); }); };
    } else if (job === 'mails') {  // enveloppes qui tournent autour
      const env = [0, 1, 2].map(() => { const e = new T.Group(), body = new T.Mesh(new T.BoxGeometry(0.44, 0.3, 0.04), stdm(0xffffff, 0.3)), flap = new T.Mesh(new T.ConeGeometry(0.23, 0.15, 3), stdm(0x93c5fd, 0.35)); flap.rotation.z = Math.PI; flap.position.set(0, 0.075, 0.03); e.add(body, flap); g.add(e); return e; });
      upd = (t) => env.forEach((e, i) => { const a = t * 1.7 + i * 2.094; e.position.set(Math.cos(a) * 1.3, Math.sin(t * 2 + i) * 0.22 + 0.1, Math.sin(a) * 0.9 + 0.5); e.rotation.y = -Math.cos(a) * 0.5; e.rotation.z = Math.sin(a) * 0.25; });
    } else if (job === 'messages') { // bulles de discussion qui montent
      const bub = [0, 1, 2].map((i) => add(new T.SphereGeometry(0.2, 16, 16), i === 1 ? 0x86efac : 0xffffff, 0.35));
      upd = (t) => bub.forEach((m, i) => { const p = (t * 0.55 + i / 3) % 1, s = 0.7 + p * 0.5; m.position.set(0.95 + (i % 2) * 0.28 - 0.1, -0.6 + p * 1.9, 0.75); m.scale.set(1.35 * s, 0.9 * s, 0.5 * s); fade(m, Math.sin(p * Math.PI)); });
    } else if (job === 'gyoo') {   // clap de cinéma + pop-corn
      const base = add(new T.BoxGeometry(0.62, 0.38, 0.05), 0x1f2937, 0.15); base.position.set(1.06, -0.05, 0.75);
      const top = new T.Group(); top.position.set(0.75, 0.14, 0.78); g.add(top);
      const bar = new T.Mesh(new T.BoxGeometry(0.62, 0.1, 0.055), stdm(0xf9fafb, 0.2)); bar.position.x = 0.31; top.add(bar);
      const corn = [0, 1, 2, 3].map(() => add(new T.SphereGeometry(0.07, 10, 10), 0xfde68a, 0.5));
      upd = (t) => { top.rotation.z = Math.max(0, Math.sin(t * 4)) * 0.75; corn.forEach((c, i) => { const p = (t * 0.9 + i / 4) % 1; c.position.set(-1.0 + i * 0.16 - 0.2, -0.3 + Math.sin(p * Math.PI) * 1.1, 0.7); fade(c, 1 - p * 0.6); }); };
    } else if (job === 'odoo') {   // engrenages
      const gear = (rr, n, c) => { const gr = new T.Group(), body = new T.Mesh(new T.CylinderGeometry(rr, rr, 0.1, 18), stdm(c, 0.3)); body.rotation.x = Math.PI / 2; gr.add(body); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, tooth = new T.Mesh(new T.BoxGeometry(rr * 0.45, rr * 0.34, 0.1), stdm(c, 0.3)); tooth.position.set(Math.cos(a) * rr * 1.1, Math.sin(a) * rr * 1.1, 0); tooth.rotation.z = a; gr.add(tooth); } g.add(gr); return gr; };
      const g1 = gear(0.3, 8, 0xfbbf24), g2 = gear(0.2, 6, 0xf97316); g1.position.set(1.05, 0.25, 0.75); g2.position.set(0.62, -0.2, 0.85);
      upd = (t) => { g1.rotation.z = t * 1.8; g2.rotation.z = -t * 2.7 + 0.3; };
    } else if (job === 'recherche') { // loupe qui balaie
      const mg = new T.Group(); g.add(mg);
      mg.add(new T.Mesh(new T.TorusGeometry(0.3, 0.05, 12, 32), stdm(0xe2e8f0, 0.2)));
      mg.add(new T.Mesh(new T.CircleGeometry(0.3, 24), new T.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.3 })));
      const h = new T.Mesh(new T.CylinderGeometry(0.045, 0.05, 0.42, 8), stdm(0x94a3b8, 0.1)); h.position.set(0.35, -0.35, 0); h.rotation.z = Math.PI / 4; mg.add(h);
      upd = (t) => { mg.position.set(Math.sin(t * 1.8) * 0.85, 0.1 + Math.sin(t * 2.6) * 0.14, 0.95); mg.rotation.z = Math.sin(t * 1.8) * 0.2; };
    } else {                       // étoiles qui tournent (agents personnalisés)
      const st5 = [0, 1, 2, 3, 4].map(() => add(new T.OctahedronGeometry(0.1), 0xfde047, 0.7));
      upd = (t) => st5.forEach((s, i) => { const a = t * 1.6 + i * 1.2566; s.position.set(Math.cos(a) * 1.25, Math.sin(a * 1.3) * 0.6 + 0.1, Math.sin(a) * 0.8 + 0.5); s.rotation.y = t * 3 + i; s.scale.setScalar(0.8 + Math.sin(t * 4 + i) * 0.3); });
    }
    return { g, upd, dispose: () => dispose(g) };
  }

  // ---------- Vue animée (en-tête d'une discussion d'agent, éditeur, et 🎙️ Muse Live)
  // opts.hands : deux petites mains flottantes qui font des gestes (Live) · opts.wide : caméra plus large pour les mains
  // Live : talk(niveau 0..1) ouvre la bouche au rythme de la voix · mood(humeur) change le visage · gesture(nom) fait un geste
  const MOODS = {   // yeux (hauteur, taille), sourcils (visibles, angle, hauteur), tête (penchée, baissée)
    calme: { eY: 1, eS: 1, bV: 0, bA: 0, bY: 0, hz: 0, hx: 0 },
    joie: { eY: 0.6, eS: 1.04, bV: 0, bA: 0, bY: 0.02, hz: 0, hx: -0.05 },
    pense: { eY: 0.9, eS: 0.97, bV: 1, bA: 0.22, bY: 0.03, hz: 0.12, hx: -0.1, asym: 1 },
    alerte: { eY: 1.05, eS: 1.1, bV: 1, bA: -0.32, bY: -0.01, hz: 0, hx: 0.04 },
    triste: { eY: 0.82, eS: 0.95, bV: 1, bA: 0.32, bY: 0, hz: -0.1, hx: 0.2 },
    surprise: { eY: 1.15, eS: 1.28, bV: 1, bA: 0, bY: 0.08, hz: 0, hx: -0.08, mouth: 0.45 },
    inquiete: { eY: 0.95, eS: 1.02, bV: 1, bA: 0.2, bY: 0.02, hz: -0.06, hx: 0.08 },
    taquine: { eY: 0.85, eS: 1, bV: 1, bA: 0.18, bY: 0.03, hz: 0.1, hx: 0, asym: 1, wink: 1 },
  };
  const GEST = { nod: 0.9, shake: 1.0, hop: 0.6, tilt: 1.2, wave: 1.7, think: 2.6, shrug: 1.3, spin: 1.0, cheer: 1.4 };
  function live(canvas, look, px = 88, job0 = 'star', opts = {}) {
    if (!T) return null;
    let r; try { r = new T.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch { return null; }
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.setSize(px, px, false); r.setClearColor(0x000000, 0);
    const scene = new T.Scene(); lights(scene); const cam = new T.PerspectiveCamera(34, 1, 0.1, 50);
    const reframe = () => { frame(cam, b.look); if (opts.wide || opts.hands) { cam.position.z += 1.1; cam.position.y += 0.05; } };
    let b = build(look); scene.add(b.root); reframe();
    let job = JOBS.includes(job0) ? job0 : 'star', P = makeProps(job), busy = false, pk = 0; scene.add(P.g); P.g.visible = false;
    let st = 'idle', stT = 0, blinkAt = performance.now() + 2500, alive = true, drag = null, spin = 0;
    let talkT = 0, talkV = 0, moodK = 'calme', gest = null, winkAt = 0;
    const cur = { ...MOODS.calme };
    // 🖐️ Mains flottantes (Live)
    let hands = null;
    const makeHands = () => {
      if (!opts.hands) return null;
      const l = norm(b.look), m = new T.MeshPhysicalMaterial({ color: new T.Color(l.c1).lerp(new T.Color(l.c2), 0.45), roughness: 0.3, clearcoat: 0.8 });
      const mk = (sx) => { const g = new T.Group(), palm = new T.Mesh(new T.SphereGeometry(0.19, 22, 18), m); palm.scale.set(1, 1.05, 0.7); g.add(palm);
        const th = new T.Mesh(new T.SphereGeometry(0.075, 12, 10), m); th.position.set(-sx * 0.16, 0.02, 0.04); g.add(th); g.userData.base = new T.Vector3(sx * 1.32, -0.62, 0.35); g.position.copy(g.userData.base); b.root.add(g); return g; };
      return { L: mk(-1), R: mk(1), mat: m };
    };
    hands = makeHands();
    const reduce = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 1;
    canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (drag !== null) { spin += (e.clientX - drag) * 0.02; drag = e.clientX; } });
    canvas.addEventListener('pointerup', () => { drag = null; });
    const lerp = (a, c, k) => a + (c - a) * k;
    function tick(now) {
      if (!alive) return;
      const t = now / 1000, R = b.root, H = b.head;
      const wk = st === 'working' || (busy && st !== 'happy' && st !== 'sad');
      const lis = st === 'listening';
      const sp = wk ? 2.6 : st === 'thinking' ? 1.2 : 1.6;
      R.position.y = Math.sin(t * sp) * 0.06 * reduce + (st === 'happy' ? Math.abs(Math.sin((now - stT) / 140)) * 0.25 : 0) - (st === 'sad' ? 0.12 : 0);
      R.position.z = lerp(R.position.z, lis ? 0.18 : 0, 0.08);
      spin *= 0.94; R.rotation.y = -0.25 + Math.sin(t * 0.6) * 0.18 * reduce + spin + (wk ? Math.sin(t * 5) * 0.08 : 0);
      R.rotation.z = 0;
      // 🎭 humeur : on glisse en douceur vers le visage voulu
      const M = MOODS[moodK] || MOODS.calme; for (const k of Object.keys(MOODS.calme)) cur[k] = lerp(cur[k], M[k] || 0, 0.12);
      H.rotation.z = (st === 'thinking' ? Math.sin(t * 1.3) * 0.12 + 0.1 : st === 'sad' ? -0.15 : lis ? 0.08 + Math.sin(t * 0.8) * 0.03 : Math.sin(t * 0.9) * 0.04 * reduce) + cur.hz;
      H.rotation.x = (st === 'sad' ? 0.25 : st === 'thinking' ? -0.12 : 0) + cur.hx;
      H.rotation.y = 0;
      b.eyes.position.x = st === 'thinking' ? Math.sin(t * 1.1) * 0.04 : 0;
      b.eyes.position.y = moodK === 'pense' ? 0.025 : 0;
      // 👄 bouche : suit le niveau de la voix (vite à l'ouverture, plus doux à la fermeture)
      const want = Math.max(talkT, M.mouth || 0); talkV = lerp(talkV, want, want > talkV ? 0.55 : 0.25);
      const op = talkV > 0.035; b.open.visible = op; b.mouthG.visible = !op;
      if (op) { b.open.scale.y = 0.18 + talkV * 1.15; b.open.scale.x = 0.9 + talkV * 0.25; H.rotation.x += talkV * 0.05 + Math.sin(t * 9) * talkV * 0.02; }
      // 🤨 sourcils
      b.brows.visible = cur.bV > 0.35;
      b.brows.children.forEach((br, i) => { const sx = i === 0 ? -1 : 1, a = M.asym ? (i === 0 ? cur.bA * 1.4 : -cur.bA * 0.3) : cur.bA; br.rotation.z = -sx * a; br.position.y = br.userData.y0 + cur.bY + (M.asym && i === 0 ? 0.03 : 0); });
      // 🛠️ accessoire du métier (apparaît en rebondissant, disparaît en douceur) + geste du corps propre à chaque métier
      pk += ((wk ? 1 : 0) - pk) * 0.14; if (pk < 0.01 && !wk) pk = 0;
      P.g.visible = pk > 0.02;
      if (P.g.visible) { P.g.scale.setScalar(Math.max(0.01, pk * (1 + Math.sin(Math.min(pk, 1) * Math.PI) * 0.15))); P.upd(t); }
      if (wk) {
        if (job === 'messages') H.rotation.x += Math.sin(t * 6) * 0.08;
        else if (job === 'odoo') H.rotation.x += Math.sin(t * 14) * 0.05;
        else if (job === 'recherche') R.rotation.y += Math.sin(t * 1.8) * 0.3;
        else if (job === 'gyoo') R.position.y += Math.abs(Math.sin(t * 6)) * 0.08;
        else if (job === 'mails') H.rotation.z += Math.sin(t * 3) * 0.05;
        else if (job === 'chef') R.rotation.z = Math.sin(t * 5) * 0.05;
      }
      // 🖐️ mains : flottent, battent la mesure quand l'avatar parle, font les gestes
      let hL = null, hR = null;
      if (hands) { hL = hands.L.userData.base.clone(); hR = hands.R.userData.base.clone();
        hL.y += Math.sin(t * 1.7) * 0.05; hR.y += Math.sin(t * 1.7 + 1.3) * 0.05;
        if (op) { hL.y += Math.max(0, Math.sin(t * 5.2)) * talkV * 0.35; hR.y += Math.max(0, Math.sin(t * 5.2 + 2)) * talkV * 0.35; hR.x -= talkV * 0.12; }
        if (lis) { hR.y += 0.08; hL.y += 0.08; }
        if (wk) { hR.y += Math.abs(Math.sin(t * 7)) * 0.12; hR.x -= 0.25; hR.z += 0.35; }
      }
      // ✨ gestes
      if (gest) {
        const p = Math.min(1, (now - gest.t0) / (gest.dur * 1000)), e = Math.sin(p * Math.PI);
        switch (gest.name) {
          case 'nod': H.rotation.x += Math.sin(p * Math.PI * 4) * 0.2 * (1 - p); break;
          case 'shake': H.rotation.y += Math.sin(p * Math.PI * 6) * 0.28 * (1 - p); break;
          case 'hop': R.position.y += e * 0.35; break;
          case 'tilt': H.rotation.z += e * 0.25; break;
          case 'spin': R.rotation.y += p * Math.PI * 2; R.position.y += e * 0.15; break;
          case 'wave': if (hR) { hR.set(1.12, 0.45 + e * 0.1, 0.45); hR.x += Math.sin(p * Math.PI * 7) * 0.18; } H.rotation.z -= e * 0.12; break;
          case 'think': if (hR) hR.lerp(new T.Vector3(0.42, -0.72, 0.85), Math.min(1, e * 2)); H.rotation.z += e * 0.14; b.eyes.position.y += e * 0.03; break;
          case 'shrug': if (hL && hR) { hL.lerp(new T.Vector3(-1.25, 0.05, 0.5), e); hR.lerp(new T.Vector3(1.25, 0.05, 0.5), e); } H.rotation.z += e * 0.12; R.position.y += e * 0.06; break;
          case 'cheer': if (hL && hR) { hL.lerp(new T.Vector3(-1.05, 0.75 + Math.sin(p * 20) * 0.06, 0.4), e); hR.lerp(new T.Vector3(1.05, 0.75 + Math.cos(p * 20) * 0.06, 0.4), e); } R.position.y += Math.abs(Math.sin(p * Math.PI * 3)) * 0.2; break;
        }
        if (p >= 1) gest = null;
      }
      if (hands) { hands.L.position.lerp(hL, 0.2); hands.R.position.lerp(hR, 0.2); hands.L.rotation.z = Math.sin(t * 1.3) * 0.1; hands.R.rotation.z = -Math.sin(t * 1.3) * 0.1 + (gest && gest.name === 'wave' ? Math.sin(t * 14) * 0.4 : 0); }
      // 👀 yeux : humeur × clignement (+ clin d'œil quand elle taquine)
      let blink = 1; if (now > blinkAt) { blink = 0.12; if (now > blinkAt + 130) { blink = 1; blinkAt = now + 2200 + Math.random() * 3000; } }
      b.eyes.scale.set(cur.eS, cur.eY * cur.eS * blink * (lis ? 1.06 : 1), cur.eS);
      if (M.wink && b.eyes.children[1]) { if (!winkAt || now > winkAt + 3200) winkAt = now; b.eyes.children[1].scale.y = now - winkAt < 260 ? 0.15 : 1; } else if (b.eyes.children[1]) b.eyes.children[1].scale.y = 1;
      const bl = H.getObjectByName('blinker'); if (bl) bl.material.emissiveIntensity = 0.35 + Math.abs(Math.sin(t * 3)) * 0.6;
      if ((st === 'happy' || st === 'sad') && now - stT > 2200) st = 'idle';
      r.render(scene, cam); requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return {
      set(look2) { scene.remove(b.root); dispose(b.root); b = build(look2); scene.add(b.root); reframe(); hands = makeHands(); },
      state(s) { st = s || 'idle'; stT = performance.now(); },
      busy(on) { busy = !!on; },
      job(j) { j = JOBS.includes(j) ? j : 'star'; if (j === job) return; job = j; scene.remove(P.g); P.dispose(); P = makeProps(job); P.g.visible = false; scene.add(P.g); },
      talk(v) { talkT = Math.max(0, Math.min(1, +v || 0)); },
      mood(m) { moodK = MOODS[m] ? m : 'calme'; },
      gesture(g) { if (GEST[g]) gest = { name: g, t0: performance.now(), dur: GEST[g] }; },
      resize(n) { r.setSize(n, n, false); },
      dispose() { alive = false; scene.remove(b.root); dispose(b.root); P.dispose(); try { r.dispose(); r.forceContextLoss && r.forceContextLoss(); } catch {} },
    };
  }
  window.Agent3D = { JOBS, OPTIONS, PAIRS, PRESETS, DEF, random, norm, snapshot, live, ok: !!T };
})();
