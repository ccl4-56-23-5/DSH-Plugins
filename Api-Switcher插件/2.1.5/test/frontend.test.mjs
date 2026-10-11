import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { SlotCore } from './fixtures/slot-core.js'
import { presets, mimoCatalog, protocols } from '../lib/core.js'
test('settings dialog mounts outside the conversation and its side-panel stacking context',()=>{
  let plugin
  const React={createElement:(type,props,...children)=>({type,props,children}),useEffect:()=>{},useRef:v=>({current:v})}
  const document={body:{id:'viewport'}}
  const ReactDOM={createPortal:(child,target)=>({child,target})}
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>{plugin=d.factory(name=>name==='react-dom'?ReactDOM:React)}}},document,Set,JSON})
  const modal=plugin.SettingsModal({onClose:()=>{}})
  assert.equal(modal.target,document.body)
  assert.equal(modal.child.props.className,'ap-modal-backdrop')
  assert.equal(modal.child.children[0].props['aria-modal'],true)
})
test('model seat mounts over the native face, binds the native store correctly, and restores on unload',async()=>{
  let plugin
  const React={createElement:(type,props,...children)=>({type,props,children}),useState:v=>[typeof v==='function'?v():v,()=>{}],useEffect:()=>{},useRef:v=>({current:v}),useSyncExternalStore:(_subscribe,get)=>get()}
  const document={documentElement:{dataset:{theme:'light'},className:''},getElementById:()=>null,createElement:()=>({}),head:{appendChild:()=>{}}}
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:definition=>{plugin=definition.factory(()=>React)}}},document,Set,JSON})
  const slots=new SlotCore(),disposers=[]
  slots.register({name:'root',children:{'conversation.input.model':{kind:'single',scope:'session'},'plugins.bundle.config':{kind:'keyed',scope:'root'}}},()=>{})
  const store={state:{current:{provider:'deepseek-account',model:'deepseek-flash'},groups:[]},subscribe(){return()=>{}},getSnapshot(){assert.equal(this,store);return this.state}}
  const native=()=>{},face={available:true,directory:store,load:()=>{}}
  const stopNative=slots.register({name:'conversation.input.model',inject:id=>{assert.equal(id,'owned-session');return face}},native)
  slots.inject=(_name,install)=>{const d=install();disposers.push(d);return d}
  plugin.apply({slots})
  const seat=slots.entriesOfSlot('conversation.input.model')[0];assert.equal(seat.component,plugin.ModelSeat);assert.equal(seat.options.priority,-10)
  const props=seat.inject('owned-session');assert.equal(props.directory,store);assert.equal(props.sessionId,'owned-session');assert.doesNotThrow(()=>plugin.ModelSeat(props))
  for(const dispose of disposers.reverse())dispose();assert.equal(slots.entriesOfSlot('conversation.input.model')[0].component,native);stopNative()
})

test('settings version follows host metadata across upgrades and loading',()=>{
  for(const version of ['2.1.2','17.5.9',null]) {
    let plugin,calls=0
    const React={createElement:(type,props,...children)=>({type,props,children}),Fragment:'fragment',useState:v=>[calls++===0?(version?{version,sources:[],active:null}:null):(typeof v==='function'?v():v),()=>{}],useEffect:()=>{},useRef:v=>({current:v})}
    const document={documentElement:{dataset:{theme:'light'},className:''}}
    vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>{plugin=d.factory(()=>React)}}},document,Set,JSON})
    const root=plugin.ProviderSettings(),nodes=[]
    function visit(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){for(const child of node)visit(child);return}nodes.push(node);for(const child of node.children||[])visit(child)}
    visit(root)
    const badge=nodes.find(n=>n.props?.className==='ap-version')
    assert.equal(badge?.children[0],version||'加载中')
  }
})

test('new MiMo template permits checking Flash through a filtered list and saving it with a blank key', async () => {
  let plugin, cursor = 0
  const state = { version: '2.1.5', revision: 'test', sources: [], active: null, presets, protocols, catalogs: { mimo: mimoCatalog } }
  const cells = [state, '', 'light', 'new', { id: '', name: '新供应商', baseURL: '', website: '', api: 'openai-completions', apiKey: '', enabled: false, editable: true, models: [] }, 'connection']
  const requests = []
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }), Fragment: 'fragment',
    useState(value) {
      const index = cursor++
      if (!(index in cells)) cells[index] = typeof value === 'function' ? value() : value
      return [cells[index], next => { cells[index] = typeof next === 'function' ? next(cells[index]) : next }]
    },
    useEffect: () => {}, useRef: value => ({ current: value })
  }
  const document = { documentElement: { dataset: { theme: 'light' }, className: '' } }
  const fetch = async (url, options) => {
    const body = JSON.parse(options.body); requests.push({ url, body })
    return { json: async () => ({ ok: true, value: { ...state, revision: 'saved', sources: [{ ...body.source, credential: { configured: false } }] } }) }
  }
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), { window: { __ModuleLoader__: { load: d => { plugin = d.factory(() => React) } } }, document, Set, JSON, URL, fetch })
  function nodes() {
    cursor = 0
    const result = []
    function visit(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); result.push(node); (node.children || []).forEach(visit) }
    visit(plugin.ProviderSettings())
    return result
  }
  const button = label => nodes().find(n => n.props?.onClick && n.children.includes(label))
  nodes().find(n => n.type === 'select' && n.props?.defaultValue === '').props.onChange({ target: { value: 'mimo' } })
  nodes().find(n => n.type?.name === 'Toggle').props.onChange(true)
  nodes().find(n => n.type === 'button' && n.children.some(c => c?.children?.includes('模型管理'))).props.onClick()
  nodes().find(n => n.props?.label === '搜索模型').props.onChange('mimo 2.6 flash')
  const checkbox = () => nodes().find(n => n.props?.['aria-label'] === '启用模型mimo-v2.6-flash')
  assert.equal(checkbox().props.checked, true)
  checkbox().props.onChange({ target: { checked: false } })
  assert.equal(checkbox().props.checked, false)
  checkbox().props.onChange({ target: { checked: true } })
  assert.equal(checkbox().props.checked, true)
  assert.equal(button('保存配置').props.disabled, false)
  await button('保存配置').props.onClick()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/api-switcher/api/sources')
  assert.equal(requests[0].body.apiKey, '')
  assert.deepEqual(requests[0].body.source.models.filter(m => m.enabled).map(m => m.id), ['mimo-v2.6-flash'])
  assert.equal(cells[4].credential.configured, false)
  assert.equal(button('保存配置').props.disabled, true)
})
