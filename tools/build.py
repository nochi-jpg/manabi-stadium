# まなびスタジアム を 組み立てる
# となりに manabi-battle（公開）と manabi-battle-assets（非公開）を clone しておく
# 使い方: python3 tools/build.py        → dist/ （dist/index.html を開くと動く）
#         python3 tools/build.py --zip  → manabi-stadium.zip（Teams 配信用。たのまれたときだけ）
import base64, json, pathlib, shutil, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
MB = ROOT.parent / 'manabi-battle'
AS = ROOT.parent / 'manabi-battle-assets'
DIST = ROOT / 'dist'
SRC = ROOT / 'src'

# game.js の差しかえ（まなびバトル本体は かえない。ここで コピーに あてる）
# どれも「1か所だけ」見つかることを たしかめる（まなびバトルが かわって 合わなくなったら ここで止まる）
PATCHES = [
    # まなびバトルの セーブには さわらない
    ("  function save() {\n    if (!S) return;", "  function save() {\n    if (!S || S.stadium) return;"),
    ("  function rawSave() {\n    if (!S) return;", "  function rawSave() {\n    if (!S || S.stadium) return;"),
    ("const VS_KEY = 'manabi_battle_vs';", "const VS_KEY = 'manabi_stadium_vs';"),
    # ホームは ない → タイトルへ
    ("  function home() {\n", "  function home() {\n    if (S && S.stadium) return stdTitle();\n"),
    ("const backToSettings = () => { home(); settings(); };", "const backToSettings = () => { home(); if (S && S.stadium) return; settings(); };"),
    # 画面の背景を すかして 3Dスタジアムを 見せる
    ("    if (bg) el.style.background = `${shade(cls === 'btl' || cls === 'dun' ? 0.2 : 0.35)}, url(\"${bg}\") center/cover`;\n",
     "    if (bg) el.style.background = `${shade(cls === 'btl' || cls === 'dun' ? 0.2 : 0.35)}, url(\"${bg}\") center/cover`;\n    if (window.STD && STD.on && S && S.stadium) STD.bgFor(cls, el);\n"),
    # わざの 教科と だれのわざか を 演出に わたす
    ("ev.push({ sk: act.sk, cut:", "ev.push({ sk: act.sk, subj: act.subj, by: x.side, cut:"),
    ("    let lastSk = null, hitN = 0;\n", "    let lastSk = null, hitN = 0, lastSubj = null;\n"),
    ("if (e.cut) { lastSk = e.sk; hitN = 0; if (e.sk === 'ガードバッシュ' || e.sk === 'カウンター') se('guard'); await cutin(e.cut, 1100); continue; }",
     "if (e.cut) { lastSk = e.sk; lastSubj = e.subj; hitN = 0; if (e.sk === 'ガードバッシュ' || e.sk === 'カウンター') se('guard'); if (window.STD && STD.on && S && S.stadium) await STD.cast(e, () => cutin(e.cut, 1100)); else await cutin(e.cut, 1100); continue; }"),
    ("if (tEl) { tEl.classList.remove('hit'); void tEl.offsetWidth; tEl.classList.add('hit'); }\n",
     "if (tEl) { tEl.classList.remove('hit'); void tEl.offsetWidth; tEl.classList.add('hit'); }\n        if (window.STD && STD.on && S && S.stadium) STD.hit(e, lastSk, lastSubj);\n"),
    # BGM：タイトル以外は ずっと バトルの曲（アイテムえらびも）
    ("    bgm(cls === 'title' || cls === 'name' ? 'title'", "    if (S && S.stadium) bgm(cls === 'title' ? 'title' : 'vs'); else bgm(cls === 'title' || cls === 'name' ? 'title'"),
    # わざの打ちあいは 3Dで（ルーレット・教科・わざ・問題は まなびバトルの画面のまま）
    ("    }\n    hideGauges();\n    const ev = resolveTurn(order, turn, false);\n", "    }\n    hideGauges();\n    const hp0 = { P: P.hp, B: B.hp };\n    const ev = resolveTurn(order, turn, false);\n"),
    ("    saveVs();\n    await playEvents(ev);\n", "    saveVs();\n    if (window.STD && STD.on && S && S.stadium && STD.ok()) { await STD.fight(ev, stdFightData(hp0, turn)); updBars(); } else await playEvents(ev);\n"),
    # まちがえたときの 解説は 1秒で 自動で 消える（テンポを上げる）
    ("          await wait(2500); nb.disabled = false;\n          await new Promise(r => (nb.onclick = r));\n",
     "          if (S && S.stadium) await wait(1000); else { await wait(2500); nb.disabled = false;\n          await new Promise(r => (nb.onclick = r)); }\n"),
    # パス（こうさん）：スタジアムだけ。わざをえらぶ画面に いつでも出す
    ("        }).join('')}</div></div>`, 'ovb');\n      o.querySelectorAll('button').forEach(b => (b.onclick = () => { o.remove(); res(b.dataset.k); }));\n",
     "        }).join('')}</div>${S && S.stadium && BT.vs ? '<div class=\"std-passrow\"><button class=\"btn-gray std-pass\" data-pass=\"1\">🏳️ パス（こうさん）</button></div>' : ''}</div>`, 'ovb');\n"
     "      o.querySelectorAll('button').forEach(b => (b.onclick = async () => {\n"
     "        if (b.dataset.pass) { o.style.display = 'none'; const c = await dialog({ who: '🏳️', text: `${esc(P.pname)}さん、ほんとうに こうさんする？\\n<span class=\"sm\">パスすると、この試合は 負けになるよ</span>`, choices: [{ label: '🏳️ こうさんする', val: 1, cls: 'btn-main' }, { label: 'やめる', val: 0, cls: 'btn-gray' }] }); if (!c) { o.style.display = ''; return; } o.remove(); res('__pass'); return; }\n"
     "        o.remove(); res(b.dataset.k); }));\n"),
    ("      const sk = await playerSkill(P);\n      const subj = await playerSubj(P, B, turn);\n",
     "      const sk = await playerSkill(P);\n      if (sk === '__pass') return { pass: true };\n      const subj = await playerSubj(P, B, turn);\n"),
    ("      await playerAct(x, x.opp, turn, i === 0, K.VS_Q);\n",
     "      const pa = await playerAct(x, x.opp, turn, i === 0, K.VS_Q);\n"
     "      if (pa && pa.pass) { hideGauges(); BT.acts = {}; BT.phase = 'end'; BT.result = x.opp.side; BT.pass = x.side; saveVs(); const el = $(x.side === 'P' ? '#fP' : '#fB'); if (el) el.classList.add('bye'); await cutin(`🏳️ ${esc(x.pname)}さん（${esc(x.name)}）は こうさんした！`, 1800); return; }\n"),
    # はじめ：タイトル（まなびバトルの セーブは 読まない）
    ("  preload().then(() => {\n    S = load();\n    if (S) titleScreen(); else startNew();\n  });\n",
     "@@FLOW@@\n  preload().then(() => {\n    S = stdS();\n    if (STDX.on && STDX.init) STDX.init();\n    stdTitle();\n  });\n"),
]

