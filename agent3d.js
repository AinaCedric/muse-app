// 🧸 Avatars 3D des agents (personnages originaux, Three.js) : forme, couleurs, matière, yeux, bouche, joues, accessoire.
// API : Agent3D.snapshot(look, px) → image (mise en cache) · Agent3D.live(canvas, look, px) → { set(look), state(s), dispose() }
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
    const my = ey - 0.3, mz = frontZ(S, 0, my) - 0.01;
    if (look.mouth === 'sourire') { const m = new T.Mesh(new T.TorusGeometry(0.11, 0.028, 10, 24, Math.PI), line); m.rotation.z = Math.PI; m.position.set(0, my + 0.06, mz); head.add(m); }
    else if (look.mouth === 'o') { const m = new T.Mesh(new T.TorusGeometry(0.055, 0.025, 10, 24), line); m.position.set(0, my, mz); head.add(m); }
    else if (look.mouth === 'chat') { for (const sx of [-1, 1]) { const m = new T.Mesh(new T.TorusGeometry(0.06, 0.022, 8, 16, Math.PI), line); m.rotation.z = Math.PI; m.position.set(sx * 0.06, my + 0.03, mz); head.add(m); } }
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
    return { root, head, eyes, look };
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

  // ---------- Vue animée (en-tête d'une discussion d'agent, éditeur)
  function live(canvas, look, px = 88) {
    if (!T) return null;
    let r; try { r = new T.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch { return null; }
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.setSize(px, px, false); r.setClearColor(0x000000, 0);
    const scene = new T.Scene(); lights(scene); const cam = new T.PerspectiveCamera(34, 1, 0.1, 50);
    let b = build(look); scene.add(b.root); frame(cam, b.look);
    let st = 'idle', stT = 0, blinkAt = performance.now() + 2500, alive = true, drag = null, spin = 0;
    const reduce = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 1;
    canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (drag !== null) { spin += (e.clientX - drag) * 0.02; drag = e.clientX; } });
    canvas.addEventListener('pointerup', () => { drag = null; });
    function tick(now) {
      if (!alive) return;
      const t = now / 1000, R = b.root, H = b.head;
      const sp = st === 'working' ? 2.6 : st === 'thinking' ? 1.2 : 1.6;
      R.position.y = Math.sin(t * sp) * 0.06 * reduce + (st === 'happy' ? Math.abs(Math.sin((now - stT) / 140)) * 0.25 : 0) - (st === 'sad' ? 0.12 : 0);
      spin *= 0.94; R.rotation.y = -0.25 + Math.sin(t * 0.6) * 0.18 * reduce + spin + (st === 'working' ? Math.sin(t * 5) * 0.08 : 0);
      H.rotation.z = st === 'thinking' ? Math.sin(t * 1.3) * 0.12 + 0.1 : st === 'sad' ? -0.15 : Math.sin(t * 0.9) * 0.04 * reduce;
      H.rotation.x = st === 'sad' ? 0.25 : st === 'thinking' ? -0.12 : 0;
      b.eyes.position.x = st === 'thinking' ? Math.sin(t * 1.1) * 0.04 : 0;
      if (now > blinkAt) { b.eyes.scale.y = 0.12; if (now > blinkAt + 130) { b.eyes.scale.y = 1; blinkAt = now + 2200 + Math.random() * 3000; } }
      const bl = H.getObjectByName('blinker'); if (bl) bl.material.emissiveIntensity = 0.35 + Math.abs(Math.sin(t * 3)) * 0.6;
      if ((st === 'happy' || st === 'sad') && now - stT > 2200) st = 'idle';
      r.render(scene, cam); requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return {
      set(look2) { scene.remove(b.root); dispose(b.root); b = build(look2); scene.add(b.root); frame(cam, b.look); },
      state(s) { st = s || 'idle'; stT = performance.now(); },
      dispose() { alive = false; scene.remove(b.root); dispose(b.root); try { r.dispose(); r.forceContextLoss && r.forceContextLoss(); } catch {} },
    };
  }
  window.Agent3D = { OPTIONS, PAIRS, PRESETS, DEF, random, norm, snapshot, live, ok: !!T };
})();
