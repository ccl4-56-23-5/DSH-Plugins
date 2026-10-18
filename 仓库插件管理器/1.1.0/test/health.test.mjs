import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtimeHealth,readRuntime} from '../lib/health.js';
const bundle={enabled:true,rows:[{entryId:'include:test',moduleName:'dsh-test'},{entryId:'include:second',moduleName:'dsh-test/client'}]};
const plugins=bundle.rows.map(row=>({...row,enabled:true,fiberPhase:'active'}));
test('traffic lights combine all live entries with verified release status',()=>{
  assert.equal(runtimeHealth(bundle,plugins,'current',true).level,'green');
  assert.equal(runtimeHealth(bundle,plugins,'update',true).level,'yellow');
  assert.equal(runtimeHealth(bundle,[plugins[0]],'current',true).level,'red');
  assert.equal(runtimeHealth(bundle,[plugins[0],{...plugins[1],fiberPhase:'failed'}],'update',true).level,'red');
  assert.equal(runtimeHealth(bundle,[plugins[0],{...plugins[1],fiberPhase:'pending'}],'current',false).level,'red');
});
test('disabled, uninstalled, unverified and unavailable states never claim healthy/latest',()=>{
  for(const args of [[null,plugins,'current',true],[{...bundle,enabled:false},plugins,'current',true],[bundle,null,'current',true],[bundle,plugins,'current',false],[bundle,plugins,'newer',true],[bundle,plugins,'current',true,true]])assert.equal(runtimeHealth(...args).level,'gray');
});
test('runtime API failure and timeout are contained',async()=>{
  assert.equal((await readRuntime({})).error,true);
  assert.equal((await readRuntime({listPlugins:()=>{throw Error('changed host');}})).error,true);
  assert.equal((await readRuntime({listPlugins:()=>new Promise(()=>{})},10)).error,true);
  assert.deepEqual((await readRuntime({listPlugins:()=>plugins})).plugins,plugins);
});
