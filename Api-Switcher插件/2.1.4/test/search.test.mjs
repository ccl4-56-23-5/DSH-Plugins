import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
let plugin
vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>{plugin=d.factory(()=>({}))}}}})
const search=plugin.modelSearch
const sources=[
  {id:'apiyi',name:'API易',enabled:true,credential:{configured:true},models:[
    {id:'gpt-5.4-mini',name:'GPT 5.4 Mini',enabled:true},
    {id:'claude-sonnet-4-5',name:'Claude Sonnet 4.5',enabled:true},
    {id:'gpt-hidden',name:'GPT隐藏模型',enabled:false}]},
  {id:'deepseek-account',name:'DeepSeek Account',enabled:true,credential:{configured:true},models:[{id:'deepseek-flash',name:'DeepSeek-V4.1-Flash',enabled:true}]},
  {id:'disabled-provider',name:'GPT供应商',enabled:false,credential:{configured:true},models:[{id:'gpt-5.4-mini',enabled:true}]}
]
test('model search normalizes full-width text, case and whitespace',()=>{
  const result=search.filterModelGroups(sources,'  ＧＰＴ   MINI  ')
  assert.equal(result.matchCount,1);assert.equal(result.groups[0].models[0].id,'gpt-5.4-mini');assert.equal(result.totalCount,3)
})
test('keywords match provider ID, provider name, model ID and display name together',()=>{
  for(const query of ['apiyi gpt mini','API易 sonnet','deepseek-account flash','deepseekv41flash']){
    const result=search.filterModelGroups(sources,query);assert.equal(result.matchCount,1,query)
  }
  assert.equal(search.filterModelGroups(sources,'API易 flash').matchCount,0)
})
test('disabled models and suppliers never become selectable search results',()=>{
  assert.equal(search.filterModelGroups(sources,'隐藏').matchCount,0)
  assert.equal(search.filterModelGroups(sources,'disabled-provider').matchCount,0)
  assert.equal(search.filterModelGroups(sources,'gpt').matchCount,1)
})
test('clearing the query restores grouped enabled models without mutating settings',()=>{
  const before=JSON.stringify(sources)
  assert.equal(search.filterModelGroups(sources,'no-such-model').groups.length,0)
  const clear=search.filterModelGroups(sources,'  ');assert.equal(clear.hasQuery,false);assert.equal(clear.matchCount,3);assert.equal(clear.groups.length,2)
  assert.equal(JSON.stringify(sources),before)
})
test('settings model search uses the same name and ID keyword matching',()=>{
  assert.equal(search.matchesModel(null,{id:'gpt-5.4-mini',name:'GPT 5.4 Mini'},search.searchTokens('gpt54 mini')),true)
  assert.equal(search.matchesModel(null,{id:'claude-sonnet',name:'Claude Sonnet'},search.searchTokens('gpt mini')),false)
})

function picker(query) {
  const state={sources,active:{provider:'apiyi',model:'gpt-5.4-mini'}},values=[state,'','light',true,query,new Set(),false,false,'',{}],refs=[],focused=[]
  let stateIndex=0,refIndex=0,component
  const document={documentElement:{dataset:{theme:'light'},className:''},activeElement:{tagName:'INPUT'}}
  const React={createElement:(type,props,...children)=>({type,props:props||{},children}),useEffect:()=>{},useSyncExternalStore:(_s,get)=>get(),useRef:v=>refs[refIndex++]||={current:v},useState:v=>{const index=stateIndex++;if(!(index in values))values[index]=typeof v==='function'?v():v;return[values[index],next=>{values[index]=typeof next==='function'?next(values[index]):next}]} }
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>{component=d.factory(()=>React)}}},document,Set,JSON,Math})
  const directory={subscribe:()=>()=>{},getSnapshot:()=>({current:state.active,groups:sources})}
  function render(){stateIndex=0;refIndex=0;return component.ModelSeat({sessionId:'fixture',locked:false,available:true,directory,load:()=>{}})}
  function nodes(tree,predicate){const result=[];function walk(value){if(Array.isArray(value)){value.forEach(walk);return}if(!value||typeof value!=='object')return;if(predicate(value))result.push(value);value.children?.forEach(walk)}walk(tree);return result}
  const rowObjects=[{focus:()=>focused.push('first')},{focus:()=>focused.push('last')}]
  const tree=render();refs[0].current={querySelectorAll:()=>rowObjects};refs[2].current={focus:()=>focused.push('input')}
  return{tree,render,nodes,values,focused,document}
}
test('picker shows a grouped match count and its clear button restores every enabled model',()=>{
  const view=picker('apiyi mini'),find=(tree,p)=>view.nodes(tree,p)
  assert.equal(find(view.tree,n=>n.props.role==='option').length,1)
  assert.ok(find(view.tree,n=>n.props.role==='status').some(n=>n.children.includes('匹配1/3个模型')))
  const searchNode=find(view.tree,n=>n.type?.name==='SearchBox')[0],box=searchNode.type(searchNode.props)
  const input=find(box,n=>n.type==='input')[0];assert.equal(input.props.role,'combobox');assert.ok(input.props['aria-controls'])
  const clear=find(box,n=>n.props['aria-label']==='清空搜索')[0];clear.props.onClick()
  assert.equal(view.values[4],'');assert.ok(view.focused.includes('input'))
  assert.equal(find(view.render(),n=>n.props.role==='option').length,3)
})
test('no-match state has an explicit clear action without changing provider settings',()=>{
  const view=picker('no-such-model'),before=JSON.stringify(sources)
  assert.equal(view.nodes(view.tree,n=>n.props.role==='option').length,0)
  assert.ok(view.nodes(view.tree,n=>n.children?.includes('没有匹配的模型')).length)
  const clear=view.nodes(view.tree,n=>n.type?.name==='Button'&&n.children.includes('清空搜索'))[0];clear.props.onClick()
  assert.equal(view.values[4],'');assert.equal(JSON.stringify(sources),before)
})
test('search keyboard keeps input Home/End editing and moves to first or last result with arrows',()=>{
  const view=picker('gpt'),menu=view.nodes(view.tree,n=>n.props.className==='ap-picker')[0]
  let prevented=0
  for(const key of ['Home','End'])menu.props.onKeyDown({key,target:{tagName:'INPUT'},preventDefault:()=>prevented++})
  assert.equal(prevented,0)
  for(const key of ['ArrowDown','ArrowUp'])menu.props.onKeyDown({key,target:{tagName:'INPUT'},preventDefault:()=>prevented++})
  assert.equal(prevented,2);assert.equal(view.focused.join(','),'first,last')
})
