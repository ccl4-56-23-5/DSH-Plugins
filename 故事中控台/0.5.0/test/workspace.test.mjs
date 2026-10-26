import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {WorldbookStore} from '../lib/core.js';
import {exampleBook} from '../lib/example.js';
const scratch=resolve('.work/workspace-tests');mkdirSync(scratch,{recursive:true});
function setup(){
 const workspaces=[{id:'one',title:'工作区一',sessionIds:['A','B']},{id:'two',title:'工作区二',sessionIds:['C']}];
 const resolver=sid=>workspaces.find(w=>w.sessionIds.includes(sid))??null;
 const store=new WorldbookStore(join(mkdtempSync(join(scratch,'case-')),'data.json'),{resolveWorkspace:resolver});
 const call=(action,args)=>store.author(action,{requestId:randomUUID(),revision:store.read().revision,...args});
 call('saveBook',{book:structuredClone(exampleBook)});
 const select=(sid,ids=[exampleBook.id],entries=exampleBook.entries.map(e=>e.id),extra={})=>call('selectBooks',{sessionId:sid,bookIds:ids,entryIds:{[exampleBook.id]:entries},...extra});
 return {store,call,select,workspaces};
}
test('同工作区共享书籍和条目开关，不同工作区隔离',()=>{
 const {store,select}=setup();select('A',[exampleBook.id],['realm-order','qi']);
 assert.deepEqual(store.session('B').selection.bookIds,[exampleBook.id]);
 assert.deepEqual(store.session('B').selection.entryIds[exampleBook.id],['realm-order','qi']);
 assert.equal(store.active('C'),false);assert.equal(store.active('unfiled'),false);
 select('B',[]);assert.equal(store.active('A'),false);
});
test('新建和移入对话实时继承，移出后读取新工作区',()=>{
 const {store,select,workspaces}=setup();select('A');workspaces[0].sessionIds.push('new');
 assert.equal(store.active('new'),true);
 workspaces[0].sessionIds=workspaces[0].sessionIds.filter(s=>s!=='B');workspaces[1].sessionIds.push('B');
 assert.equal(store.active('B'),false);select('C');assert.equal(store.active('B'),true);
});
test('工作区共享设定但剧情进度、认知、事件保持独立且持久',()=>{
 const {store,select}=setup();select('A');const before=store.session('B'),bStory=before.selection.storyIds[exampleBook.id];
 const args={requestId:randomUUID(),revision:before.revision,event:{expectedStateRevision:0,certainty:'confirmed',summary:'B突破',source:'B已突破筑基',patch:{realm:'筑基'},knownIds:['letter']}};
 const first=store.commit('B',args);assert.deepEqual(store.commit('B',args),first);
 assert.equal(store.context('B','').state.realm,'筑基');assert.equal(store.context('A','').state.realm,'炼气');
 assert.deepEqual(store.context('A','').knownIds,[]);assert.equal(store.read().stories[bStory].events.length,1);
 select('A',[]);select('A');assert.equal(store.context('B','').state.realm,'筑基');
 assert.equal(store.session('B').selection.storyIds[exampleBook.id],bStory);
});
test('跨对话条目开关真正影响同步和异步检索',async()=>{
 const {store,select}=setup();select('A',[exampleBook.id],['realm-order']);
 assert.deepEqual((await store.contextAsync('B','',{limit:20})).entries.map(e=>e.id),['realm-order']);
 select('B',[exampleBook.id],[]);assert.deepEqual(store.context('A','').entries,[]);
});
test('纯读取不会改动文件或推进全局版本，首次剧情写入物化稳定ID',()=>{
 const {store,select}=setup();select('A');const bytes=readFileSync(store.file,'utf8'),s=store.session('B');
 const id=s.selection.storyIds[exampleBook.id];store.context('B','');store.active('B');
 assert.equal(readFileSync(store.file,'utf8'),bytes);assert.equal(store.session('B').selection.storyIds[exampleBook.id],id);
 store.author('commit',{sessionId:'B',storyId:id,requestId:randomUUID(),revision:s.revision,event:{expectedStateRevision:0,certainty:'confirmed',summary:'B突破',source:'B突破筑基',patch:{realm:'筑基'}}});
 assert.equal(store.read().stories[id].state.realm,'筑基');
});
test('schema2并集合并旧开关，保留关书的历史剧情，原始字节备份',()=>{
 const {store,select}=setup();
 const legacy=new WorldbookStore(store.file);const call=(sid,ids)=>legacy.author('selectBooks',{requestId:randomUUID(),revision:legacy.read().revision,sessionId:sid,bookIds:[exampleBook.id],entryIds:{[exampleBook.id]:ids}});
 call('A',['realm-order']);call('B',['qi']);const d=legacy.read();d.schema=2;delete d.workspaceSelections;
 const original=JSON.stringify(d);writeFileSync(store.file,original);
 const s=store.session('A');assert.deepEqual(new Set(s.selection.entryIds[exampleBook.id]),new Set(['realm-order','qi']));
 assert.equal(readFileSync(store.file,'utf8'),original);assert.equal(existsSync(store.file+'.schema2-backup'),false);
 const storyIds=structuredClone(d.selections.A.storyIds);select('A',[]);
 assert.equal(readFileSync(store.file+'.schema2-backup','utf8'),original);assert.equal(store.read().schema,3);
 select('B');assert.deepEqual(store.session('A').selection.storyIds,storyIds);
});
test('未归入工作区的对话独立，不合并为全局默认工作区',()=>{
 const {store,select}=setup();select('unfiled-one');assert.equal(store.active('unfiled-two'),false);assert.equal(store.session('unfiled-one').scope.kind,'session');
});
test('客户端伪造workspaceId不改变宿主归属，原型键拒绝',()=>{
 const {store,select}=setup();select('A',[exampleBook.id],['realm-order'],{workspaceId:'two'});
 assert.equal(store.active('C'),false);assert.equal(store.active('B'),true);
 assert.throws(()=>select('__proto__'),/ID无效/);
});
test('并发保存和过期剧情提交拒绝，持久操作回执去重',()=>{
 const {store,select}=setup();select('A');const s=store.session('B');
 const args={requestId:randomUUID(),revision:s.revision,sessionId:'A',bookIds:[],entryIds:{}};
 const r=store.author('selectBooks',args);assert.deepEqual(store.author('selectBooks',args),r);
 assert.throws(()=>store.author('selectBooks',{...args,requestId:randomUUID(),sessionId:'B',bookIds:[exampleBook.id]}),/数据已变化/);
 assert.throws(()=>store.commit('B',{requestId:randomUUID(),revision:s.revision,event:{}}),/数据已变化/);
 assert.equal(store.active('B'),false);
});
test('宿主工作区读取异常时拒绝访问，不退回错误的旧设置',()=>{
 const {store,select}=setup();select('A');store.resolveWorkspace=()=>{throw Error('registry unavailable')};
 assert.throws(()=>store.session('A'),/registry unavailable/);assert.throws(()=>store.context('A',''),/registry unavailable/);
});
