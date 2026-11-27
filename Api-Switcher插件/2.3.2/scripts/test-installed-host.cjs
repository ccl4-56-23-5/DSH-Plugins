const {pathToFileURL}=require('node:url'),fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
fs.mkdirSync(__dirname+'/../.work',{recursive:true});
(async()=>{
 const m=await import(pathToFileURL((process.argv[2] || 'D:/DeepSeekHarness')+'/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js'));
 const catalog=JSON.parse(fs.readFileSync(__dirname+'/../lib/assets/mimo-catalog.json'));
 let adapter,discovery;const captured=[];
 const server=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;if(req.url.endsWith('/models')){res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{id:'mimo-v2.6-pro',context_window:1000000,max_output_tokens:131072}]}));return;}
 captured.push(JSON.parse(body));res.writeHead(200,{'content-type':'text/event-stream'});res.write('data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',created:1,model:'mimo-v2.6-pro',choices:[{index:0,delta:{role:'assistant',content:'OK'},finish_reason:null}]})+'\n\n');res.write('data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',created:1,model:'mimo-v2.6-pro',choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:420000,completion_tokens:1,total_tokens:420001}})+'\n\n');res.end('data: [DONE]\n\n');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
 const baseURL='http://127.0.0.1:'+server.address().port+'/v1';
 const raw={providers:{fixture:{api:'openai-completions',apiKeyEnv:'FIXTURE_KEY',baseURL,models:catalog.models.map(({id,name,input,contextWindow,maxTokens})=>({id,name,input,contextWindow,maxTokens}))}}};
 const ctx={fiber:{entry:{options:{id:'llm-pi-ai'}}},inject:()=>{},on:()=>{},get:name=>name==='credentials'?{resolve:async()=>({value:'fixture-not-a-real-key'})}:undefined,logger:{warn:()=>{},error:()=>{}},llm:{registerConfigurableProviders:()=>({replace:()=>{}}),registerModelDiscovery:(_ns,fn)=>{discovery=fn},registerAdapter:(_routes,a)=>{adapter=a;return{replace:()=>{}}}}};
 m.apply(ctx,m.Config(raw));
 const info=await adapter.resolveModel('fixture','mimo-v2.6-pro');assert.equal(info.context.contextWindow,1000000);assert.equal(info.defaultMaxTokens,131072);
 const listing=await discovery({provider:'fixture',api:'openai-completions',baseURL},AbortSignal.timeout(5000));assert.equal(listing[0].contextWindow,1000000);assert.equal(listing[0].maxTokens,131072);
 let finish;for await(const chunk of adapter.stream({provider:'fixture',model:'mimo-v2.6-pro',messages:[{role:'user',content:[{type:'text',text:'synthetic 420k usage regression'}]}],maxTokens:131072,signal:AbortSignal.timeout(5000)}))if(chunk.type==='finish')finish=chunk.reason;
 assert.equal(finish.kind,'stop',JSON.stringify(finish));assert.equal(captured.length,1);
 const result={ok:true,hostAdapter:'installed app.asar dsh-llm-pi-ai',info,listing,finish,wireModel:captured[0].model,wireMaxTokens:captured[0].max_tokens??captured[0].max_completion_tokens,syntheticInputUsage:420000,endpoint:'isolated loopback fixture; no user credentials or paid API'};
 assert.equal(result.wireMaxTokens,131072);fs.writeFileSync(__dirname+'/../.work/installed-host-contract.json',JSON.stringify(result,null,2));
 }finally{server.close();}
})().catch(e=>{fs.writeFileSync(__dirname+'/../.work/installed-host-contract.json',JSON.stringify({error:e.stack}));process.exitCode=1});
