import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createManager} from '../lib/index.js';
import {readCatalogCache,writeCatalogCache} from '../lib/cache.js';
import {REPO} from '../lib/catalog.js';
mkdirSync(join(import.meta.dirname,'../.work'),{recursive:true});
const dir=()=>mkdtempSync(join(import.meta.dirname,'../.work/cache-'));
const item={name:'dsh-repo-manager',version:'1.1.0',bytes:123,sha256:'a'.repeat(64),url:`https://github.com/${REPO}/releases/download/repo-manager-v1.1.0/dsh-repo-manager-1.1.0.tgz`};
const catalog=()=>({items:[item],errors:[],checkedAt:new Date().toISOString()});
const host={listBundles:async()=>[{name:item.name,version:'1.0.1',enabled:true}]};
const tick=()=>new Promise(r=>setImmediate(r));
test('cold entry returns six useful local cards before network resolves',async()=>{
  let release,calls=0;const m=createManager(host,{directory:dir(),load:()=>{calls++;return new Promise(r=>release=r);}});
  const timeout=new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('State waited for network')),500);timer.unref();});
  const initial=await Promise.race([m.state(true),timeout]);
  assert.equal(initial.items.length,6);assert.equal(initial.cacheSource,'local');assert.equal(initial.refreshing,true);
  assert.equal(initial.items.find(i=>i.name===item.name).installedVersion,'1.0.1');
  assert.ok(initial.items.every(i=>i.version===null&&i.status==='unchecked'));
  await Promise.all([m.state(true),m.state(true),m.state()]);assert.equal(calls,1);
  release(catalog());await tick();assert.equal((await m.state()).items[0].status,'update');
});
test('disk cache survives host restart without network; installed status stays live',async()=>{
  const directory=dir();const first=createManager(host,{directory,load:async()=>catalog()});await first.refresh();
  let calls=0;const next=createManager({listBundles:async()=>[{name:item.name,version:'1.1.0',enabled:false}]},{directory,load:async()=>{calls++;throw new Error('offline');}});
  const state=await next.state();assert.equal(calls,0);assert.equal(state.cacheSource,'disk');assert.equal(state.items[0].enabled,false);assert.equal(state.items[0].status,'current');
});
test('network error preserves last-good cards and cache bytes',async()=>{
  const directory=dir(),path=join(directory,'catalog-v1.json');writeCatalogCache(path,catalog());const original=readFileSync(path,'utf8');
  const m=createManager(host,{directory,load:async()=>{throw new Error('offline fixture');}});
  await m.state(true);await tick();const s=await m.state();assert.equal(s.items[0].version,'1.1.0');assert.equal(s.refreshError,'offline fixture');assert.equal(s.refreshing,false);assert.equal(readFileSync(path,'utf8'),original);
});
test('partial release error cannot overwrite healthy cache',async()=>{
  const directory=dir();writeCatalogCache(join(directory,'catalog-v1.json'),catalog());
  const m=createManager(host,{directory,load:async()=>({items:[],errors:['release invalid'],checkedAt:new Date().toISOString()})});
  await assert.rejects(m.refresh(),/部分发布/);assert.equal((await m.state()).items[0].name,item.name);
});
test('corrupt, foreign, oversize and hostile cache falls back without crashing',async()=>{
  for(const raw of ['invalid','x'.repeat(4*1024*1024+1),JSON.stringify({schema:1,repo:'other',catalog:catalog()}),JSON.stringify({schema:1,repo:REPO,catalog:{...catalog(),items:[{...item,url:'https://evil.invalid/archive.tgz'}]}})]){
    const directory=dir();writeFileSync(join(directory,'catalog-v1.json'),raw);const m=createManager(host,{directory,load:async()=>catalog()});const s=await m.state();assert.equal(s.cacheSource,'local');assert.equal(s.items.length,6);assert.ok(s.cacheWarning);
  }
});
test('install revalidates cache version before using download URL',async()=>{
  const directory=dir();writeCatalogCache(join(directory,'catalog-v1.json'),catalog());let downloads=0;
  const m=createManager(host,{directory,load:async()=>({items:[{...item,version:'1.2.0'}],errors:[]}),download:async()=>{downloads++;}});
  m.start({id:'cache-install-revalidate-001',action:'install',name:item.name,version:item.version,sha256:item.sha256});
  await tick();assert.equal(downloads,0);assert.equal([...m.jobs.values()][0].status,'failed');assert.match([...m.jobs.values()][0].message,/版本已变化/);
});
test('successful refresh atomically replaces old cache and clears error',async()=>{
  const directory=dir();let fail=true;const m=createManager(host,{directory,load:async()=>{if(fail)throw new Error('offline');return catalog();}});
  await assert.rejects(m.refresh());fail=false;await m.refresh();const s=await m.state();assert.equal(s.refreshError,null);assert.equal(s.cacheSource,'memory');assert.equal(readCatalogCache(join(directory,'catalog-v1.json')).catalog.items[0].version,'1.1.0');
});
