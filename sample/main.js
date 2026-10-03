// まなびスタジアム 演出サンプル（C：3Dスタジアム＋2Dモンスター）
(function () {
  "use strict";
  const D = window.DATA;
  const LIGHT = /[?&]light/.test(location.search);
  const W = 1280, H = 720;
  const $ = (id) => document.getElementById(id);

  // ---------- 画面の拡大縮小 ----------
  const stage = $("stage");
  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  addEventListener("resize", fit); fit();

  // ---------- レンダラー ----------
  const renderer = new THREE.WebGLRenderer({ antialias: !LIGHT, powerPreference: "high-performance" });
  renderer.setPixelRatio(LIGHT ? 0.75 : Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  $("gl").appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0f2a, 70, 190);
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 500);

  // ---------- 便利 ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const easeOut = (x) => { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); };
  const easeIn = (x) => { x = clamp(x, 0, 1); return x * x * x; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.userData.canvas = c; return t;
  }
  function imgTex(src) {
    const t = new THREE.TextureLoader().load(src);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  }

  // ---------- 空と星 ----------
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(220, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "varying vec3 vP; void main(){ float h=clamp(vP.y,0.0,1.0); vec3 c=mix(vec3(0.20,0.10,0.35),vec3(0.02,0.03,0.12),pow(h,0.5)); gl_FragColor=vec4(c,1.0); }",
  })));
  {
    const n = LIGHT ? 300 : 900, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = rand(0, Math.PI * 2), ph = rand(0.08, 1.4), r = 200;
      p[i * 3] = r * Math.cos(th) * Math.cos(ph); p[i * 3 + 1] = r * Math.sin(ph); p[i * 3 + 2] = r * Math.sin(th) * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.85 })));
  }

  // ---------- 光 ----------
  scene.add(new THREE.HemisphereLight(0x8fa0ff, 0x1a1530, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(10, 30, 15); scene.add(sun);
  function spot(color) {
    const s = new THREE.SpotLight(color, 0, 40, 0.32, 0.6, 0);
    s.position.set(0, 22, 4); scene.add(s); scene.add(s.target); return s;
  }
  const spotA = spot(0x88ccff), spotB = spot(0xffaa77);

  // ---------- フィールド ----------
  const fieldTex = canvasTex(1024, 1024, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    const gr = g.createRadialGradient(cx, cy, 50, cx, cy, 512);
    gr.addColorStop(0, "#c9a46a"); gr.addColorStop(0.8, "#a9824c"); gr.addColorStop(1, "#6b4f2c");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,240,210" : "80,50,20"},${rand(0.03, 0.09)})`; g.fillRect(rand(0, w), rand(0, h), rand(2, 8), rand(2, 8)); }
    g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 10;
    g.beginPath(); g.arc(cx, cy, 470, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(cx, cy, 120, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(cx, cy - 470); g.lineTo(cx, cy + 470); g.stroke();
    g.lineWidth = 8;
    g.strokeStyle = "rgba(90,170,255,0.9)"; g.beginPath(); g.arc(cx - 220, cy, 85, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "rgba(255,110,90,0.9)"; g.beginPath(); g.arc(cx + 220, cy, 85, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(255,255,255,0.9)"; g.font = "bold 64px MR, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("まなび", cx, cy);
  });
  const field = new THREE.Mesh(new THREE.CircleGeometry(16, 96), new THREE.MeshStandardMaterial({ map: fieldTex, roughness: 0.95 }));
  field.rotation.x = -Math.PI / 2; scene.add(field);
  // 外の地面
  const outer = new THREE.Mesh(new THREE.CircleGeometry(160, 48), new THREE.MeshStandardMaterial({ color: 0x141a33, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; scene.add(outer);

  // ---------- 観客席 ----------
  const ROWS = 12, R0 = 16.5, STEP_R = 1.5, STEP_H = 1.0, WALL = 1.6;
  {
    const pts = [V(16.0, 0, 0), V(16.0, WALL, 0)];
    for (let i = 0; i < ROWS; i++) {
      const r = R0 + i * STEP_R, y = WALL + i * STEP_H;
      pts.push(new THREE.Vector2(r, y), new THREE.Vector2(r + STEP_R, y), new THREE.Vector2(r + STEP_R, y + STEP_H));
    }
    pts.push(new THREE.Vector2(R0 + ROWS * STEP_R + 2, WALL + ROWS * STEP_H), new THREE.Vector2(R0 + ROWS * STEP_R + 2, 0));
    const lathe = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x, p.y)), 96);
    scene.add(new THREE.Mesh(lathe, new THREE.MeshStandardMaterial({ color: 0x2c3560, roughness: 0.8, side: THREE.DoubleSide })));
    // かべの光るライン
    const band = new THREE.Mesh(new THREE.CylinderGeometry(15.95, 15.95, 0.35, 96, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x66e0ff, side: THREE.DoubleSide, toneMapped: false }));
    band.position.y = WALL - 0.3; scene.add(band);
  }
  const GATE_W = 0.22; // 入場ゲート（±x の方向）にはお客さんを置かない
  const crowd = [];
  {
    const sp = LIGHT ? 1.15 : 0.72;
    for (let i = 0; i < ROWS; i++) {
      const r = R0 + i * STEP_R + 0.7, y = WALL + i * STEP_H, n = Math.floor((Math.PI * 2 * r) / sp);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rand(-0.01, 0.01);
        const d = Math.min(Math.abs(Math.atan2(Math.sin(a), Math.cos(a))), Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))));
        if (d < GATE_W + i * 0.004) continue;
        if (Math.random() < 0.08) continue;
        crowd.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y, a, ph: rand(0, 6.28), sp: rand(5, 9), h: rand(0.7, 1.0) });
      }
    }
    const geo = new THREE.BoxGeometry(0.42, 0.75, 0.3); geo.translate(0, 0.375, 0);
    const mat = new THREE.MeshLambertMaterial();
    var crowdMesh = new THREE.InstancedMesh(geo, mat, crowd.length);
    const pal = [0xff6b6b, 0x4dabf7, 0xffd43b, 0x69db7c, 0xf783ac, 0xffffff, 0x845ef7, 0xff922b];
    const col = new THREE.Color();
    crowd.forEach((c, i) => { col.setHex(pal[i % pal.length]).multiplyScalar(Math.random() < 0.12 ? 1.3 : rand(0.25, 0.55)); crowdMesh.setColorAt(i, col); });
    scene.add(crowdMesh);
  }
  const dummy = new THREE.Object3D();
  function updateCrowd(t, excite) {
    for (let i = 0; i < crowd.length; i++) {
      const c = crowd[i];
      const jump = Math.max(0, Math.sin(t * c.sp + c.ph)) * 0.55 * excite;
      dummy.position.set(c.x, c.y + jump, c.z); dummy.rotation.set(0, -c.a + Math.PI / 2, 0);
      dummy.scale.set(1, c.h + jump * 0.3, 1); dummy.updateMatrix(); crowdMesh.setMatrixAt(i, dummy.matrix);
    }
    crowdMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- 入場ゲート ----------
  function gate(sign, color) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), m), p2 = p1.clone(), top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 7.5), m);
    p1.position.set(0, 3, -3.5); p2.position.set(0, 3, 3.5); top.position.set(0, 6, 0);
    g.add(p1, p2, top); g.position.set(sign * 16.3, 0, 0); scene.add(g); return g;
  }
  gate(-1, 0x4dabf7); gate(1, 0xff6b6b);

  // ---------- 照明塔とサーチライト ----------
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beams = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, r = 38;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 24, 8), new THREE.MeshStandardMaterial({ color: 0x555b75 }));
    pole.position.set(Math.cos(a) * r, 12, Math.sin(a) * r); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 1), new THREE.MeshBasicMaterial({ color: 0xffffee, toneMapped: false }));
    head.position.set(Math.cos(a) * r, 24.5, Math.sin(a) * r); head.lookAt(0, 0, 0); scene.add(head);
    const pivot = new THREE.Object3D(); pivot.position.copy(head.position); scene.add(pivot);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 60, 24, 1, true), beamMat);
    cone.rotation.x = -Math.PI / 2; cone.position.z = 30; pivot.add(cone);
    beams.push({ pivot, a, target: V(0, 0, 0) });
  }

  // ---------- 大型ビジョン ----------
  const vision = canvasTex(1024, 576, () => {});
  function drawVision(mode) {
    const c = vision.userData.canvas, g = c.getContext("2d"), w = c.width, h = c.height;
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#1b2a6b"); gr.addColorStop(1, "#5a1b5e");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.textAlign = "center"; g.textBaseline = "middle";
    if (mode === "logo") {
      g.fillStyle = "#ffe066"; g.font = "bold 110px MR, sans-serif"; g.fillText("まなび", w / 2, h / 2 - 70);
      g.fillStyle = "#fff"; g.font = "bold 120px MR, sans-serif"; g.fillText("スタジアム", w / 2, h / 2 + 70);
    } else {
      if (imgA.complete) { g.imageSmoothingEnabled = false; g.drawImage(imgA, 40, 120, 340, 340); g.drawImage(imgB, w - 380, 120, 340, 340); }
      g.fillStyle = "#ffe066"; g.font = "bold 200px MR, sans-serif"; g.fillText("VS", w / 2, h / 2);
      g.font = "bold 44px MR, sans-serif"; g.fillStyle = "#9fd8ff"; g.fillText(D.nameA, 210, 510); g.fillStyle = "#ffb3a8"; g.fillText(D.nameB, w - 210, 510);
    }
    vision.needsUpdate = true;
  }
  const imgA = new Image(); imgA.src = D.imgA; const imgB = new Image(); imgB.src = D.imgB;
  {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(19, 11.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x222633 }));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(18, 10.125), new THREE.MeshBasicMaterial({ map: vision, toneMapped: false }));
    scr.position.z = 0.41; const g = new THREE.Group(); g.add(frame, scr);
    g.position.set(0, 22, -38); scene.add(g);
  }

  // ---------- モンスター ----------
  function monster(src, x, color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ map: imgTex(src), transparent: true, alphaTest: 0.4, toneMapped: false });
    const body = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), mat); body.position.y = 2.6;
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.scale.set(1.2, 0.7, 1);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.5, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 32, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    pillar.position.y = 15;
    const holder = new THREE.Group(); holder.add(body); // せり上がり用
    g.add(sh, ring, pillar, holder); g.position.x = x; scene.add(g);
    return { g, body, holder, sh, ring, pillar, mat, home: x, show: 0 };
  }
  const mA = monster(D.imgA, -6, 0x4dabf7), mB = monster(D.imgB, 6, 0xff6b6b);
  mA.holder.position.y = -6; mB.holder.position.y = -6; mA.sh.visible = mB.sh.visible = false;

  // ---------- パーティクル ----------
  function particles(n, size, additive) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
    const P = []; for (let i = 0; i < n; i++) { P.push({ life: 0, v: V(0, 0, 0), grav: 0, drag: 1 }); pos[i * 3 + 1] = -999; }
    let next = 0; const c = new THREE.Color();
    return {
      emit(k, o, speed, colors, opt = {}) {
        for (let j = 0; j < k; j++) {
          const i = next; next = (next + 1) % n; const p = P[i];
          p.life = rand(opt.life || 1, (opt.life || 1) * 1.6); p.grav = opt.grav ?? -9; p.drag = opt.drag ?? 0.97;
          const d = V(rand(-1, 1), rand(opt.up ?? -0.2, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1));
          p.v.copy(d); pos[i * 3] = o.x + rand(-0.3, 0.3); pos[i * 3 + 1] = o.y + rand(-0.3, 0.3); pos[i * 3 + 2] = o.z + rand(-0.3, 0.3);
          c.setHex(colors[(Math.random() * colors.length) | 0]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        g.attributes.color.needsUpdate = true;
      },
      update(dt) {
        for (let i = 0; i < n; i++) {
          const p = P[i]; if (p.life <= 0) continue;
          p.life -= dt; if (p.life <= 0) { pos[i * 3 + 1] = -999; continue; }
          p.v.y += p.grav * dt; p.v.multiplyScalar(p.drag);
          pos[i * 3] += p.v.x * dt; pos[i * 3 + 1] += p.v.y * dt; pos[i * 3 + 2] += p.v.z * dt;
          if (pos[i * 3 + 1] < 0.05) { pos[i * 3 + 1] = 0.05; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; }
        }
        g.attributes.position.needsUpdate = true;
      },
    };
  }
  const sparks = particles(LIGHT ? 300 : 900, 0.35, true);
  const confetti = particles(LIGHT ? 300 : 800, 0.28, false);

  // 数字のエフェクト（さんすう）
  const glyphs = "1234567890+−×÷=".split("").map((ch) => canvasTex(128, 128, (g) => {
    g.font = "bold 100px MR, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 12; g.strokeStyle = "#1c3d8a"; g.strokeText(ch, 64, 70); g.fillStyle = "#fff36b"; g.fillText(ch, 64, 70);
  }));
  const nums = [];
  for (let i = 0; i < (LIGHT ? 20 : 45); i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphs[i % glyphs.length], transparent: true, depthWrite: false, toneMapped: false }));
    s.visible = false; scene.add(s); nums.push({ s, life: 0, v: V(0, 0, 0) });
  }
  function emitNums(o, k) {
    let n = 0;
    for (const q of nums) { if (q.life > 0) continue; q.life = rand(0.9, 1.5); q.s.position.copy(o); q.v.set(rand(-1, 1), rand(0.3, 1.2), rand(-1, 1)).normalize().multiplyScalar(rand(5, 11)); q.s.visible = true; const sc = rand(0.8, 1.6); q.s.scale.set(sc, sc, 1); if (++n >= k) break; }
  }
  function updateNums(dt) {
    for (const q of nums) { if (q.life <= 0) continue; q.life -= dt; q.v.y -= 9 * dt; q.v.multiplyScalar(0.96); q.s.position.addScaledVector(q.v, dt); q.s.material.opacity = clamp(q.life * 2, 0, 1); if (q.life <= 0) q.s.visible = false; }
  }
  // 衝撃波
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.2, 64), new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  shock.rotation.x = -Math.PI / 2; shock.position.y = 0.1; scene.add(shock);
  const shock2 = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  scene.add(shock2);

  // ---------- 2Dの重ね表示 ----------
  const telop = $("telop"), telopText = $("telopText");
  let telopTimer = null;
  function say(text) {
    telop.classList.add("on"); telopText.textContent = ""; clearInterval(telopTimer);
    let i = 0; telopTimer = setInterval(() => { telopText.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(telopTimer); }, 40);
  }
  function flash(op = 1) { const f = $("flash"); f.style.transition = "none"; f.style.opacity = op; requestAnimationFrame(() => { f.style.transition = "opacity .5s"; f.style.opacity = 0; }); }
  function cutin(on) { $("cutin").classList.toggle("on", on); }
  function setHP(who, r) { $("hp" + who).style.width = r * 100 + "%"; }
  function damage(n, pos3) {
    const v = pos3.clone().project(camera);
    const d = $("dmg"); d.textContent = n; d.style.left = ((v.x + 1) / 2) * W + "px"; d.style.top = ((1 - v.y) / 2) * H + "px";
    d.classList.remove("on"); void d.offsetWidth; d.classList.add("on");
  }
  function vsSlam() { const e = $("vs"); e.classList.remove("on"); void e.offsetWidth; e.classList.add("on"); }
  $("cutImg").src = D.imgA; $("iconA").src = D.imgA; $("iconB").src = D.imgB;
  $("nameA").textContent = D.nameA; $("nameB").textContent = D.nameB;

  // ---------- 音 ----------
  const bgm = new Audio(D.bgm); bgm.loop = true; bgm.volume = 0.45;
  function se(k, vol = 0.8) { const a = new Audio(D.se[k]); a.volume = vol; a.play().catch(() => {}); }

  // ---------- カメラ ----------
  let shake = 0;
  const camPos = V(0, 0, 0), camLook = V(0, 0, 0);
  function lerpKeys(t, keys) {
    if (t <= keys[0].t) return keys[0];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b.t) { const u = ease((t - a.t) / (b.t - a.t)); return { p: a.p.clone().lerp(b.p, u), l: a.l.clone().lerp(b.l, u) }; }
    }
    return keys[keys.length - 1];
  }
  const K = (t, p, l) => ({ t, p: V(...p), l: V(...l) });
  const SHOTS = [
    [4.5, 7.0, [K(4.5, [-1, 3.2, 12], [-6, 2.6, 0]), K(7.0, [-2.5, 2.8, 9.5], [-6, 2.8, 0])]],
    [7.0, 9.5, [K(7.0, [1, 3.2, 12], [6, 2.6, 0]), K(9.5, [2.5, 2.8, 9.5], [6, 2.8, 0])]],
    [9.5, 11.2, [K(9.5, [0, 7, 22], [0, 2.5, 0]), K(11.2, [0, 5, 17], [0, 2.5, 0])]],
    [11.2, 12.4, [K(11.2, [-12, 2.0, 5], [4, 2.8, 0]), K(12.4, [-11, 2.4, 6], [4, 2.8, 0])]],
    [12.4, 13.1, [K(12.4, [-5, 2.4, 9], [6, 2.6, 0]), K(13.1, [1, 2.6, 9], [6, 2.6, 0])]],
    [13.1, 17, [K(13.1, [3.5, 3, 10], [5, 2.6, 0]), K(17, [0, 8, 24], [1, 2.5, 0])]],
  ];
  function updateCamera(t) {
    if (t < 4.5) {
      const u = ease(t / 4.5), a = -0.9 + u * 2.2, r = 46 - u * 10, h = 22 - u * 8;
      camPos.set(Math.sin(a) * r, h, Math.cos(a) * r); camLook.set(0, 3, 0);
    } else {
      for (const [a, b, keys] of SHOTS) if (t >= a && (t < b || b === 17)) { const k = lerpKeys(t, keys); camPos.copy(k.p); camLook.copy(k.l); break; }
    }
    camera.position.copy(camPos);
    if (shake > 0.001) camera.position.add(V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake));
    camera.lookAt(camLook);
  }

  // ---------- タイムライン ----------
  const posB = () => mB.g.position.clone().add(V(0, 2.6, 0));
  const EVENTS = [
    [0.0, () => { drawVision("logo"); say("まなびスタジアムへ ようこそ！"); $("letter").classList.add("on"); }],
    [4.5, () => { say(`あおコーナー！ さんすうの ${D.nameA}！`); se("statup"); }],
    [5.2, () => { se("kira"); confetti.emit(LIGHT ? 120 : 260, V(-6, 1, 0), 9, [0x4dabf7, 0xffffff, 0x99e9f2, 0xffe066], { up: 0.6, grav: -4, drag: 0.985, life: 2.2 }); }],
    [7.0, () => { say(`あかコーナー！ こくごの ${D.nameB}！`); se("statup"); }],
    [7.7, () => { se("fire"); confetti.emit(LIGHT ? 120 : 260, V(6, 1, 0), 9, [0xff6b6b, 0xffffff, 0xffa94d, 0xffe066], { up: 0.6, grav: -4, drag: 0.985, life: 2.2 }); }],
    [9.5, () => { say("いよいよ たいせんの はじまりだ！"); drawVision("vs"); $("letter").classList.remove("on"); }],
    [9.9, () => { vsSlam(); se("start"); shake = 0.35; $("hud").classList.add("on"); }],
    [11.2, () => { say(`${D.nameA}の パワーシュート！`); cutin(true); se("thunder"); }],
    [12.3, () => { cutin(false); se("wind"); }],
    [13.0, () => { flash(0.9); se("crit", 1); se("hit", 1); shake = 0.6; emitNums(posB(), LIGHT ? 20 : 40); sparks.emit(LIGHT ? 150 : 400, posB(), 14, [0xfff3a0, 0xffffff, 0x74c0fc, 0xffd43b], { grav: -6, life: 0.8 }); setHP("B", 0.32); damage(128, posB().add(V(0, 2, 0))); }],
    [13.5, () => { say("こうかは ばつぐんだ！"); }],
    [15.6, () => { $("end").classList.add("on"); }],
  ];
  function updateWorld(t, dt) {
    // サーチライト
    beams.forEach((b, i) => {
      let tx, tz;
      if (t < 4.5) { const a = t * 1.3 + i * 1.7; tx = Math.cos(a) * 12; tz = Math.sin(a) * 12; }
      else if (t < 7) { tx = -6; tz = 0; } else if (t < 9.5) { tx = i % 2 ? 6 : -6; tz = 0; }
      else { const a = t * 0.8 + i * 1.6; tx = Math.cos(a) * 8; tz = Math.sin(a) * 8; }
      b.target.lerp(V(tx, 0, tz), Math.min(1, dt * 3)); b.pivot.lookAt(b.target);
    });
    beamMat.opacity = t < 9.5 ? 0.08 : 0.05;
    // スポットライト
    spotA.target.position.set(-6, 0, 0); spotB.target.position.set(6, 0, 0);
    spotA.position.set(-6, 20, 6); spotB.position.set(6, 20, 6);
    spotA.intensity = t > 4.5 ? 6 * ease((t - 4.5) * 2) : 0; spotB.intensity = t > 7 ? 6 * ease((t - 7) * 2) : 0;
    // 入場（せり上がり＋光の柱）
    [[mA, 4.6], [mB, 7.1]].forEach(([m, t0]) => {
      const u = (t - t0) / 0.9;
      m.holder.position.y = u < 0 ? -6 : -6 + 6 * easeOut(u);
      m.sh.visible = u > 0.6;
      m.pillar.material.opacity = u < 0 ? 0 : u < 1 ? 0.35 * ease(u * 2) : 0.35 * Math.max(0, 1 - (u - 1) * 0.9);
      m.ring.material.opacity = u > 0 ? 0.8 * ease(u) : 0;
      m.ring.rotation.z += dt * 0.8;
      m.show = u > 0 ? 1 : 0;
    });
    // ふだんの ゆれ
    [mA, mB].forEach((m, i) => {
      if (!m.show) return;
      const bob = Math.sin(t * 2.2 + i * 2) * 0.12;
      m.body.position.y = 2.6 + bob;
      const br = 1 + Math.sin(t * 2.2 + i * 2) * 0.025; m.body.scale.set(2 - br, br, 1);
    });
    // こうげき：Aが とびこむ
    let ax = mA.home;
    if (t > 12.4 && t < 13.0) ax = mA.home + 8.5 * easeIn((t - 12.4) / 0.6);
    else if (t >= 13.0 && t < 13.9) ax = mA.home + 8.5 * (1 - easeOut((t - 13.0) / 0.9));
    mA.g.position.x = ax;
    if (t > 12.4 && t < 13.0) mA.body.scale.set(1.25, 0.85, 1);
    // Bが ふっとぶ・点めつ
    let bx = mB.home;
    if (t >= 13.0 && t < 14.5) bx = mB.home + 2.5 * Math.sin(clamp((t - 13.0) / 1.5, 0, 1) * Math.PI) * (1 - (t - 13) / 3);
    mB.g.position.x = bx;
    mB.body.visible = !(t > 13.0 && t < 13.8 && Math.floor(t * 20) % 2 === 0);
    mB.mat.color.setRGB(1, t > 13 && t < 13.4 ? 0.4 : 1, t > 13 && t < 13.4 ? 0.4 : 1);
    // 衝撃波
    const s = (t - 13.0) / 0.7;
    if (s > 0 && s < 1) {
      shock.position.x = mB.home; shock.scale.setScalar(1 + s * 9); shock.material.opacity = 1 - s;
      shock2.position.copy(posB()); shock2.scale.setScalar(0.5 + s * 4); shock2.material.opacity = 0.6 * (1 - s);
    } else { shock.material.opacity = 0; shock2.material.opacity = 0; }
    // ビルボード（モンスターはカメラの方を向く）
    [mA, mB].forEach((m) => { m.holder.rotation.y = Math.atan2(camera.position.x - m.g.position.x, camera.position.z - m.g.position.z); });
    // 観客のもり上がり
    const ex = t < 4.5 ? 0.35 : t < 9.5 ? 0.8 : t < 13 ? 0.6 : 1.0;
    updateCrowd(t, ex);
    shake *= Math.pow(0.02, dt);
    sparks.update(dt); confetti.update(dt); updateNums(dt);
  }

  // ---------- FPS ----------
  const fpsEl = $("fps"); let frames = 0, acc = 0, total = 0, totalFrames = 0, minFps = 999;
  function fps(dt, t) {
    frames++; acc += dt;
    if (t > 1) { total += dt; totalFrames++; }
    if (acc >= 0.5) { const f = frames / acc; if (t > 1) minFps = Math.min(minFps, f); fpsEl.textContent = `FPS ${f.toFixed(0)}${LIGHT ? "（かるい）" : ""}`; frames = 0; acc = 0; }
  }

  // ---------- 動かす ----------
  let start = null, last = 0, ei = 0, playing = false, simDone = false;
  const AT = (location.search.match(/[?&]at=([\d.]+)/) || [])[1] ? parseFloat(location.search.match(/[?&]at=([\d.]+)/)[1]) : null;
  if (AT !== null) { playing = true; $("start").classList.remove("on"); }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!playing) { renderer.render(scene, camera); return; }
    if (start === null) { start = now; last = now; }
    const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
    const t = AT !== null ? AT : (now - start) / 1000;
    if (AT !== null && !simDone) { simDone = true; for (let x = 0; x < AT; x += 1 / 30) { while (ei < EVENTS.length && x >= EVENTS[ei][0]) EVENTS[ei++][1](); updateWorld(x, 1 / 30); } }
    while (ei < EVENTS.length && t >= EVENTS[ei][0]) EVENTS[ei++][1]();
    if (AT === null) updateWorld(t, dt); updateCamera(t); fps(raw, t);
    if (t > 15.6 && !$("result").textContent) {
      const avg = totalFrames / total;
      $("result").textContent = `平均 FPS：${avg.toFixed(0)}　いちばん低いとき：${minFps.toFixed(0)}　→ ${avg >= 50 ? "◎ じゅうぶん なめらか" : avg >= 30 ? "○ だいじょうぶ" : "△ 重い（かるいモードを ためして）"}`;
    }
    renderer.render(scene, camera);
  }
  updateCamera(0); updateCrowd(0, 0.3); drawVision("logo");
  requestAnimationFrame(frame);

  $("startBtn").addEventListener("click", () => {
    $("start").classList.remove("on"); playing = true; bgm.currentTime = 0; bgm.play().catch(() => {});
  });
  $("again").addEventListener("click", () => location.reload());
  $("mode").textContent = LIGHT ? "ふつうモードで ためす" : "かるいモードで ためす";
  $("mode").addEventListener("click", () => { location.href = location.pathname + (LIGHT ? "" : "?light"); });
  $("renderer").textContent = (() => { try { const gl = renderer.getContext(); const ext = gl.getExtension("WEBGL_debug_renderer_info"); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ""; } catch (e) { return ""; } })();
})();
