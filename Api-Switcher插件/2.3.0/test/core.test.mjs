import test from 'node:test'
import { writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createController, validateSource, presets, mimoCatalog } from '../lib/core.js'

const work = fileURLToPath(new URL('.work/', import.meta.url))
mkdirSync(work, { recursive: true })
const draft = { id: 'new-source', name: '测试来源', api: 'openai-completions', baseURL: 'https://example.test/v1', models: [{ id: 'test-model' }] }
function fixture() {
  let revision = 0
  const providers = { existing: { api: 'openai-completions', displayName: '已有来源', baseURL: 'https://example.test/v1', apiKeyEnv: 'EXISTING_KEY', headers: { 'x-custom': 'preserve' }, compat: { supportsStore: false }, models: [{ id: 'old-model', compat: { supportsDeveloperRole: false } }] } }
  const keys = new Map([['EXISTING_KEY', 'secret-original-value']])
  const creds = { resolve: async ref => keys.has(ref) ? { value: keys.get(ref), source: 'file' } : undefined,
    describe: async ref => ({ configured: keys.has(ref), writable: true, ...(keys.has(ref) ? { source: 'file' } : {}) }),
    set: async (ref, value) => { keys.set(ref, value) }, unset: async ref => { keys.delete(ref) } }
  let active = { provider: 'existing', model: 'old-model' }, fail = false, streamMode = 'ok'
  const selections = [], calls = []
  const ctx = {
    settings: { writable: true, describe: () => [{ ns: 'llm-pi-ai', revision, value: { providers: structuredClone(providers) } }],
      mutate: async (_ns, ops, expected) => {
        if (fail) throw Object.assign(new Error('fixture rejected'), { name: 'SettingsConflictError' })
        if (expected !== revision) throw Object.assign(new Error('stale'), { name: 'SettingsConflictError' })
        for (const op of ops) { if (op.op === 'set') providers[op.path[1]] = structuredClone(op.value); else delete providers[op.path[1]] }
        revision++
      } },
    llm: {
      listConfigurableProviders: () => Object.keys(providers).map(provider => ({ provider, settingsNs: 'llm-pi-ai', settingsPath: ['providers', provider] })),
      listProviders: () => Object.keys(providers).map(id => ({ id, name: id })),
      listModels: async id => providers[id]?.models || [],
      resolveCallConfig: async input => input,
      discoverModels: async (_ns, input) => { calls.push(input); return [{ id: 'discovered' }] },
      stream: async function* (input) {
        calls.push(input)
        if (streamMode === 'error') { yield { type: 'finish', reason: { kind: 'error', failure: { message: 'Authentication failed secret-original-value', code: 'AUTH' } } }; return }
        if (streamMode !== 'empty') yield { type: 'text-delta', text: 'OK' }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    },
    agentDefaultModel: { currentSelection: () => active, saveSelection: async v => { active = v } },
    get: name => name === 'credentials' ? creds : name === 'sessionController' ? { selectModel: async v => { selections.push(v) } } : undefined
  }
  const filename = mkdtempSync(work + 'case-') + '/state.json'
  return { controller: createController(ctx, filename, {logos:{cached:()=>undefined,refresh:async()=>undefined,read:()=>undefined}}), keys, providers, ctx, filename, selections, calls, reject: () => { fail = true }, streamMode: v => { streamMode = v } }
}

test('upgrade repairs bundled text defaults once, preserves manual modes, settings, keys and unrelated routes', async () => {
  const f = fixture(), before = structuredClone(f.providers.existing), keys = [...f.keys]
  f.providers.mimo = { baseURL: 'https://api.xiaomimimo.com/v1', api: 'openai-completions', headers: {custom:'keep'}, models: mimoCatalog.models.map(m => ({id:m.id,input:['text'],compat:{supportsStore:false}})) }
  writeFileSync(f.filename, JSON.stringify({version:2,initialized:true,managed:['mimo'],favorites:['mimo'],providers:{mimo:{enabled:false,enabledModels:['mimo-v2.6-flash'],modelInputModes:{'mimo-v2.6-pro':'manual'}}}}))
  await f.controller.initialize()
  assert.deepEqual(f.providers.mimo.models[0].input,['text','image'])
  assert.deepEqual(f.providers.mimo.models[1].input,['text'])
  assert.equal(f.providers.mimo.models[0].compat.supportsStore,false)
  assert.deepEqual(f.providers.mimo.headers,{custom:'keep'})
  assert.deepEqual(f.providers.existing,before); assert.deepEqual([...f.keys],keys)
  const state = await f.controller.state(), source=state.sources.find(s=>s.id==='mimo')
  assert.equal(source.enabled,false); assert.equal(source.favorite,true)
  assert.deepEqual(source.models.filter(m=>m.enabled).map(m=>m.id),['mimo-v2.6-flash'])
  f.providers.mimo.models[0].input=['text']; await f.controller.initialize()
  assert.deepEqual(f.providers.mimo.models[0].input,['text'])
})

test('DSH discovery modalities survive normalization, save and reload without leaking presentation fields', async () => {
  const f=fixture()
  f.ctx.llm.discoverModels=async()=>[{id:'vision',inputModalities:['text','image']},{id:'unknown'},{id:'vision'}]
  const found=await f.controller.discover({api:draft.api,baseURL:draft.baseURL})
  assert.equal(found.models.length,2);assert.deepEqual(found.models[0].input,['text','image']);assert.equal(found.models[1].input,undefined)
  const saved=await f.controller.save({expectedRevision:(await f.controller.state()).revision,source:{...draft,models:found.models.map(m=>({...m,inputMode:'auto'}))}})
  const model=saved.sources.find(s=>s.id===draft.id).models[0]
  assert.deepEqual(model.input,['text','image']);assert.equal(model.inputEvidence,'discovery')
  assert.equal(f.providers[draft.id].models[0].inputModalities,undefined)
  await f.controller.save({expectedRevision:saved.revision,source:{...draft,models:saved.sources.find(s=>s.id===draft.id).models}})
  assert.deepEqual(f.providers[draft.id].models[0].input,['text','image'])
})

test('automatic unknown input is omitted and cleared token limits really clear while compatibility survives',async()=>{
  const f=fixture();Object.assign(f.providers.existing.models[0],{input:['text'],contextWindow:32000,maxTokens:4000})
  await f.controller.save({expectedRevision:(await f.controller.state()).revision,source:{...draft,id:'existing',models:[{id:'old-model',inputMode:'auto',input:['text'],inputEvidence:'unknown',contextWindow:null,maxTokens:null}]}})
  const model=f.providers.existing.models[0]
  for(const key of ['input','contextWindow','maxTokens'])assert.equal(Object.hasOwn(model,key),false)
  assert.equal(model.compat.supportsDeveloperRole,false)
})

test('failed migration does not mark repair complete or alter metadata',async()=>{
  const f=fixture();f.providers.mimo={baseURL:'https://api.xiaomimimo.com/v1',models:[{id:'mimo-v2.6-flash',input:['text']}]}
  writeFileSync(f.filename,JSON.stringify({version:2,initialized:true,managed:['mimo'],favorites:[],providers:{}}))
  const before=readFileSync(f.filename,'utf8');f.reject();await assert.rejects(f.controller.initialize())
  assert.equal(readFileSync(f.filename,'utf8'),before)
})

test('temporarily unavailable provider retains all editable model fields in its fallback state',async()=>{
  const f=fixture();Object.assign(f.providers.existing.models[0],{input:['text','image'],contextWindow:32000,maxTokens:4000,reasoningEfforts:{high:'high'}})
  f.ctx.llm.listModels=async()=>{throw new Error('offline')}
  const model=(await f.controller.state()).sources.find(s=>s.id==='existing').models[0]
  assert.equal(model.contextWindow,32000);assert.equal(model.maxTokens,4000)
  assert.deepEqual(model.reasoningEfforts,['high']);assert.deepEqual(model.input,['text','image']);assert.equal(model.inputMode,'manual')
})

test('saving one source preserves other provider settings and keeps secrets out of returned state and metadata', async () => {
  const f = fixture(), before = structuredClone(f.providers.existing)
  const s = await f.controller.save({ expectedRevision: (await f.controller.state()).revision, source: draft, apiKey: 'secret-new-value' })
  assert.deepEqual(f.providers.existing, before)
  assert.equal(s.sources.find(x => x.id === draft.id).managed, true)
  assert.equal(s.sources.find(x => x.id === draft.id).credential.configured, true)
  assert.equal(JSON.stringify(s).includes('secret-new-value'), false)
  assert.equal(readFileSync(f.filename, 'utf8').includes('secret-new-value'), false)
})
test('editing existing source preserves unexposed route and model compatibility fields and blank key', async () => {
  const f = fixture()
  await f.controller.save({ expectedRevision: (await f.controller.state()).revision, source: { ...draft, id: 'existing', models: [{ id: 'old-model' }] }, apiKey: '' })
  assert.deepEqual(f.providers.existing.headers, { 'x-custom': 'preserve' })
  assert.equal(f.providers.existing.models[0].compat.supportsDeveloperRole, false)
  assert.equal(f.keys.get('EXISTING_KEY'), 'secret-original-value')
})
test('revision conflict prevents changes, and a failed route write restores its prior credential', async () => {
  const f = fixture(), original = (await f.controller.state()).revision
  await f.controller.favorite({ expectedRevision: original, provider: 'existing', favorite: true })
  await assert.rejects(f.controller.save({ expectedRevision: original, source: draft, apiKey: 'new-secret' }), e => e.status === 409)
  assert.equal(f.keys.has('DSH_API_SWITCHER_NEW_SOURCE_KEY'), false)
  f.reject()
  await assert.rejects(f.controller.save({ expectedRevision: (await f.controller.state()).revision, source: { ...draft, id: 'existing' }, apiKey: 'changed-secret' }), e => e.status === 409)
  assert.equal(f.keys.get('EXISTING_KEY'), 'secret-original-value')
})
test('current-session activation calls DSH model selection and updates the new-session default without sending messages', async () => {
  const f = fixture()
  await f.controller.save({ expectedRevision: (await f.controller.state()).revision, source: draft })
  const r = await f.controller.activate({ expectedRevision: (await f.controller.state()).revision, provider: draft.id, model: 'test-model', sessionId: 'session-one' })
  assert.equal(r.scope, 'session-and-default')
  assert.equal(r.state.active.provider, draft.id)
  assert.deepEqual(f.selections, [{ sessionId: 'session-one', provider: draft.id, model: 'test-model' }])
  assert.equal(f.calls.length, 0)
  await assert.rejects(f.controller.remove({ expectedRevision: r.state.revision, provider: draft.id }), e => e.code === 'SOURCE_IN_USE')
})
test('connection test requires actual visible text, disables tools, masks secrets, and handles terminal failure', async () => {
  const f = fixture()
  const ok = await f.controller.test({ provider: 'existing', model: 'old-model' })
  assert.equal(ok.success, true); assert.equal(ok.reply, 'OK'); assert.deepEqual(f.calls[0].tools, [])
  f.streamMode('error')
  const bad = await f.controller.test({ provider: 'existing', model: 'old-model' })
  assert.equal(bad.success, false); assert.equal(bad.message.includes('secret-original-value'), false)
  f.streamMode('empty')
  assert.equal((await f.controller.test({ provider: 'existing', model: 'old-model' })).success, false)
})
test('discovery never reuses a stored key at a changed draft endpoint', async () => {
  const f = fixture()
  await assert.rejects(f.controller.discover({ provider: 'existing', api: 'openai-completions', baseURL: 'https://different.test/v1' }), e => e.code === 'DRAFT_CREDENTIAL_REQUIRED')
  assert.equal(f.calls.length, 0)
})
test('invalid addresses, duplicate models, and prototype provider identifiers are rejected before any I/O', () => {
  for (const baseURL of ['javascript:alert(1)', 'https://user:secret@example.test/v1', 'https://example.test/v1?key=secret']) assert.throws(() => validateSource({ ...draft, baseURL }))
  assert.throws(() => validateSource({ ...draft, id: 'constructor' }))
  assert.throws(() => validateSource({ ...draft, models: [{ id: 'same' }, { id: 'same' }] }))
})
test('declared reasoning levels round-trip to DSH effort maps and remain selectable', async () => {
  const f = fixture()
  const state = await f.controller.save({ expectedRevision: (await f.controller.state()).revision, source: { ...draft, models: [{ id: 'test-model', reasoningEfforts: ['off', 'high'] }] } })
  assert.deepEqual(f.providers[draft.id].models[0].reasoningEfforts, { off: null, high: 'high' })
  assert.deepEqual(state.sources.find(s => s.id === draft.id).models[0].reasoningEfforts, ['off', 'high'])
  const selected = await f.controller.activate({ expectedRevision: state.revision, provider: draft.id, model: 'test-model', reasoningEffort: 'high' })
  assert.equal(selected.selected.reasoningEffort, 'high')
})

test('MiMo from the model editor saves with no reasoning levels or key, keeps its checked model and leaves other routes unchanged', async () => {
  const f = fixture(), before = structuredClone(f.providers.existing), keys = [...f.keys]
  const mutate = f.ctx.settings.mutate
  f.ctx.settings.mutate = async (ns, ops, revision) => {
    for (const op of ops) for (const model of op.value?.models || []) {
      // Actual DSH rejects a present-but-empty reasoningEfforts map.
      assert.ok(model.reasoningEfforts === undefined || model.reasoningEfforts === false || Object.keys(model.reasoningEfforts).length > 0)
    }
    return mutate(ns, ops, revision)
  }
  const template = presets.find(p => p.id === 'mimo')
  const source = { ...template, enabled: true, models: mimoCatalog.models.map(m => ({ ...m, enabled: m.id === template.defaultModel, reasoningEfforts: [] })) }
  const saved = await f.controller.save({ expectedRevision: (await f.controller.state()).revision, source, apiKey: '' })
  assert.equal(saved.sources.find(s => s.id === 'mimo').credential.configured, false)
  assert.deepEqual(f.providers.mimo.models[0].reasoningEfforts, {off:null,high:'high'})
  const reloaded = await f.controller.state(), mimo = reloaded.sources.find(s => s.id === 'mimo')
  assert.deepEqual(mimo.models.filter(m => m.enabled).map(m => m.id), ['mimo-v2.6-flash'])
  assert.equal(mimo.website, 'https://platform.xiaomimimo.com')
  assert.deepEqual(f.providers.existing, before)
  assert.deepEqual([...f.keys], keys)
  assert.equal(f.calls.length, 0)
})

test('an old empty checkbox payload cannot erase preserved manual reasoning configuration', async () => {
  const f = fixture()
  f.providers.existing.models[0].reasoningEfforts = { off: null, high: 'high' }
  await f.controller.save({ expectedRevision: (await f.controller.state()).revision, source: { ...draft, id: 'existing', models: [{ id: 'old-model', reasoningEfforts: [] }] }, apiKey: '' })
  assert.deepEqual(f.providers.existing.models[0].reasoningEfforts, {off:null,high:'high'})
  assert.equal(f.providers.existing.models[0].compat.supportsDeveloperRole, false)
  assert.equal(f.keys.get('EXISTING_KEY'), 'secret-original-value')
})
test('credential-only edits invalidate stale forms without exposing the credential hash', async () => {
  const f = fixture(), before = await f.controller.state()
  f.keys.set('EXISTING_KEY', 'edited-in-another-window')
  const after = await f.controller.state()
  assert.notEqual(after.revision, before.revision)
  await assert.rejects(f.controller.favorite({ expectedRevision: before.revision, provider: 'existing', favorite: true }), e => e.code === 'CONFLICT')
  assert.equal(JSON.stringify(after).includes('edited-in-another-window'), false)
})
test('provider activation and a model allowlist survive reload and block disabled selections', async () => {
  const f=fixture()
  let s=await f.controller.save({expectedRevision:(await f.controller.state()).revision,source:{...draft,enabled:false,models:[{id:'one',enabled:true},{id:'two',enabled:false}]}})
  await assert.rejects(f.controller.activate({expectedRevision:s.revision,provider:draft.id,model:'one'}),e=>e.code==='MODEL_DISABLED')
  s=await f.controller.preferences({expectedRevision:s.revision,provider:draft.id,enabled:true,enabledModels:['one'],name:'独立供应商名称'})
  assert.equal((await f.controller.state()).sources.find(v=>v.id===draft.id).name,'独立供应商名称')
  await assert.rejects(f.controller.activate({expectedRevision:s.revision,provider:draft.id,model:'two'}),e=>e.code==='MODEL_DISABLED')
  const before=JSON.stringify(f.providers)
  await assert.rejects(f.controller.preferences({expectedRevision:s.revision,provider:draft.id,enabledModels:['missing']}))
  assert.equal(JSON.stringify(f.providers),before)
  const r=await f.controller.activate({expectedRevision:s.revision,provider:draft.id,model:'one'})
  assert.equal(r.selected.model,'one')
})
test('v1 metadata migrates without losing favorites or changing preexisting enabled models',async()=>{
  const f=fixture();writeFileSync(f.filename,JSON.stringify({version:1,managed:['existing'],favorites:['existing']}))
  const s=await f.controller.state();assert.equal(s.sources[0].favorite,true);assert.equal(s.sources[0].enabled,true);assert.equal(s.sources[0].models[0].enabled,true)
  await f.controller.preferences({expectedRevision:s.revision,provider:'existing',enabledModels:[]})
  const saved=JSON.parse(readFileSync(f.filename,'utf8'));assert.equal(saved.version,2);assert.deepEqual(saved.favorites,['existing'])
})
test('APIYI bootstrap preserves credentials, existing routes and default; deleting it does not recreate it',async()=>{
  const f=fixture(),before=structuredClone(f.providers.existing),keys=[...f.keys],active=(await f.controller.state()).active
  await f.controller.initialize();let s=await f.controller.state(),source=s.sources.find(v=>v.id==='apiyi')
  assert.equal(source.baseURL,'https://api.apiyi.com/v1');assert.equal(source.enabled,false);assert.equal(source.models.length,233);assert.equal(source.models.filter(m=>m.enabled).length,1)
  assert.deepEqual(f.providers.existing,before);assert.deepEqual([...f.keys],keys);assert.deepEqual(s.active,active)
  s=await f.controller.remove({expectedRevision:s.revision,provider:'apiyi'});await f.controller.initialize();assert.equal((await f.controller.state()).sources.some(v=>v.id==='apiyi'),false)
})

test('discovered image input survives an unknown catalog entry and repeated saves; disabled reasoning survives unrelated edits',async()=>{
  const f=fixture()
  const {apiyiCatalog}=await import('../lib/capabilities.js')
  const id=apiyiCatalog.models.find(m=>m.inputEvidence==='unknown').id
  const source={...draft,baseURL:'https://api.apiyi.com/v1',models:[{id,input:['text','image'],inputMode:'auto',inputEvidence:'discovery'}]}
  let state=await f.controller.save({expectedRevision:(await f.controller.state()).revision,source})
  const loaded=state.sources.find(s=>s.id===draft.id)
  assert.equal(loaded.models[0].inputEvidence,'discovery')
  await f.controller.save({expectedRevision:state.revision,source:loaded})
  assert.deepEqual(f.providers[draft.id].models[0].input,['text','image'])
  f.providers.existing.models[0].reasoningEfforts=false
  state=await f.controller.state()
  await f.controller.save({expectedRevision:state.revision,source:state.sources.find(s=>s.id==='existing')})
  assert.equal(f.providers.existing.models[0].reasoningEfforts,false)
})

test('official MiMo limits migrate into DSH and remain automatic; external edits become manual',async()=>{
  const f=fixture();f.providers.mimo={api:'openai-completions',baseURL:'https://api.xiaomimimo.com/v1',models:[{id:'mimo-v2.6-pro'}]}
  writeFileSync(f.filename,JSON.stringify({version:2,initialized:true,managed:['mimo'],favorites:[],providers:{}}))
  await f.controller.initialize()
  assert.equal(f.providers.mimo.models[0].contextWindow,1000000);assert.equal(f.providers.mimo.models[0].maxTokens,131072)
  let state=await f.controller.state(),m=state.sources.find(s=>s.id==='mimo').models[0]
  assert.equal(m.limitModes.contextWindow,'auto');assert.equal(m.effectiveLimits.contextWindow,1000000)
  const before=readFileSync(f.filename,'utf8');await f.controller.initialize();assert.equal(readFileSync(f.filename,'utf8'),before)
  f.providers.mimo.models[0].contextWindow=900000;await f.controller.initialize()
  m=(await f.controller.state()).sources.find(s=>s.id==='mimo').models[0]
  assert.equal(m.contextWindow,900000);assert.equal(m.limitModes.contextWindow,'manual')
})

test('migration preserves existing user limits, custom endpoints and other provider configuration',async()=>{
  const f=fixture();f.providers.mimo={baseURL:'https://api.xiaomimimo.com/v1',models:[{id:'mimo-v2.6-pro',contextWindow:800000,maxTokens:8192}]}
  f.providers.mirror={baseURL:'https://proxy.test/v1',models:[{id:'mimo-v2.6-pro'}]}
  const before=structuredClone(f.providers);writeFileSync(f.filename,JSON.stringify({version:2,initialized:true,managed:['mimo','mirror'],favorites:[],providers:{}}))
  await f.controller.initialize();assert.deepEqual(f.providers,before)
})

test('DSH fallback capacities never become saved overrides on unrelated form edits',async()=>{
  const f=fixture();f.ctx.llm.listModels=async id=>(f.providers[id]?.models||[]).map(m=>({...m,contextWindow:m.contextWindow??262144,maxTokens:m.maxTokens??32768}))
  const state=await f.controller.state(),src=state.sources.find(s=>s.id==='existing')
  assert.equal(src.models[0].contextWindow,undefined);assert.equal(src.models[0].effectiveLimits.contextWindow,262144)
  assert.ok(src.models[0].capacityWarning)
  await f.controller.save({expectedRevision:state.revision,source:{...src,name:'Renamed'}})
  assert.equal(f.providers.existing.models[0].contextWindow,undefined);assert.equal(f.providers.existing.models[0].maxTokens,undefined)
})

test('live discovered capacities survive save, reload and partial subsequent listings',async()=>{
  const f=fixture();f.ctx.llm.discoverModels=async()=>[{id:'wide',contextWindow:500000,maxTokens:50000}]
  const found=await f.controller.discover({api:draft.api,baseURL:draft.baseURL})
  let state=await f.controller.save({expectedRevision:(await f.controller.state()).revision,source:{...draft,models:found.models}})
  let m=state.sources.find(s=>s.id===draft.id).models[0]
  assert.equal(m.contextWindow,500000);assert.equal(m.limitModes.contextWindow,'auto')
  await f.controller.save({expectedRevision:state.revision,source:{...draft,models:[{...m,name:'Renamed'}]}})
  assert.equal(f.providers[draft.id].models[0].maxTokens,50000)
})

test('explicit default survives restart and catalog refresh; returning to auto restores official limits',async()=>{
  const f=fixture(),src={...draft,id:'mimo',baseURL:'https://api.xiaomimimo.com/v1',models:[{id:'mimo-v2.6-pro',limitModes:{contextWindow:'default',maxTokens:'default'}}]}
  let state=await f.controller.save({expectedRevision:(await f.controller.state()).revision,source:src})
  await f.controller.initialize();assert.equal(f.providers.mimo.models[0].contextWindow,undefined)
  state=await f.controller.state()
  await f.controller.save({expectedRevision:state.revision,source:{...src,models:[{id:'mimo-v2.6-pro',limitModes:{contextWindow:'auto',maxTokens:'auto'}}]}})
  assert.equal(f.providers.mimo.models[0].contextWindow,1000000)
})

test('invalid budget pairs are rejected before writes, including catalog/manual combinations',async()=>{
  const f=fixture(),before=structuredClone(f.providers)
  await assert.rejects(f.controller.save({expectedRevision:(await f.controller.state()).revision,source:{...draft,models:[{id:'x',contextWindow:1000,maxTokens:1000}]}}))
  await assert.rejects(f.controller.save({expectedRevision:(await f.controller.state()).revision,source:{...draft,baseURL:'https://api.xiaomimimo.com/v1',models:[{id:'mimo-v2.6-pro',contextWindow:10000,limitModes:{contextWindow:'manual',maxTokens:'auto'}}]}}))
  assert.deepEqual(f.providers,before)
})

test('an unavailable configured row is retained and marked unavailable when the host lists only healthy models',async()=>{
  const f=fixture();f.providers.existing.models.push({id:'invalid',contextWindow:1000,compat:{keep:true}})
  f.ctx.llm.listModels=async()=>[{id:'old-model'}]
  const state=await f.controller.state(),src=state.sources[0]
  assert.equal(src.models.length,2);assert.equal(src.models[1].available,false)
  await f.controller.save({expectedRevision:state.revision,source:src})
  assert.equal(f.providers.existing.models[1].compat.keep,true)
})

test('changed endpoint never carries stored credential or custom discovery headers',async()=>{
  const f=fixture();await f.controller.discover({provider:'existing',api:draft.api,baseURL:'https://elsewhere.test/v1',apiKey:'replacement'})
  assert.equal(f.calls[0].provider,undefined)
  await assert.rejects(f.controller.save({expectedRevision:(await f.controller.state()).revision,source:{...draft,id:'existing',baseURL:'https://elsewhere.test/v1'}}),e=>e.code==='DRAFT_CREDENTIAL_REQUIRED')
})

test('discovery errors mask non-sk stored credential values',async()=>{
  const f=fixture();f.ctx.llm.discoverModels=async()=>{throw Error('failed secret-original-value')}
  await assert.rejects(f.controller.discover({provider:'existing',api:draft.api,baseURL:draft.baseURL}),e=>!e.message.includes('secret-original-value'))
})

test('connection test rejects truncated visible text and does not report it as success',async()=>{
  const f=fixture();f.ctx.llm.stream=async function*(){yield {type:'text-delta',text:'O'};yield {type:'finish',reason:{kind:'max-tokens'}}}
  assert.equal((await f.controller.test({provider:'existing',model:'old-model'})).success,false)
})

test('metadata disk failure rolls back settings and credentials atomically',async()=>{
  const f=fixture(),before=structuredClone(f.providers),keys=[...f.keys]
  const c=createController(f.ctx,f.filename,{logos:{cached:()=>{},refresh:async()=>{}},writeMetadata:()=>{throw Error('disk full')}})
  await assert.rejects(c.save({expectedRevision:(await c.state()).revision,source:{...draft,id:'existing'},apiKey:'changed'}),e=>e.code==='METADATA_WRITE_FAILED')
  assert.deepEqual(f.providers,before);assert.deepEqual([...f.keys],keys)
})

test('session switching reports partial success if saving defaults fails',async()=>{
  const f=fixture();f.ctx.agentDefaultModel.saveSelection=async()=>{throw Error('disk failure')}
  await assert.rejects(f.controller.activate({expectedRevision:(await f.controller.state()).revision,provider:'existing',model:'old-model',sessionId:'s'}),e=>e.code==='DEFAULT_NOT_SYNCED'&&e.message.includes('当前会话已切换'))
  assert.equal(f.selections.length,1)
})

test('real DSH model-info shape supplies effective capacity and output defaults instead of list-row guesses',async()=>{
  const f=fixture();f.ctx.llm.listModels=async()=>[{id:'old-model',inputModalities:['text']}]
  f.ctx.llm.resolveModelInfo=async()=>({id:'old-model',context:{contextWindow:262144},defaultMaxTokens:4096,reasoning:{efforts:[{id:'off'},{id:'high'}]}})
  const m=(await f.controller.state()).sources[0].models[0]
  assert.equal(m.contextWindow,undefined);assert.equal(m.effectiveLimits.contextWindow,262144);assert.equal(m.effectiveLimits.maxTokens,4096)
  assert.deepEqual(m.reasoningEfforts,['off','high'])
})

test('reasoning upgrade preserves choices, custom wire values, credentials and default semantics',async()=>{
  const f=fixture(),keyBefore=[...f.keys];
  f.providers.mimo={api:'openai-completions',baseURL:'https://api.xiaomimimo.com/v1',headers:{custom:'keep'},models:[{id:'mimo-v2.6-flash',compat:{supportsStore:false}},{id:'mimo-v2.6-pro',reasoningEfforts:{high:'custom'},compat:{thinkingFormat:'openai'}}]};
  writeFileSync(f.filename,JSON.stringify({version:2,initialized:true,managed:['mimo'],favorites:['mimo'],providers:{mimo:{enabled:false,enabledModels:['mimo-v2.6-pro']}}}));
  const custom=structuredClone(f.providers.mimo.models[1]);
  await f.controller.initialize();
  assert.deepEqual(f.providers.mimo.models[0].reasoningEfforts,{off:null,high:'high'});
  assert.equal(f.providers.mimo.models[0].compat.supportsStore,false);
  assert.deepEqual(f.providers.mimo.models[1].reasoningEfforts,custom.reasoningEfforts);
  assert.equal(f.providers.mimo.models[1].compat.thinkingFormat,'openai');
  assert.deepEqual([...f.keys],keyBefore);
  assert.deepEqual(await f.controller.withReasoningDefault({provider:'mimo',model:'mimo-v2.6-flash'}),{provider:'mimo',model:'mimo-v2.6-flash',reasoningEffort:'high'});
  assert.equal((await f.controller.withReasoningDefault({provider:'mimo',model:'mimo-v2.6-flash',reasoningEffort:'off'})).reasoningEffort,'off');
  f.providers.mimo.reasoning='off';
  assert.equal((await f.controller.withReasoningDefault({provider:'mimo',model:'mimo-v2.6-flash'})).reasoningEffort,undefined);
  const once=JSON.stringify(f.providers);await f.controller.initialize();assert.equal(JSON.stringify(f.providers),once);
  const pref=JSON.parse(readFileSync(f.filename)).providers.mimo;assert.equal(pref.enabled,false);assert.deepEqual(pref.enabledModels,['mimo-v2.6-pro']);
});

test('external reasoning edits survive restart and auto to default removes only owned fields',async()=>{
 const f=fixture(),src={...draft,id:'mimo',baseURL:'https://api.xiaomimimo.com/v1',models:[{id:'mimo-v2.6-flash'}]};
 await f.controller.save({expectedRevision:(await f.controller.state()).revision,source:src});
 f.providers.mimo.models[0].reasoningEfforts={low:'vendor-custom'};
 await f.controller.initialize();assert.deepEqual(f.providers.mimo.models[0].reasoningEfforts,{low:'vendor-custom'});
 assert.equal((await f.controller.state()).sources.find(s=>s.id==='mimo').models[0].reasoningMode,'manual');
 await f.controller.save({expectedRevision:(await f.controller.state()).revision,source:{...src,models:[{id:'mimo-v2.6-flash',reasoningMode:'auto'}]}});
 await f.controller.save({expectedRevision:(await f.controller.state()).revision,source:{...src,models:[{id:'mimo-v2.6-flash',reasoningMode:'default'}]}});
 assert.equal(f.providers.mimo.models[0].reasoningEfforts,undefined);assert.equal(f.providers.mimo.models[0].compat.thinkingFormat,undefined);
});

test('native thinking route uses same origin credential reference, correct URL, preserves source, never overwrites',async()=>{
 const f=fixture();f.providers.existing={...f.providers.existing,baseURL:'https://api.apiyi.com/v1',models:[{id:'claude-sonnet-4-6',contextWindow:200000,input:['text','image']},{id:'gpt-5.4'}]};
 const before=structuredClone(f.providers.existing),keys=[...f.keys];
 await f.controller.native({expectedRevision:(await f.controller.state()).revision,provider:'existing'});
 assert.deepEqual(f.providers.existing,before);assert.deepEqual([...f.keys],keys);
 const p=f.providers['existing-claude'];assert.equal(p.baseURL,'https://api.apiyi.com');assert.equal(p.api,'anthropic-messages');assert.equal(p.apiKeyEnv,before.apiKeyEnv);
 assert.equal(p.models.length,1);assert.equal(p.models[0].contextWindow,200000);assert.deepEqual(p.models[0].reasoningEfforts,{off:null,low:'low',medium:'medium',high:'high'});
 await assert.rejects(f.controller.native({expectedRevision:(await f.controller.state()).revision,provider:'existing'}),e=>e.code==='NO_NATIVE_ROUTE');
 assert.deepEqual(f.providers['existing-claude'],p);
});
