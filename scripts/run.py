"""Own PostgreSQL cluster and app processes; never touches another project database."""
import os,sys,time,socket,subprocess,urllib.request,json,signal
from winjob import Job
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'.runtime'
def main():
 RUNTIME.mkdir(exist_ok=True);children=[];logs=[];job=Job();owned_pg=None
 pg=Path(os.environ.get('PG_BIN',r'C:\Program Files\PostgreSQL\17\bin'))
 if not (pg/'postgres.exe').exists():raise RuntimeError('PostgreSQL 17+ gerekli. PG_BIN ile bin klasörünü seç veya docker compose up db kullan.')
 cluster=RUNTIME/'postgres'
 env=os.environ.copy();env['DATABASE_URL']='postgresql://stageflow@127.0.0.1:55452/stageflow';env.update(NEXT_TELEMETRY_DISABLED='1',EXPO_NO_TELEMETRY='1',BROWSER='none');env.pop('CI',None)
 for port in [9148,9149]+([9150] if '--mobile' in sys.argv else []):
  with socket.socket() as probe:
   try:probe.bind(('127.0.0.1',port))
   except OSError:raise RuntimeError(f'{port} portu kullanımda. Önce önceki Stageflow penceresini kapat; başka süreçler durdurulmadı.')
 def run(args):return subprocess.run([str(x) for x in args],cwd=ROOT,env=env,capture_output=True,text=True)
 def start(name,args):
  log=open(RUNTIME/(name+'.log'),'w',encoding='utf8');logs.append(log)
  p=subprocess.Popen([str(x) for x in args],cwd=ROOT,env=env,stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0));children.append(p)
  if name!='postgres':job.assign(p)
  return p
 try:
  if not (cluster/'PG_VERSION').exists():
   result=run([pg/'initdb.exe','-D',cluster,'-U','stageflow','-A','trust','--encoding=UTF8','--locale=C']);
   if result.returncode:raise RuntimeError(result.stderr)
  status=run([pg/'pg_ctl.exe','-D',cluster,'status'])
  owned_pg=None
  if status.returncode:owned_pg=start('postgres',[pg/'postgres.exe','-D',cluster,'-h','127.0.0.1','-p','55452'])
  for _ in range(100):
   if run([pg/'pg_isready.exe','-h','127.0.0.1','-p','55452']).returncode==0:break
   time.sleep(.2)
  db=run([pg/'createdb.exe','-h','127.0.0.1','-p','55452','-U','stageflow','stageflow'])
  if db.returncode and 'already exists' not in db.stderr and 'zaten' not in db.stderr:print(db.stderr,flush=True)
  node=Path(os.environ.get('ProgramFiles',r'C:\Program Files'))/'nodejs/node.exe'
  api=start('api',[node,ROOT/'node_modules/tsx/dist/cli.mjs',ROOT/'apps/api/src/main.ts'])
  for _ in range(100):
   if api.poll() is not None:raise RuntimeError((RUNTIME/'api.log').read_text(encoding='utf8'))
   try:
    with urllib.request.urlopen('http://127.0.0.1:9149/api/health',timeout=1) as r:
     if r.status==200:break
   except Exception:time.sleep(.3)
  else:raise RuntimeError('API başlatılamadı. .runtime/api.log dosyasını kontrol et.')
  web=start('web',[node,ROOT/'node_modules/next/dist/bin/next','dev',str(ROOT/'apps/web'),'--hostname','127.0.0.1','--port','9148'])
  if '--mobile' in sys.argv:
   start('mobile',[node,ROOT/'node_modules/expo/bin/cli','start',str(ROOT/'apps/mobile'),'--web','--port','9150','--localhost'])
   print('Stageflow MOBILE http://localhost:9150',flush=True)
  print('Stageflow WEB http://127.0.0.1:9148',flush=True)
  while api.poll() is None and web.poll() is None:time.sleep(1)
 finally:
  job.close()
  if owned_pg and owned_pg.poll() is None:run([pg/'pg_ctl.exe','-D',cluster,'stop','-m','fast','-w'])
  for p in reversed(children):
   if p.poll() is None:p.terminate()
  for p in children:
   try:p.wait(timeout=8)
   except subprocess.TimeoutExpired:p.kill()
  for log in logs:log.close()
if __name__=='__main__':
 try:main()
 except KeyboardInterrupt:pass
