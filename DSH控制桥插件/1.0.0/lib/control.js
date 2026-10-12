import {createHash,randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {TOOLS,VERSION,validate} from './protocol.js';
export const fault=(message,status=400)=>Object.assign(new Error(message),{status});
export function atomic(file,value) { mkdirSync(dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});renameSync(tmp,file); }
function canonical(v){return JSON.stringify(v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v);}
const fingerprint=v=>createHash('sha256').update(canonical(v)).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function createControl(ctx,{stateFile,now=Date.now}={}) {
  const receipts=existsSync(stateFile)?JSON.parse(readFileSync(stateFile,'utf8')):{};
  const clients=new Map(),pendingUI=new Map(),jobs=new Map(),answerOnly=new Set(),streams=new Map();
  const persist=()=>atomic(stateFile,receipts);
  const service=name=>{const x=ctx[name]||ctx.get?.(name);if(!x)throw fault(`Host capability unavailable: ${name}`,503);return x;};
  const descriptor=endpoint=>{const d=service('typert').local.get(endpoint);if(!d)throw fault('Unknown registered endpoint',404);return d;};
  function describe(d){return {endpoint:d.namespace+'/'+d.method,service:d.service,mode:d.mode||'unary',parameters:d.parameters.map(p=>{let schema;try{schema=p.codec?.create?.().toJSONSchema?.();}catch{}return {name:p.wire,source:p.source,type:p.codec?.typeSymbol,...schema?{schema}:{}};})};}
  const workspaces=()=>{const r=service('workspaceRegistry');return {items:r.list().map(w=>({id:w.id,path:w.path,title:w.title,sessionIds:w.sessionIds})),archivedSessionIds:r.archivedSessionIds,pinnedSessionIds:r.pinnedSessionIds};};
  function status(){return {protocolVersion:1,version:VERSION,packageName:'dsh-control-bridge',tools:TOOLS.map(t=>({name:t.name,available:!t.service||!!(ctx[t.service]||ctx.get?.(t.service))})),clients:[...clients.values()].map(c=>({clientId:c.clientId,selection:c.selection,url:c.url,lastSeen:c.lastSeen,online:now()-c.lastSeen<10000})),pendingOperations:Object.values(receipts).filter(r=>r.status==='pending').map(r=>({operationId:r.operationId,name:r.name,createdAt:r.createdAt}))};}
  async function readSession(p){const c=service('sessionController'),s=AbortSignal.timeout(10000);const projections=await c.projections({sessionId:p.sessionId},s);const page=projections.asOfSeq<0?{records:[]}:await c.page({address:{kind:'session',sessionId:p.sessionId},throughSeq:projections.asOfSeq,...p.beforeSeq===undefined?{}:{beforeSeq:p.beforeSeq},maxMessages:p.maxMessages||30},s);return {sessionId:p.sessionId,projections,page};}
  async function waitSession(p){const deadline=now()+(p.maxWaitMs||0);let result;do {const data=await readSession({...p,maxMessages:100}),events=data.page.records.filter(r=>r.type==='event').map(r=>r.event);const user=events.find(e=>e.type==='user/message'&&e.data?.source?.rpcId===p.requestId);const nextUser=user?events.find(e=>e.type==='user/message'&&e.data?.source?.kind==='user'&&e.seq>user.seq):undefined;const after=user?events.filter(e=>e.seq>user.seq&&(!nextUser||e.seq<nextUser.seq)):[];const end=after.findLast(e=>e.type==='turn/end'),reason=end?.data?.reason,failed=after.some(e=>e.type==='turn/error')||['error','cancelled','aborted','interrupted'].includes(reason?.kind||reason);const reply=after.filter(e=>e.type==='assistant/message').map(e=>(e.data?.message?.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n')).filter(Boolean).at(-1)||'';result={sessionId:p.sessionId,requestId:p.requestId,sent:!!user,completed:!!user&&!!reply&&!!end&&!failed,failed,reply,completionReason:reason??null,asOfSeq:data.projections.asOfSeq,historyLimited:!user};if(end||failed||now()>=deadline)return result;await sleep(350);}while(now()<deadline);return result;}
  async function ui(name,p){const client=clients.get(p.clientId);if(!client||now()-client.lastSeen>10000)throw fault('Desktop client offline; read status and select a live clientId.',503);const id=p.operationId||randomUUID();if(pendingUI.has(id))throw fault('UI command already pending',409);let resolve;const promise=new Promise(r=>resolve=r);const command={id,name,args:p,expiresAt:now()+15000};pendingUI.set(id,{command,resolve,clientId:p.clientId,claimed:false});let timeout;try {const value=await Promise.race([promise,new Promise(r=>{timeout=setTimeout(()=>r({error:'Desktop acknowledgement timed out; inspect current state before a new action.'}),16000);})]);if(value.error)throw fault(value.error,504);return value.result;}finally{clearTimeout(timeout);pendingUI.delete(id);}}
  function heartbeat(p){validate({type:'object',properties:{clientId:{type:'string',pattern:'^[a-zA-Z0-9-]{8,80}$'},url:{type:'string'},selection:{type:'object'}},required:['clientId','url','selection'],additionalProperties:false},p);clients.set(p.clientId,{...p,lastSeen:now()});for(const [id,c]of clients)if(now()-c.lastSeen>60000)clients.delete(id);const commands=[];for(const v of pendingUI.values())if(v.clientId===p.clientId&&!v.claimed&&now()<v.command.expiresAt){v.claimed=true;commands.push(v.command);}return {commands};}
  function acknowledge(p){const task=pendingUI.get(p.id);if(!task||task.clientId!==p.clientId||now()>task.command.expiresAt)throw fault('Stale or mismatched desktop acknowledgement',409);task.resolve(p);return {accepted:true};}
  async function execute(name,p){const c=()=>service('sessionController'),w=()=>service('workspaceRegistry');const {operationId,...a}=p;
    if(name.startsWith('desktop_'))return ui(name,p);
    switch(name){
      case 'status':return status();
      case 'operation_read':return receipts[p.operationId]||{status:'not_found',operationId:p.operationId};
      case 'host_catalog':return service('typert').local.list().filter(d=>!p.namespace||d.namespace===p.namespace).map(d=>({endpoint:d.namespace+'/'+d.method,mode:d.mode||'unary',service:d.service}));
      case 'host_describe':return describe(descriptor(p.endpoint));
      case 'host_stream_open':{const d=descriptor(p.endpoint);if(!d.mode)throw fault('Endpoint is not a stream');if(streams.size>=32)throw fault('Close unused streams first',429);const streamId=randomUUID(),controller=new AbortController(),row={streamId,controller,items:[],seq:0,bytes:0,lease:now()+120000,done:false};streams.set(streamId,row);const timer=setInterval(()=>{if(now()>row.lease){controller.abort();row.done=true;streams.delete(streamId);clearInterval(timer);}},2000);timer.unref?.();row.timer=timer;row.task=(async()=>{try{const stream=await service('typertGateway').stream({namespace:d.namespace,method:d.method,args:p.arguments,signal:controller.signal});for await(const value of stream){const item={cursor:++row.seq,value},bytes=Buffer.byteLength(JSON.stringify(item));row.items.push({...item,bytes});row.bytes+=bytes;while(row.items.length>100||row.bytes>1024*1024){row.bytes-=row.items.shift().bytes;}}}catch(e){if(!controller.signal.aborted)row.error=e.message;}finally{row.done=true;}})();return {streamId,leaseMs:120000};}
      case 'host_stream_poll':{const row=streams.get(p.streamId);if(!row)throw fault('Stream expired, closed or host restarted',404);row.lease=now()+120000;const deadline=now()+(p.maxWaitMs||0);while(!row.done&&!row.items.some(x=>x.cursor>(p.after||0))&&now()<deadline)await sleep(100);return {streamId:p.streamId,items:row.items.filter(x=>x.cursor>(p.after||0)).map(({bytes,...x})=>x),cursor:row.seq,dropped:(row.items[0]?.cursor||row.seq+1)>(p.after||0)+1,done:row.done,error:row.error};}
      case 'host_stream_close':{const row=streams.get(p.streamId);if(row){row.controller.abort();clearInterval(row.timer);await row.task;streams.delete(p.streamId);}return {closed:true};}
      case 'host_invoke':{const d=descriptor(p.endpoint);if(d.mode)throw fault('Use host_stream_read for streams');if(d.namespace==='pluginManager'&&['removeBundle','setBundleEnabled','setPluginEnabled'].includes(d.method)&&(p.arguments.name==='dsh-control-bridge'||p.arguments.id==='include:dsh-control-bridge'))throw fault('Cannot disable the active control bridge');return service('typertGateway').invoke({namespace:d.namespace,method:d.method,args:p.arguments,signal:AbortSignal.timeout(50000)});}
      case 'host_stream_read':{const d=descriptor(p.endpoint);if(!d.mode)throw fault('Endpoint is not a stream');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),p.maxWaitMs||2000),items=[];let timedOut=false;try{const stream=await service('typertGateway').stream({namespace:d.namespace,method:d.method,args:p.arguments,signal:controller.signal});for await(const item of stream){items.push(item);if(items.length>=(p.maxItems||1))break;}}catch(e){if(!controller.signal.aborted)throw e;timedOut=true;}finally{controller.abort();clearTimeout(timer);}return {items,timedOut};}
      case 'sessions_list':return c().list({},AbortSignal.timeout(15000));
      case 'sessions_search':return c().search(a,AbortSignal.timeout(15000));
      case 'session_create':return c().create(a);
      case 'session_read':return readSession(a);
      case 'session_wait':return waitSession(a);
      case 'session_send':{if(p.answerOnly){if(!ctx.on)throw fault('Answer-only verification unavailable',503);answerOnly.add(p.sessionId);}try{return {...await c().prompt({sessionId:p.sessionId,requestId:operationId,mode:p.mode,content:[{type:'text',text:p.text}],clientTimeZone:'Asia/Shanghai'},AbortSignal.timeout(30000)),requestId:operationId};}catch(e){answerOnly.delete(p.sessionId);throw e;}}
      case 'session_cancel':{const result=await c().cancel(a);answerOnly.delete(p.sessionId);return result;}
      case 'session_rename':return c().rename(a);
      case 'session_fork':return c().fork(a);
      case 'session_archive':await (p.archived?w().archiveSession(p.sessionId,{stopActivity:p.stopActivity===true}):w().unarchiveSession(p.sessionId));return workspaces();
      case 'session_pin':await (p.pinned?w().pinSession(p.sessionId):w().unpinSession(p.sessionId));return workspaces();
      case 'queue_update':if(p.action==='edit'&&!p.text)throw fault('text required for edit');return c().updateQueue({sessionId:p.sessionId,itemId:p.itemId,action:{kind:p.action,...p.action==='edit'?{content:[{type:'text',text:p.text}]}:{}}});
      case 'models_list':return c().modelCatalog();
      case 'model_select':return c().selectModel(a);
      case 'workspaces_list':return workspaces();
      case 'workspace_create':{const value=await w().create(p.path,p.title);return {id:value.id,path:value.path,title:value.title};}
      case 'workspace_rename':{const value=w().get(p.workspaceId);if(!value)throw fault('Unknown workspace',404);await value.setTitle(p.title);return workspaces();}
      case 'workspace_reorder':await w().insertBefore(p.workspaceId,p.beforeWorkspaceId);return workspaces();
      case 'workspace_remove':return {deleted:await w().delete(p.workspaceId)};
      case 'settings_read':return service('settingsController').describe();
      case 'settings_update':return service('settingsController').update(p.namespace,p.patch,p.expectedRevision);
      case 'plugins_list':{const m=service('pluginManager');const clean=v=>JSON.parse(JSON.stringify(v,(k,x)=>k==='icon'&&typeof x==='string'&&x.startsWith('data:')?'[embedded icon omitted]':x));return clean({plugins:await m.listPlugins(),bundles:await m.listBundles()});}
      case 'plugin_enable':if(p.packageName==='dsh-control-bridge'&&!p.enabled)throw fault('Cannot disable active control channel');return service('pluginManager').setBundleEnabled(p.packageName,p.enabled);
      case 'plugin_install':return service('pluginManager').installBundle(p.spec,{requestId:operationId});
      case 'plugin_remove':if(p.packageName==='dsh-control-bridge')throw fault('Cannot remove active control channel');return service('pluginManager').removeBundle(p.packageName);
      default:throw fault('Unknown control operation',404);
    }
  }
  async function call(name,p={}){const spec=TOOLS.find(t=>t.name===name);if(!spec)throw fault('Unknown control operation',404);validate(spec.inputSchema,p);if(!spec.write)return execute(name,p);const key=p.operationId,fp=fingerprint({name,input:p});if(receipts[key]){if(receipts[key].fingerprint!==fp)throw fault('operationId already used for different arguments',409);if(jobs.has(key))return jobs.get(key);return receipts[key];}
    receipts[key]={operationId:key,name,fingerprint:fp,status:'pending',createdAt:new Date(now()).toISOString()};persist();
    const job=(async()=>{try{const result=await execute(name,p);Object.assign(receipts[key],{status:'completed',result:result??null});}catch(error){Object.assign(receipts[key],{status:'uncertain',error:String(error.message),code:error.status||500});}receipts[key].updatedAt=new Date(now()).toISOString();persist();return receipts[key];})();jobs.set(key,job);try{return await job;}finally{jobs.delete(key);}}
  if(ctx.on){ctx.on('system-prompt/assemble',async(_assembly,context,next)=>{const a=await next();return answerOnly.has(context.agent?.id)?{...a,tools:[]}:a;},{prepend:true});ctx.on('session/event',(session,event)=>{if(event.type==='turn/end')answerOnly.delete(session.id);});}
  function dispose(){for(const row of streams.values()){row.controller.abort();clearInterval(row.timer);}streams.clear();for(const row of pendingUI.values())row.resolve({error:'Bridge disposed'});pendingUI.clear();}
  return {call,status,heartbeat,acknowledge,dispose};
}
