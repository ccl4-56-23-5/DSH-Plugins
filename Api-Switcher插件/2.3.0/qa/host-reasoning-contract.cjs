const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=require('node:path').resolve(__dirname,'..'), host=process.argv[2];if(!host)throw Error('Usage: ELECTRON_RUN_AS_NODE=1 <DSH executable> qa/host-reasoning-contract.cjs <DSH root>');
 const {reasoningRules}=await import(pathToFileURL(root+'/lib/reasoning.js'));
 const mod=await import(pathToFileURL(host+'/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js'));
 const requests=[],results=[];
 const server=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;requests.push({url:req.url,body:JSON.parse(body)});res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:{message:'intentional local fixture rejection',type:'invalid_request_error'}}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {for(const rule of reasoningRules)for(const id of rule.models){
  let adapter;const profile={api:rule.api,apiKeyEnv:'FIXTURE',baseURL:'http://127.0.0.1:'+server.address().port+(rule.api==='anthropic-messages'?'':'/v1'),models:[{id,reasoningEfforts:rule.efforts,compat:rule.compat}]};
  const ctx={fiber:{entry:{options:{id:'llm-pi-ai'}}},inject:()=>{},on:()=>{},get:n=>n==='credentials'?{resolve:async()=>({value:'fixture'})}:undefined,logger:{warn:()=>{},error:()=>{}},llm:{registerConfigurableProviders:()=>({replace:()=>{}}),registerModelDiscovery:()=>{},registerAdapter:(_,a)=>{adapter=a;return {replace:()=>{}}}}};
  mod.apply(ctx,mod.Config({providers:{fixture:profile}}));
  for(const [effort,value] of Object.entries(rule.efforts)){
   const before=requests.length;
   for await(const chunk of adapter.stream({provider:'fixture',model:id,reasoningEffort:effort,messages:[{role:'user',content:[{type:'text',text:'fixture'}]}],maxTokens:4096,signal:AbortSignal.timeout(5000)})){}
   assert.equal(requests.length,before+1,`${id} ${rule.api} ${effort}: no request`);
   const {url,body}=requests.at(-1);assert.equal(url.split('?')[0],rule.api==='anthropic-messages'?'/v1/messages':rule.api==='openai-responses'?'/v1/responses':'/v1/chat/completions');
   if(rule.api==='anthropic-messages'){
    assert.equal(body.thinking?.type,effort==='off'?'disabled':'adaptive');
    assert.equal(body.output_config?.effort,effort==='off'?undefined:value);
   }else if(rule.api==='openai-responses')assert.equal(body.reasoning?.effort,value);
   else if(rule.compat.thinkingFormat==='deepseek'){
    assert.equal(body.thinking?.type,effort==='off'?'disabled':'enabled');
    assert.equal(body.reasoning_effort,rule.compat.supportsReasoningEffort&&effort!=='off'?value:undefined);
   }else assert.equal(body.reasoning_effort,value);
   results.push({id,api:rule.api,effort,url,thinking:body.thinking,reasoning:body.reasoning,reasoning_effort:body.reasoning_effort,output_config:body.output_config});
  }
 }}finally{server.close()}
 fs.writeFileSync(__dirname+'/wire-result.json',JSON.stringify({ok:true,count:results.length,results},null,2));
})().catch(e=>{fs.writeFileSync(__dirname+'/wire-error.txt',e.stack);process.exitCode=1});
