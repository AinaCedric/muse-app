// Mascotte 3D de Muse (personnage original) — Three.js.
// États : idle (repos) · thinking (réfléchit) · working (travaille sur son ordinateur portable) · happy (réponse reçue) · sad (erreur)
// API : window.MuseAvatar.setState('thinking' | 'working' | 'idle' | 'happy' | 'sad')
(function () {
  const wrap = document.getElementById('who');
  const canvas = document.getElementById('avatar');
  const statusEl = document.getElementById('status');
  if (!wrap || !canvas) return;

  const LABELS = { idle: 'en ligne', thinking: 'réfléchit', working: 'travaille', happy: 'en ligne', sad: 'souci de connexion' };
  let state = 'idle', until = 0;
  const publish = (s) => { wrap.dataset.state = s; if (statusEl) statusEl.textContent = LABELS[s] || ''; };
  publish('idle');

  // --- Repli (pas de WebGL / script bloqué) : l'API reste disponible, la mascotte est en CSS.
  let ok = !!window.THREE, renderer;
  if (ok) { try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch (e) { ok = false; } }
  if (!ok) {
    wrap.classList.add('fallback');
    window.MuseAvatar = { setState(s) { state = s; publish(s); if (s === 'happy' || s === 'sad') setTimeout(() => { state = 'idle'; publish('idle'); }, 2200); } };
    return;
  }

  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOTION = reduce ? 0.35 : 1;
  const SIZE = 88;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0.2, 6.5);
  camera.lookAt(0, 0.1, 0);

  // Lumières : clé chaude, contre-jour rose, remplissage violet
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.95); key.position.set(-2.5, 3.5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff7ac6, 0.9); rim.position.set(3, 1, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9b7bff, 0.5); fill.position.set(3, -2, 3); scene.add(fill);

  const head = new THREE.Group(); scene.add(head);

  // Corps : sphère lisse, dégradé violet → rose via couleurs de sommets
  const bodyGeo = new THREE.SphereGeometry(1, 56, 56);
  const cols = [], c1 = new THREE.Color(0x7c5cff), c2 = new THREE.Color(0xff8ad0), tmp = new THREE.Color();
  const pos = bodyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { tmp.copy(c1).lerp(c2, Math.min(1, Math.max(0, (pos.getY(i) + 0.6) / 1.9))); cols.push(tmp.r, tmp.g, tmp.b); }
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.12 }));
  head.add(body);

  // Yeux
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1233, roughness: 0.15, metalness: 0.1 });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyes = [-1, 1].map((side) => {
    const g = new THREE.Group();
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.14, 28, 28), eyeMat); e.scale.set(0.82, 1.3, 0.55); g.add(e);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), glintMat); gl.position.set(0.04, 0.09, 0.07); g.add(gl);
    g.userData = { side, glint: gl, baseX: side * 0.34, baseY: 0.12 };
    head.add(g); return g;
  });
  const surfZ = (x, y) => Math.sqrt(Math.max(0.05, 1 - x * x - y * y));

  // Joues
  const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff5fa8, transparent: true, opacity: 0.5 });
  const cheeks = [-1, 1].map((side) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), cheekMat);
    m.scale.set(1, 0.6, 0.3); m.position.set(side * 0.57, -0.14, surfZ(0.57, -0.14) - 0.02); m.rotation.y = side * 0.62; head.add(m); return m;
  });

  // Bouche : arc de tore (scale.y > 0 sourire, ≈ 0 ligne, < 0 moue)
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 10, 28, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1a1233, roughness: 0.3, side: THREE.DoubleSide }));
  mouth.rotation.z = Math.PI; mouth.position.set(0, -0.05, surfZ(0, -0.1) + 0.01); head.add(mouth);

  // Étoile flottante (signature ✨ de Muse)
  const sh = new THREE.Shape(), R = 1, r = 0.38;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rad = i % 2 ? r : R; (i ? sh.lineTo : sh.moveTo).call(sh, Math.cos(a) * rad, Math.sin(a) * rad); }
  sh.closePath();
  const starGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3 });
  starGeo.center();
  const starMat = new THREE.MeshStandardMaterial({ color: 0xffd6f0, emissive: 0xff9bd8, emissiveIntensity: 0.55, roughness: 0.25 });
  const star = new THREE.Mesh(starGeo, starMat); star.scale.setScalar(0.26); star.position.set(0, 1.62, 0); scene.add(star);

  // Bulles de réflexion : 3 billes qui orbitent
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xc9b6ff, emissiveIntensity: 0.9, roughness: 0.2 });
  const dots = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), dotMat); m.scale.setScalar(0.001); scene.add(m); return m; });

  // Ordinateur portable (état « travaille ») : vu de dos, logo étoile lumineux, lueur de l'écran sur le visage, petites mains qui tapent
  const lap = new THREE.Group(); lap.position.set(0, -1.28, 1.05); scene.add(lap);
  const shell = new THREE.MeshPhysicalMaterial({ color: 0x5d5878, roughness: 0.35, metalness: 0.6, clearcoat: 0.7 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.85), shell); base.position.set(0, 0, -0.1); lap.add(base);
  const hinge = new THREE.Group(); hinge.position.set(0, 0.035, -0.5); lap.add(hinge);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 0.05), shell); lid.position.set(0, 0.31, 0); hinge.add(lid);
  const logoMat = new THREE.MeshBasicMaterial({ color: 0xffb8e6, transparent: true, opacity: 0.9 });
  const logo = new THREE.Mesh(new THREE.ShapeGeometry(sh), logoMat); logo.scale.setScalar(0.12); logo.position.set(0, 0.31, 0.03); hinge.add(logo);
  const screenLight = new THREE.PointLight(0x8fe6ff, 0, 3.2); screenLight.position.set(0, -0.35, 0.75); scene.add(screenLight);
  const handMat = new THREE.MeshPhysicalMaterial({ color: 0xb07cff, roughness: 0.3, clearcoat: 1 });
  const hands = [-1, 1].map((side) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 20), handMat); m.scale.set(1, 0.75, 1); m.position.set(side * 0.62, 0.1, 0.05); lap.add(m); return m; });
  lap.scale.setScalar(0.001);

  // ===== Effets modernes (halo, anneaux orbitaux, comètes, hologrammes, flux de données) =====
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  const glow = (color, size) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0, blending: THREE.NormalBlending, depthWrite: false })); m.scale.setScalar(size); scene.add(m); return m; };
  const halo = glow(0xb38cff, 3.6); halo.position.set(0, 0.05, -0.9);
  // Réflexion : deux anneaux holographiques inclinés + comètes à traînée + étincelles neuronales + onde « eurêka »
  const ringMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.NormalBlending, depthWrite: false });
  const rings = [[0xff6fc4, 1.42, 1.25, 0.32], [0x7f8bff, 1.6, 1.38, -0.42]].map(([c, r, rx, rz]) => {
    const g = new THREE.Group(); g.rotation.set(rx, 0, rz); scene.add(g);
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 8, 96), ringMat(c)); g.add(m);
    g.userData = { r, m, c }; return g;
  });
  const comets = rings.map((g, i) => Array.from({ length: 7 }, (_, j) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: g.userData.c, transparent: true, opacity: 0, blending: THREE.NormalBlending, depthWrite: false })); g.add(sp); return { sp, j, off: i * Math.PI }; }));
  const sparks = Array.from({ length: 9 }, (_, i) => { const m = glow([0xffffff, 0xffc4ec, 0xc9b6ff][i % 3], 0.18); m.userData = { a: Math.random() * 6.28, r: 1.25 + Math.random() * 0.55, y: Math.random() * 1.6 - 0.5, ph: Math.random() * 6.28, sp: 1.5 + Math.random() * 2 }; return m; });
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 64), ringMat(0xffffff)); wave.position.set(0, 0, -0.2); scene.add(wave);
  // Travail : deux écrans holographiques animés + clavier lumineux + flux de données vers l'étoile
  const holo = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = Math.round(128 * h / w); const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.userData = { c, g: c.getContext('2d'), tex, draw }; scene.add(m); return m;
  };
  const frameHolo = (g, W, H, col) => { g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(20,40,90,.72)'; g.fillRect(0, 0, W, H); g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(2, 2, W - 4, H - 4); g.fillStyle = col; g.fillRect(8, 8, 26, 5); };
  let codeOff = 0;
  const holoCode = holo(1.0, 0.68, (g, W, H, t) => {
    frameHolo(g, W, H, 'rgba(120,230,255,.95)'); codeOff = (codeOff + 1) % 8;
    const cs = ['#7cf5c8', '#8fe6ff', '#ffb8e6', '#ffe08a'];
    for (let i = 0; i < 8; i++) { const k = (i + codeOff) * 7919; const ind = (k % 3) * 8, len = 18 + (k % 61); g.fillStyle = cs[k % 4]; g.globalAlpha = 0.9; g.fillRect(10 + ind, 20 + i * 7, len, 3.5); g.fillStyle = cs[(k >> 3) % 4]; g.fillRect(14 + ind + len, 20 + i * 7, 8 + (k % 23), 3.5); }
    g.globalAlpha = 1; if (Math.floor(t * 3) % 2) { g.fillStyle = '#fff'; g.fillRect(12, H - 12, 7, 5); }
  });
  const holoChart = holo(0.9, 0.68, (g, W, H, t) => {
    frameHolo(g, W, H, 'rgba(255,170,230,.95)');
    for (let i = 0; i < 6; i++) { const v = 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.3)); const bh = (H - 34) * v; g.fillStyle = i % 2 ? '#ffb8e6' : '#8fe6ff'; g.fillRect(12 + i * 18, H - 10 - bh, 11, bh); }
    g.strokeStyle = '#7cf5c8'; g.lineWidth = 2.5; g.beginPath(); for (let x = 0; x <= W - 20; x += 6) { const y = 30 + 14 * Math.sin(t * 3 + x * 0.08); x ? g.lineTo(10 + x, y) : g.moveTo(10, y); } g.stroke();
  });
  holoCode.position.set(1.42, 0.42, 0.2); holoCode.rotation.y = -0.42;
  holoChart.position.set(-1.42, 0.3, 0.2); holoChart.rotation.y = 0.42;
  const kbGlow = glow(0x6fe0ff, 1.2); kbGlow.scale.set(1.5, 0.35, 1);
  const flow = Array.from({ length: 10 }, (_, i) => { const m = glow([0x7cf5c8, 0x8fe6ff, 0xffb8e6][i % 3], 0.16); m.userData = { ph: i / 10, side: i % 2 ? 1 : -1 }; return m; });
  let holoTick = 0, eurekaAt = 3, eurekaT = -1;

  // --- Animation
  const cur = { gx: 0, gy: 0, tilt: 0, nod: 0, squash: 0, hop: 0, eyeOpen: 1, smile: 0.8, cheek: 0.5, star: 0, dots: 0, spin: 0.6, sway: 0, work: 0, think: 0 };
  const ptr = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.5)));
    ptr.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight * 0.5)));
  }, { passive: true });
  const k = (v, t, dt, speed) => v + (t - v) * (1 - Math.exp(-dt * speed));

  let blinkAt = 1.5, blinkT = -1, t = 0, last = performance.now(), hopV = 0, hopAgain = false, starPhase = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;

    if (until && now > until) { state = 'idle'; until = 0; publish('idle'); }

    // Cibles selon l'état
    let tg = { gx: ptr.x * 0.7, gy: -ptr.y * 0.5, tilt: 0, nod: 0, eye: 1, smile: 0.8, cheek: 0.5, star: 0, dots: 0, spin: 0.6, sway: 0, work: 0 };
    if (state === 'working') {
      // regarde l'écran, petits mouvements de lecture gauche → droite, sourire concentré
      const read = (t * 0.55) % 1;
      tg = { gx: -0.45 + read * 0.9, gy: -0.75, tilt: Math.sin(t * 0.8) * 0.05, nod: 0.12 + Math.sin(t * 14) * 0.012, eye: 0.78, smile: 0.45, cheek: 0.55, star: 0.7, dots: 0, spin: 5, sway: 0, work: 1 };
    } else if (state === 'thinking') {
      tg = { gx: -0.35 + Math.sin(t * 1.3) * 0.7, gy: 0.6 + Math.sin(t * 2.1) * 0.08, tilt: Math.sin(t * 1.1) * 0.16 - 0.06, nod: -0.1, eye: 0.82, smile: 0.1 + Math.sin(t * 3) * 0.05, cheek: 0.3, star: 1, dots: 0, spin: 3.2, sway: 1, work: 0 };
    } else if (state === 'happy') {
      tg = { gx: 0, gy: 0.1, tilt: Math.sin(t * 9) * 0.07, nod: 0.05, eye: 0.3, smile: 1.5, cheek: 0.95, star: 0.6, dots: 0, spin: 2.2, sway: 0 };
    } else if (state === 'sad') {
      tg = { gx: -0.2, gy: -0.5, tilt: -0.12, nod: 0.22, eye: 0.62, smile: -0.75, cheek: 0.15, star: 0, dots: 0, spin: 0.2, sway: 0 };
    }

    cur.gx = k(cur.gx, tg.gx, dt, 7); cur.gy = k(cur.gy, tg.gy, dt, 7);
    cur.tilt = k(cur.tilt, tg.tilt, dt, 6); cur.nod = k(cur.nod, tg.nod, dt, 6);
    cur.eyeOpen = k(cur.eyeOpen, tg.eye, dt, 14); cur.smile = k(cur.smile, tg.smile, dt, 8);
    cur.cheek = k(cur.cheek, tg.cheek, dt, 6); cur.star = k(cur.star, tg.star, dt, 5);
    cur.dots = k(cur.dots, tg.dots, dt, 5); cur.spin = k(cur.spin, tg.spin, dt, 3); cur.sway = k(cur.sway, tg.sway, dt, 4); cur.work = k(cur.work, tg.work || 0, dt, 5); cur.think = k(cur.think, state === 'thinking' ? 1 : 0, dt, 4);

    // Clignement
    let blink = 1;
    if (state !== 'happy') {
      if (blinkT < 0 && t > blinkAt) { blinkT = 0; }
      if (blinkT >= 0) { blinkT += dt; const p = blinkT / 0.16; blink = p < 0.5 ? 1 - p * 2 * 0.92 : 0.08 + (p - 0.5) * 2 * 0.92; if (p >= 1) { blinkT = -1; blink = 1; blinkAt = t + (state === 'thinking' || state === 'working' ? 1.2 + Math.random() * 1.5 : 2.2 + Math.random() * 3); } }
    }

    // Respiration / flottement / saut
    const busyS = state === 'thinking' || state === 'working'; const breathe = Math.sin(t * (busyS ? 4.2 : 1.8)) * (busyS ? 0.035 : 0.022);
    if (cur.hop > 0 || hopV !== 0) {
      hopV -= 14 * dt; cur.hop += hopV * dt;
      if (cur.hop <= 0) { cur.hop = 0; if (hopAgain) { hopV = 2.6; hopAgain = false; } else hopV = 0; }
    }
    const float = Math.sin(t * 1.5) * 0.07 * MOTION;

    head.position.y = float + cur.hop * 0.45 * MOTION + cur.work * 0.14;
    head.scale.set(1 - breathe * 0.6, 0.97 + breathe, 1 - breathe * 0.6);
    head.rotation.y = cur.gx * 0.38 * MOTION + Math.sin(t * 0.7) * 0.05 * MOTION + cur.sway * Math.sin(t * 0.9) * 0.12;
    head.rotation.x = -cur.gy * 0.28 * MOTION + cur.nod;
    head.rotation.z = cur.tilt * MOTION;

    // Yeux : suivent le regard sur la surface de la sphère
    eyes.forEach((g) => {
      const d = g.userData;
      const x = d.baseX + cur.gx * 0.07, y = d.baseY + cur.gy * 0.06;
      g.position.set(x, y, surfZ(x, y) - 0.015);
      g.rotation.y = x * 0.9; g.rotation.x = -y * 0.9;
      g.scale.set(1, Math.max(0.06, cur.eyeOpen * blink), 1);
      d.glint.position.set(0.04 + cur.gx * 0.02, 0.09 + cur.gy * 0.02, 0.07);
    });
    cheeks.forEach((m) => m.scale.set(1, 0.6, 0.3).multiplyScalar(0.7 + cur.cheek * 0.6));
    cheekMat.opacity = 0.18 + cur.cheek * 0.5;
    mouth.scale.set(0.9 + Math.abs(cur.smile) * 0.12, cur.smile, 1);
    mouth.position.y = -0.07 + (cur.smile < 0 ? -0.05 : 0);

    // Étoile
    starPhase += cur.spin * dt; star.rotation.y = Math.sin(starPhase) * 0.85; star.rotation.z = Math.sin(t * 1.4) * 0.15;
    star.position.y = 1.62 + float + cur.hop * 0.45 * MOTION + cur.work * 0.1 + Math.sin(t * 2.2) * 0.04;
    const pulse = 1 + cur.star * Math.sin(t * 6) * 0.12;
    star.scale.setScalar(0.26 * pulse * (state === 'sad' ? 0.7 : 1));
    starMat.emissiveIntensity = 0.45 + cur.star * 0.7 + Math.sin(t * 3) * 0.05;

    // Bulles qui orbitent la tête
    dots.forEach((m, i) => {
      const a = t * 2.6 + (i * Math.PI * 2) / 3;
      m.position.set(Math.cos(a) * 1.45, 0.75 + Math.sin(t * 3 + i) * 0.08, Math.sin(a) * 0.9);
      m.scale.setScalar(Math.max(0.001, cur.dots * (0.8 + 0.25 * Math.sin(t * 5 + i * 2))));
    });

    // Ordinateur portable : apparaît en glissant, mains qui tapent, lueur qui scintille, bouts de code qui s'envolent
    const w = cur.work;
    lap.scale.setScalar(Math.max(0.001, w * 0.85));
    lap.position.y = -1.2 - (1 - w) * 0.6;
    hinge.rotation.x = -0.32 - (1 - w) * 1.2;
    hands.forEach((m, i) => { const tap = Math.max(0, Math.sin(t * 17 * MOTION + i * Math.PI + Math.sin(t * 3 + i) * 1.5)); m.position.y = 0.1 + tap * 0.09 * MOTION; });
    screenLight.intensity = w * (1.1 + Math.sin(t * 9) * 0.15 + Math.sin(t * 23) * 0.1);
    logoMat.opacity = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.4));
    // Halo derrière la tête (violet quand il réfléchit, cyan quand il travaille)
    const th = cur.think, busyAmt = Math.max(th, w);
    halo.material.color.setRGB(0.7 * th + 0.35 * w, 0.55 * th + 0.85 * w, 1);
    halo.material.opacity = busyAmt * (0.35 + 0.1 * Math.sin(t * 2.4));
    halo.scale.setScalar(3.4 + Math.sin(t * 1.7) * 0.18);
    halo.position.y = head.position.y + 0.05;
    // Anneaux + comètes
    rings.forEach((g, i) => {
      g.rotation.y = Math.sin(t * 0.5 + i * 2) * 0.35;
      g.position.y = head.position.y - 0.38;
      g.userData.m.material.opacity = th * 0.7;
      g.scale.setScalar(0.85 + th * 0.15);
    });
    comets.forEach((list, i) => list.forEach(({ sp, j, off }) => {
      const a = t * (i ? -2.4 : 2.9) + off - j * 0.11 * (i ? -1 : 1), r = rings[i].userData.r;
      sp.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      sp.material.opacity = th * (1 - j / 7) * 0.95; sp.scale.setScalar(0.34 * (1 - j / 9));
    }));
    sparks.forEach((m) => { const d = m.userData; const a = d.a + t * 0.35; const tw = Math.max(0, Math.sin(t * d.sp + d.ph)); m.position.set(Math.cos(a) * d.r, d.y + head.position.y, Math.sin(a) * d.r * 0.6); m.material.opacity = th * tw * tw; m.scale.setScalar(0.08 + tw * 0.2); });
    // Onde « eurêka » toutes les ~4 s : l'étoile flashe, une onde s'élargit
    if (th > 0.6 && t > eurekaAt && eurekaT < 0) { eurekaT = 0; eurekaAt = t + 3.2 + Math.random() * 2; }
    if (eurekaT >= 0) { eurekaT += dt; const p = eurekaT / 0.9; wave.scale.setScalar(1 + p * 1.1); wave.position.y = head.position.y; wave.material.opacity = Math.max(0, (1 - p)) * 0.7 * th; starMat.emissiveIntensity += (1 - Math.min(1, p)) * 1.2; if (p >= 1) { eurekaT = -1; wave.material.opacity = 0; } }
    // Hologrammes + clavier + flux de données
    holoTick += dt; if (w > 0.02 && holoTick > 0.12) { holoTick = 0; [holoCode, holoChart].forEach((m) => { const u = m.userData; u.draw(u.g, u.c.width, u.c.height, t); u.tex.needsUpdate = true; }); }
    [holoCode, holoChart].forEach((m, i) => { m.material.opacity = w * (0.92 + Math.sin(t * 13 + i) * 0.05 + (Math.random() < 0.015 ? -0.35 : 0)); m.position.y = (i ? 0.25 : 0.45) + Math.sin(t * 1.6 + i * 2) * 0.06 + head.position.y * 0.5; m.scale.setScalar(Math.max(0.001, w)); });
    kbGlow.position.set(0, lap.position.y + 0.06, 1.3); kbGlow.material.opacity = w * (0.35 + 0.35 * Math.max(0, Math.sin(t * 17)));
    flow.forEach((m) => {
      const d = m.userData, p = (t * 0.55 + d.ph) % 1, sx = d.side * 0.62, sy = lap.position.y + 0.15;
      const ex = 0, ey = star.position.y, cx = d.side * 1.25, cy = (sy + ey) / 2;
      const x = (1 - p) * (1 - p) * sx + 2 * (1 - p) * p * cx + p * p * ex, y = (1 - p) * (1 - p) * sy + 2 * (1 - p) * p * cy + p * p * ey;
      m.position.set(x, y, 0.75 - p * 0.7); m.material.opacity = w * Math.sin(p * Math.PI) * 0.95; m.scale.setScalar(0.12 + Math.sin(p * Math.PI) * 0.16);
    });

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  function setState(s, ms) {
    if (!LABELS[s]) return;
    state = s; publish(s);
    if (s === 'happy') { hopV = 4.2; hopAgain = true; }
    until = s === 'happy' ? performance.now() + (ms || 2000) : s === 'sad' ? performance.now() + (ms || 3500) : 0;
  }
  window.MuseAvatar = { setState };

  // Un clic sur la mascotte la fait réagir
  canvas.addEventListener('click', () => { if (state === 'idle') setState('happy', 1400); });
})();
