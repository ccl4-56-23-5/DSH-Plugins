export const VERSION = '1.0.0';
const str = {type:'string', minLength:1, maxLength:32768};
const bool = {type:'boolean'};
const num = {type:'integer', minimum:0};
const obj = {type:'object'};
const id = {...str, maxLength:160, pattern:'^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'};
const sid = {sessionId:id};
const wid = {workspaceId:id};
const defs = [];
function tool(name, description, properties={}, required=[], write=false, service) {
  defs.push({name, description, inputSchema:{type:'object', properties:write?{...properties,operationId:id}:properties, required:write?[...required,'operationId']:required,additionalProperties:false}, write, service});
}
tool('status','Read bridge version, supported operations, desktop client identities and freshness.');
tool('operation_read','Read a durable mutation receipt after timeout; never retry under a different operationId.',{operationId:id},['operationId']);
tool('host_catalog','Discover live registered DSH Remote endpoints. Includes terminals, schedules, approvals and plugin extensions exposed by this host.',{namespace:str},[],false,'typert');
tool('host_describe','Read an observed endpoint parameter contract from host reflection before invoking it.',{endpoint:str},['endpoint'],false,'typert');
tool('host_invoke','Invoke an observed unary Remote endpoint through the host validation and lookup gateway. Read its contract first. User authorization for this particular action is required. No arbitrary JS or private method access.',{endpoint:str,arguments:obj},['endpoint','arguments'],true,'typertGateway');
tool('host_stream_read','Read a bounded snapshot from an observed host stream endpoint, closing it after the limit. No uplink events.',{endpoint:str,arguments:obj,maxItems:{...num,minimum:1,maximum:100},maxWaitMs:{...num,minimum:100,maximum:10000}},['endpoint','arguments'],false,'typertGateway');
tool('host_stream_open','Open a retained host stream, such as terminal/retain. Poll at least every 120 seconds. Closed on host restart. No uplink.',{endpoint:str,arguments:obj},['endpoint','arguments'],true,'typertGateway');
tool('host_stream_poll','Read retained stream items after a cursor. Reports dropped data explicitly. Renews the stream lease.',{streamId:id,after:num,maxWaitMs:{...num,maximum:50000}},['streamId'],false,'typertGateway');
tool('host_stream_close','Close a retained stream and release its host resources.',{streamId:id},['streamId'],true,'typertGateway');
tool('sessions_list','List existing sessions, without activating agents.',{},[],false,'sessionController');
tool('sessions_search','Search literal text in session messages.',{query:str},['query'],false,'sessionController');
tool('session_create','Create a session in a registered workspace. Does not send a message.',{...wid,sessionId:id,agentPreset:str},['workspaceId','sessionId'],true,'sessionController');
tool('session_read','Read current projections and bounded message history; beforeSeq paginates older history.',{...sid,beforeSeq:num,maxMessages:{...num,minimum:1,maximum:100}},['sessionId'],false,'sessionController');
tool('session_send','Send a scoped, user-authorized message. mode queue or steer. Reuse operationId after timeouts. Never automatically delegate the parent development request.',{...sid,text:str,mode:{enum:['queue','steer']},answerOnly:bool},['sessionId','text','mode'],true,'sessionController');
tool('session_wait','Read the actual reply for requestId, with a bounded wait. No new message is sent.',{...sid,requestId:id,maxWaitMs:{...num,maximum:50000}},['sessionId','requestId'],false,'sessionController');
tool('session_cancel','Cancel the specified running session.',sid,['sessionId'],true,'sessionController');
tool('session_rename','Rename the specified session.',{...sid,title:str},['sessionId','title'],true,'sessionController');
tool('session_fork','Fork the specified session, optionally at a known event sequence.',{...sid,atSeq:num},['sessionId'],true,'sessionController');
tool('session_archive','Archive/unarchive a session. stopActivity explicitly stops its active work.',{...sid,archived:bool,stopActivity:bool},['sessionId','archived'],true,'workspaceRegistry');
tool('session_pin','Pin/unpin a session.',{...sid,pinned:bool},['sessionId','pinned'],true,'workspaceRegistry');
tool('queue_update','Edit, remove or steer one queued message.',{...sid,itemId:id,action:{enum:['edit','remove','steer']},text:str},['sessionId','itemId','action'],true,'sessionController');
tool('models_list','Read routable models, capacities and current deployment default.',{},[],false,'sessionController');
tool('model_select','Select a model and reasoning effort for a session. The host also saves its default.',{...sid,provider:str,model:str,reasoningEffort:str},['sessionId','provider','model'],true,'sessionController');
tool('workspaces_list','Read registered workspaces, archive and pin sets.',{},[],false,'workspaceRegistry');
tool('workspace_create','Register an existing local directory.',{path:str,title:str},['path'],true,'workspaceRegistry');
tool('workspace_rename','Rename a registered workspace.',{...wid,title:str},['workspaceId','title'],true,'workspaceRegistry');
tool('workspace_reorder','Move a workspace before another, or to the end.',{...wid,beforeWorkspaceId:id},['workspaceId'],true,'workspaceRegistry');
tool('workspace_remove','Remove a workspace registration; host retains directories and session logs.',wid,['workspaceId'],true,'workspaceRegistry');
tool('settings_read','Read editable settings and revision tokens; host-declared secrets are redacted.',{},[],false,'settingsController');
tool('settings_update','Merge settings using the revision from settings_read to prevent lost updates.',{namespace:str,patch:obj,expectedRevision:num},['namespace','patch','expectedRevision'],true,'settingsController');
tool('plugins_list','Read installed bundles and plugin runtime states.',{},[],false,'pluginManager');
tool('plugin_enable','Enable/disable one bundle. Cannot disable this control bridge from itself.',{packageName:str,enabled:bool},['packageName','enabled'],true,'pluginManager');
tool('plugin_install','Install a user-specified bundle. Returns installation identity; inspect host state afterwards.',{spec:str},['spec'],true,'pluginManager');
tool('plugin_remove','Remove a user-specified bundle. Cannot remove this bridge from itself.',{packageName:str},['packageName'],true,'pluginManager');
tool('desktop_snapshot','Read visible DOM controls, current session, dialogs and text from a specific desktop client. No screenshot.',{clientId:id},['clientId']);
tool('desktop_open_session','Select an existing session in the actual desktop; read back selection.',{clientId:id,...sid},['clientId','sessionId'],true);
tool('desktop_click','Click a nodeId from a fresh desktop snapshot; rejects detached or changed controls.',{clientId:id,nodeId:id},['clientId','nodeId'],true);
tool('desktop_fill','Fill a text input or contenteditable from a fresh snapshot. Does not submit.',{clientId:id,nodeId:id,text:{type:'string',maxLength:32768}},['clientId','nodeId','text'],true);
tool('desktop_select','Select a native select option by value.',{clientId:id,nodeId:id,value:{type:'string'}},['clientId','nodeId','value'],true);
tool('desktop_key','Dispatch a key on a known control. Browser synthetic events may not trigger native actions; verify readback.',{clientId:id,nodeId:id,key:{enum:['Enter','Escape','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']},ctrlKey:bool,shiftKey:bool},['clientId','nodeId','key'],true);
tool('desktop_scroll','Scroll a known control into view.',{clientId:id,nodeId:id},['clientId','nodeId'],true);
export const TOOLS = defs;
export function validate(schema, value, path='input') {
  if(schema.enum && !schema.enum.includes(value))throw new Error(`${path}: invalid choice`);
  if(schema.type==='object') {
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${path}: object required`);
    for(const k of Object.keys(value)) {if(['__proto__','constructor','prototype'].includes(k))throw new Error('Unsafe property');if(schema.additionalProperties===false&&!Object.hasOwn(schema.properties,k))throw new Error(`${path}.${k}: unknown field`);if(schema.properties?.[k])validate(schema.properties[k],value[k],`${path}.${k}`);}
    for(const k of schema.required||[])if(!Object.hasOwn(value,k))throw new Error(`${path}.${k}: required`);
  }
  if(schema.type==='string'&&(typeof value!=='string'||value.length<(schema.minLength||0)||value.length>(schema.maxLength||Infinity)||schema.pattern&&!new RegExp(schema.pattern).test(value)))throw new Error(`${path}: invalid string`);
  if(schema.type==='boolean'&&typeof value!=='boolean')throw new Error(`${path}: boolean required`);
  if(schema.type==='integer'&&(!Number.isSafeInteger(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)))throw new Error(`${path}: invalid integer`);
}
