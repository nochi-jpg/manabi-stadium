// ===== まなびスタジアム：3Dスタジアムと演出（STD）=====
// まなびバトルの game.js（スタジアム用に すこし差しかえたもの）から よばれる。
// ・3D：スタジアム・観客・ライト・大型ビジョン・入場するモンスター（Three.js）
// ・2D：わざのエフェクト（教科ごと）・花吹雪（canvas）
// ・file:// では 画像ファイルを WebGL に わたせないので、モンスターの絵は std_img.js（data URL）を使う
(function () {
  'use strict';
  const W = 1280, H = 720;
  const LIGHT = /[?&]light/.test(location.search);
  const FAST = () => !!window.FAST;
  const $ = (s, r = document) => r.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const easeOut = x => { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); };
  const wait = ms => new Promise(r => setTimeout(r, FAST() ? ms / 50 : ms));
  const FONT = '"MBRound","BIZ UDPGothic","Meiryo",sans-serif';
  const TH = {
    国語: { c: ['#ff8787', '#ffffff', '#ffd8a8'], g: 'あいうえおかな字文詩'.split(''), fx: 'ink', ink: '#1b1f4a' },
    算数: { c: ['#74c0fc', '#fff36b', '#ffffff'], g: '1234567890+−×÷='.split(''), fx: 'geo', ink: '#1c3d8a' },
    理科: { c: ['#8ce99a', '#99e9f2', '#ffffff', '#fff36b'], g: ['H', 'O', 'C', '⚡', 'N'], fx: 'bolt', ink: '#0b5345' },
    社会: { c: ['#ffd43b', '#e8a33d', '#ffffff', '#8ce99a'], g: ['日', '本', '国', '城', '旗'], fx: 'rock', ink: '#6b3d0e' },
    英語: { c: ['#da77f2', '#ff8cc6', '#ffffff', '#91a7ff'], g: 'ABCDEFGHIJKLMN'.split(''), fx: 'star', ink: '#4a1a6b' },
  };
  const THX = { c: ['#ffffff', '#fff3bf', '#ffd43b'], g: ['★', '✦'], fx: 'star', ink: '#333' };

  let renderer, scene, camera, gl, fx, fxc, ui, ready = false, mode = 'title', T0 = performance.now(), last = T0;
  const STD = (window.STD = { on: true });

  // ---------- 便利 ----------
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.canvas = c; return t;
  }
  const imgSrc = html => { const m = /src="([^"]+)"/.exec(html || ''); return m ? m[1] : ''; };
  const dataOf = src => (window.STD_IMG && src && (window.STD_IMG[src] || window.STD_IMG[src.replace(/^.*?(images\/)/, '$1')])) || '';
  function monsterTex(art, emo, flip) {
    const d = dataOf(imgSrc(art));
    let t;
    if (d) {
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      const im = new Image();
      im.onload = () => { const g = c.getContext('2d'), k = Math.max(1, Math.floor(1024 / Math.max(im.width, im.height))); c.width = im.width * k; c.height = im.height * k; g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, c.width, c.height); t.needsUpdate = true; };
      im.src = d;
    }
    else t = canvasTex(256, 256, (g) => { g.font = '200px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emo || '❓', 128, 140); });
    t.colorSpace = THREE.SRGBColorSpace;
    if (flip) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
    return t;
  }

  // 画面に うつる大きさ × 画面のこまかさ（電子黒板で 1280×720 を引きのばして ぼやけないように）
  function pixRatio() {
    const st = document.querySelector('#stage'), k = st ? st.getBoundingClientRect().width / W : 1;
    const r = (window.devicePixelRatio || 1) * (k || 1);
    return LIGHT ? clamp(r * 0.6, 0.6, 1) : clamp(r, 1, 2);
  }
  function resize() {
    if (renderer) renderer.setPixelRatio(pixRatio());
    if (fx) { const r = LIGHT ? 1 : clamp(pixRatio(), 1, 2); fx.width = W * r; fx.height = H * r; }
  }
  addEventListener('resize', () => setTimeout(resize, 50));
  // ---------- 3D の世界 ----------
  const W3 = {};
  function build3D() {
    renderer = new THREE.WebGLRenderer({ antialias: !LIGHT, powerPreference: 'high-performance', alpha: false });
    renderer.setPixelRatio(pixRatio());
    renderer.setSize(W, H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    gl.appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0a0f2a, 70, 190);
    camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 500);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    // 空・星
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(220, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float h=clamp(vP.y,0.0,1.0); vec3 c=mix(vec3(0.20,0.10,0.35),vec3(0.02,0.03,0.12),pow(h,0.5)); gl_FragColor=vec4(c,1.0); }',
    })));
    {
      const n = LIGHT ? 300 : 900, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const th = rand(0, 6.283), ph = rand(0.08, 1.4); p[i * 3] = 200 * Math.cos(th) * Math.cos(ph); p[i * 3 + 1] = 200 * Math.sin(ph); p[i * 3 + 2] = 200 * Math.sin(th) * Math.cos(ph); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, fog: false, transparent: true, opacity: 0.85 })));
    }
    scene.add(new THREE.HemisphereLight(0x8fa0ff, 0x1a1530, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(10, 30, 15); scene.add(sun);
    W3.spots = [0x88ccff, 0xffaa77].map((c, i) => { const s = new THREE.SpotLight(c, 0, 40, 0.32, 0.6, 0); s.position.set(i ? 6 : -6, 20, 6); s.target.position.set(i ? 6 : -6, 0, 0); scene.add(s, s.target); return s; });
    W3.flash = new THREE.PointLight(0xffffff, 0, 60, 0); W3.flash.position.set(0, 8, 6); scene.add(W3.flash);
    // フィールド
    W3.fieldTex = canvasTex(1024, 1024, drawField);
    const field = new THREE.Mesh(new THREE.CircleGeometry(16, 96), new THREE.MeshStandardMaterial({ map: W3.fieldTex, roughness: 0.95 }));
    field.rotation.x = -Math.PI / 2; scene.add(field);
    const outer = new THREE.Mesh(new THREE.CircleGeometry(160, 48), new THREE.MeshStandardMaterial({ color: 0x141a33, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; scene.add(outer);
    // 観客席
    const ROWS = 12, R0 = 16.5, SR = 1.5, SH = 1.0, WALL = 1.6;
    const pts = [new THREE.Vector2(16, 0), new THREE.Vector2(16, WALL)];
    for (let i = 0; i < ROWS; i++) { const r = R0 + i * SR, y = WALL + i * SH; pts.push(new THREE.Vector2(r, y), new THREE.Vector2(r + SR, y), new THREE.Vector2(r + SR, y + SH)); }
    pts.push(new THREE.Vector2(R0 + ROWS * SR + 2, WALL + ROWS * SH), new THREE.Vector2(R0 + ROWS * SR + 2, 0));
    scene.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 96), new THREE.MeshStandardMaterial({ color: 0x2c3560, roughness: 0.8, side: THREE.DoubleSide })));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(15.95, 15.95, 0.35, 96, 1, true), new THREE.MeshBasicMaterial({ color: 0x66e0ff, side: THREE.DoubleSide, toneMapped: false }));
    band.position.y = WALL - 0.3; scene.add(band);
    // お客さん
    const crowd = (W3.crowd = []), sp = LIGHT ? 1.2 : 0.85;
    for (let i = 0; i < ROWS; i++) {
      const r = R0 + i * SR + 0.7, y = WALL + i * SH, n = Math.floor((Math.PI * 2 * r) / sp);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const d = Math.min(Math.abs(Math.atan2(Math.sin(a), Math.cos(a))), Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))));
        if (d < 0.22 + i * 0.004 || Math.random() < 0.08) continue;
        crowd.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y, a, ph: rand(0, 6.28), sp: rand(5, 9), h: rand(0.7, 1.0) });
      }
    }
    buildCrowd(crowd);
    // 入場ゲート
    [[-1, 0x4dabf7], [1, 0xff6b6b]].forEach(([s, c]) => {
      const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), m), p2 = p1.clone(), top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 7.5), m);
      p1.position.set(0, 3, -3.5); p2.position.set(0, 3, 3.5); top.position.set(0, 6, 0); g.add(p1, p2, top); g.position.set(s * 16.3, 0, 0); scene.add(g);
    });
    // 照明塔とサーチライト
    W3.beamMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    W3.beams = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, r = 38;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 24, 8), new THREE.MeshStandardMaterial({ color: 0x555b75 }));
      pole.position.set(Math.cos(a) * r, 12, Math.sin(a) * r); scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 1), new THREE.MeshBasicMaterial({ color: 0xffffee, toneMapped: false }));
      head.position.set(Math.cos(a) * r, 24.5, Math.sin(a) * r); head.lookAt(0, 0, 0); scene.add(head);
      const pivot = new THREE.Object3D(); pivot.position.copy(head.position); scene.add(pivot);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 60, 24, 1, true), W3.beamMat); cone.rotation.x = -Math.PI / 2; cone.position.z = 30; pivot.add(cone);
      W3.beams.push({ pivot, target: V(0, 0, 0) });
    }
    // 大型ビジョン
    W3.vision = canvasTex(1024, 576, () => {});
    {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(19, 11.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x222633 }));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(18, 10.125), new THREE.MeshBasicMaterial({ map: W3.vision, toneMapped: false }));
      scr.position.z = 0.41; const g = new THREE.Group(); g.add(frame, scr); g.position.set(0, 22, -38); scene.add(g);
    }
    // モンスター（入場・勝利で使う。対戦中は かくす＝まなびバトルと同じ画面の絵を使う）
    W3.mon = [makeMon(-6, 0x4dabf7), makeMon(6, 0xff6b6b)];
    // パーティクル（3D の紙吹雪）
    W3.conf = particles3(LIGHT ? 300 : 800, 0.28);
    // 衝撃波
    W3.shock = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.2, 64), new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    W3.shock.rotation.x = -Math.PI / 2; W3.shock.position.y = 0.1; scene.add(W3.shock); W3.shockT = 9;
    W3.cam = { p: V(0, 20, 45), l: V(0, 3, 0) }; W3.excite = 0.4; W3.shake = 0; W3.punch = 0;
    drawVision('logo');
  }
  // 観客席の モンスター：5教科の 1段階目（かわいい・かっこいい）＝10しゅるい。向きは ばらばら・ぴょんぴょん はねる
  const CROWD_ART = ['kokugo', 'sansu', 'rika', 'shakai', 'eigo'].flatMap(k => ['cute', 'cool'].map(s => `images/player/${k}_${s}_1.png`));
  function buildCrowd(crowd) {
    const n = crowd.length, pos = new Float32Array(n * 3), att = new Float32Array(n * 4);
    crowd.forEach((c, i) => { pos.set([c.x, c.y, c.z], i * 3); att.set([(Math.random() * 10) | 0, c.ph, c.sp, Math.random() < 0.5 ? 1 : 0], i * 4); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aD', new THREE.BufferAttribute(att, 4));
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 256;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const cg = cv.getContext('2d'); let left = 10;
    CROWD_ART.forEach((src, i) => { const d = dataOf(src); if (!d) { left--; return; } const im = new Image(); im.onload = () => { cg.drawImage(im, (i % 5) * 128 + 6, ((i / 5) | 0) * 128 + 6, 116, 116); if (--left <= 0) tex.needsUpdate = true; }; im.src = d; });
    const ok = CROWD_ART.some(src => dataOf(src));
    W3.crowdU = { uTime: { value: 0 }, uEx: { value: 0.4 }, uProj: { value: 600 }, uTex: { value: tex }, uOk: { value: ok ? 1 : 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: W3.crowdU, transparent: false, depthWrite: true,
      vertexShader: `attribute vec4 aD; uniform float uTime, uEx, uProj; varying vec3 vD; varying float vB;
        void main(){ float j = max(0.0, sin(uTime * aD.z + aD.y)) * 0.6 * uEx; vec3 p = position + vec3(0.0, 0.42 + j, 0.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 1.15 * uProj / -mv.z;
          vD = aD.xyw; vB = 0.75 + 0.25 * fract(aD.y * 7.13); }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uOk; varying vec3 vD; varying float vB;
        void main(){ vec2 uv = gl_PointCoord; if (vD.z > 0.5) uv.x = 1.0 - uv.x;
          if (uOk < 0.5) { if (abs(uv.x - 0.5) > 0.22) discard; gl_FragColor = vec4(vec3(0.3 + 0.4 * fract(vD.x * 0.37)) * vB, 1.0); return; }
          float k = floor(vD.x + 0.5), row = floor((k + 0.5) / 5.0), col = k - row * 5.0; // 小数の ずれで となりの絵に ならないように
          vec2 a = (vec2(col, row) + clamp(uv, 0.03, 0.97)) / vec2(5.0, 2.0);
          vec4 c = texture2D(uTex, vec2(a.x, 1.0 - a.y)); if (c.a < 0.4) discard; gl_FragColor = vec4(c.rgb * vB, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts); W3.crowdPts = pts;
  }
  function drawField(g, w, h) {
    const cx = w / 2, cy = h / 2, gr = g.createRadialGradient(cx, cy, 50, cx, cy, 512);
    gr.addColorStop(0, '#c9a46a'); gr.addColorStop(0.8, '#a9824c'); gr.addColorStop(1, '#6b4f2c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,210' : '80,50,20'},${rand(0.03, 0.09)})`; g.fillRect(rand(0, w), rand(0, h), rand(2, 8), rand(2, 8)); }
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 10;
    g.beginPath(); g.arc(cx, cy, 470, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, 120, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(cx, cy - 470); g.lineTo(cx, cy + 470); g.stroke();
    g.lineWidth = 8; g.strokeStyle = 'rgba(90,170,255,0.9)'; g.beginPath(); g.arc(cx - 192, cy, 85, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,110,90,0.9)'; g.beginPath(); g.arc(cx + 192, cy, 85, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = `900 60px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('まなび', cx, cy);
  }
  let visionMode = 'logo', visionData = null;
  function drawVision(m, d) {
    visionMode = m; visionData = d || visionData;
    const c = W3.vision.userData.canvas, g = c.getContext('2d'), w = c.width, h = c.height;
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1b2a6b'); gr.addColorStop(1, '#5a1b5e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    const D = visionData;
    if (m === 'vs' && D) {
      g.imageSmoothingEnabled = false;
      if (D.imA && D.imA.complete) g.drawImage(D.imA, 40, 120, 340, 340);
      if (D.imB && D.imB.complete) { g.save(); g.translate(w - 40, 120); g.scale(-1, 1); g.drawImage(D.imB, 0, 0, 340, 340); g.restore(); }
      g.fillStyle = '#ffe066'; g.font = `900 200px ${FONT}`; g.fillText('VS', w / 2, h / 2);
      g.font = `900 44px ${FONT}`; g.fillStyle = '#9fd8ff'; g.fillText(D.nA, 210, 510); g.fillStyle = '#ffb3a8'; g.fillText(D.nB, w - 210, 510);
    } else if (m === 'win' && D) {
      g.imageSmoothingEnabled = false;
      if (D.imW && D.imW.complete) g.drawImage(D.imW, w / 2 - 190, 40, 380, 380);
      g.fillStyle = '#ffe066'; g.font = `900 90px ${FONT}`; g.fillText(D.wText, w / 2, 490);
    } else {
      if (LOGO && LOGO.complete && LOGO.width) { const k = Math.min((w - 80) / LOGO.width, 300 / LOGO.height); g.drawImage(LOGO, (w - LOGO.width * k) / 2, (h - LOGO.height * k) / 2, LOGO.width * k, LOGO.height * k); }
      else { g.fillStyle = '#ffe066'; g.font = `900 110px ${FONT}`; g.fillText('まなび', w / 2, h / 2 - 70); g.fillStyle = '#fff'; g.font = `900 120px ${FONT}`; g.fillText('スタジアム', w / 2, h / 2 + 70); }
    }
    W3.vision.needsUpdate = true;
  }
  const LOGO = (() => { const d = window.STD_IMG && window.STD_IMG.logo; if (!d) return null; const im = new Image(); im.onload = () => { if (W3.vision && visionMode === 'logo') drawVision('logo'); }; im.src = d; return im; })();
  // 進化の段階（絵の _1〜_4）で 大きさを かえる
  const SZ = { 1: 0.62, 2: 0.8, 3: 0.95, 4: 1.12 };
  const stageOfArt = art => { const m = /_(\d)\.png/.exec(imgSrc(art)); return m ? +m[1] : 3; };
  function setMons(o) {
    W3.mon.forEach((x, i) => {
      const f = i ? o.B : o.A;
      if (x.src !== f.art) { x.mat.map = monsterTex(f.art, f.emo, !!i); x.mat.needsUpdate = true; x.src = f.art; }
      x.sz = SZ[stageOfArt(f.art)] || 0.95; x.lean = 0; x.kb = 0; x.flick = 0; x.ko = 0; x.home = i ? 6 : -6;
    });
  }
  let HALO = null;
  function haloTex() {
    if (HALO) return HALO;
    return (HALO = canvasTex(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 10, 128, 128, 128); r.addColorStop(0, 'rgba(255,250,220,.9)'); r.addColorStop(0.4, 'rgba(255,220,150,.35)'); r.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); }));
  }
  function makeMon(x, color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, toneMapped: false });
    const body = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), mat); body.position.y = 2.6;
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.45, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.scale.set(1.2, 0.7, 1);
    const add = { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide };
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.5, 48), new THREE.MeshBasicMaterial({ color, ...add })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 32, 1, true), new THREE.MeshBasicMaterial({ color, ...add })); pillar.position.y = 15;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: haloTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.position.set(0, 0, -0.05); body.add(halo); body.userData.halo = halo;
    const holder = new THREE.Group(); holder.add(body);
    g.add(sh, ring, pillar, holder); g.position.x = x; g.visible = false; scene.add(g);
    return { g, body, holder, sh, ring, pillar, mat, home: x, t0: -99, lean: 0 };
  }
  function particles3(n, size) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
    pts.frustumCulled = false; scene.add(pts);
    const P = []; for (let i = 0; i < n; i++) { P.push({ life: 0, v: new THREE.Vector3() }); pos[i * 3 + 1] = -999; }
    let next = 0; const c = new THREE.Color();
    return {
      emit(k, o, speed, colors) {
        for (let j = 0; j < k; j++) {
          const i = next; next = (next + 1) % n; const p = P[i]; p.life = rand(2.2, 3.5);
          p.v.set(rand(-1, 1), rand(0.6, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1));
          pos[i * 3] = o.x; pos[i * 3 + 1] = o.y; pos[i * 3 + 2] = o.z;
          c.set(colors[(Math.random() * colors.length) | 0]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        g.attributes.color.needsUpdate = true;
      },
      update(dt) {
        for (let i = 0; i < n; i++) {
          const p = P[i]; if (p.life <= 0) continue; p.life -= dt; if (p.life <= 0) { pos[i * 3 + 1] = -999; continue; }
          p.v.y -= 4 * dt; p.v.multiplyScalar(0.985);
          pos[i * 3] += p.v.x * dt; pos[i * 3 + 1] += p.v.y * dt; pos[i * 3 + 2] += p.v.z * dt;
          if (pos[i * 3 + 1] < 0.05) { pos[i * 3 + 1] = 0.05; p.v.set(0, 0, 0); }
        }
        g.attributes.position.needsUpdate = true;
      },
    };
  }

  // ---------- カメラ ----------
  const CAM = {
    title: t => { const a = t * 0.08; return { p: [Math.sin(a) * 30, 22, Math.cos(a) * 30], l: [0, 3, 0] }; },
    battle: t => ({ p: [Math.sin(t * 0.12) * 3, 9 + Math.sin(t * 0.2) * 0.4, 25], l: [0, 2.5, 0] }),
  };
  let shot = null; // { from, to, t0, dur }（入場などで その場面に うつる）
  function setShot(p, l, dur = 0) {
    const V = (a) => new THREE.Vector3(...a);
    shot = { fp: W3.cam.p.clone(), fl: W3.cam.l.clone(), tp: V(p), tl: V(l), t0: now(), dur: Math.max(0.001, dur), drift: null };
  }
  // 観客席の 上を まわる（かべの うらに 出ない）
  function orbitShot(a0, a1, r, h0, h1, dur) { shot = { orbit: { a0, a1, r, h0, h1, dur }, t0: now() }; }
  function drift(p, l, dur) { const V = (a) => new THREE.Vector3(...a); if (shot) shot.drift = { p: V(p), l: V(l), t0: now() + shot.dur, dur }; }
  const now = () => (performance.now() - T0) / 1000;
  function updateCam(t, dt) {
    let p, l;
    if (shot && shot.orbit) {
      const o = shot.orbit, u = ease((t - shot.t0) / o.dur), a = o.a0 + (o.a1 - o.a0) * u;
      p = new THREE.Vector3(Math.sin(a) * o.r, o.h0 + (o.h1 - o.h0) * u, Math.cos(a) * o.r); l = new THREE.Vector3(0, 3, 0);
    } else if (shot) {
      const u = ease((t - shot.t0) / shot.dur);
      p = shot.fp.clone().lerp(shot.tp, u); l = shot.fl.clone().lerp(shot.tl, u);
      if (shot.drift && t > shot.drift.t0) { const v = ease((t - shot.drift.t0) / shot.drift.dur); p.lerp(shot.drift.p, v); l.lerp(shot.drift.l, v); }
    } else {
      const c = (CAM[mode] || CAM.title)(t); p = new THREE.Vector3(...c.p); l = new THREE.Vector3(...c.l);
      // 場面が かわったとき なめらかに
      p = W3.cam.p.clone().lerp(p, Math.min(1, dt * 2.5)); l = W3.cam.l.clone().lerp(l, Math.min(1, dt * 2.5));
    }
    W3.cam.p.copy(p); W3.cam.l.copy(l);
    camera.position.copy(p);
    if (W3.punch > 0.001) { const d = l.clone().sub(p).normalize(); camera.position.addScaledVector(d, W3.punch * 2.2); }
    if (W3.shake > 0.001) camera.position.add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(W3.shake));
    camera.lookAt(l);
    W3.shake *= Math.pow(0.02, dt); W3.punch *= Math.pow(0.01, dt);
  }

  // ---------- 毎フレーム ----------
  let fpsN = 0, fpsT = 0;
  function frame(nowMs) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs;
    const t = STD._freezeT !== undefined ? STD._freezeT : (nowMs - T0) / 1000; // テスト用：時間を止める
    if (ready && !document.hidden) {
      updateWorld(t, dt); updateCam(t, dt); renderer.render(scene, camera);
    }
    updateFx(dt);
    fpsN++; fpsT += dt; if (fpsT > 1) { const f = $('#stdfps'); if (f) f.textContent = 'FPS ' + Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
  }
  function updateWorld(t, dt) {
    // サーチライト
    W3.beams.forEach((b, i) => {
      const a = t * (mode === 'battle' ? 0.5 : 1.1) + i * 1.7, r = mode === 'battle' ? 7 : 12;
      const tg = W3.beamTo ? W3.beamTo(i) : new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      b.target.lerp(tg, Math.min(1, dt * 3)); b.pivot.lookAt(b.target);
    });
    W3.beamMat.opacity = mode === 'battle' ? 0.045 : 0.075;
    W3.flash.intensity *= Math.pow(0.005, dt);
    // モンスター
    W3.mon.forEach((m, i) => {
      if (!m.g.visible) return;
      const u = (t - m.t0) / 0.9;
      m.holder.position.y = u < 0 ? -6 : -6 + 6 * easeOut(u);
      m.sh.visible = u > 0.6;
      m.pillar.material.opacity = u < 0 ? 0 : u < 1 ? 0.35 * ease(u * 2) : 0.35 * Math.max(0, 1 - (u - 1) * 0.9);
      m.ring.material.opacity = u > 0 ? 0.8 * ease(u) : 0; m.ring.rotation.z += dt * 0.8;
      const bob = Math.sin(t * 2.2 + i * 2) * 0.12, br = 1 + Math.sin(t * 2.2 + i * 2) * 0.025;
      const z = m.sz || 1; m.body.position.y = 2.6 * z + bob; m.body.scale.set((2 - br) * z, br * z, 1); m.sh.scale.set(1.2 * z, 0.7 * z, 1); m.ring.scale.setScalar(Math.max(0.8, z));
      m.kb = (m.kb || 0) * Math.pow(0.03, dt);
      m.g.position.x = m.home + m.lean * (i ? -1 : 1) + m.kb * (i ? 1 : -1);
      if (m.flick > 0) { m.flick -= dt; m.body.visible = Math.floor(m.flick * 20) % 2 === 0; m.mat.color.setRGB(1, 0.5, 0.5); } else { m.body.visible = true; m.mat.color.setRGB(1, 1, 1); }
      if (m.ko) { m.ko = Math.min(1, m.ko + dt * 0.9); m.holder.position.y -= dt * 0; m.body.rotation.z = (i ? 1 : -1) * ease(m.ko) * 1.4; m.body.position.y -= ease(m.ko) * 1.6 * z; } else m.body.rotation.z = 0;
      m.holder.rotation.y = Math.atan2(camera.position.x - m.g.position.x, camera.position.z - m.g.position.z);
    });
    // 衝撃波
    W3.shockT += dt; const s = W3.shockT / 0.7;
    if (s < 1) { W3.shock.scale.setScalar(1 + s * 9); W3.shock.material.opacity = 1 - s; } else W3.shock.material.opacity = 0;
    // 観客
    const ex = W3.excite; W3.excite += ((W3.exBase || 0.4) - W3.excite) * Math.min(1, dt * 0.8);
    W3.crowdU.uTime.value = t; W3.crowdU.uEx.value = ex;
    W3.crowdU.uProj.value = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    W3.conf.update(dt);
  }

  // ---------- 2D エフェクト ----------
  const PS = [];
  const FXK = LIGHT ? 0.5 : 1;
  function P(o) { if (PS.length > 1400) return; PS.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1, life: 1, max: 1, size: 6, rot: 0, vr: 0, add: true, a: 1 }, o, { max: o.life || 1 })); }
  function burst(x, y, n, sp, col, o = {}) {
    n = Math.round(n * FXK);
    for (let i = 0; i < n; i++) { const a = rand(0, 6.283), v = sp * rand(0.3, 1); P(Object.assign({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.4, 0.9), size: rand(3, 7), color: col[(Math.random() * col.length) | 0], drag: 0.93, k: 'dot' }, o)); }
  }
  function ring(x, y, col, r1, life = 0.5, w = 10) { P({ k: 'ring', x, y, color: col, r0: 10, r1, life, w }); }
  function glyphs(x, y, th, n, sp) {
    n = Math.round(n * FXK);
    for (let i = 0; i < n; i++) { const a = rand(-Math.PI, 0.3), v = sp * rand(0.4, 1); P({ k: 'glyph', x, y, vx: Math.cos(a) * v * 1.3, vy: Math.sin(a) * v, g: 900, drag: 0.98, life: rand(0.8, 1.3), size: rand(26, 54), rot: rand(-0.5, 0.5), vr: rand(-4, 4), text: th.g[(Math.random() * th.g.length) | 0], color: th.c[(Math.random() * th.c.length) | 0], stroke: th.ink, add: false }); }
  }
  function bolt(x, y, col) { P({ k: 'bolt', x, y, x0: x + rand(-80, 80), y0: -20, color: col, life: 0.35, w: rand(5, 9), seed: Math.random() * 1000 }); }
  function updateFx(dt) {
    const g = fxc; if (!g) return;
    g.setTransform(fx.width / W, 0, 0, fx.height / H, 0, 0);
    g.clearRect(0, 0, W, H);
    if (petals > 0) {
      petalAcc += petals * dt;
      while (petalAcc >= 1) { petalAcc--; const far = Math.random() < 0.5; P({ k: 'petal', x: rand(-40, W + 40), y: -20, vx: rand(-30, 60), vy: far ? rand(40, 70) : rand(70, 110), g: 0, life: 12, size: far ? rand(5, 7) : rand(8, 11), rot: rand(0, 6), vr: rand(-2, 2), color: ['#ffd1e1', '#ffb8d0', '#ffe6ef', '#ffc2d6'][(Math.random() * 4) | 0], add: false, sw: rand(0, 6), a: far ? 0.55 : 0.9 }); }
    }
    for (let i = PS.length - 1; i >= 0; i--) {
      const p = PS[i]; p.life -= dt; if (p.life <= 0 || p.y > H + 60) { PS.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60);
      if (p.k === 'petal') { p.sw += dt * 2; p.x += (p.vx + Math.sin(p.sw) * 40) * dt; p.y += p.vy * dt; } else { p.x += p.vx * dt; p.y += p.vy * dt; }
      if (p.k === 'orb' && p.tx !== undefined) { const u = 1 - p.life / p.max, e = u * u; p.x = p.sx + (p.tx - p.sx) * e; p.y = p.sy + (p.ty - p.sy) * e - Math.sin(u * Math.PI) * 60; if (Math.random() < 0.9) P({ k: 'dot', x: p.x, y: p.y, life: 0.35, size: p.size * 0.6, color: p.color, vx: rand(-30, 30), vy: rand(-30, 30) }); }
      p.rot += p.vr * dt;
      const u = p.life / p.max;
      g.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      g.globalAlpha = clamp(p.k === 'petal' ? Math.min(1, p.life) : u * 1.6, 0, 1) * p.a;
      drawP(g, p, u);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  function drawP(g, p, u) {
    switch (p.k) {
      case 'dot': case 'orb': g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * (p.k === 'orb' ? 1 : 0.5 + u * 0.5), 0, 6.283); g.fill(); break;
      case 'ring': { const r = p.r0 + (p.r1 - p.r0) * easeOut(1 - u); g.strokeStyle = p.color; g.lineWidth = p.w * u + 1; g.beginPath(); g.arc(p.x, p.y, r, 0, 6.283); g.stroke(); break; }
      case 'glyph': g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.font = `900 ${p.size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = p.size * 0.14; g.strokeStyle = p.stroke; g.strokeText(p.text, 0, 0); g.fillStyle = p.color; g.fillText(p.text, 0, 0); g.restore(); break;
      case 'bolt': {
        g.strokeStyle = p.color; g.lineWidth = p.w; g.shadowColor = p.color; g.shadowBlur = 20; g.beginPath();
        let x = p.x0, y = p.y0; g.moveTo(x, y); const n = 9; let s = p.seed + Math.floor(p.life * 30);
        for (let i = 1; i <= n; i++) { s = (s * 9301 + 49297) % 233280; const r = s / 233280; x = p.x0 + (p.x - p.x0) * i / n + (i < n ? (r - 0.5) * 70 : 0); y = p.y0 + (p.y - p.y0) * i / n; g.lineTo(x, y); }
        g.stroke(); g.shadowBlur = 0; break;
      }
      case 'ink': g.fillStyle = p.color; g.beginPath(); g.ellipse(p.x, p.y, p.size * (1.4 - u * 0.4), p.size * (0.9 - u * 0.2), p.rot, 0, 6.283); g.fill(); break;
      case 'slash': { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); const L = p.len * easeOut(1 - u + 0.3); g.strokeStyle = p.color; g.lineCap = 'round'; g.lineWidth = p.w * u; g.shadowColor = p.color; g.shadowBlur = 18; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke(); g.restore(); g.shadowBlur = 0; break; }
      case 'shape': { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.strokeStyle = p.color; g.lineWidth = 4; const s = p.size * (1.6 - u * 0.6); g.beginPath(); for (let i = 0; i < p.sides; i++) { const a = (i / p.sides) * 6.283; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * s, Math.sin(a) * s); } g.closePath(); g.stroke(); g.restore(); break; }
      case 'star': { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color; const s = p.size; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.42 : s, a = (i / 10) * 6.283 - Math.PI / 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.restore(); break; }
      case 'rock': g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color; g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8); g.restore(); break;
      case 'petal': { // さくらの花びら（先が少し へこんだ形）。くるくる 回って 見える
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, 0.35 + Math.abs(Math.sin(p.sw * 1.3)) * 0.65);
        const s = p.size, gr = g.createLinearGradient(-s, 0, s, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, p.color);
        g.fillStyle = gr; g.beginPath(); g.moveTo(-s, 0);
        g.bezierCurveTo(-s * 0.4, -s * 0.75, s * 0.6, -s * 0.7, s, -s * 0.18); g.lineTo(s * 0.72, 0); g.lineTo(s, s * 0.18);
        g.bezierCurveTo(s * 0.6, s * 0.7, -s * 0.4, s * 0.75, -s, 0); g.fill(); g.restore(); break;
      }
      case 'seal': { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.strokeStyle = p.color; g.lineWidth = 4; g.shadowColor = p.color; g.shadowBlur = 14; const r = p.size; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.stroke(); g.beginPath(); g.arc(0, 0, r * 0.75, 0, 6.283); g.stroke(); g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 * 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75); } g.closePath(); g.stroke(); g.restore(); g.shadowBlur = 0; break; }
      case 'hex': { g.save(); g.translate(p.x, p.y); g.strokeStyle = p.color; g.fillStyle = p.color + '33'; g.lineWidth = 5; const r = p.size * (1.2 - u * 0.2); g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); g.restore(); break; }
    }
  }
  // 画面の上の位置（1280×720 の中）
  function posOf(side) {
    const el = document.querySelector(side === 'P' ? '#fP .emo' : '#fB .emo'), st = document.querySelector('#stage');
    if (!el || !st) return { x: side === 'P' ? 300 : 980, y: 140 };
    const r = el.getBoundingClientRect(), s = st.getBoundingClientRect(), k = s.width / W;
    return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k };
  }
  function shakeScreen(px, ms = 380) {
    const els = [$('#app'), gl, fx].filter(Boolean), t0 = performance.now();
    const step = () => {
      const u = (performance.now() - t0) / ms;
      if (u >= 1) { els.forEach(e => (e.style.transform = '')); return; }
      const a = px * (1 - u), x = rand(-a, a), y = rand(-a, a); els.forEach(e => (e.style.transform = `translate(${x}px,${y}px)`));
      requestAnimationFrame(step);
    };
    step();
  }
  function flashScreen(color = '#fff', op = 0.8) {
    const f = $('#stdflash'); if (!f) return; f.style.background = color;
    const t0 = performance.now(), id = (f._id = (f._id || 0) + 1);
    const step = () => { if (f._id !== id) return; const u = (performance.now() - t0) / 450; f.style.opacity = u >= 1 ? 0 : op * (1 - u); if (u < 1) setTimeout(step, 16); };
    step();
  }

  // ---------- わざの演出（game.js の playEvents から）----------
  // cut：わざの名前が出るとき（ためる → とばす）。e = { sk, subj, by }
  STD.cast = async function (e, cutinFn) {
    const by = e.by || 'P', to = by === 'P' ? 'B' : 'P';
    W3.exBase = 0.7; W3.excite = Math.max(W3.excite, 0.8);
    await Promise.all([cutinFn(), chargeFx(posOf(by), posOf(to), e)]);
  };
  // ためる → とばす（a：わざを出す方、b：受ける方。画面の上の位置）
  async function chargeFx(a, b, e) {
    const th = TH[e.subj] || THX, big = e.sk === 'パワーシュート';
    {
      ring(a.x, a.y, th.c[0], big ? 160 : 110, 0.6, 12);
      for (let i = 0; i < 8; i++) {
        if (FAST()) break;
        for (let k = 0; k < 6 * FXK; k++) { const r = rand(70, 130), ang = rand(0, 6.283); P({ k: 'dot', x: a.x + Math.cos(ang) * r, y: a.y + Math.sin(ang) * r, vx: -Math.cos(ang) * r * 2.2, vy: -Math.sin(ang) * r * 2.2, life: 0.4, size: rand(3, 6), color: th.c[(Math.random() * th.c.length) | 0], drag: 1 }); }
        await wait(70);
      }
      if (e.sk === 'ガードバッシュ') P({ k: 'hex', x: a.x, y: a.y, size: 120, color: '#74c0fc', life: 0.9, add: false, a: 0.9 });
      // とばす
      const n = e.sk === '連続攻撃' ? 2 : 1;
      for (let j = 0; j < n; j++) { P({ k: 'orb', sx: a.x, sy: a.y, tx: b.x, ty: b.y, x: a.x, y: a.y, life: 0.32, size: big ? 26 : 16, color: th.c[0] }); if (n > 1) await wait(120); }
      if (big) { flashScreen(th.c[0], 0.35); W3.punch = 1; }
    }
  }
  // hit：ダメージが出るとき。e = { side（受けた方）, crit, eff, hit }
  STD.hit = function (e, sk, subj) { hitFx(posOf(e.side), posOf(e.side === 'P' ? 'B' : 'P'), e, sk, subj); };
  function hitFx(p, a, e, sk, subj) {
    const th = TH[subj] || THX, by = e.side === 'P' ? 'B' : 'P';
    const k = (e.crit ? 1.6 : 1) * (sk === 'パワーシュート' ? 1.5 : sk === '連続攻撃' ? 0.7 : 1) * (e.eff > 1 ? 1.2 : 1);
    burst(p.x, p.y, 60 * k, 900 * k, th.c); ring(p.x, p.y, '#ffffff', 150 * k, 0.45, 12); ring(p.x, p.y, th.c[0], 220 * k, 0.6, 8);
    glyphs(p.x, p.y, th, 10 * k, 700);
    switch (th.fx) {
      case 'ink': for (let i = 0; i < 12 * k * FXK; i++) P({ k: 'ink', x: p.x + rand(-90, 90), y: p.y + rand(-70, 70), size: rand(10, 28), rot: rand(0, 3), color: th.ink, add: false, life: rand(0.6, 1), a: 0.85 }); P({ k: 'slash', x: p.x, y: p.y, rot: -0.6, len: 380, w: 22, color: '#ff8787', life: 0.4 }); break;
      case 'geo': for (let i = 0; i < 6 * k * FXK; i++) { const ang = rand(0, 6.283), v = rand(200, 500); P({ k: 'shape', x: p.x, y: p.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, drag: 0.92, sides: [3, 4, 6][i % 3], size: rand(14, 30), rot: rand(0, 3), vr: rand(-6, 6), color: th.c[i % 2], life: 0.9 }); } break;
      case 'bolt': for (let i = 0; i < 3 + (e.crit ? 2 : 0); i++) bolt(p.x + rand(-40, 40), p.y, i % 2 ? '#fff36b' : '#99e9f2'); for (let i = 0; i < 10 * FXK; i++) P({ k: 'ring', x: p.x + rand(-80, 80), y: p.y + rand(-60, 60), r0: 2, r1: rand(10, 26), w: 3, color: '#c5f6fa', life: rand(0.5, 1), add: true, vy: -120 }); break;
      case 'rock': for (let i = 0; i < 16 * k * FXK; i++) { const ang = rand(-Math.PI, 0); P({ k: i % 3 ? 'rock' : 'dot', x: p.x, y: p.y + 40, vx: Math.cos(ang) * rand(150, 450), vy: Math.sin(ang) * rand(250, 600), g: 1400, drag: 0.99, size: rand(8, 18), rot: rand(0, 3), vr: rand(-8, 8), color: ['#8d6e63', '#a1887f', '#6d4c41', '#ffd43b'][i % 4], add: false, life: 1 }); } break;
      case 'star': for (let i = 0; i < 12 * k * FXK; i++) { const ang = rand(0, 6.283), v = rand(150, 520); P({ k: 'star', x: p.x, y: p.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, drag: 0.93, size: rand(8, 18), rot: rand(0, 3), vr: rand(-5, 5), color: th.c[i % th.c.length], life: rand(0.6, 1.1) }); } break;
    }
    if (sk === 'ふういん') P({ k: 'seal', x: p.x, y: p.y, size: 110, rot: 0, vr: 2, color: '#e599f7', life: 1.2 });
    if (sk === 'かんつう') P({ k: 'slash', x: p.x, y: p.y, rot: by === 'P' ? 0 : Math.PI, len: 900, w: 16, color: '#ffffff', life: 0.35 });
    if (sk === 'カウンター') { P({ k: 'slash', x: p.x, y: p.y, rot: 0.8, len: 300, w: 18, color: '#ff6b6b', life: 0.4 }); P({ k: 'slash', x: p.x, y: p.y, rot: -0.8, len: 300, w: 18, color: '#ff6b6b', life: 0.4 }); }
    if (sk === 'ドレイン') for (let i = 0; i < 16 * FXK; i++) P({ k: 'orb', sx: p.x + rand(-40, 40), sy: p.y + rand(-40, 40), tx: a.x, ty: a.y, x: p.x, y: p.y, life: rand(0.5, 0.8), size: 7, color: '#8ce99a' });
    if (e.crit) flashScreen('#ffffff', 0.75); else if (sk === 'パワーシュート') flashScreen('#ffffff', 0.5);
    shakeScreen(e.crit ? 18 : sk === 'パワーシュート' ? 16 : 9);
    if (ready) { W3.shake = e.crit ? 0.5 : 0.25; W3.flash.intensity = e.crit ? 6 : 3; W3.flash.color.set(th.c[0]); W3.excite = 1.2; }
  }

  // ---------- 画面の背景（game.js の render から）----------
  STD.bgFor = function (cls, el) {
    el.style.background = cls === 'btl' ? 'linear-gradient(rgba(8,10,24,.05),rgba(8,10,24,.25))' : cls === 'title' ? 'transparent' : 'linear-gradient(rgba(8,10,24,.62),rgba(8,10,24,.78))';
    if (mode !== 'intro' && mode !== 'win' && mode !== 'fight') setMode(cls === 'btl' ? 'battle' : 'title');
  };
  function setMode(m) {
    if (mode === m) return;
    mode = m; shot = null; W3.beamTo = null;
    if (m === 'title' || m === 'battle') { W3.mon.forEach(x => (x.g.visible = false)); W3.spots.forEach(s => (s.intensity = 0)); petals = 0; W3.exBase = m === 'battle' ? 0.5 : 0.35; }
    if (m === 'title') drawVision('logo');
  }
  STD.mode = setMode;
  let petals = 0, petalAcc = 0;

  // ---------- 入場 ----------
  // o = { A:{art,emo,name,card}, B:{...}, nA, nB }  card は game.js が作った紹介パネルの HTML
  STD.intro = async function (o) {
    setMode('intro');
    let skip = false;
    const sk = document.createElement('button'); sk.className = 'std-skip'; sk.textContent = 'スキップ ▶▶'; ui.appendChild(sk);
    sk.onclick = () => (skip = true);
    const W8 = async ms => { const t1 = performance.now() + (FAST() ? ms / 50 : ms); while (!skip && performance.now() < t1) await new Promise(r => setTimeout(r, 30)); };
    const m = W3.mon;
    setMons(o); m.forEach(x => { x.g.visible = true; x.t0 = 1e9; });
    const imA = new Image(), imB = new Image(); imA.src = dataOf(imgSrc(o.A.art)); imB.src = dataOf(imgSrc(o.B.art));
    W3.spots.forEach(s => (s.intensity = 0)); W3.exBase = 0.45;
    drawVision('logo');
    const telop = txt => { let t = $('.std-telop', ui); if (!t) { t = document.createElement('div'); t.className = 'std-telop'; ui.appendChild(t); } t.innerHTML = `<span>じっきょう</span><b>${txt}</b>`; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); };
    const card = (html, side) => { const c = document.createElement('div'); c.className = 'std-card ' + side; c.innerHTML = html; ui.appendChild(c); requestAnimationFrame(() => c.classList.add('on')); return c; };
    ui.classList.add('letter');
    // 1. スタジアムを ぐるり
    orbitShot(-1.0, 1.0, 29, 25, 19, 3.2);
    telop('まなびスタジアムへ ようこそ！');
    await W8(3200);
    // 2. A の入場
    const enter = async (i, who) => {
      const x = m[i], sgn = i ? 1 : -1;
      setShot([sgn * 1, 3.2, 12], [sgn * 6, 2.6, 0], skip ? 0.01 : 1.0); drift([sgn * 2.8, 2.8, 9.5], [sgn * 6, 2.8, 0], 4);
      W3.beamTo = () => new THREE.Vector3(sgn * 6, 0, 0);
      await W8(500);
      x.t0 = now(); W3.spots[i].intensity = 6;
      window.STD_SE && window.STD_SE('statup');
      telop(`${who === 'A' ? 'あおコーナー' : 'あかコーナー'}！ ${o['n' + who]}！`);
      await W8(700);
      window.STD_SE && window.STD_SE('kira');
      W3.conf.emit(LIGHT ? 120 : 260, new THREE.Vector3(sgn * 6, 1, 0), 9, i ? ['#ff6b6b', '#ffffff', '#ffa94d', '#ffe066'] : ['#4dabf7', '#ffffff', '#99e9f2', '#ffe066']);
      W3.excite = 1.1;
      const c = card(o[who].card, i ? 'b' : 'a');
      // アイテムを 1つずつ おもてに
      const its = c.querySelectorAll('.sc-it');
      await W8(700);
      for (const it of its) { if (skip) break; it.classList.add('open'); window.STD_SE && window.STD_SE('ok'); await W8(320); }
      await W8(1700);
      c.classList.remove('on'); setTimeout(() => c.remove(), 500);
    };
    if (!skip) await enter(0, 'A');
    if (!skip) await enter(1, 'B');
    // 3. にらみあい
    m.forEach(x => { if (x.t0 > now()) x.t0 = now() - 2; });
    W3.spots.forEach(s => (s.intensity = 6));
    W3.beamTo = i => new THREE.Vector3(i % 2 ? 6 : -6, 0, 0);
    drawVision('vs', { imA, imB, nA: o.A.name, nB: o.B.name });
    setShot([0, 2.4, 18], [0, 2.8, 0], skip ? 0.01 : 0.8); drift([0, 2.6, 15], [0, 2.9, 0], 3);
    telop('にらみあう 2ひき……！');
    ui.querySelectorAll('.std-card').forEach(c => c.remove());
    const vs = document.createElement('div'); vs.className = 'std-vs'; vs.innerHTML = `<div class="sv-a">${o.A.pnameH}<small>${o.A.nameH}</small></div><div class="sv-x">${gt('VS', 'gd')}</div><div class="sv-b">${o.B.pnameH}<small>${o.B.nameH}</small></div>`; ui.appendChild(vs);
    requestAnimationFrame(() => vs.classList.add('on'));
    window.STD_SE && window.STD_SE('start'); W3.shake = 0.3;
    const t1 = performance.now();
    if (!skip) while (!skip && performance.now() - t1 < (FAST() ? 60 : 2600)) {
      const u = (performance.now() - t1) / 2600; m.forEach(x => (x.lean = Math.sin(u * 20) * 0.08 + u * 1.2));
      if (Math.random() < 0.25) { const y = 230 + rand(-40, 40); P({ k: 'bolt', x: 640 + rand(-30, 30), y: y + 40, x0: 640 + rand(-30, 30), y0: y - 60, color: Math.random() < 0.5 ? '#74c0fc' : '#ff8787', life: 0.2, w: 4, seed: Math.random() * 999 }); }
      await new Promise(r => setTimeout(r, 30));
    }
    vs.remove();
    // 4. 試合開始！
    skip = false;
    m.forEach(x => (x.lean = 0));
    const go = document.createElement('div'); go.className = 'std-go'; go.innerHTML = gt('試合開始！', 'cy'); ui.appendChild(go);
    flashScreen('#fff', 0.9); W3.shake = 0.6; W3.excite = 1.4; window.STD_SE && window.STD_SE('crit');
    W3.conf.emit(LIGHT ? 150 : 300, new THREE.Vector3(0, 2, 0), 12, ['#ffe066', '#ffffff', '#ff6b6b', '#4dabf7']);
    await W8(1500);
    go.remove(); sk.remove(); $('.std-telop', ui) && $('.std-telop', ui).remove(); ui.classList.remove('letter');
    setMode('battle');
  };

  // ---------- わざの打ちあい（3D）----------
  // ルーレット・教科・わざ・問題は まなびバトルの画面。そのあとの 打ちあいだけ ここで見せる
  // ev：game.js の resolveTurn が作った できごと。o = { A, B（art・emo・nameH・pnameH・maxhp・hp）, turn }
  function proj(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; }
  const monTop = i => { const m = W3.mon[i], z = m.sz || 1; return proj(m.g.position.x, 2.6 * z, 0); };
  function telopOn(txt) {
    let t = $('.std-telop', ui); if (!t) { t = document.createElement('div'); t.className = 'std-telop'; ui.appendChild(t); }
    t.innerHTML = `<span>じっきょう</span><b>${txt}</b>`; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
  }
  const pick1 = a => a[(Math.random() * a.length) | 0];
  const gt = (t, c = '') => `<span class="gt ${c}" data-t="${t}">${t}</span>`; STD.gt = gt;
  STD.fight = async function (ev, o) {
    setMode('fight');
    let skip = false;
    const W8 = async ms => { const t1 = performance.now() + (FAST() ? ms / 50 : ms); while (!skip && performance.now() < t1) await new Promise(r => setTimeout(r, 30)); };
    const m = W3.mon, st = $('#stage');
    setMons(o);
    m.forEach(x => { x.g.visible = true; x.t0 = now() - 5; });
    W3.spots.forEach(s => (s.intensity = 4)); W3.exBase = 0.7;
    W3.beamTo = i => new THREE.Vector3(i % 2 ? 6 : -6, 0, 0);
    st.classList.add('std-fighting'); $('#app').style.visibility = 'hidden';
    // 格闘ゲームの 体力ゲージ
    const hp = { P: o.A.hp, B: o.B.hp };
    const hud = document.createElement('div'); hud.className = 'std-hud';
    const side = (f, k) => `<div class="hb ${k}"><div class="hb-nm"><b>${f.nameH}</b><small>${f.pnameH}</small></div><div class="hb-bar"><i class="hb-dmg"></i><i class="hb-hp"></i></div><div class="hb-num"></div></div>`;
    hud.innerHTML = `${side(o.A, 'a')}<div class="hb-turn">TURN<b>${o.turn}</b></div>${side(o.B, 'b')}`;
    ui.appendChild(hud);
    const setHP = snap => {
      if (snap) { hp.P = snap.P.hp; hp.B = snap.B.hp; }
      [['a', 'P', o.A], ['b', 'B', o.B]].forEach(([k, s, f]) => {
        const r = clamp(hp[s] / f.maxhp, 0, 1) * 100, el = $('.hb.' + k, hud);
        el.querySelector('.hb-hp').style.width = r + '%'; el.querySelector('.hb-dmg').style.width = r + '%';
        el.querySelector('.hb-num').textContent = `${Math.max(0, Math.round(hp[s]))} / ${f.maxhp}`; el.classList.toggle('low', r < 30);
      });
    };
    setHP(); requestAnimationFrame(() => hud.classList.add('on'));
    const sk = document.createElement('button'); sk.className = 'std-skip'; sk.textContent = 'スキップ ▶▶'; ui.appendChild(sk); sk.onclick = () => (skip = true);
    // ひいた画面から
    setShot([0, 16, 27], [0, 2.5, 0], 0.01); drift([0, 4.2, 19], [0, 2.4, 0], 1.2);
    telopOn(pick1([`ターン${o.turn}！ わざの 打ちあいだ！`, `ターン${o.turn}！ さあ、どうなる！？`]));
    await W8(1300);
    let atk = -1, sk1 = null, subj = null, hits = 0;
    const back = async () => { if (atk < 0) return; const x = m[atk], t0 = performance.now(); const l0 = x.lean; while (performance.now() - t0 < (FAST() ? 10 : 450)) { x.lean = l0 * (1 - easeOut((performance.now() - t0) / 450)); await new Promise(r => setTimeout(r, 16)); } x.lean = 0; };
    for (const e of ev) {
      if (e.cut) {
        await back();
        atk = e.by === 'B' ? 1 : 0; sk1 = e.sk; subj = e.subj; hits = 0;
        const f = atk ? o.B : o.A, ax = m[atk].home, sg = atk ? 1 : -1, th = TH[subj] || THX, z = m[atk].sz || 1;
        if (sk1 === 'ガードバッシュ' || sk1 === 'カウンター') window.STD_SE && window.STD_SE('guard');
        // ためる：わざを出す方に よる
        setShot([ax * 0.45, 1.6 + z, 6.5 + z * 2], [ax, 2.3 * z, 0], skip ? 0.01 : 0.55); drift([ax * 0.6, 1.4 + z, 5.5 + z * 2], [ax, 2.4 * z, 0], 1.6);
        telopOn(`${f.nameH}の <em>${sk1}</em>！（${subj}）`);
        const cut = document.createElement('div'); cut.className = 'std-cut ' + (atk ? 'b' : 'a');
        cut.style.setProperty('--c', th.c[0]);
        cut.innerHTML = `<img src="${dataOf(imgSrc(f.art)) || ''}" alt=""><div><b>${gt(sk1 + '！')}</b><small>${subj}</small></div>`;
        ui.appendChild(cut); requestAnimationFrame(() => cut.classList.add('on'));
        window.STD_SE && window.STD_SE('thunder');
        await W8(550);
        const a2 = monTop(atk), b2 = monTop(1 - atk);
        chargeFx(a2, b2, e);
        await W8(650);
        cut.classList.remove('on'); setTimeout(() => cut.remove(), 300);
        // とびこむ：かたごしの カメラ
        window.STD_SE && window.STD_SE('wind');
        setShot([ax * 2, 2.0, 5.5], [-ax * 0.67, 2.5, 0], skip ? 0.01 : 0.3);
        const t0 = performance.now(), D = sk1 === 'かんつう' ? 10 : 8.2;
        while (!skip && performance.now() - t0 < (FAST() ? 10 : 380)) { m[atk].lean = D * Math.pow((performance.now() - t0) / 380, 2); await new Promise(r => setTimeout(r, 16)); }
        m[atk].lean = D;
        continue;
      }
      if (e.hit) {
        hits++;
        const ti = e.side === 'B' ? 1 : 0, tx = m[ti].home, f = ti ? o.B : o.A;
        window.STD_SE && window.STD_SE(e.crit ? 'crit' : sk1 === '連続攻撃' ? (hits === 1 ? 'combo' : 'hit') : 'hit');
        if (atk < 0) atk = 1 - ti;
        // 受けた方を 正面から
        const sw = rand(-1, 1) * 2;
        setShot([tx * 0.35 + sw, 2.6, 9.5], [tx, 2.4, 0], skip ? 0.01 : 0.12); drift([tx * 0.15 + sw * 2, 4.2, 14.5], [tx * 0.7, 2.4, 0], 1.4);
        await W8(60);
        const p = monTop(ti), a = monTop(atk);
        hitFx(p, a, e, sk1, subj);
        m[ti].kb = e.crit ? 3 : 1.8; m[ti].flick = 0.6;
        W3.shock.position.x = tx; W3.shockT = 0; W3.punch = e.crit ? 1 : 0.5;
        const d = document.createElement('div'); d.className = 'std-dmg' + (e.crit ? ' crit' : '');
        d.innerHTML = `${e.crit ? `<small>${gt('かいしん！', 'pk')}</small>` : ''}${gt(String(e.hit), e.crit ? 'pk' : 'yl')}`; d.style.left = p.x + 'px'; d.style.top = (p.y - 40) + 'px';
        ui.appendChild(d); setTimeout(() => d.remove(), FAST() ? 20 : 1500);
        setHP(e.snap);
        const fl = e.crit ? 'かいしんの いちげき！！' : e.eff > 1 ? 'こうかは ばつぐんだ！' : e.eff < 1 ? 'いまひとつの ようだ…' : e.hit >= f.maxhp * 0.3 ? 'これは 大きい！' : pick1(['きまった！', 'ヒット！', 'いい一撃！']);
        telopOn(`${f.nameH}に <em>${e.hit}</em> ダメージ！ ${fl}`);
        await W8(e.crit ? 1500 : 1150);
        continue;
      }
      // 状態異常・回復などの おしらせ
      if (e.stt) window.STD_SE && window.STD_SE(e.stt);
      setHP(e.snap);
      setShot([rand(-4, 4), 5, 18], [0, 2.4, 0], skip ? 0.01 : 0.6);
      telopOn(e.t);
      await W8(1400);
    }
    await back();
    // 決着がついたら KO
    const ko = hp.P <= 0 ? 0 : hp.B <= 0 ? 1 : -1;
    if (ko >= 0 && !(hp.P <= 0 && hp.B <= 0)) {
      const kx = m[ko].home;
      skip = false;
      setShot([kx * 0.4, 2.2, 10], [kx, 1.6, 0], 0.4);
      m[ko].ko = 0.001; window.STD_SE && window.STD_SE('crit'); W3.shake = 0.6; W3.excite = 1.5;
      const k = document.createElement('div'); k.className = 'std-go ko'; k.innerHTML = gt('K.O.!', 'gd'); ui.appendChild(k);
      flashScreen('#fff', 0.7);
      telopOn(`${(ko ? o.B : o.A).nameH}は たおれた！`);
      await W8(1900); k.remove();
    } else {
      setShot([0, 9, 21], [0, 2.4, 0], skip ? 0.01 : 0.8);
      telopOn(o.turn >= 3 ? '3ターン しゅうりょう！' : 'つぎの ターンへ！');
      await W8(1100);
    }
    // まなびバトルの画面に もどる
    hud.classList.remove('on'); setTimeout(() => hud.remove(), 400);
    sk.remove(); const t = $('.std-telop', ui); if (t) t.remove();
    st.classList.remove('std-fighting'); $('#app').style.visibility = '';
    m.forEach(x => { x.ko = 0; x.lean = 0; });
    setMode('battle');
  };

  // ---------- 勝利 ----------
  // w = 'P' | 'B' | 'draw'
  STD.win = async function (w, o) {
    setMode('win'); PS.length = 0;
    const m = W3.mon;
    setMons(o);
    const show = w === 'draw' ? [0, 1] : [w === 'P' ? 0 : 1];
    m.forEach((x, i) => { x.g.visible = show.includes(i); x.t0 = now(); x.home = show.length === 1 ? 0 : i ? 4 : -4; });
    W3.spots.forEach((s, i) => { s.intensity = show.includes(i) ? 7 : 0; s.position.set(m[i].home, 20, 6); s.target.position.set(m[i].home, 0, 0); });
    W3.beamTo = i => new THREE.Vector3(show.length === 1 ? rand(-0.5, 0.5) : (i % 2 ? 4 : -4), 0, 0);
    const im = new Image(); im.src = dataOf(imgSrc((w === 'B' ? o.B : o.A).art));
    im.onload = () => drawVision('win', { imW: im, wText: w === 'draw' ? 'ひきわけ！' : 'WINNER!' });
    drawVision('win', { imW: im, wText: w === 'draw' ? 'ひきわけ！' : 'WINNER!' });
    const zW = show.length === 1 ? (m[show[0]].sz || 1) : 1;
    setShot([0, 9, 20], [0, 2.8 * zW, 0], 0.01); drift([0, 2.8 * zW + 0.4, 9 + zW * 6], [0, 2.4 * zW, 0], 2.2);
    m.forEach((x, i) => (x.body.userData.halo.material.opacity = show.includes(i) ? 0.85 : 0));
    W3.exBase = 1.0; W3.excite = 1.4;
    flashScreen('#fff', 0.8);
    await wait(900);
  };
  STD.endWin = function () { W3.mon.forEach(x => (x.body.userData.halo.material.opacity = 0)); W3.mon.forEach((x, i) => { x.home = i ? 6 : -6; x.g.visible = false; }); W3.spots.forEach((s, i) => { s.intensity = 0; s.position.set(i ? 6 : -6, 20, 6); s.target.position.set(i ? 6 : -6, 0, 0); }); mode = ''; setMode('title'); };

  // ---------- はじめ ----------
  STD.init = function () {
    const st = $('#stage'), app = $('#app');
    gl = document.createElement('div'); gl.id = 'stdgl'; st.insertBefore(gl, app);
    fx = document.createElement('canvas'); fx.id = 'stdfx'; fx.width = W; fx.height = H; st.appendChild(fx); fxc = fx.getContext('2d');
    ui = document.createElement('div'); ui.id = 'stdui'; ui.innerHTML = '<div id="stdflash"></div>'; st.appendChild(ui);
    if (/[?&]fps/.test(location.search)) { const f = document.createElement('div'); f.id = 'stdfps'; st.appendChild(f); }
    try { build3D(); ready = true; resize(); } catch (e) { console.warn('3Dが うごきません', e); st.classList.add('no3d'); ready = false; }
    // 字が よみこまれたら フィールドと ビジョンを かきなおす
    if (ready && document.fonts) document.fonts.ready.then(() => { drawField(W3.fieldTex.userData.canvas.getContext('2d'), 1024, 1024); W3.fieldTex.needsUpdate = true; drawVision(visionMode); });
    requestAnimationFrame(frame);
  };
  STD.ok = () => ready;
  if (!window.THREE) { STD.on = false; } // three がないときは ふつうの まなびバトルの見た目
  STD.light = LIGHT;
})();
