import base64, json
import os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
A=os.path.join(ROOT,'..','manabi-battle-assets')+'/'; F=os.path.join(ROOT,'..','manabi-battle','fonts')+'/'
def u(p, mime): return f'data:{mime};base64,'+base64.b64encode(open(p,'rb').read()).decode()
se={k:u(A+f'sounds/se/{k}.mp3','audio/mpeg') for k in ['statup','kira','fire','start','thunder','wind','crit','hit']}
data={'imgA':u(A+'images/player/sansu_cool_3.png','image/png'),'imgB':u(A+'images/player/kokugo_cool_4.png','image/png'),
 'nameA':'ブルーファング','nameB':'フレイムキング','bgm':u(A+'sounds/bgm/170.mp3','audio/mpeg'),'se':se}
h=open(os.path.join(HERE,'template.html')).read()
h=h.replace('__FONT_MR__',u(F+'MPLUSRounded1c-ExtraBold.woff','font/woff')).replace('__FONT_DG__',u(F+'DotGothic16-Regular.woff','font/woff'))
h=h.replace('__DATA__',json.dumps(data)).replace('__THREE__',open(os.path.join(ROOT,'lib','three.iife.js')).read().replace('</script','<\\/script')).replace('__MAIN__',open(os.path.join(HERE,'main.js')).read())
open(os.path.join(HERE,'stadium_sample.html'),'w').write(h); print(len(h)//1024,'KB')
