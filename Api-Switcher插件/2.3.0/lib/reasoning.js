// Capabilities are matched by endpoint AND protocol AND exact model ID.
// Never infer reseller capabilities from an upstream model name alone.
const chat = 'openai-completions', responses = 'openai-responses', anthropic = 'anthropic-messages'
const openai = 'https://developers.openai.com/api/docs/guides/reasoning'
const mimo = 'https://mimo.mi.com/docs/en-US/api/chat/openai-api'
const apiDoc = 'https://docs.apiyi.com/api-capabilities/'
const levels = list => Object.fromEntries(list.map(x => [x, x === 'off' ? 'none' : x]))
const toggle = {off:null,high:'high'}
const deepseekToggle = {thinkingFormat:'deepseek',supportsReasoningEffort:false}
const openaiCompat = {thinkingFormat:'openai',supportsReasoningEffort:true}
export const reasoningRules = [
  {hosts:['api.xiaomimimo.com'],paths:['/v1'],api:chat,models:['mimo-v2.6-flash','mimo-v2.6-pro','mimo-v2.6-pro-ultraspeed'],kind:'toggle',efforts:toggle,compat:deepseekToggle,defaultEffort:'high',source:mimo},
  {hosts:['api.xiaomimimo.com'],paths:['/v1'],api:responses,models:['mimo-v2.6-flash','mimo-v2.6-pro','mimo-v2.6-pro-ultraspeed'],kind:'toggle',efforts:{off:'none',high:'high'},compat:{},defaultEffort:'high',source:'https://mimo.mi.com/docs/en-US/api/chat/responses'},
  {hosts:['api.deepseek.com'],paths:['','/v1'],api:chat,models:['deepseek-flash','deepseek-v4-pro'],kind:'levels',efforts:{off:null,low:'low',high:'high',max:'max'},compat:{thinkingFormat:'deepseek',supportsReasoningEffort:true},defaultEffort:'high',source:'https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/'},
  {hosts:['api.apiyi.com'],paths:['','/v1'],api:chat,models:['deepseek-v4-flash-ga-260731'],kind:'toggle',efforts:toggle,compat:deepseekToggle,defaultEffort:'high',source:apiDoc+'deepseek-v4-flash/chat-completions'},
  ...[chat,responses].map(api=>({hosts:['api.openai.com'],paths:['/v1'],api,models:['gpt-5','gpt-5-mini','gpt-5-nano'],kind:'levels',efforts:levels(['minimal','low','medium','high']),compat:api===chat?openaiCompat:{},defaultEffort:'medium',source:openai})),
  ...[chat,responses].map(api=>({hosts:['api.openai.com'],paths:['/v1'],api,models:['gpt-5.1'],kind:'levels',efforts:levels(['off','low','medium','high']),compat:api===chat?openaiCompat:{},defaultEffort:'off',source:openai})),
  ...[chat,responses].map(api=>({hosts:['api.openai.com'],paths:['/v1'],api,models:['gpt-5.2','gpt-5.4','gpt-5.4-mini','gpt-5.4-nano'],kind:'levels',efforts:levels(['off','low','medium','high','xhigh']),compat:api===chat?openaiCompat:{},defaultEffort:'off',source:openai})),
  ...[chat,responses].map(api=>({hosts:['api.openai.com'],paths:['/v1'],api,models:['gpt-5.5'],kind:'levels',efforts:levels(['off','low','medium','high','xhigh']),compat:api===chat?openaiCompat:{},defaultEffort:'medium',source:openai})),
  {hosts:['api.apiyi.com'],paths:['','/v1'],api:responses,models:['gpt-5.4','gpt-5.5'],kind:'levels',efforts:levels(['off','low','medium','high','xhigh']),compat:{},defaultEffort:'medium',source:apiDoc+'openai/native'},
  {hosts:['api.apiyi.com'],paths:['/v1'],api:chat,models:['gpt-5.4','gpt-5.5'],kind:'levels',efforts:levels(['off','low','medium','high','xhigh']),compat:openaiCompat,defaultEffort:'medium',source:apiDoc+'openai/native'},
  ...[
    {models:['claude-opus-4-6'],list:['low','medium','high','max']},
    {models:['claude-opus-4-7','claude-opus-4-8'],list:['low','medium','high','xhigh','max']},
    {models:['claude-sonnet-4-6'],list:['low','medium','high']}
  ].map(({models,list})=>({hosts:['api.apiyi.com','api.anthropic.com'],paths:[''],api:anthropic,models,kind:'levels',efforts:{off:null,...levels(list)},compat:{forceAdaptiveThinking:true},defaultEffort:'off',source:apiDoc+'claude-effort-thinking'}))
]
function endpoint(baseURL) { try {const u=new URL(baseURL);if(u.protocol!=='https:'||u.port||u.username||u.password||u.search||u.hash)return;return {host:u.hostname,path:u.pathname.replace(/\/+$/,'')}}catch{} }
export function reasoningCapability(baseURL,api,id) {
  const u=endpoint(baseURL)
  const candidates=u&&['','/v1'].includes(u.path)?reasoningRules.filter(r=>r.hosts.includes(u.host)&&r.models.includes(id)):[]
  const rule=candidates.find(r=>r.api===api&&r.paths.includes(u.path))
  if(!rule)return {kind:'unknown',status:candidates.length?'protocol-required':'unknown',message:candidates.length?'此模型的思考控制已确认于其他协议；当前协议不自动添加档位。':'当前线路和模型的思考控制尚未确认，保留供应商默认。',protocols:[...new Set(candidates.map(r=>r.api))]}
  return {kind:rule.kind,status:'documented',efforts:structuredClone(rule.efforts),compat:structuredClone(rule.compat),defaultEffort:rule.defaultEffort,source:rule.source,message:rule.kind==='toggle'?'支持开启或关闭思考，不提供独立深度档位。':'按当前线路文档提供思考档位；实际用量不保证随档位单调变化。'}
}
export function nativeReasoningGroups(profile) {
 const u=endpoint(profile.baseURL),groups=new Map();
 if(!u||!['','/v1'].includes(u.path))return [];
 for(const model of profile.models||[]) {
  if(reasoningCapability(profile.baseURL,profile.api,model.id).status!=='protocol-required'||model.reasoningEfforts!==undefined)continue;
  const rule=reasoningRules.find(r=>r.hosts.includes(u.host)&&r.models.includes(model.id)&&r.api!==profile.api);
  if(!rule)continue;
  const baseURL='https://'+u.host+rule.paths[0],key=rule.api;
  if(!groups.has(key))groups.set(key,{api:key,baseURL,models:[]});
  const {compat,reasoningEfforts,...clean}=model;
  groups.get(key).models.push(applyReasoning(clean,reasoningCapability(baseURL,key,model.id),'auto'));
 }
 return [...groups.values()];
}
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export function reasoningStamp(model,keys=[]) {return {efforts:model.reasoningEfforts,compat:Object.fromEntries(keys.filter(k=>Object.hasOwn(model.compat||{},k)).map(k=>[k,model.compat[k]]))}}
export function reasoningMode(pref,model,profile) {
  const mode=pref?.modelReasoningModes?.[model.id],owned=pref?.modelAutoReasoning?.[model.id]
  const inherited=profile?.modelOverrides?.[model.id];
  if(!mode&&(inherited?.reasoningEfforts!==undefined||[profile?.compat,inherited?.compat].some(c=>Object.keys(c||{}).some(k=>/thinking|reasoning/i.test(k)))))return 'manual'
  if(mode==='auto'&&owned&&!eq(reasoningStamp(model,Object.keys(owned.compat)),owned))return 'manual'
  if(mode)return mode
  if(model.reasoningEfforts!==undefined||Object.keys(model.compat||{}).some(k=>/thinking|reasoning/i.test(k)&&!['chatTemplateKwargs','chatTemplateArgs'].includes(k)))return 'manual'
  return 'auto'
}
export function applyReasoning(model,cap,mode,previous) {
  const next=structuredClone(model)
  // Remove only fields last written by us, and only when still unmodified.
  if(previous) {
    if(eq(next.reasoningEfforts,previous.efforts))delete next.reasoningEfforts
    for(const [k,v]of Object.entries(previous.compat))if(eq(next.compat?.[k],v))delete next.compat[k]
  }
  if(mode==='auto'&&cap.status==='documented') {
    next.reasoningEfforts=structuredClone(cap.efforts)
    next.compat={...next.compat,...cap.compat}
  }
  return next
}
export function publicReasoning(pref,model,baseURL,api) {
  const mode=reasoningMode(pref,model),cap=reasoningCapability(baseURL,api,model.id)
  return {reasoningMode:mode,reasoningCapability:{...cap,...mode==='manual'?{kind:'manual',status:'manual',message:'保留现有手动配置；未将其标记为自动验证能力。'}:mode==='default'?{kind:'default',status:'default',message:'使用DSH或供应商默认，未自动配置思考控制。'}:{}}}
}
