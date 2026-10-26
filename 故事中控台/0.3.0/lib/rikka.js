import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';

const fail=message=>{throw new Error(message);};
const string=(v,fallback='')=>typeof v==='string'?v:fallback;
// Native RikkaHub ExportData(version=1,type=lorebook); retain every original
// field for lossless export. Runtime placement remains owned by DSH's tools.
export function importRikka(input) {
  const envelope=input?.type==='lorebook'?input:null;
  if(envelope&&envelope.version!==1)fail('不支持的 RikkaHub 导出版本');
  const raw=envelope?.data??input;
  if(!raw||!Array.isArray(raw.entries)||typeof raw.name!=='string')fail('需要 RikkaHub 原生世界书 JSON（type: lorebook）');
  if(raw.entries.length>3000)fail('世界书条目上限为3000');
  const entries=raw.entries.map((e,i)=>{
    if(!e||!['regex',undefined].includes(e.type)||typeof e.content!=='string')fail('不支持的 RikkaHub 条目类型或正文：'+(i+1));
    if(e.keywords!==undefined&&(!Array.isArray(e.keywords)||e.keywords.length>100||e.keywords.some(k=>typeof k!=='string'||k.length>1000)))fail('关键词格式无效');
    const activation={enabled:e.enabled??true,priority:e.priority??0,keywords:e.keywords??[],useRegex:e.useRegex??false,caseSensitive:e.caseSensitive??false,constantActive:e.constantActive??false};
    if(['enabled','useRegex','caseSensitive','constantActive'].some(k=>typeof activation[k]!=='boolean')||!Number.isFinite(activation.priority))fail('条目开关或优先级无效');
    return {id:'entry-'+randomUUID(),title:string(e.name)||'条目 '+(i+1),body:e.content,visibility:'public',always:activation.constantActive,tags:[],when:{},activation,rikka:structuredClone(e)};
  });
  return {id:'rikka-'+randomUUID(),title:raw.name||'未命名世界书',description:string(raw.description),fields:[],initialState:{},entries,format:'rikkahub',defaultEnabled:raw.enabled??true,rikka:{envelope:envelope?structuredClone(envelope):null,book:structuredClone(raw)}};
}
export function exportRikka(book) {
  if(book.format!=='rikkahub'||!book.rikka)fail('仅 RikkaHub 导入的世界书可以按原格式导出');
  return book.rikka.envelope?structuredClone(book.rikka.envelope):{version:1,type:'lorebook',data:structuredClone(book.rikka.book)};
}
export function literalTrigger(activation,query) {
  if(activation.constantActive)return true;
  const hay=activation.caseSensitive?query:query.toLowerCase();
  return activation.keywords.some(k=>hay.includes(activation.caseSensitive?k:k.toLowerCase()));
}
// Untrusted regex never executes on the host event loop. One bounded worker
// evaluates the entire request; timeout/invalid expressions fail visibly.
// Worker startup has its own bounded wait: a slow Windows thread launch must
// not consume the regex execution budget before any expression has run.
export async function regexTriggers(books,query,timeout=500) {
  const jobs=books.flatMap(b=>b.entries.filter(e=>e.activation?.useRegex&&!e.activation.constantActive).map(e=>({key:b.id+':'+e.id,patterns:e.activation.keywords,flags:e.activation.caseSensitive?'':'i'})));
  if(!jobs.length)return {};
  return new Promise((resolve,reject)=>{
    const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');try{const out={};for(const j of workerData.jobs)out[j.key]=j.patterns.some(p=>new RegExp(p,j.flags).test(workerData.query));parentPort.postMessage({out});}catch(e){parentPort.postMessage({error:'正则表达式不受支持：'+e.message});}`,{eval:true,workerData:{jobs,query},resourceLimits:{maxOldGenerationSizeMb:32}});
    let settled=false;
    const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(value);};
    let timer=setTimeout(()=>done(new Error('世界书正则工作进程启动超时；请稍后重试')),5000);
    worker.once('online',()=>{if(settled)return;clearTimeout(timer);timer=setTimeout(()=>done(new Error('世界书正则匹配超时；请停用或修改相关条目')),timeout);});
    worker.on('message',m=>done(m.error?new Error(m.error):null,m.out));worker.on('error',e=>done(e));worker.on('exit',code=>{if(!settled)done(new Error('世界书正则工作进程退出：'+code));});
  });
}
