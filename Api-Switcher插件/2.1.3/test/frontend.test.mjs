import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { SlotCore } from './fixtures/slot-core.js'
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
