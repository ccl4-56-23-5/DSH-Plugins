import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { apiyiCatalog, mimoCatalog, catalogFor, normalizeDiscovered } from '../lib/capabilities.js'

function client() {
  let plugin, cells=[], cursor=0
  const React={createElement:(type,props,...children)=>({type,props,children}),useState:initial=>{const i=cursor++;if(!(i in cells))cells[i]=initial;return[cells[i],v=>{cells[i]=typeof v==='function'?v(cells[i]):v}]} }
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>{plugin=d.factory(()=>React)}}},Set,Map,JSON})
  return {plugin,render:model=>{cursor=0;return plugin.ModelsEditor(model)}}
}
const plain=v=>JSON.parse(JSON.stringify(v))
function nodes(node){return !node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...(node.children||[]).flatMap(nodes)]}
test('all catalog entries declare evidence; unknown is not a text-only claim; MiMo and common vision models are correct',()=>{
  for(const catalog of [apiyiCatalog,mimoCatalog]){
    assert.equal(new Set(catalog.models.map(m=>m.id)).size,catalog.models.length)
    for(const m of catalog.models){assert.ok(m.inputEvidence);if(m.inputEvidence==='unknown')assert.equal(m.input,undefined);else assert.ok(m.input.includes('text'))}
  }
  for(const m of mimoCatalog.models)assert.deepEqual(m.input,['text','image'])
  for(const id of ['gpt-4o','gpt-4.1','gpt-5.4-mini','gemini-2.5-pro','claude-sonnet-4-6'])assert.ok(apiyiCatalog.models.find(m=>m.id===id).input.includes('image'),id)
  assert.equal(catalogFor('https://api.xiaomimimo.com.evil.test/v1'),undefined)
  assert.equal(catalogFor('https://api.xiaomimimo.com/custom'),undefined)
  assert.equal(normalizeDiscovered([{id:'mimo-v2.6-flash'}],'https://api.xiaomimimo.com/v1')[0].input.includes('image'),true)
})
test('sync updates automatic capabilities, preserves names and enabled state, never downgrades from missing metadata or overwrites manual choices',()=>{
  const {plugin}=client(), existing=[{id:'a',name:'My name',enabled:true,input:['text'],inputMode:'auto'},{id:'b',enabled:false,input:['text'],inputMode:'manual'},{id:'c',input:['text','image'],inputMode:'auto'}]
  const next=plain(plugin.mergeModels(existing,[{id:'a',name:'Remote',input:['text','image'],inputEvidence:'discovery'},{id:'b',input:['text','image']},{id:'c'},{id:'d',input:['text','image']}]))
  assert.deepEqual(next[0].input,['text','image']);assert.equal(next[0].name,'My name');assert.equal(next[0].enabled,true)
  assert.deepEqual(next[1],existing[1]);assert.deepEqual(next[2],existing[2]);assert.equal(next[3].enabled,false)
})
test('editing an unknown model name does not create a text-only input or reasoning override',()=>{
  const c=client();let saved
  const props={model:{id:'unknown'},onDone:v=>{saved=v},onClose:()=>{}}
  let tree=nodes(c.render(props));tree.find(n=>n.type==='input'&&n.props.placeholder==='可选，便于识别').props.onChange({target:{value:'renamed'}})
  tree=nodes(c.render(props));tree.find(n=>n.children?.includes('确认模型信息')).props.onClick()
  assert.equal(saved.reasoningEfforts,undefined);assert.equal(saved.name,'renamed');assert.equal(saved.input,undefined);assert.equal(saved.inputMode,'auto')
  assert.equal(c.plugin.capabilityLabel({input:['text'],inputEvidence:'unknown'}),'能力待确认')
})
