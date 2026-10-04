# 1つのHTMLにまとめた版を作る（解凍しなくていい）。まなびバトルの tools/build_html.py と同じやり方
# 使い方: python3 tools/build_html.py [BGMのビットレート kbps（ふつう48）]  → manabi-stadium.html
#   さきに tools/build.py で dist/ を作る（このスクリプトが よぶ）。ffmpeg が必要（BGMを軽くする）
import base64, json, pathlib, re, subprocess, sys, tempfile
ROOT = pathlib.Path(__file__).resolve().parent.parent
subprocess.run([sys.executable, str(ROOT / 'tools' / 'build.py')], check=True)
D = ROOT / 'dist'
KBPS = int(sys.argv[1]) if len(sys.argv) > 1 else 48
OUT = ROOT / 'manabi-stadium.html'
TMP = pathlib.Path(tempfile.mkdtemp())
MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff': 'font/woff', '.woff2': 'font/woff2'}
def data_uri(rel):
    p = D / rel
    if rel.startswith('sounds/bgm/'):  # BGM は モノラル・低いビットレートに（電子黒板のスピーカーなら じゅうぶん）
        q = TMP / p.name
        if not q.exists(): subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(p), '-ac', '1', '-b:a', f'{KBPS}k', str(q)], check=True)
        p = q
    return f'data:{MIME[p.suffix.lower()]};base64,' + base64.b64encode(p.read_bytes()).decode()
PATH = re.compile(r'(?:images|sounds|fonts)/[\w./%-]+\.(?:png|jpg|jpeg|gif|webp|svg|mp3|woff2?)')
js = lambda t: t.replace('</script', '<\\/script')
exists = lambda p: (D / p).exists()
html = (D / 'index.html').read_text()
inline = lambda t: PATH.sub(lambda m: data_uri(m.group(0)) if exists(m.group(0)) else m.group(0), t)
html = ''.join(inline(s) if s.startswith('<style>') else s for s in re.split(r'(<style>.*?</style>)', html, flags=re.S))
for css in ['assets.local.css', 'stadium.css']:
    html = html.replace(f'<link rel="stylesheet" href="{css}">', '<style>\n' + inline((D / css).read_text()) + '\n</style>')
ico = data_uri('images/player/all_cute_1.png')
html = re.sub(r'(<link rel="(?:icon|apple-touch-icon)"[^>]*href=")images/player/all_cute_1\.png', lambda m: m.group(1) + ico, html)
local_js = (D / 'assets.local.js').read_text()
paths = sorted({p for p in set(PATH.findall(local_js)) | set(PATH.findall((D / 'assets.js').read_text())) if exists(p)} | {f'images/player/{p.name}' for p in (D / 'images/player').glob('*.png')})
emb = {p: data_uri(p) for p in paths}
logo = D / '..' / '..' / 'manabi-battle-assets' / 'stadium' / 'logo.png'
if logo.exists(): emb['stadium/logo.png'] = 'data:image/png;base64,' + base64.b64encode(logo.read_bytes()).decode()
fix = '<script>(function(){/* data: を blob: に（innerHTML に 長い文字が 入らないように＝画面の切りかえが かるくなる）。画像は 先に デコードしておく */const E=window.__EMB,K=window.__KEEP=[];for(const k in E){const v=E[k],c=v.indexOf(\',\'),t=v.slice(5,v.indexOf(\';\')),b=atob(v.slice(c+1)),u=new Uint8Array(b.length);for(let j=0;j<b.length;j++)u[j]=b.charCodeAt(j);E[k]=URL.createObjectURL(new Blob([u],{type:t}));if(t.startsWith(\'image/\')){const im=new Image();im.src=E[k];if(im.decode)im.decode().catch(()=>{});K.push(im);}}const w=o=>{for(const k in o){const v=o[k];if(typeof v==="string"&&E[v])o[k]=E[v];else if(v&&typeof v==="object")w(v);}};w(window.ASSETS||{});})();</script>'
std_img = 'window.STD_IMG={logo:window.__EMB["stadium/logo.png"]};for(const k in window.__EMB)if(k.startsWith("images/player/"))window.STD_IMG[k]=window.__EMB[k];'
def script(m):
    name = m.group(1)
    if name == 'assets.local.js': return '<script>window.__EMB=' + js(json.dumps(emb, ensure_ascii=False)) + ';</script>\n<script>' + js(local_js) + '</script>\n' + fix
    if name == 'std_img.js': return '<script>' + std_img + '</script>'
    return '<script>' + js((D / name).read_text()) + '</script>'
html = re.sub(r'<script src="([^"]+)"></script>', script, html)
left = [p for p in PATH.findall(re.sub(r'data:[^"\')]+', '', html)) if p not in emb and exists(p)]
OUT.write_text(html)
print(f'{OUT.name}（{OUT.stat().st_size / 1e6:.1f} MB・BGM {KBPS}kbps モノラル・埋めこみ {len(emb)} ファイル）')
if left: print('のこっているパス:', sorted(set(left))[:10])
