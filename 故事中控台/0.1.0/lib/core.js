import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const clone = value => structuredClone(value);
const own = (o,k) => Object.hasOwn(o,k);
const plain = o => !!o && typeof o === 'object' && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype;
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const canonical = v => Array.isArray(v) ? v.map(canonical) : plain(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v;
const signature = v => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
export function check(ok, message) { if(!ok) throw new Error(message); }
const text = (v,max=200) => typeof v==='string' && v.length>0 && v.length<=max && !v.includes('\u0000');
const id = v => typeof v==='string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(v) && !['__proto__','constructor','prototype'].includes(v);
const fieldsOf = book => new Map(book.fields.map(f=>[f.key,f]));
function valueValid(field,value) {
  if(field.type==='enum') return field.values.includes(value);
  if(field.type==='string') return typeof value==='string' && value.length<=500;
  if(field.type==='boolean') return typeof value==='boolean';
  if(field.type==='number') return typeof value==='number' && Number.isFinite(value);
  return Array.isArray(value) && value.length<=100 && value.every(v=>text(v,200)) && new Set(value).size===value.length;
}
export function validateState(book, state) {
  check(plain(state),'状态必须是对象');
  const fields=fieldsOf(book);
  check(Object.keys(state).length===fields.size,'状态必须包含全部已定义字段');
  for(const [key,value] of Object.entries(state)) check(fields.has(key)&&valueValid(fields.get(key),value),'状态字段或取值无效：'+key);
  return state;
}
function validateCondition(book,c) {
  check(plain(c)&&['field','op','value'].every(k=>own(c,k))&&Object.keys(c).length===3,'条件必须包含 field/op/value');
  const field=fieldsOf(book).get(c.field);
  check(field,'条件引用未知字段：'+c.field);
  check(['eq','ne','in','contains','gte','lte'].includes(c.op),'条件运算符无效');
  if(c.op==='in') check(Array.isArray(c.value)&&c.value.length>0&&c.value.length<=100&&c.value.every(v=>valueValid(field,v)),'in 条件取值无效');
  else if(c.op==='contains') check(field.type==='tags'&&text(c.value,200),'contains 只用于标签列表');
  else {
    check(valueValid(field,c.value),'条件取值无效：'+c.field);
    if(['gte','lte'].includes(c.op)) check(['enum','number'].includes(field.type),'范围条件只用于有序枚举或数值');
  }
}
export function validateBook(book) {
  check(plain(book)&&id(book.id)&&text(book.title),'世界书 id 或名称无效');
  check(Array.isArray(book.fields)&&book.fields.length>0&&book.fields.length<=40,'字段数应为1至40');
  const keys=new Set();
  for(const f of book.fields) {
    check(plain(f)&&id(f.key)&&!keys.has(f.key)&&text(f.label)&&['enum','string','number','boolean','tags'].includes(f.type),'字段定义无效或重复');
    keys.add(f.key);
    if(f.type==='enum') check(Array.isArray(f.values)&&f.values.length>0&&f.values.length<=100&&f.values.every(v=>text(v))&&new Set(f.values).size===f.values.length,'枚举值无效或重复');
  }
  validateState(book,book.initialState);
  check(Array.isArray(book.entries)&&book.entries.length<=3000,'世界书条目上限为3000');
  const ids=new Set();
  for(const e of book.entries) {
    check(plain(e)&&id(e.id)&&!ids.has(e.id)&&text(e.title)&&text(e.body,16000),'条目无效或重复');
    ids.add(e.id);
    check(['public','known','author'].includes(e.visibility),'条目 visibility 必须为 public/known/author');
    check(typeof e.always==='boolean','条目必须明确 always 开关');
    check(Array.isArray(e.tags)&&e.tags.length<=30&&e.tags.every(t=>text(t,100)),'条目标签无效');
    check(plain(e.when)&&Object.keys(e.when).every(k=>['all','any'].includes(k)),'条目条件只支持 all/any');
    for(const key of ['all','any']) {
      if(e.when[key]!==undefined) {
        check(Array.isArray(e.when[key])&&e.when[key].length>0&&e.when[key].length<=30,'条件列表为空或过长');
        e.when[key].forEach(c=>validateCondition(book,c));
      }
    }
  }
  check(Buffer.byteLength(JSON.stringify(book))<=4*1024*1024,'世界书超过4MiB');
  return book;
}
function compare(book,state,c) {
  const a=state[c.field], b=c.value, f=fieldsOf(book).get(c.field);
  if(c.op==='eq') return equal(a,b);
  if(c.op==='ne') return !equal(a,b);
  if(c.op==='in') return b.some(v=>equal(a,v));
  if(c.op==='contains') return a.includes(b);
  const av=f.type==='enum'?f.values.indexOf(a):a, bv=f.type==='enum'?f.values.indexOf(b):b;
  return c.op==='gte'?av>=bv:av<=bv;
}
export function eligibility(book,story,entry) {
  if(entry.visibility==='author') return { allowed:false, reason:'作者隐藏设定' };
  if(entry.visibility==='known'&&!story.knownIds.includes(entry.id)) return { allowed:false, reason:'角色尚未知晓' };
  if(entry.when.all&&!entry.when.all.every(c=>compare(book,story.state,c))) return { allowed:false, reason:'未满足全部状态条件' };
  if(entry.when.any&&!entry.when.any.some(c=>compare(book,story.state,c))) return { allowed:false, reason:'未满足任一状态条件' };
  return { allowed:true, reason:entry.always?'常驻条目，且状态/认知条件已满足':'状态与认知条件已满足' };
}
const tokens = q => [...new Set((q.toLowerCase().match(/[a-z0-9]+|[\u3400-\u9fff]/g)||[]))].slice(0,100);
export function retrieve(book,story,{query='',limit=8,maxChars=12000}={}) {
  check(typeof query==='string'&&query.length<=1000,'查询过长');
  check(Number.isInteger(limit)&&limit>=1&&limit<=20,'条数上限为20');
  check(Number.isInteger(maxChars)&&maxChars>=256&&maxChars<=24000,'正文预算应为256至24000字符');
  const words=tokens(query), candidates=[];
  for(const e of book.entries) {
    const gate=eligibility(book,story,e);
    if(!gate.allowed) continue;
    const title=(e.title+' '+e.tags.join(' ')).toLowerCase(), body=e.body.toLowerCase();
    const score=words.reduce((n,w)=>n+(title.includes(w)?4:body.includes(w)?1:0),0);
    if(e.always||(!words.length)||score>0) candidates.push({e,gate,score});
  }
  candidates.sort((a,b)=>Number(b.e.always)-Number(a.e.always)||b.score-a.score||a.e.id.localeCompare(b.e.id));
  let used=0, omitted=0;
  const entries=[];
  for(const {e,gate,score} of candidates) {
    const cost=e.body.length+e.title.length;
    if(entries.length>=limit||used+cost>maxChars) { omitted++;continue; }
    used+=cost;
    entries.push({id:e.id,title:e.title,body:e.body,tags:e.tags,reason:gate.reason,score});
  }
  return { stateRevision:story.revision,bookRevision:story.bookRevision,entries,usedChars:used,eligibleMatches:candidates.length,omittedByBudget:omitted };
}
function empty() { return {schema:1,revision:0,books:{},stories:{},bindings:{},receipts:{}}; }
export class WorldbookStore {
  constructor(file) { this.file=file; mkdirSync(dirname(file),{recursive:true}); this.read(); }
  read() {
    if(!existsSync(this.file)) return empty();
    const raw=readFileSync(this.file,'utf8');check(Buffer.byteLength(raw)<=32*1024*1024,'数据文件过大');
    const data=JSON.parse(raw);
    check(data.schema===1&&Number.isSafeInteger(data.revision)&&plain(data.books)&&plain(data.stories)&&plain(data.bindings)&&plain(data.receipts),'数据文件格式错误，未重置原文件');
    return data;
  }
  transact(requestId, expectedRevision, payload, action) {
    check(id(requestId)&&requestId.length>=12,'操作ID应为12至96位字母数字或连字符');
    const lock=this.file+'.lock'; let handle;
    try { handle=openSync(lock,'wx'); } catch { throw new Error('数据正在被另一个进程更新，或遗留锁待人工检查'); }
    try {
      const data=this.read(), sig=signature(payload), prior=data.receipts[requestId];
      if(prior) { check(prior.signature===sig,'同一操作ID不可用于不同请求'); return clone(prior.result); }
      check(expectedRevision===data.revision,'数据已变化，请刷新后重试');
      const result=action(data);data.revision++;
      const response={...result,revision:data.revision};
      data.receipts[requestId]={signature:sig,result:response};
      for(const key of Object.keys(data.receipts).slice(0,-500)) delete data.receipts[key];
      const bytes=JSON.stringify(data,null,2)+'\n';
      check(Buffer.byteLength(bytes)<=32*1024*1024,'数据已达32MiB上限，请导出后整理');
      const tmp=this.file+'.'+randomUUID()+'.pending';
      try { writeFileSync(tmp,bytes,{flag:'wx'});renameSync(tmp,this.file); }
      finally { if(existsSync(tmp)) unlinkSync(tmp); }
      return clone(response);
    } finally { closeSync(handle);unlinkSync(lock); }
  }
  author(action,args) {
    check(plain(args),'请求必须为对象');
    return this.transact(args.requestId,args.revision,{action,args},data=>{
      if(action==='saveBook') {
        const book=clone(validateBook(args.book)), old=data.books[book.id];
        if(old) {
          // Existing stories pin a book revision; editing a book cannot silently alter their rules.
          check(!Object.values(data.stories).some(s=>s.bookId===book.id),'世界书已关联剧情，请另存为新ID；旧剧情保持原规则');
        }
        data.books[book.id]={...book,revision:(old?.revision||0)+1};
        return {bookId:book.id};
      }
      if(action==='createStory') {
        check(id(args.id)&&!data.stories[args.id]&&text(args.title),'剧情ID或名称无效');
        const book=data.books[args.bookId];check(book,'世界书不存在');
        data.stories[args.id]={id:args.id,title:args.title,bookId:book.id,bookRevision:book.revision,state:clone(book.initialState),knownIds:[],revision:0,events:[]};
        return {storyId:args.id};
      }
      if(action==='bind') {
        check(text(args.sessionId,200)&&data.stories[args.storyId],'会话或剧情无效');
        data.bindings[args.sessionId]=args.storyId;return {sessionId:args.sessionId,storyId:args.storyId};
      }
      if(action==='forkStory') {
        const source=data.stories[args.sourceId];
        check(source&&id(args.id)&&!data.stories[args.id]&&text(args.title),'分支信息无效');
        data.stories[args.id]={...clone(source),id:args.id,title:args.title,parentId:source.id,revision:0,events:[]};
        return {storyId:args.id};
      }
      if(action==='unbind') { check(text(args.sessionId,200),'会话ID无效');delete data.bindings[args.sessionId];return {unbound:true}; }
      if(action==='commit') return this.applyEvent(data,args.storyId,args.event,'author');
      if(action==='undo') return this.undo(data,args.storyId,args.eventId);
      throw new Error('未知作者操作');
    });
  }
  bound(sessionId,data=this.read()) {
    check(text(sessionId,200),'调用缺少真实DSH会话身份');
    const story=data.stories[data.bindings[sessionId]];check(story,'当前会话未关联剧情，请在故事中控台选择剧情并关联会话');
    const book=data.books[story.bookId];check(book&&book.revision===story.bookRevision,'世界书版本不匹配');
    return {book,story};
  }
  context(sessionId,query,options={}) {
    const data=this.read(),{book,story}=this.bound(sessionId,data);
    return {revision:data.revision,storyId:story.id,title:story.title,fields:clone(book.fields),state:clone(story.state),knownIds:clone(story.knownIds),...retrieve(book,story,{query,...options})};
  }
  applyEvent(data,storyId,event,actor) {
    const story=data.stories[storyId];check(story,'剧情不存在');
    const book=data.books[story.bookId];check(plain(event),'事件无效');
    check(event.expectedStateRevision===story.revision,'剧情状态已变化，请重新读取后再更新');
    check(text(event.summary,500)&&text(event.source,4000),'必须提供已发生事件摘要与来源正文');
    check(event.certainty==='confirmed','只有已确认发生的事件才能更新状态');
    check(plain(event.patch)&&Object.keys(event.patch).length>0,'事件必须包含状态变更');
    check(story.events.length<2000,'当前剧情事件达到2000条，请创建后续分支');
    const state={...clone(story.state),...clone(event.patch)};
    validateState(book,state);
    const known=event.knownIds===undefined?clone(story.knownIds):clone(event.knownIds);
    check(Array.isArray(known)&&known.length<=3000&&new Set(known).size===known.length&&known.every(k=>book.entries.some(e=>e.id===k&&e.visibility!=='author')),'已知条目ID无效或包含作者隐藏条目');
    const changes=Object.entries(event.patch).filter(([k,v])=>!equal(v,story.state[k]));
    check(changes.length>0||!equal(known,story.knownIds),'没有实际状态变化');
    const record={id:randomUUID(),at:new Date().toISOString(),actor,summary:event.summary,source:event.source,before:clone(story.state),beforeKnown:clone(story.knownIds),after:state,afterKnown:known};
    story.state=state;story.knownIds=known;story.revision++;story.events.push(record);
    return {storyId:story.id,stateRevision:story.revision,eventId:record.id,state:clone(state)};
  }
  commit(sessionId,args) {
    check(plain(args),'状态事件无效');
    return this.transact(args.requestId,args.revision,{sessionId,args},data=>{
      const {story}=this.bound(sessionId,data);
      return this.applyEvent(data,story.id,args.event,'dsh');
    });
  }
  undo(data,storyId,eventId) {
    const story=data.stories[storyId];check(story,'剧情不存在');
    const active=story.events.filter(e=>!e.undoneAt), event=active.at(-1);
    check(event&&event.id===eventId,'仅允许逐条撤回最新事件，避免覆盖后续剧情');
    story.state=clone(event.before);story.knownIds=clone(event.beforeKnown);
    story.revision++;event.undoneAt=new Date().toISOString();
    return {storyId,stateRevision:story.revision};
  }
  preview(storyId,query='') {
    const data=this.read(),story=data.stories[storyId];check(story,'剧情不存在');
    const book=data.books[story.bookId];
    return {...retrieve(book,story,{query}),rules:book.entries.map(e=>({id:e.id,title:e.title,...eligibility(book,story,e)}))};
  }
}
