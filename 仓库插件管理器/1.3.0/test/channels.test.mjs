import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {discover} from '../lib/catalog.js';import {createManager} from '../lib/index.js';import {writeCatalogCache} from '../lib/cache.js';
const dir=()=>mkdtempSync(join(tmpdir(),'dsh-channels-')),host={listBundles:async()=>[]},tick=()=>new Promise(r=>setImmediate(r));
const item=(version,prerelease=false)=>({name:'dsh-storydeck',version,prerelease,bytes:1,sha256:'a'.repeat(64),url:`https://github.com/ccl4-56-23-5/DSH-Plugins/releases/download/storydeck-v${version}/dsh-storydeck-${version}.tgz`,tag:'storydeck-v'+version});
const catalog=include=>({items:[item(include?'0.8.0':'0.7.1',include)],errors:[],checkedAt:new Date().toISOString()});
test('discovery excludes tests by default and selects verified newer tests only after opt-in',async()=>{
 const values=[item('0.7.1'),item('0.8.0',true)];const releases=values.map(i=>({tag_name:i.tag,prerelease:i.prerelease,assets:[{name:'release-manifest.json',browser_download_url:i.url.replace(/[^/]+$/,'release-manifest.json')},{name:`dsh-storydeck-${i.version}.tgz`,browser_download_url:i.url,size:1,digest:'sha256:'+i.sha256}]}));
 const read=async url=>Buffer.from(JSON.stringify(url.includes('api.github')?releases:(()=>{const i=values.find(i=>url.includes(i.tag));return {name:i.name,version:i.version,files:{[`dsh-storydeck-${i.version}.tgz`]:{bytes:1,sha256:i.sha256}}};})()));
 assert.equal((await discover(read)).items[0].version,'0.7.1');const tests=await discover(read,{includePrerelease:true});assert.equal(tests.items[0].version,'0.8.0');assert.equal(tests.items[0].prerelease,true);
});
test('test opt-in defaults off and persists independently from plugin enablement',async()=>{
 const directory=dir(),load=async options=>catalog(options.includePrerelease),m=createManager(host,{directory,load});assert.equal((await m.state()).receiveTests,false);await m.refresh();assert.equal((await m.state()).items[0].version,'0.7.1');await m.setReceiveTests(true);await m.refresh();assert.equal((await m.state()).items[0].prerelease,true);
 const next=createManager(host,{directory,load});assert.equal((await next.state()).receiveTests,true);assert.equal((await next.state()).items[0].version,'0.8.0');assert.equal(JSON.parse(readFileSync(join(directory,'preferences-v1.json'))).receiveTests,true);
});
test('slow previous-channel response cannot replace the current catalog or cache',async()=>{
 let oldResolve;const directory=dir(),m=createManager(host,{directory,load:async options=>options.includePrerelease?catalog(true):new Promise(r=>oldResolve=r)});const old=m.refresh();await tick();await m.setReceiveTests(true);await m.refresh();oldResolve(catalog(false));await old;const state=await m.state();assert.equal(state.receiveTests,true);assert.equal(state.items[0].version,'0.8.0');assert.equal(state.cacheSource,'memory');
});
test('turning tests off never downgrades the installed plugin and refuses a stale test install',async()=>{
 let downloads=0;const m=createManager({listBundles:async()=>[{name:'dsh-storydeck',version:'0.8.0',installed:true,enabled:true}]},{directory:dir(),load:async o=>catalog(o.includePrerelease),download:async()=>downloads++});await m.setReceiveTests(true);await m.refresh();await m.setReceiveTests(false);await m.refresh();assert.equal((await m.state()).items[0].status,'newer');m.start({id:'stale-test-install-0001',name:'dsh-storydeck',action:'install',version:'0.8.0',sha256:'a'.repeat(64)});for(let i=0;i<30&&[...m.jobs.values()][0].status==='running';i++)await tick();assert.equal(downloads,0);assert.equal([...m.jobs.values()][0].status,'failed');
});
test('invalid preferences fail closed and a stable catalog does not expose cached test entries',async()=>{
 const directory=dir();writeFileSync(join(directory,'preferences-v1.json'),'bad json');writeCatalogCache(join(directory,'catalog-v1.json'),catalog(true));const m=createManager(host,{directory,load:async()=>catalog(false)});assert.equal((await m.state()).receiveTests,false);assert.ok((await m.state()).items.every(i=>!i.prerelease));await assert.rejects(m.setReceiveTests('true'),/无效/);
});
