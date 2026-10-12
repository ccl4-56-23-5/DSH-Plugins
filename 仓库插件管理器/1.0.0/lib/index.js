import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {REPO,discover,bytes,verifyPackage,compare} from './catalog.js';
export const name='dsh-repo-manager';
export const inject=['webServer','pluginManager'];
const ROOT='/repo-manager/api';
export function trusted(req){
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress))return false;
  try{const host=new URL('http://'+req.headers.host);if(!['localhost','127.0.0.1','[::1]'].includes(host.hostname)||req.headers['sec-fetch-site']==='cross-site')return false;for(const key of ['origin','referer'])if(req.headers[key]&&new URL(req.headers[key]).host!==host.host)return false;return true;}catch{return false;}
}
export function createManager(manager,{directory,load=discover,download=bytes}={}){
  mkdirSync(directory,{recursive:true});let catalog=null,checking=null,busy=false;const jobs=new Map();
  const jobsFile=join(directory,'jobs.json');
  if(existsSync(jobsFile)){try{for(const j of JSON.parse(readFileSync(jobsFile,'utf8'))){if(!['done','failed'].includes(j.status)){j.status='uncertain';j.message='宿主已重新加载，请检查本地版本后再操作。';}jobs.set(j.id,j);}}catch{/* Broken receipts never authorize a retry. */}}
  const save=()=>{const path=jobsFile+'.tmp';writeFileSync(path,JSON.stringify([...jobs.values()].slice(-40),null,2));renameSync(path,jobsFile);};
  async function refresh(){if(!checking)checking=load().then(v=>(catalog=v)).finally(()=>checking=null);return checking;}
  async function state(refreshNow=false){if(refreshNow||!catalog)await refresh();const bundles=await manager.listBundles();return {repo:REPO,...catalog,items:catalog.items.map(i=>{const b=bundles.find(b=>b.name===i.name&&b.installed!==false);let status='available';if(b){try{const c=compare(i.version,b.version);status=c>0?'update':c<0?'newer':'current';}catch{status='unknown';}}return {...i,installedVersion:b?.version||null,enabled:b?.enabled??null,status,protected:['dsh-repo-manager','dsh-control-bridge'].includes(i.name)};}),jobs:[...jobs.values()].slice(-10),busy};}
  async function execute(job,p){
    try{
      if(!catalog)await refresh();const item=catalog.items.find(i=>i.name===p.name);if(!item)throw new Error('插件不在仓库的已验证发布列表中');
      const installed=(await manager.listBundles()).find(b=>b.name===p.name&&b.installed!==false);
      if(p.action==='install'){
        if(p.version!==item.version||p.sha256!==item.sha256)throw new Error('发布版本已变化，请重新检查更新');
        if(installed&&compare(item.version,installed.version)<=0)throw new Error('本地已是同版或更新版本，无需安装');
        job.message='正在下载并校验SHA-256';save();
        const data=await download(item.url,64*1024*1024);verifyPackage(data,item);
        const path=join(directory,`${item.name}-${item.version}-${item.sha256.slice(0,16)}.tgz`);writeFileSync(path+'.tmp',data);renameSync(path+'.tmp',path);
        job.message='正在由DSH安装；请勿重复操作';save();
        const result=await manager.installBundle(path,{requestId:job.id});
        if(!['applied','restart-required','overridden'].includes(result.application))throw new Error(typeof result.error==='string'?result.error:JSON.stringify(result.error||result.application));
        // Preserve a previously disabled plugin even if the host enables an updated bundle.
        if(installed?.enabled===false)await manager.setBundleEnabled(item.name,false);
        job.application=result.application;job.message=result.application==='restart-required'?'安装完成，需重启DSH后生效':result.application==='overridden'?'安装完成，启用状态受用户配置覆盖':'安装完成';
      }else if(p.action==='enable'){
        if(!installed)throw new Error('插件尚未安装');
        if(typeof p.enabled!=='boolean')throw new Error('启用参数无效');
        if(!p.enabled&&['dsh-repo-manager','dsh-control-bridge'].includes(p.name))throw new Error('请在DSH原生插件页管理此基础插件的开关');
        const result=await manager.setBundleEnabled(p.name,p.enabled);
        if(result?.application&&!['applied','restart-required','overridden'].includes(result.application))throw new Error(JSON.stringify(result.error||result.application));
        job.application=result?.application;job.message=result?.application==='restart-required'?'状态已保存，需重启DSH':result?.application==='overridden'?'状态受用户配置覆盖':p.enabled?'已启用':'已停用';
      }else throw new Error('不支持的操作');job.status='done';
    }catch(e){job.status='failed';job.message=e.message;}finally{job.finishedAt=new Date().toISOString();busy=false;save();}
  }
  function start(p){if(typeof p.id!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(p.id))throw new Error('操作ID无效');const prior=jobs.get(p.id);const signature=JSON.stringify({action:p.action,name:p.name,version:p.version,sha256:p.sha256,enabled:p.enabled});if(prior){if(prior.signature!==signature)throw new Error('操作ID不可用于不同请求');return prior;}if(busy)throw new Error('已有插件操作进行中');busy=true;const job={id:p.id,name:p.name,status:'running',message:'准备操作',signature,startedAt:new Date().toISOString()};jobs.set(p.id,job);save();void execute(job,p);return job;}
  return {state,start,jobs};
}
export function apply(ctx){
  const manager=createManager(ctx.pluginManager,{directory:join(process.env.DSH_HOME||join(homedir(),'.dsh'),'repo-manager')});
  ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:ROOT,handler:async(req,res)=>{
    const send=(status,v)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(v));};
    try{if(!trusted(req))throw new Error('仅允许本机同源访问');const u=new URL(req.url,'http://localhost'),leaf=u.pathname.slice(ROOT.length);
      if(req.method==='GET'&&['/logo','/icon'].includes(leaf)){res.setHeader('content-type','image/png');res.end(readFileSync(new URL('./assets/'+(leaf==='/logo'?'logo':'icon')+'.png',import.meta.url)));return;}
      if(req.headers['x-dsh-repo-manager']!=='1')throw new Error('缺少客户端请求标识');
      if(req.method==='GET'&&leaf==='/state'){send(200,{ok:true,value:await manager.state(u.searchParams.get('refresh')==='1')});return;}
      if(req.method==='POST'&&leaf==='/action'){if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('需要JSON请求');let data='',size=0;for await(const c of req){size+=c.length;if(size>8192)throw new Error('请求过大');data+=c;}send(202,{ok:true,value:manager.start(JSON.parse(data))});return;}
      send(404,{ok:false,error:'接口不存在'});
    }catch(e){send(400,{ok:false,error:e.message});}
  }}));
}
