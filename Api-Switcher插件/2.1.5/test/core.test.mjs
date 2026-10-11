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
  assert.equal(Object.hasOwn(f.providers.mimo.models[0], 'reasoningEfforts'), false)
  const reloaded = await f.controller.state(), mimo = reloaded.sources.find(s => s.id === 'mimo')
  assert.deepEqual(mimo.models.filter(m => m.enabled).map(m => m.id), ['mimo-v2.6-flash'])
  assert.equal(mimo.website, 'https://platform.xiaomimimo.com')
  assert.deepEqual(f.providers.existing, before)
  assert.deepEqual([...f.keys], keys)
  assert.equal(f.calls.length, 0)
})

test('clearing all reasoning checkboxes removes an old effort map while preserving other model compatibility', async () => {
  const f = fixture()
  f.providers.existing.models[0].reasoningEfforts = { off: null, high: 'high' }
  await f.controller.save({ expectedRevision: (await f.controller.state()).revision, source: { ...draft, id: 'existing', models: [{ id: 'old-model', reasoningEfforts: [] }] }, apiKey: '' })
  assert.equal(Object.hasOwn(f.providers.existing.models[0], 'reasoningEfforts'), false)
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
