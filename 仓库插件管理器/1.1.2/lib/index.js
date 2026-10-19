import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {readCatalogCache,writeCatalogCache,normalizeCatalog,localCatalog} from './cache.js';
import {REPO,discover,bytes,verifyPackage,compare} from './catalog.js';
import {runtimeHealth,readRuntime} from './health.js';
import {checkSources,installedTarget,diagnostic} from './operations.js';
import {randomUUID} from 'node:crypto';
export const name='dsh-repo-manager';
export const inject=['webServer','pluginManager'];
const ROOT='/repo-manager/api';
export function trusted(req){
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress))return false;
  try{const host=new URL('http://'+req.headers.host);if(!['localhost','127.0.0.1','[::1]'].includes(host.hostname)||req.headers['sec-fetch-site']==='cross-site')return false;for(const key of ['origin','referer'])if(req.headers[key]&&new URL(req.headers[key]).host!==host.host)return false;return true;}catch{return false;}
}
export function createManager(manager,{directory,load=discover,download=bytes}={}){
  mkdirSync(directory,{recursive:true});
  const cacheFile=join(directory,'catalog-v1.json'),cached=readCatalogCache(cacheFile);
  let catalog=cached.catalog,cacheSource=catalog?'disk':'local',cacheWarning=cached.warning,refreshError=null,checking=null,busy=false;const jobs=new Map();
  const jobsFile=join(directory,'jobs.json');
  if(existsSync(jobsFile)){try{for(const j of JSON.parse(readFileSync(jobsFile,'utf8'))){if(!['done','failed'].includes(j.status)){j.status='uncertain';j.message='宿主已重新加载，请检查本地版本后再操作。';}jobs.set(j.id,j);}}catch{/* Broken receipts never authorize a retry. */}}
  for(const job of jobs.values())if(job.status==='failed'&&!job.detail){const info=diagnostic(job.message);job.message=info.message;job.detail=info.detail;}
  let disposed=false;
  const save=()=>{if(disposed)return;const path=jobsFile+'.'+randomUUID()+'.tmp';writeFileSync(path,JSON.stringify([...jobs.values()].slice(-40),null,2));renameSync(path,jobsFile);};
  function refresh(){
    if(!checking){
      refreshError=null;
      checking=Promise.resolve().then(load).then(value=>{
        const next=normalizeCatalog(value);
        if(next.errors.length)throw new Error('部分发布校验失败：'+next.errors.join('；'));
        catalog=next;cacheSource='memory';cacheWarning=null;
        try{writeCatalogCache(cacheFile,catalog);}catch{cacheWarning='列表已更新，但本地缓存保存失败';}
        return catalog;
      }).catch(error=>{refreshError=error.message||String(error);throw error;}).finally(()=>{checking=null;});
    }
    return checking;
  }
  async function state(refreshNow=false){
    // Opening a panel must not await GitHub. This request returns local state
    // while one shared background request refreshes the durable catalog.
    if(refreshNow)void refresh().catch(()=>{});
    const [bundles,runtime]=await Promise.all([manager.listBundles(),readRuntime(manager)]);
    let recovered=false;
    for(const job of jobs.values())if(job.status==='uncertain'||(job.status==='done'&&!job.installationVerified)){
      let target=job.target;try{target??=JSON.parse(job.signature);}catch{}
      const bundle=bundles.find(b=>b.name===job.name);
      if(installedTarget(bundle,target)){
        job.status='done';job.message='已核对安装版本与源包SHA-256，更新已完成';job.finishedAt=new Date().toISOString();job.recovered=true;job.installationVerified=true;recovered=true;
      }
    }
    if(recovered)save();
    const items=catalog?.items||localCatalog();
    return {repo:REPO,checkedAt:catalog?.checkedAt||null,errors:catalog?.errors||[],cacheSource,cacheWarning,refreshError,refreshing:!!checking,
      items:items.map(i=>{const b=bundles.find(b=>b.name===i.name&&b.installed!==false);let status=i.version?'available':'unchecked';if(b&&i.version){try{const c=compare(i.version,b.version);status=c>0?'update':c<0?'newer':'current';}catch{status='unknown';}}return {...i,installedVersion:b?.version||null,enabled:b?.enabled??null,status,health:runtimeHealth(b,runtime.plugins,status,cacheSource==='memory'&&!checking&&!refreshError,runtime.error),protected:['dsh-repo-manager','dsh-control-bridge'].includes(i.name)};}),jobs:[...jobs.values()].slice(-10),busy};
  }
  async function execute(job,p){
    try{
      if(p.action==='install')await refresh();
      const item=(catalog?.items||localCatalog()).find(i=>i.name===p.name);if(!item)throw new Error('插件不在仓库的已验证发布列表中');
      const bundles=await manager.listBundles(),installed=bundles.find(b=>b.name===p.name&&b.installed!==false);
      if(p.action==='install'){
        if(p.version!==item.version||p.sha256!==item.sha256)throw new Error('发布版本已变化，请重新检查更新');
        if(installed&&compare(item.version,installed.version)<=0)throw new Error('本地已是同版或更新版本，无需安装');
        checkSources(bundles);
        job.message='正在下载并校验SHA-256';save();
        const data=await download(item.url,64*1024*1024);verifyPackage(data,item);
        const path=join(directory,`${item.name}-${item.version}-${item.sha256.slice(0,16)}.tgz`);writeFileSync(path+'.tmp',data);renameSync(path+'.tmp',path);
        job.target={version:item.version,sha256:item.sha256,preserveDisabled:installed?.enabled===false};job.phase='installing';job.message='正在由DSH安装；请勿重复操作';save();
        const result=await manager.installBundle(path,{requestId:job.id});
        if(!['applied','restart-required','overridden'].includes(result.application)){job.phase='refused';throw new Error(JSON.stringify(result.error||result.application));}
        // Preserve a previously disabled plugin even if the host enables an updated bundle.
        if(installed?.enabled===false)await manager.setBundleEnabled(item.name,false);
        job.phase='verifying';job.message='DSH已返回，正在核对实际安装版本';save();
        const observed=(await manager.listBundles()).find(b=>b.name===item.name&&b.installed!==false);
        if(!installedTarget(observed,job.target))throw new Error('DSH返回后尚未确认目标版本与源包SHA-256；结果待核对，请勿重复安装');
        if(installed?.enabled===false&&observed.enabled!==false)throw new Error('目标版本已安装，但原停用状态未确认保留；结果待核对');
        job.installationVerified=true;
        job.application=result.application;job.message=result.application==='restart-required'?'安装完成，需重启DSH后生效':result.application==='overridden'?'安装完成，启用状态受用户配置覆盖':'安装完成';
      }else if(p.action==='enable'){
        if(!installed)throw new Error('插件尚未安装');
        if(typeof p.enabled!=='boolean')throw new Error('启用参数无效');
        if(!p.enabled&&['dsh-repo-manager','dsh-control-bridge'].includes(p.name))throw new Error('请在DSH原生插件页管理此基础插件的开关');
        const result=await manager.setBundleEnabled(p.name,p.enabled);
        if(result?.application&&!['applied','restart-required','overridden'].includes(result.application))throw new Error(JSON.stringify(result.error||result.application));
        job.application=result?.application;job.message=result?.application==='restart-required'?'状态已保存，需重启DSH':result?.application==='overridden'?'状态受用户配置覆盖':p.enabled?'已启用':'已停用';
      }else throw new Error('不支持的操作');job.status='done';
    }catch(e){const info=diagnostic(e);job.status=['installing','verifying'].includes(job.phase)?'uncertain':'failed';job.message=info.message;job.detail=info.detail;}finally{job.finishedAt=new Date().toISOString();busy=false;save();}
  }
  function start(p){if(typeof p.id!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(p.id))throw new Error('操作ID无效');const prior=jobs.get(p.id);const signature=JSON.stringify({action:p.action,name:p.name,version:p.version,sha256:p.sha256,enabled:p.enabled});if(prior){if(prior.signature!==signature)throw new Error('操作ID不可用于不同请求');return prior;}if(busy)throw new Error('已有插件操作进行中');busy=true;const job={id:p.id,name:p.name,status:'running',message:'准备操作',signature,startedAt:new Date().toISOString()};jobs.set(p.id,job);save();void execute(job,p);return job;}
  return {state,start,jobs,refresh,dispose:()=>{disposed=true;}};
}
export function apply(ctx){
  const manager=createManager(ctx.pluginManager,{directory:join(process.env.DSH_HOME||join(homedir(),'.dsh'),'repo-manager')});
  ctx.effect(()=>()=>manager.dispose());
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
