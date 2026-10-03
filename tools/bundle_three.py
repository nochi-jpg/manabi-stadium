import re
B='three-src/build/'  # r186 の build を clone して使う
core=open(B+'three.core.js').read(); mod=open(B+'three.module.js').read()
def take_export(src, pat):
    m=re.search(pat, src, re.S); return m
def entries(lst):
    out=[]
    for e in lst.split(','):
        e=e.strip()
        if not e: continue
        p=e.split(' as '); out.append((p[0].strip(), p[-1].strip()))
    return out
# core: final export
m=re.search(r'\nexport \{([^}]*)\};\s*$', core, re.S)
core_ex=entries(m.group(1)); core_body=core[:m.start()]
assert 'import ' not in core_body[:2000] or True
# module
mi=re.search(r'^import \{([^}]*)\} from \'\./three\.core\.js\';\n', mod, re.M)
imports=entries(mi.group(1))
mr=re.search(r'^export \{([^}]*)\} from \'\./three\.core\.js\';\n', mod, re.M)
reexp=entries(mr.group(1))
mo=re.search(r'\nexport \{([^}]*)\};\s*$', mod, re.S)
mod_ex=entries(mo.group(1))
mod_body=mod[:mo.start()].replace(mi.group(0),'').replace(mr.group(0),'')
assert not re.search(r'^(import|export) ', core_body, re.M), 'core leftovers'
assert not re.search(r'^(import|export) ', mod_body, re.M), 'mod leftovers'
out='var THREE=(function(){\n"use strict";\nconst __core=(function(){\n'+core_body+'\nreturn {'+','.join(f'{b}:{a}' for a,b in core_ex)+'};\n})();\n'
out+='const __mod=(function(){\nconst {'+','.join(f'{a}:{b}' if a!=b else a for a,b in imports)+'}=__core;\n'+mod_body+'\nreturn {'+','.join(f'{b}:{a}' for a,b in mod_ex)+'};\n})();\n'
out+='const T={};'+''.join(f'T.{b}=__core.{a};' for a,b in reexp)+'Object.assign(T,__mod);return T;\n})();\n'
open('three.iife.js','w').write(out)
print(len(core_ex),len(imports),len(reexp),len(mod_ex),len(out))
