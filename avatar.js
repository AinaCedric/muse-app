// Mascotte 3D de Muse (personnage original) — Three.js.
// États : idle (repos) · thinking (réfléchit) · happy (réponse reçue) · sad (erreur)
// API : window.MuseAvatar.setState('thinking' | 'idle' | 'happy' | 'sad')
(function () {
  const wrap = document.getElementById('who');
  const canvas = document.getElementById('avatar');
  const statusEl = document.getElementById('status');
  if (!wrap || !canvas) return;

  const LABELS = { idle: '✨ en ligne', thinking: '🧠 réfléchit', happy: '💜 voilà !', sad: '😕 oups' };
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

  // --- Animation
  const cur = { gx: 0, gy: 0, tilt: 0, nod: 0, squash: 0, hop: 0, eyeOpen: 1, smile: 0.8, cheek: 0.5, star: 0, dots: 0, spin: 0.6, sway: 0 };
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
    let tg = { gx: ptr.x * 0.7, gy: -ptr.y * 0.5, tilt: 0, nod: 0, eye: 1, smile: 0.8, cheek: 0.5, star: 0, dots: 0, spin: 0.6, sway: 0 };
    if (state === 'thinking') {
      tg = { gx: -0.35 + Math.sin(t * 1.3) * 0.7, gy: 0.6 + Math.sin(t * 2.1) * 0.08, tilt: Math.sin(t * 1.1) * 0.16 - 0.06, nod: -0.1, eye: 0.82, smile: 0.1 + Math.sin(t * 3) * 0.05, cheek: 0.3, star: 1, dots: 1, spin: 3.2, sway: 1 };
    } else if (state === 'happy') {
      tg = { gx: 0, gy: 0.1, tilt: Math.sin(t * 9) * 0.07, nod: 0.05, eye: 0.3, smile: 1.5, cheek: 0.95, star: 0.6, dots: 0, spin: 2.2, sway: 0 };
    } else if (state === 'sad') {
      tg = { gx: -0.2, gy: -0.5, tilt: -0.12, nod: 0.22, eye: 0.62, smile: -0.75, cheek: 0.15, star: 0, dots: 0, spin: 0.2, sway: 0 };
    }

    cur.gx = k(cur.gx, tg.gx, dt, 7); cur.gy = k(cur.gy, tg.gy, dt, 7);
    cur.tilt = k(cur.tilt, tg.tilt, dt, 6); cur.nod = k(cur.nod, tg.nod, dt, 6);
    cur.eyeOpen = k(cur.eyeOpen, tg.eye, dt, 14); cur.smile = k(cur.smile, tg.smile, dt, 8);
    cur.cheek = k(cur.cheek, tg.cheek, dt, 6); cur.star = k(cur.star, tg.star, dt, 5);
    cur.dots = k(cur.dots, tg.dots, dt, 5); cur.spin = k(cur.spin, tg.spin, dt, 3); cur.sway = k(cur.sway, tg.sway, dt, 4);

    // Clignement
    let blink = 1;
    if (state !== 'happy') {
      if (blinkT < 0 && t > blinkAt) { blinkT = 0; }
      if (blinkT >= 0) { blinkT += dt; const p = blinkT / 0.16; blink = p < 0.5 ? 1 - p * 2 * 0.92 : 0.08 + (p - 0.5) * 2 * 0.92; if (p >= 1) { blinkT = -1; blink = 1; blinkAt = t + (state === 'thinking' ? 1.2 + Math.random() * 1.5 : 2.2 + Math.random() * 3); } }
    }

    // Respiration / flottement / saut
    const breathe = Math.sin(t * (state === 'thinking' ? 4.2 : 1.8)) * (state === 'thinking' ? 0.035 : 0.022);
    if (cur.hop > 0 || hopV !== 0) {
      hopV -= 14 * dt; cur.hop += hopV * dt;
      if (cur.hop <= 0) { cur.hop = 0; if (hopAgain) { hopV = 2.6; hopAgain = false; } else hopV = 0; }
    }
    const float = Math.sin(t * 1.5) * 0.07 * MOTION;

    head.position.y = float + cur.hop * 0.45 * MOTION;
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
    star.position.y = 1.62 + float + cur.hop * 0.45 * MOTION + Math.sin(t * 2.2) * 0.04;
    const pulse = 1 + cur.star * Math.sin(t * 6) * 0.12;
    star.scale.setScalar(0.26 * pulse * (state === 'sad' ? 0.7 : 1));
    starMat.emissiveIntensity = 0.45 + cur.star * 0.7 + Math.sin(t * 3) * 0.05;

    // Bulles qui orbitent la tête
    dots.forEach((m, i) => {
      const a = t * 2.6 + (i * Math.PI * 2) / 3;
      m.position.set(Math.cos(a) * 1.45, 0.75 + Math.sin(t * 3 + i) * 0.08, Math.sin(a) * 0.9);
      m.scale.setScalar(Math.max(0.001, cur.dots * (0.8 + 0.25 * Math.sin(t * 5 + i * 2))));
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
