import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { VERSION } from '../lib/core.js'

// Documentation renderer: original UI components, isolated example data.
// It never loads a DSH profile, credentials, sessions or provider endpoint.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const cache=join(root,'.work','docs-preview')
await mkdir(join(cache,'vendor'),{recursive:true})
for(const [name,url] of [['react.js','https://unpkg.com/react@18.3.1/umd/react.production.min.js'],['react-dom.js','https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js']]) {
  try { await readFile(join(cache,'vendor',name)) }
  catch { const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`Cannot load ${name}`);await writeFile(join(cache,'vendor',name),Buffer.from(await response.arrayBuffer())) }
}
const catalog=JSON.parse(await readFile(join(root,'lib/assets/apiyi-catalog.json'),'utf8'))
const third=catalog.models.find(m=>/deepseek/i.test(m.id))?.id
const enabledIds=new Set(['gpt-5.4-mini','gpt-5.4',third])
const credential={configured:true}
let state={version:VERSION,revision:'demo-1',writable:true,active:{provider:'apiyi',model:'gpt-5.4-mini'},protocols:[{id:'openai-completions',name:'OpenAI Chat Completions'},{id:'openai-responses',name:'OpenAI Responses'},{id:'anthropic-messages',name:'Anthropic Messages'}],presets:[],catalogs:{apiyi:catalog},sources:[
  {id:'apiyi',name:'API易',baseURL:'https://api.apiyi.com/v1',website:'https://api.apiyi.com',api:'openai-completions',enabled:true,editable:true,managed:true,credential,models:catalog.models.map(m=>({...m,enabled:enabledIds.has(m.id)}))},
  {id:'deepseek',name:'DeepSeek',baseURL:'https://api.deepseek.com/v1',website:'https://www.deepseek.com',api:'openai-completions',enabled:true,editable:true,credential,models:[{id:'deepseek-chat',name:'DeepSeek Chat',enabled:true,input:['text']},{id:'deepseek-reasoner',name:'DeepSeek Reasoner',enabled:true,input:['text'],reasoningEfforts:['low','medium','high']}]},
  {id:'deepseek-account',name:'DeepSeek Account',website:'https://chat.deepseek.com',api:'native',enabled:true,editable:false,credential,models:[{id:'deepseek-flash',name:'DeepSeek Flash',enabled:true,input:['text']},{id:'deepseek-expert',name:'DeepSeek Expert',enabled:true,input:['text']}]},
]}
for(const source of state.sources)source.logo='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${source.id==='apiyi'?'#eef5ff':'#e9f0ff'}"/><text x="32" y="41" font-family="sans-serif" font-size="23" font-weight="700" text-anchor="middle" fill="#3477cf">${source.id==='apiyi'?'API':'DS'}</text></svg>`)
let serial=1
const example=JSON.stringify(state).replaceAll('<','\\u003c')
const html=`<!doctype html><html lang="zh-CN" data-theme="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>api-switcher功能演示</title><link rel="stylesheet" href="/plugin/theme.css"><style>
body{margin:0;background:#f3f6fb;color:#243147;font:14px "Segoe UI","Microsoft YaHei",sans-serif}#capture{box-sizing:border-box;max-width:1280px;min-height:860px;margin:0 auto;padding:30px 38px}.caption{display:flex;align-items:center;justify-content:space-between;margin:0 0 20px}.caption h1{margin:0;font-size:25px;letter-spacing:-.5px}.caption p{margin:7px 0 0;color:#74839a;font-size:12px}.demo-badge{padding:6px 10px;border:1px solid #dce5f1;background:#fff;border-radius:20px;color:#657791;font-size:11px}.chat-shell{height:735px;border:1px solid #dce5f1;border-radius:18px;background:#fff;position:relative;overflow:hidden;box-shadow:0 14px 55px #24375709}.chat-title{padding:20px 25px;border-bottom:1px solid #edf0f6;font-weight:600}.chat-empty{position:absolute;top:170px;width:100%;text-align:center;color:#8795a9}.chat-empty img{width:94px;height:94px}.chat-empty h2{font-size:23px;color:#5c6e88;font-weight:500;margin:18px 0 9px}.chat-empty p{font-size:12px}.composer{position:absolute;bottom:24px;left:25px;right:25px;border:1px solid #dce5f1;border-radius:18px;background:#fff;box-shadow:0 8px 35px #34577c08;padding:18px 20px 15px}.composer .placeholder{color:#929caf;height:46px;font-size:14px}.composer-bar{display:flex;align-items:center;justify-content:space-between}.composer-right{display:flex;align-items:center;gap:17px}.send-arrow{display:flex;align-items:center;justify-content:center;width:37px;height:37px;border-radius:50%;background:#3477cf;color:#fff;font-size:23px}.muted{color:#99a3b2;font-size:11px}.footnote{color:#8390a6;text-align:center;font-size:11px;margin:19px 0 0}
</style><div id="capture"><header class="caption"><div><h1 id="scene-title">统一管理供应商</h1><p>api-switcher · 真实前端组件与示例配置</p></div><span class="demo-badge">演示截图 · 无真实API请求</span></header><main id="mount"></main><p class="footnote">供应商、认证状态与模型启用范围为演示数据；图标为示例占位，不包含个人配置或密钥。</p></div><script src="/vendor/react.js"></script><script src="/vendor/react-dom.js"></script><script>window.__ModuleLoader__={load(d){window.plugin=d.factory(n=>n==='react'?React:ReactDOM)}};</script><script src="/plugin/client.js"></script><script>
const example=${example},watchers=new Set();let nativeSnapshot={current:example.active,groups:example.sources.map(s=>({id:s.id,models:s.models.map(m=>({...m,reasoning:{efforts:[{id:'low',name:'Low'},{id:'medium',name:'Medium'},{id:'high',name:'High'}],defaultEffort:'medium'}}))}))};
const directory={getSnapshot:()=>nativeSnapshot,subscribe(fn){watchers.add(fn);return()=>watchers.delete(fn)}};
async function load(){const r=await fetch('/api-switcher/api/state'),d=await r.json();nativeSnapshot={...nativeSnapshot,current:d.value.active};for(const fn of watchers)fn()}
const view=new URLSearchParams(location.search).get('view')||'settings',h=React.createElement;
document.getElementById('scene-title').textContent=view==='picker'?'按供应商切换与搜索模型':'统一管理供应商与模型';
const mount=document.getElementById('mount');
if(view==='picker'){mount.innerHTML='<section class="chat-shell"><div class="chat-title">会话输入区示意</div><div class="chat-empty"><img src="/api-switcher/api/brand" alt="api-switcher"><h2>选择供应商，找到需要的模型</h2><p>仅展示启用的供应商和模型；搜索在本机完成。</p></div><div class="composer"><div class="placeholder">在这里输入消息…</div><div class="composer-bar"><span class="muted">示意输入区</span><div class="composer-right"><div id="model-seat"></div><span class="send-arrow" aria-hidden="true">↑</span></div></div></div></section>';ReactDOM.createRoot(document.getElementById('model-seat')).render(h(plugin.ModelSeat,{sessionId:'docs-example',available:true,locked:false,directory,load}))}
else ReactDOM.createRoot(mount).render(h(plugin.ProviderSettings));
</script></html>`
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost')
    res.setHeader('Cache-Control','no-store')
    if(url.pathname.startsWith('/api-switcher/api/')){
      const route=url.pathname.slice('/api-switcher/api/'.length)
      if(route==='brand'){res.setHeader('Content-Type','image/png');return res.end(await readFile(join(root,'lib/assets/logo.png')))}
      let body={};if(req.method==='POST'){let text='';for await(const chunk of req){text+=chunk;if(text.length>1048576)throw new Error('Body too large')}body=JSON.parse(text||'{}')}
      if(req.method==='POST'){
        if(route==='test')throw new Error('演示界面不发送真实API请求')
        if(route==='activate')state.active={provider:body.provider,model:body.model}
        if(route==='preferences'){const s=state.sources.find(s=>s.id===body.provider);Object.assign(s,{enabled:body.enabled,name:body.name,website:body.website});s.models=s.models.map(m=>({...m,enabled:body.enabledModels.includes(m.id)}))}
        if(route==='sources'){const s={...body.source,credential};const index=state.sources.findIndex(s=>s.id===body.source.id);if(index<0)state.sources.push(s);else state.sources[index]=s}
        state.revision='demo-'+(++serial)
      }
      res.setHeader('Content-Type','application/json; charset=utf-8')
      return res.end(JSON.stringify({ok:true,value:route==='discover'?{models:catalog.models}:state}))
    }
    if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html)}
    const files={'/plugin/client.js':['text/javascript',join(root,'lib/client.js')],'/plugin/theme.css':['text/css',join(root,'lib/assets/theme.css')],'/vendor/react.js':['text/javascript',join(cache,'vendor/react.js')],'/vendor/react-dom.js':['text/javascript',join(cache,'vendor/react-dom.js')]}
    if(files[url.pathname]){const[type,path]=files[url.pathname];res.setHeader('Content-Type',type+'; charset=utf-8');return res.end(await readFile(path))}
    res.statusCode=404;res.end('Not found')
  }catch(error){res.statusCode=400;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({ok:false,error:{message:error.message}}))}
})
server.listen(Number(process.env.DOCS_PREVIEW_PORT||0),'127.0.0.1',()=>console.log(JSON.stringify({url:`http://127.0.0.1:${server.address().port}`,version:VERSION,mode:'original-components-with-example-data',componentSHA256:createHash('sha256').update(html).digest('hex'),paidModelRequests:0})))
