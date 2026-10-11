import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { apply } from '../lib/index.js'

test('startup failure reports 503 instead of pretending migration succeeded and retries after recovery', async()=>{
  const dir=fileURLToPath(new URL('.work/',import.meta.url));mkdirSync(dir,{recursive:true})
  let broken=true,route
  const ctx={settings:{writable:false,describe:()=>{if(broken)throw Error('fixture unavailable');return[]}},llm:{listConfigurableProviders:()=>[],listProviders:()=>[]},agentDefaultModel:{currentSelection:()=>({})},inject:(_deps,fn)=>fn(ctx),effect:fn=>fn(),webServer:{register:r=>{route=r}},get:()=>undefined}
  apply(ctx,{stateFile:mkdtempSync(dir+'startup-')+'/state.json'})
  const request={headers:{host:'127.0.0.1'},method:'GET',url:'/api-switcher/api/state'}
  const response=()=>({statusCode:0,setHeader(){},end(body){this.body=JSON.parse(body)}})
  const failed=response();await route.handler(request,failed);assert.equal(failed.statusCode,503);assert.equal(failed.body.error.code,'INITIALIZATION_FAILED')
  broken=false;const recovered=response();await route.handler(request,recovered);assert.equal(recovered.statusCode,200);assert.equal(recovered.body.value.version,'2.2.0')
})