def patch_game():
    g = (MB / 'game.js').read_text(encoding='utf-8')
    for old, new in PATCHES:
        n = g.count(old)
        if n != 1: sys.exit(f'game.js の差しかえが {n} か所見つかった（1か所のはず）：\n{old[:120]}')
        g = g.replace(old, new)
    g = g.replace('@@FLOW@@', (SRC / 'flow.js').read_text(encoding='utf-8'))
    return g

def main():
    for p in [MB / 'game.js', AS / 'images']:
        if not p.exists(): sys.exit(f'{p} がない（となりに clone してね）')
    if DIST.exists(): shutil.rmtree(DIST)
    DIST.mkdir()
    for f in ['questions.js', 'qmap.js', 'data.js', 'assets.js', 'savecode.js']: shutil.copy(MB / f, DIST / f)
    shutil.copytree(MB / 'lib', DIST / 'lib'); shutil.copytree(MB / 'fonts', DIST / 'fonts')
    shutil.copy(ROOT / 'lib' / 'three.iife.js', DIST / 'lib' / 'three.iife.js')
    for d in ['images', 'sounds']: shutil.copytree(AS / d, DIST / d)
    for f in ['assets.local.js', 'assets.local.css']:
        if (AS / f).exists(): shutil.copy(AS / f, DIST / f)
    (DIST / 'game.js').write_text(patch_game(), encoding='utf-8')
    for f in ['stadium.js', 'stadium.css']: shutil.copy(SRC / f, DIST / f)
    # 3D で使う モンスターの絵（file:// では 画像ファイルを WebGL に わたせないので data URL にする）
    img = {}
    for p in sorted((AS / 'images' / 'player').glob('*.png')):
        img['images/player/' + p.name] = 'data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode()
    logo = AS / 'stadium' / 'logo.png'
    if logo.exists(): img['logo'] = 'data:image/png;base64,' + base64.b64encode(logo.read_bytes()).decode()
    (DIST / 'std_img.js').write_text('window.STD_IMG=' + json.dumps(img) + ';\n', encoding='utf-8')
    # index.html
    h = (MB / 'index.html').read_text(encoding='utf-8')
    rep = [
        ('<title>まなびバトル</title>', '<title>まなびスタジアム</title>'),
        ('content="まなびバトル"', 'content="まなびスタジアム"'),
        ('<link rel="stylesheet" href="assets.local.css">', '<link rel="stylesheet" href="assets.local.css">\n<link rel="stylesheet" href="stadium.css">'),
        ('<script src="game.js"></script>', '<script src="lib/three.iife.js"></script>\n<script src="std_img.js"></script>\n<script src="stadium.js"></script>\n<script src="game.js"></script>'),
    ]
    for a, b in rep:
        if a not in h: sys.exit(f'index.html に「{a}」がない')
        h = h.replace(a, b, 1)
    (DIST / 'index.html').write_text(h, encoding='utf-8')
    print('dist/ を作った')
    if '--zip' in sys.argv:
        z = ROOT / 'manabi-stadium.zip'
        with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
            for p in sorted(DIST.rglob('*')):
                if p.is_file(): zf.write(p, 'manabi-stadium/' + str(p.relative_to(DIST)))
        print(z.name, round(z.stat().st_size / 1e6, 1), 'MB')

main()
