import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WorldbookStore,validateBook,retrieve } from '../lib/core.js';
import { exampleBook } from '../lib/example.js';
const scratch=resolve('.work/tests');mkdirSync(scratch,{recursive:true});
function setup() {
  const store=new WorldbookStore(join(mkdtempSync(join(scratch,'case-')),'data.json'));
  const call=(action,args)=>store.author(action,{requestId:randomUUID(),revision:store.read().revision,...args});
  call('saveBook',{book:structuredClone(exampleBook)});
  call('createStory',{id:'story-a',title:'测试主线',bookId:exampleBook.id});
  call('bind',{sessionId:'session-a',storyId:'story-a'});
  return {store,call};
}
function event(store,patch,extra={}) {
  const state=store.read(),story=state.stories['story-a'];
  return {requestId:randomUUID(),revision:state.revision,event:{expectedStateRevision:story.revision,certainty:'confirmed',summary:'测试已发生事件',source:'主角成功突破，灵力根基稳定。',patch,...extra}};
}
test('境界筛选先于查询，猜中隐藏关键词也不会越权',()=>{
  const {store}=setup(),r=store.context('session-a','金丹 作者 隐藏 密信',{limit:20});
  assert.ok(r.entries.some(e=>e.id==='realm-order'));
  assert.ok(!r.entries.some(e=>['golden-core','secret','letter'].includes(e.id)));
  assert.equal(JSON.stringify(r).includes('作者隐藏身份'),false);
  assert.equal(JSON.stringify(r).includes('失踪弟子'),false);
});
test('自动事件更新境界，旧境界条目退出，新境界进入',()=>{
  const {store}=setup();store.commit('session-a',event(store,{realm:'筑基'}));
  const ids=store.context('session-a','',{limit:20}).entries.map(e=>e.id);
  assert.ok(ids.includes('foundation'));assert.ok(!ids.includes('qi'));assert.ok(!ids.includes('flight'));
});
test('学会能力和达到境界分别判断，跌境后保留学习记录',()=>{
  const {store}=setup();store.commit('session-a',event(store,{realm:'筑基',skills:['御剑术']}));
  assert.ok(store.context('session-a','御剑').entries.some(e=>e.id==='flight'));
  store.commit('session-a',event(store,{realm:'炼气'}));
  assert.deepEqual(store.context('session-a','').state.skills,['御剑术']);
  assert.ok(!store.context('session-a','御剑').entries.some(e=>e.id==='flight'));
});
test('认知门槛、作者隐藏门槛和状态条件同时生效',()=>{
  const {store}=setup();store.commit('session-a',event(store,{realm:'炼气'},{knownIds:['letter']}));
  assert.ok(store.context('session-a','密信').entries.some(e=>e.id==='letter'));
  assert.throws(()=>store.commit('session-a',event(store,{realm:'筑基'},{knownIds:['secret']})),/作者隐藏/);
});
test('always不会绕过状态与角色认知门槛',()=>{
  const b=structuredClone(exampleBook);b.entries.find(e=>e.id==='golden-core').always=true;
  const r=retrieve(b,{state:b.initialState,knownIds:[],revision:0}, {query:'',limit:20});
  assert.ok(!r.entries.some(e=>e.id==='golden-core'));
});
test('未绑定会话拒绝访问，其他会话不共享剧情',()=>{
  const {store,call}=setup();
  assert.throws(()=>store.context('session-b',''),/未关联/);
  call('createStory',{id:'story-b',title:'另一本剧情',bookId:exampleBook.id});
  call('bind',{sessionId:'session-b',storyId:'story-b'});
  store.commit('session-a',event(store,{realm:'筑基'}));
  assert.equal(store.context('session-b','').state.realm,'炼气');
});
test('重复请求恰好执行一次，同ID不同内容拒绝',()=>{
  const {store}=setup(),args=event(store,{realm:'筑基'});
  const one=store.commit('session-a',args),two=store.commit('session-a',args);
  assert.deepEqual(one,two);assert.equal(store.read().stories['story-a'].events.length,1);
  assert.throws(()=>store.commit('session-a',{...args,event:{...args.event,patch:{realm:'金丹'}}}),/同一操作ID/);
});
test('全局版本与剧情版本都执行并发冲突检查',()=>{
  const {store,call}=setup(),args=event(store,{realm:'筑基'});
  call('createStory',{id:'story-b',title:'其他更新',bookId:exampleBook.id});
  assert.throws(()=>store.commit('session-a',args),/数据已变化/);
  args.revision=store.read().revision;args.event.expectedStateRevision=99;
  assert.throws(()=>store.commit('session-a',args),/剧情状态已变化/);
});
test('未知字段、未定义境界和未确认事件不改变数据',()=>{
  const {store}=setup(),before=readFileSync(store.file,'utf8');
  for(const patch of [{realm:'渡劫'},{evil:'x'}]) assert.throws(()=>store.commit('session-a',event(store,patch)));
  assert.throws(()=>store.commit('session-a',event(store,{realm:'筑基'},{certainty:'planned'})),/已确认/);
  assert.throws(()=>store.commit('session-a',event(store,{realm:'筑基'},{source:''})),/来源正文/);
  assert.equal(readFileSync(store.file,'utf8'),before);
});
test('只能依次撤回最新事件，事件轨迹仍保留',()=>{
  const {store,call}=setup(),a=store.commit('session-a',event(store,{realm:'筑基'})),b=store.commit('session-a',event(store,{realm:'金丹'}));
  assert.throws(()=>call('undo',{storyId:'story-a',eventId:a.eventId}),/最新事件/);
  call('undo',{storyId:'story-a',eventId:b.eventId});assert.equal(store.context('session-a','').state.realm,'筑基');
  call('undo',{storyId:'story-a',eventId:a.eventId});assert.equal(store.context('session-a','').state.realm,'炼气');
  assert.equal(store.read().stories['story-a'].events.length,2);
});
test('世界书被剧情使用后不可静默覆盖，分支从当前状态独立派生',()=>{
  const {store,call}=setup();
  assert.throws(()=>call('saveBook',{book:exampleBook}),/另存为新ID/);
  store.commit('session-a',event(store,{realm:'筑基'}));
  call('forkStory',{sourceId:'story-a',id:'branch-a',title:'另一条剧情'});
  store.commit('session-a',event(store,{realm:'金丹'}));
  assert.equal(store.read().stories['branch-a'].state.realm,'筑基');
});
test('重载持久化、损坏文件不被重置',()=>{
  const {store}=setup();store.commit('session-a',event(store,{realm:'筑基'}));
  assert.equal(new WorldbookStore(store.file).context('session-a','').state.realm,'筑基');
  writeFileSync(store.file,'{broken');
  assert.throws(()=>new WorldbookStore(store.file));
  assert.equal(readFileSync(store.file,'utf8'),'{broken');
});
test('条件规则拒绝无效字段和运算符，不执行脚本',()=>{
  for(const c of [{field:'unknown',op:'eq',value:1},{field:'realm',op:'eval',value:'process.exit()'},{field:'location',op:'gte',value:'x'}]) {
    const book=structuredClone(exampleBook);book.entries[0].when={all:[c]};assert.throws(()=>validateBook(book));
  }
});
test('检索有条数和正文预算，整体条目不被悄悄截断',()=>{
  const {store}=setup();const r=store.context('session-a','',{limit:1,maxChars:256});
  assert.ok(r.entries.length<=1);assert.ok(r.usedChars<=256);assert.ok(r.omittedByBudget>0);
  assert.throws(()=>store.context('session-a','',{limit:999}),/上限/);
});
test('文件写锁阻止两个进程覆盖彼此，不能擅自清理遗留锁',()=>{
  const {store}=setup();writeFileSync(store.file+'.lock','');
  assert.throws(()=>store.commit('session-a',event(store,{realm:'筑基'})),/遗留锁/);
});
