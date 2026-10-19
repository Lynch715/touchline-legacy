#!/usr/bin/env python3
"""在临时目录复用足球经理的历史测试；不向源项目写入任何结果或存档。"""
from pathlib import Path
import argparse,json,re,subprocess,tempfile
parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[3]/'足球经理')
parser.add_argument('--full-season',action='store_true')
a=parser.parse_args();root=Path(__file__).resolve().parents[2];upstream=a.source/'_patch/attachment-fix-v3-20261018'
output=root/'output/football-sync';output.mkdir(parents=True,exist_ok=True)
legacy=Path('/private/tmp/fm-audit-20261018/base.json')
if not legacy.exists():raise SystemExit('缺少原附件测试旧档 /private/tmp/fm-audit-20261018/base.json；请保留原测试资料后再运行历史迁移回归。常规定向测试不依赖此文件。')
suites=['regression.cjs','edge-regression.cjs','v1-regression.cjs','v2-regression.cjs','instant-competitions.cjs','storage-extra.cjs']
if a.full_season:suites.append('full-season.cjs')
results=[]
with tempfile.TemporaryDirectory(prefix='touchline-upstream-') as tmp:
 temp=Path(tmp)
 for name in suites:
  s=(upstream/name).read_text()
  s=re.sub(r'process.env.FMFILE\s*=\s*[^;]+;',lambda m:'process.env.FMFILE='+json.dumps(str(root/'index.html'))+';',s)
  for old in ["require('../fc27/shim.js')","require(path.resolve(__dirname,'../fc27/shim.js'))"]:
   s=s.replace(old,'require('+json.dumps(str(root/'qa/football-sync/shim.cjs'))+')')
  # Historical read fixtures stay read-only. Full-season outputs stay inside the temporary folder.
  if name!='full-season.cjs':
   for fixture in ['qa-precontract.json','qa-new-season.json']:
    s=s.replace("path.join(__dirname,'"+fixture+"')",json.dumps(str(upstream/fixture)))
  if name=='v1-regression.cjs':
   # Expiration day is now valid; the historical expired case must be the following day.
   s=s.replace('offer();WORLD.day=14;assert.equal(acceptOffer(0),false);','offer();WORLD.day=15;assert.equal(acceptOffer(0),false);')
   # The upstream positive case had a full buyer and removed positional cover. New guards
   # correctly reject that case; make it a genuinely legal sale without weakening assertions.
   s=s.replace('const u=reset(),b=WORLD.clubs.find(c=>c.id!==u.id),p=P(u.squad[1]);',"const u=reset(),b=WORLD.clubs.find(c=>c.id!==u.id),p=u.squad.map(P).find(p=>p.pos==='ST');\nwhile(b.squad.length>=30)toFreeAgent(P(b.squad.at(-1)),b);")
   s=s.replace('movePlayer(extra.id,u.id,0);','movePlayer(extra.id,u.id,0);extra.pos=p.pos;extra.pos2=[];')
  if name=='regression.cjs':
   # Finance-only legacy fixture manually increments the year without rebuilding
   # any competitions. Keep its inert WCL state in the same year for validation.
   s=s.replace('const save=JSON.parse(JSON.stringify(WORLD));assertLoadable(save);','const save=JSON.parse(JSON.stringify(WORLD));if(save.wcl)save.wcl.season=save.season;assertLoadable(save);')
  if name=='instant-competitions.cjs':
   # WCL is now calendar based. A legacy completed season must stay completed,
   # without rerunning all matches or paying again. New calendar progression is
   # covered by wcl.cjs and wcl-season.cjs rather than the old instant expectation.
   start=s.index('const beforeW=')
   end=s.index('assert.equal(WORLD.wcHistory.at(-1).season',start)
   s=s[:start]+"""const beforeW=total('balance'),historyW=JSON.stringify(WORLD.wclHistory);runWorldChampionsLeague(WORLD.season);const w=WORLD.wcl;
assert(w.legacy&&w.stage==='F');assert.deepEqual(w.teams.slice().sort((a,b)=>a-b),qualified.sort((a,b)=>a-b));assert.equal(total('balance'),beforeW);assert.equal(JSON.stringify(WORLD.wclHistory),historyW);results.push('世冠旧版已结算档保留历史与奖金，不重复瞬时模拟');
"""+s[end:]
  (temp/name).write_text(s)
  r=subprocess.run(['node',str(temp/name)],capture_output=True,text=True,cwd=root)
  (output/(name+'.log')).write_text(r.stdout+r.stderr)
  results.append({'suite':name,'exit':r.returncode});print(name,'PASS' if r.returncode==0 else 'FAIL',flush=True)
 for f in temp.glob('*results.json'):(output/('upstream-'+f.name)).write_bytes(f.read_bytes())
(output/'inherited.json').write_text(json.dumps(results,indent=2))
raise SystemExit(1 if any(r['exit'] for r in results) else 0)
