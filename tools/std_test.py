# まなびスタジアムのテスト（Playwright）
# 使い方: python3 tools/build.py && python3 tools/std_test.py [--shots]
#  --shots：演出つきで1試合して スクリーンショットを撮る（tools/_shots/）
import pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
MB = ROOT.parent / 'manabi-battle'
BOT = (MB / 'tools/play_test.py').read_text().split('BOT = """')[1].split('"""')[0]
URL = (ROOT / 'dist/index.html').as_uri()
SHOTS = ROOT / 'tools/_shots'
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
errors, fails = [], []
def check(c, m):
    print(('OK  ' if c else 'NG  ') + m)
    if not c: fails.append(m)

def make_qr(b, pn, cn, runs):
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page()
    pg.add_init_script('window.FAST = true'); pg.goto((MB / 'index.html').as_uri() + '?test')
    pg.fill('#pn', pn); pg.fill('#cn', cn); pg.click('#go')
    for _ in range(runs):
        pg.click('#dun'); pg.wait_for_timeout(50); pg.click('.ov .choices button')
        for _ in range(4000):
            if pg.query_selector('#dun') and not pg.query_selector('.ov'): break
            pg.evaluate(BOT, 0.8); pg.wait_for_timeout(25)
    pg.evaluate("MB.S.owned.push('どくキバ','木の盾','たこ焼き','おにぎり','ねらいのメガネ','いのちの実')")
    q = pg.evaluate('MB.qrBytes()'); ctx.close(); return q

def play(pg, until, n=8000, shot=None):
    for i in range(n):
        if pg.evaluate(until): return True
        if pg.query_selector('#ok') and not pg.query_selector('.ov') and pg.query_selector('.bk'):
            if len(pg.query_selector_all('.bk.sel')) < 3: pg.evaluate("(()=>{const e=document.querySelector('.bk:not(.none):not(.sel)'); if(e) e.click(); else document.querySelector('#ok').click();})()")
            else: pg.evaluate("document.querySelector('#ok').click()")
            pg.wait_for_timeout(30); continue
        if pg.evaluate("document.body.innerText.includes('画面を見て')") and not pg.query_selector('.ov'):
            pg.evaluate("document.querySelector('.scr') && document.querySelector('.scr').click()"); pg.wait_for_timeout(30); continue
        if shot: shot(i)
        pg.evaluate(BOT, 0.7); pg.wait_for_timeout(25)
    return False

with sync_playwright() as p:
    b = p.chromium.launch(args=GL)
    qa = make_qr(b, 'あおい', 'ピコ', 2); qb = make_qr(b, 'けんた', 'ガオ', 2)
    shots = '--shots' in sys.argv
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    if not shots: pg.add_init_script('window.FAST = true')
    pg.goto(URL); pg.wait_for_timeout(1500)
    if shots: SHOTS.mkdir(exist_ok=True); pg.screenshot(path=str(SHOTS / '01_title.png'))
    check(pg.query_selector('#m1') is not None, 'タイトルに 1vs1モード')
    check(pg.evaluate("!!document.querySelector('#stdgl canvas')"), '3Dスタジアムが ある')
    pg.click('#m1'); pg.wait_for_timeout(300)
    check(pg.evaluate(f"MB.scan({qa})"), 'Aの QR を読めた'); pg.wait_for_timeout(300)
    check(pg.evaluate(f"MB.scan({qb})"), 'Bの QR を読めた'); pg.wait_for_timeout(300)
    txt = pg.inner_text('.ov'); check('あおい' in txt and 'けんた' in txt, '確認画面に 2人')
    pg.click('.ov .choices button'); pg.wait_for_timeout(200)
    check('後ろを向いて' in pg.inner_text('#app'), 'Aがえらぶとき「Bは後ろを向いて」')
    n = [0]
    def shot(i):
        if not shots: return
        if pg.query_selector('.std-card.on') and n[0] < 2: pg.screenshot(path=str(SHOTS / f'02_card{n[0]}.png')); n[0] += 1; pg.wait_for_timeout(2500)
        if pg.query_selector('.std-vs.on') and not (SHOTS / '03_vs.png').exists(): pg.screenshot(path=str(SHOTS / '03_vs.png'))
        if pg.query_selector('.std-go') and not (SHOTS / '04_go.png').exists(): pg.wait_for_timeout(250); pg.screenshot(path=str(SHOTS / '04_go.png'))
        if pg.query_selector('.dmg') and len(list(SHOTS.glob('05_hit*'))) < 4: pg.screenshot(path=str(SHOTS / f'05_hit{len(list(SHOTS.glob("05_hit*")))}.png'))
    ok = play(pg, "MB.VS && MB.VS.phase === 'end' && !!document.querySelector('.std-win.on')", shot=shot)
    check(ok, '対戦が 最後まで 進んで 勝利画面')
    if shots: pg.wait_for_timeout(1500); pg.screenshot(path=str(SHOTS / '06_win.png'))
    check(pg.evaluate("localStorage.getItem('manabi_battle_save') === null"), 'まなびバトルの セーブを 作っていない')
    btn = [x.inner_text() for x in pg.query_selector_all('.sw-btns button')]
    check(len(btn) == 3, f'勝利画面の ボタンは3つ {btn}')
    picks = pg.evaluate('MB.VS.picks')
    pg.click('#w1'); pg.wait_for_timeout(300)
    check(pg.evaluate("MB.VS.phase") == 'intro' and pg.evaluate('MB.VS.picks') == picks, '同じアイテムで再戦 → そうびは そのまま')
    if not shots:
        ok = play(pg, "MB.VS && MB.VS.phase === 'end' && !!document.querySelector('.std-win.on')")
        check(ok, '再戦も 最後まで')
        pg.click('#w2'); pg.wait_for_timeout(300)
        pg.click('.scr'); pg.wait_for_timeout(300)
        sel = pg.evaluate("[...document.querySelectorAll('.bk.sel')].map(e=>e.dataset.n)")
        check(sorted(set(sel)) == sorted(set(picks['a'])), f'えらびなおし → 前のそうびが 入っている {sel}')
        play(pg, "MB.VS && MB.VS.phase === 'end' && !!document.querySelector('.std-win.on')")
        pg.click('#w3'); pg.wait_for_timeout(300)
        check(pg.query_selector('#m1') is not None and pg.evaluate("localStorage.getItem('manabi_stadium_vs') === null"), 'タイトルにもどる → 対戦のデータは消える')
    b.close()
print('errors:', errors or 'なし'); print('NG:', fails or 'なし')
