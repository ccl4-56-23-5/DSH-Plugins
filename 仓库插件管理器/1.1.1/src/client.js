window.__ModuleLoader__.load({id:'dsh-repo-manager',factory:require=>{
  const React=require('react');
  const h=React.createElement;
  const {useState,useEffect,useRef,useCallback}=React;
  const ROOT='repo-manager/api/';
  const REPO='ccl4-56-23-5/DSH-Plugins';
  const byteLength=s=>new TextEncoder().encode(s).length;
  const timestamp=v=>{const t=typeof v==='number'?v:Date.parse(v);return Number.isFinite(t)&&t>0&&t<=Date.now()+300000?t:0;};
  function releaseLink(v){try{const u=new URL(v);return u.protocol==='https:'&&u.hostname==='github.com'&&!u.username&&!u.password&&u.pathname.startsWith('/'+REPO+'/releases')?u.href:'';}catch{return '';}}
  const CACHE_KEY='dsh-repo-manager:display:v1';
  const SCHEMA=1;
  const CACHE_LIMIT=512*1024;
  const pluginIcons=__PLUGIN_ICONS__;
  const KNOWN=[
    {name:'dsh-api-switcher',title:'Api-Switcher',description:'管理API供应商、模型与连接设置，支持多协议与快速切换。'},
    {name:'dsh-top-directive',title:'最高指令',description:'保存全局初始提示词，让所有会话遵循同一套系统指令。'},
    {name:'dsh-usage-statistics-panel',title:'使用统计',description:'查看Token用量、热力图与模型使用分布。'},
    {name:'dsh-control-bridge',title:'DSH控制桥',description:'宿主API与桌面控件控制桥，向插件开放受控操作。'},
    {name:'dsh-repo-manager',title:'鲸鱼娘插件仓库',description:'从GitHub仓库安装DSH插件、检查更新与启停管理。'},
    {name:'dsh-storydeck',title:'故事中控台',description:'输入框内选择多本世界书和条目，兼容RikkaHub原生JSON，选择及剧情状态仅对当前对话生效。'}
  ];
  const META=Object.create(null);KNOWN.forEach(k=>{META[k.name]=k;});
  const STATUS={available:'未安装',update:'可更新',current:'已是最新',newer:'本地版本较新',unchecked:'待检查',unknown:'待核对',error:'校验失败'};
  const CACHE_SOURCE={disk:'磁盘缓存',memory:'内存缓存',local:'本地插件信息'};
  function isStr(v){return typeof v==='string';}
  function clean(v,max){return isStr(v)?v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,max):'';}
  function versionOf(v){if(!isStr(v))return null;const s=v.trim();return s&&!/[\s<>]/.test(s)?s.slice(0,60):null;}
  const HEALTH={red:1,yellow:1,green:1,gray:1};
  function normalizeHealth(v){
    if(!v||typeof v!=='object')return null;
    const iso=isStr(v.checkedAt)?v.checkedAt.trim():'';
    return {level:HEALTH[v.level]?v.level:'gray',label:clean(v.label,80),detail:clean(v.detail,300),checkedAt:/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(iso)?iso.slice(0,40):''};
  }
  function normalizeItem(raw){
    if(!raw||typeof raw!=='object')return null;
    const name=clean(raw.name,80);
    if(!/^dsh-[a-z0-9-]{1,100}$/.test(name))return null;
    const status=Object.prototype.hasOwnProperty.call(STATUS,raw.status)?raw.status:'unknown';
    return {health:normalizeHealth(raw.health),name:name,title:clean(raw.title,80)||name,description:clean(raw.description,300),installedVersion:versionOf(raw.installedVersion),version:versionOf(raw.version),status:status,enabled:raw.enabled===true,protected:raw.protected===true,releaseURL:releaseLink(raw.releaseURL),notes:clean(raw.notes,4000),sha256:clean(raw.sha256,64)};
  }
  function normalizeJob(j){return j&&typeof j==='object'?{id:String(j.id||''),name:clean(j.name,80),status:['running','done','failed','uncertain'].includes(j.status)?j.status:'uncertain',message:clean(j.message,1200),detail:clean(j.detail,24000)}:null;}
  function titleOf(i){return (META[i.name]&&META[i.name].title)||i.title||i.name;}
  function descOf(i){return (META[i.name]&&META[i.name].description)||i.description||'';}
  function normalizeSnapshot(v){
    if(!v||typeof v!=='object'||Array.isArray(v)||v.repo!==REPO)throw new Error('仓库状态格式不正确');
    const items=Array.isArray(v.items)?v.items.map(normalizeItem).filter(Boolean).slice(0,80):[];
    const jobs=Array.isArray(v.jobs)?v.jobs.map(normalizeJob).filter(Boolean).slice(-20):[];
    return {repo:clean(v.repo,200),items:items,checkedAt:timestamp(v.checkedAt),errors:Array.isArray(v.errors)?v.errors.map(e=>clean(e,300)).filter(Boolean).slice(0,20):[],jobs:jobs,busy:v.busy===true,refreshing:v.refreshing===true,refreshError:clean(v.refreshError,400),cacheSource:isStr(v.cacheSource)?v.cacheSource:'',cacheWarning:clean(v.cacheWarning,400)};
  }
  function presetSnapshot(){
    return {repo:'',checkedAt:0,source:'preset',items:KNOWN.map(k=>({name:k.name,title:k.title,description:k.description,installedVersion:null,version:null,status:'unchecked',enabled:false,protected:false,releaseURL:'',notes:'',sha256:''})),errors:[],jobs:[],busy:false,refreshing:false,refreshError:'',cacheSource:'',cacheWarning:''};
  }
  function readCache(){
    try{
      const raw=typeof localStorage!=='undefined'?localStorage.getItem(CACHE_KEY):null;
      if(!raw||byteLength(raw)>CACHE_LIMIT)return null;
      const snap=JSON.parse(raw);
      if(!snap||snap.schema!==SCHEMA||snap.repo!==REPO)return null;
      if(!Array.isArray(snap.items))return null;
      const items=snap.items.map(normalizeItem).filter(Boolean).slice(0,80);
      if(!items.length)return null;
      const ts=timestamp(snap.checkedAt);
      return {repo:snap.repo.slice(0,200),checkedAt:Number.isFinite(ts)&&ts>0?ts:0,source:'local',items:items,errors:[],jobs:[],busy:false,refreshing:false,refreshError:'',cacheSource:isStr(snap.source)?snap.source:'local',cacheWarning:''};
    }catch(e){return null;}
  }
  function writeCache(snap){
    if(!snap||!snap.repo||!Array.isArray(snap.items)||!snap.items.length)return;
    try{
      const payload={schema:SCHEMA,repo:snap.repo.slice(0,200),checkedAt:snap.checkedAt||0,source:snap.cacheSource||'disk',items:snap.items.slice(0,60).map(i=>({name:i.name,title:i.title,description:i.description,installedVersion:i.installedVersion,version:i.version,status:i.status,enabled:i.enabled,protected:i.protected,releaseURL:i.releaseURL,notes:i.notes.slice(0,1200),sha256:i.sha256}))};
      let text=JSON.stringify(payload);
      if(byteLength(text)>CACHE_LIMIT){payload.items=payload.items.map(i=>({...i,notes:''}));text=JSON.stringify(payload);}
      if(byteLength(text)<=CACHE_LIMIT)localStorage.setItem(CACHE_KEY,text);
    }catch(e){}
  }
  function stamp(ts){if(!ts)return '';try{return new Date(ts).toLocaleString('zh-CN',{hour12:false});}catch(e){return new Date(ts).toISOString();}}
  const css=`.wrm{--acc:#0e86a3;--acc2:rgba(14,134,163,.13);--line:rgba(120,130,140,.28);--soft:rgba(120,130,140,.08);box-sizing:border-box;height:100%;overflow:auto;padding:26px clamp(16px,4vw,52px) 42px;font:14px/1.65 inherit;color:var(--color-text-primary,inherit)}.wrm *{box-sizing:border-box}.wrm .hero{display:flex;align-items:center;gap:20px;margin-bottom:22px}.wrm .hero-logo{width:96px;height:96px;object-fit:contain;flex:0 0 auto}.wrm h1{font-size:26px;line-height:1.25;margin:0 0 6px;letter-spacing:-.2px}.wrm .hero p{margin:0;font-size:13px;opacity:.7}.wrm a{color:var(--acc);text-decoration:none}.wrm a:hover{text-decoration:underline}.wrm .bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:18px 0 12px}.wrm button,.wrm input,.wrm select{font:inherit;color:inherit;border:1px solid var(--line);border-radius:10px;background:transparent;padding:8px 12px;min-height:38px}.wrm button{cursor:pointer;transition:background .15s,border-color .15s}.wrm button:hover:enabled{background:var(--acc2);border-color:var(--acc)}.wrm button:disabled{opacity:.5;cursor:not-allowed}.wrm button.primary{background:var(--acc);border-color:transparent;color:#fff}.wrm button.primary:hover:enabled{background:var(--acc);border-color:transparent;filter:brightness(1.08)}.wrm .search{flex:1 1 220px;min-width:0}.wrm .search input{width:100%}.wrm .chip{border:1px solid var(--line);border-radius:20px;padding:2px 10px;opacity:.8;background:var(--soft);font-size:12px}.wrm .muted{font-size:12px;opacity:.65}.wrm .summary{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 16px}.wrm .summary div{flex:1 1 130px;min-width:0;border:1px solid var(--line);border-radius:12px;background:var(--soft);padding:10px 14px}.wrm .summary b{display:block;font-size:22px;line-height:1.2}.wrm .summary span{font-size:12px;opacity:.7}.wrm .notice{border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:10px 0;background:var(--soft);overflow-wrap:anywhere;white-space:pre-wrap;font-size:13px}.wrm .notice.error{border-color:rgba(210,80,80,.55);background:rgba(210,80,80,.1)}.wrm .notice.warn{border-color:rgba(200,140,40,.55);background:rgba(200,140,40,.1)}.wrm .statusline{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:12px;opacity:.75;margin:8px 0 4px}.wrm .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(310px,100%),1fr));gap:16px;margin-top:16px}.wrm article{display:flex;flex-direction:column;gap:10px;border:1px solid var(--line);border-radius:16px;background:var(--soft);padding:18px;min-width:0;transition:border-color .15s}.wrm article:hover{border-color:var(--acc)}.wrm .head{display:flex;gap:12px;align-items:center;min-width:0}.wrm .icon{width:56px;height:56px;flex:0 0 56px;object-fit:contain;background:transparent}.wrm .head .meta{min-width:0}.wrm h2{font-size:17px;line-height:1.35;margin:0;overflow-wrap:anywhere}.wrm .pkg{font-size:11.5px;opacity:.55;overflow-wrap:anywhere}.wrm .desc{margin:0;font-size:13px;opacity:.82}.wrm .tag{align-self:flex-start;font-size:11.5px;border-radius:20px;padding:2px 10px;background:rgba(120,130,140,.16);border:1px solid transparent}.wrm .tag.update{background:var(--acc2);color:var(--acc);border-color:rgba(14,134,163,.35)}.wrm .tag.current{background:rgba(46,160,96,.14)}.wrm .tag.available{background:rgba(46,120,200,.14)}.wrm .versions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0}.wrm .versions div{min-width:0;border:1px solid var(--line);border-radius:10px;padding:8px 10px}.wrm .versions small{display:block;font-size:11px;opacity:.6}.wrm .versions strong{font-size:13px;font-weight:600;overflow-wrap:anywhere}.wrm .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:4px}.wrm .actions button,.wrm .actions a.link{flex:0 0 auto;min-height:34px;padding:6px 12px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center}.wrm .actions a.link{border:1px solid var(--line);font-size:13px}.wrm details{margin-top:2px}.wrm summary{cursor:pointer;font-size:12.5px;opacity:.75}.wrm pre{margin:8px 0 0;white-space:pre-wrap;word-break:break-word;font:inherit;font-size:12.5px;max-height:220px;overflow:auto;opacity:.9}.wrm .jobs{display:grid;gap:8px}.wrm .job{display:flex;gap:10px;align-items:flex-start;font-size:12.5px}.wrm .job .dot{width:8px;height:8px;border-radius:50%;background:#2ea060;margin-top:7px;flex:0 0 8px}.wrm .job.failed .dot{background:#d25656}.wrm .dialog{border:1px solid var(--acc);border-radius:16px;padding:18px;margin:14px 0;background:var(--acc2)}.wrm .dialog h3{margin:0 0 6px;font-size:16px}.wrm .dialog p{margin:4px 0;font-size:13px;overflow-wrap:anywhere}.wrm .dialog .actions{margin-top:12px}.wrm footer{margin-top:30px;font-size:12px;opacity:.55;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center}.wrm :focus-visible{outline:2px solid var(--acc);outline-offset:2px}@media (prefers-color-scheme:dark){.wrm{--acc:#45bcd8;--acc2:rgba(69,188,216,.16);--line:rgba(150,165,180,.26);--soft:rgba(150,165,180,.09)}.wrm button.primary{color:#04222b}}@media (max-width:560px){.wrm{padding:18px 14px 32px}.wrm .hero{gap:14px}.wrm .hero-logo{width:64px;height:64px}.wrm h1{font-size:21px}.wrm .bar>*{flex:1 1 100%}.wrm .search{flex-basis:100%}.wrm .actions button,.wrm .actions a.link{flex:1 1 auto}.wrm .versions{grid-template-columns:1fr}}`;
  const HEALTH_TEXT={red:'运行异常',yellow:'正常·待更新',green:'正常·最新',gray:'待检测'};
  function displayHealth(item,ctx){
    const raw=item.health||null;
    const when=raw&&raw.checkedAt?stamp(new Date(raw.checkedAt).getTime()):'';
    const detail=[raw&&raw.detail||'',when?'检测于 '+when:''].filter(Boolean).join(' · ');
    if(!ctx.live||!ctx.trusted)return {level:'gray',label:'待检测',detail:'尚未从后端读回真实运行状态，缓存中的颜色不作为依据'};
    if(raw&&raw.level==='red')return {level:'red',label:raw.label||HEALTH_TEXT.red,detail:detail||'宿主运行时报告异常'};
    if(!raw)return {level:'gray',label:'状态未知',detail:'后端未提供运行状态'};
    if(ctx.refreshing&&(raw.level==='green'||raw.level==='yellow'))return {level:'gray',label:'刷新中',detail:'仓库正在后台刷新，颜色暂缓确认'+(detail?' · '+detail:'')};
    return {level:HEALTH[raw.level]?raw.level:'gray',label:raw.label||HEALTH_TEXT[raw.level]||HEALTH_TEXT.gray,detail:detail};
  }
  function TrafficLight({health}){
    const bulbs=['red','yellow','green'];
    return h('div',{className:'tl tl-'+health.level,role:'group','aria-label':'运行状态：'+health.label,title:health.label+(health.detail?' — '+health.detail:'')},
      h('span',{className:'bulbs','aria-hidden':'true'},bulbs.map(b=>h('i',{key:b,className:'bulb '+b+(b===health.level?' on':'')}))),
      h('span',{className:'tl-text'},HEALTH_TEXT[health.level]?health.label:health.label),
      health.detail&&h('details',{className:'tl-detail'},h('summary',null,'原因'),h('p',null,health.detail)));
  }
  function PluginIcon(props){
    const [failed,setFailed]=useState(false);
    const src=pluginIcons&&pluginIcons[props.name];
    if(src&&!failed)return h('img',{className:'plugin-icon icon',src:src,alt:props.title+'图标',width:56,height:56,loading:'lazy',onError:()=>setFailed(true)});
    return h('svg',{className:'icon',viewBox:'0 0 64 64',role:'img','aria-label':props.title+'默认图标'},h('rect',{x:6,y:6,width:52,height:52,rx:14,fill:'rgba(14,134,163,.16)'}),h('path',{d:'M18 24L32 16L46 24V40L32 48L18 40ZM18 24L32 32L46 24M32 32V48',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinejoin:'round',strokeLinecap:'round'}));
  }
  function Panel(){
    const [view,setView]=useState(()=>readCache()||presetSnapshot());
    const [live,setLive]=useState(false);
    const [checking,setChecking]=useState(false);
    const [error,setError]=useState('');
    const [notice,setNotice]=useState('');
    const [query,setQuery]=useState('');
    const [filter,setFilter]=useState('all');
    const [confirm,setConfirm]=useState(null);
    const [sending,setSending]=useState(false);
    const alive=useRef(true),seq=useRef(0),ctrl=useRef(null);
    const load=useCallback(async refresh=>{
      if(ctrl.current&&!refresh)return;
      const my=++seq.current;
      if(ctrl.current)ctrl.current.abort();
      const ac=typeof AbortController!=='undefined'?new AbortController():null;
      ctrl.current=ac;
      let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;ac?.abort();},20000);
      if(refresh)setChecking(true);
      try{
        const r=await fetch(ROOT+'state'+(refresh?'?refresh=1':''),{headers:{'x-dsh-repo-manager':'1'},...(ac?{signal:ac.signal}:{})});
        const body=await r.json().catch(()=>null);
        if(!alive.current||my!==seq.current)return;
        if(!r.ok||!body||body.ok!==true)throw new Error(clean(body&&body.error,300)||('请求失败（HTTP '+r.status+'）'));
        const snap=normalizeSnapshot(body.value);
        setView(prev=>{
          const items=snap.items.length?snap.items:prev.items;
          const warn=snap.items.length?snap.cacheWarning:(snap.cacheWarning||'仓库暂未返回可验证的插件列表，保留已显示卡片');
          return {...snap,items:items,source:'network',cacheWarning:warn,healthTrusted:snap.items.length>0};
        });
        setLive(true);
        setError('');
        if(snap.items.length)writeCache(snap);
      }catch(e){
        if(!alive.current||my!==seq.current)return;
        if(e&&e.name==='AbortError'&&!timedOut)return;
        setLive(false);
        setError('无法获取仓库状态：'+(e&&e.message?e.message:'网络错误')+'。已保留当前显示的插件信息，可稍后重试。');
        setView(prev=>({...prev,refreshing:false,busy:false}));
      }finally{
        clearTimeout(timeout);
        if(my===seq.current)ctrl.current=null;
        if(alive.current&&my===seq.current)setChecking(false);
      }
    },[]);
    useEffect(()=>{alive.current=true;load(true);return ()=>{alive.current=false;seq.current++;if(ctrl.current)ctrl.current.abort();};},[load]);
    useEffect(()=>{
      if(!live||error)return;
      const id=setInterval(()=>{load(false);},view.refreshing||view.busy?1000:10000);
      return ()=>clearInterval(id);
    },[view.refreshing,view.busy,live,error,load]);
    async function act(){
      if(!confirm||!live)return;
      setSending(true);setNotice('');
      try{
        const r=await fetch(ROOT+'action',{method:'POST',headers:{'x-dsh-repo-manager':'1','content-type':'application/json'},body:JSON.stringify(confirm.payload)});
        const body=await r.json().catch(()=>null);
        if(!r.ok||!body||body.ok!==true)throw new Error(clean(body&&body.error,300)||'操作提交失败');
        setNotice(confirm.payload.action==='install'?'已提交安装／更新任务；执行前会重新核对远端版本。':'已提交启用状态变更。');
        setConfirm(null);
        load(false);
      }catch(e){setNotice('操作失败：'+(e&&e.message?e.message:'网络错误'));}
      finally{setSending(false);}
    }
    function openConfirm(i,action){
      const enabled=action==='enable'?true:action==='disable'?false:i.enabled;
      const payload={id:(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'op-'+Date.now()),name:i.name,action:action==='disable'?'enable':action,enabled:enabled};
      if(action==='install'){payload.version=i.version;payload.sha256=i.sha256;}
      setConfirm({title:titleOf(i),payload:payload});
    }
    const items=view.items||[];
    const updates=items.filter(i=>i.status==='update');
    const installed=items.filter(i=>i.installedVersion);
    const trust=live&&!error&&!view.refreshing&&!view.refreshError&&view.source==='network'&&view.cacheSource==='memory';
    const healthCtx={live:live,trusted:view.healthTrusted===true,refreshing:!!view.refreshing};
    const canAct=live&&!error&&!sending&&!view.busy;
    const q=query.trim().toLowerCase();
    const shown=items.filter(i=>{if(filter==='installed')return !!i.installedVersion;if(filter==='updates')return i.status==='update';if(filter==='enabled')return i.enabled;return true;}).filter(i=>!q||(i.name+' '+titleOf(i)+' '+descOf(i)+' '+(i.description||'')).toLowerCase().includes(q));
    const jobs=(view.jobs||[]).slice(-8).reverse();
    const checked=view.checkedAt?stamp(view.checkedAt):'尚未完成检查';
    let line='正在获取最新状态…';
    if(error)line='连接失败，已保留现有卡片';
    else if(view.refreshing)line='正在后台更新仓库信息…';
    else if(view.refreshError)line='后台刷新未完成：'+view.refreshError;
    else if(live)line='状态已同步';
    function tagOf(i){
      if(i.status==='current'&&!trust)return {cls:'',label:'待核对'};
      if(i.status==='update')return {cls:'update',label:'可更新'};
      if(i.status==='current')return {cls:'current',label:'已是最新'};
      if(i.status==='available')return {cls:'available',label:'未安装'};
      if(i.status==='newer')return {cls:'',label:'本地版本较新'};
      if(i.status==='error')return {cls:'',label:'校验失败'};
      return {cls:'',label:'待检查'};
    }
    return h('section',{className:'wrm','aria-label':'鲸鱼娘插件仓库'},
      h('style',null,css+".wrm .tl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;border:1px solid var(--line);border-radius:10px;padding:5px 10px;background:var(--soft);min-width:0}.wrm .tl .bulbs{display:flex;gap:4px;flex:0 0 auto}.wrm .tl .bulb{width:9px;height:9px;border-radius:50%;background:rgba(128,136,144,.28)}.wrm .tl .bulb.red{--c:#d25656}.wrm .tl .bulb.yellow{--c:#d9a02b}.wrm .tl .bulb.green{--c:#2ea060}.wrm .tl .bulb.gray{--c:#9aa3ac}.wrm .tl .bulb.on{background:var(--c);box-shadow:0 0 7px var(--c)}.wrm .tl-text{font-weight:600;overflow-wrap:anywhere}.wrm .tl-red .tl-text{color:#d25656}.wrm .tl-yellow .tl-text{color:#c08a1e}.wrm .tl-green .tl-text{color:#2ea060}.wrm .tl-gray .tl-text{opacity:.72}.wrm .tl-detail{flex:1 1 100%;margin:0}.wrm .tl-detail summary{font-size:11.5px}.wrm .tl-detail p{margin:6px 0 0;font-size:12px;opacity:.8;white-space:pre-wrap;overflow-wrap:anywhere}"),
      h('style',null,'.wrm .job.running .dot{background:#2188c9}.wrm .job.uncertain .dot{background:#c58a22}.wrm .job.done .dot{background:#2ea060}.wrm .job{overflow-wrap:anywhere}.wrm .job details{max-width:100%}'),
      h('header',{className:'hero'},
        h('img',{className:'hero-logo',src:ROOT+'logo',alt:'鲸鱼娘正面推购物车logo'}),
        h('div',null,
          h('h1',null,'鲸鱼娘插件仓库'),
          h('p',null,'你的插件，集中管理。缓存优先显示，后台静默核对更新。'),
          h('a',{href:'https://github.com/ccl4-56-23-5/DSH-Plugins',target:'_blank',rel:'noreferrer'},'ccl4-56-23-5 / DSH-Plugins ↗'))),
      h('div',{className:'summary'},
        h('div',null,h('b',null,items.length),h('span',null,'个插件')),
        h('div',null,h('b',null,installed.length),h('span',null,'已安装')),
        h('div',null,h('b',null,updates.length),h('span',null,'可更新'))),
      h('div',{className:'bar'},
        h('div',{className:'search'},h('input',{type:'search','aria-label':'搜索仓库插件',placeholder:'搜索插件名称或功能…',value:query,onChange:e=>setQuery(e.target.value)})),
        h('select',{'aria-label':'筛选插件',value:filter,onChange:e=>setFilter(e.target.value)},
          h('option',{value:'all'},'全部插件'),
          h('option',{value:'installed'},'已安装'),
          h('option',{value:'updates'},'可更新'),
          h('option',{value:'enabled'},'已启用')),
        h('button',{className:'primary',disabled:checking||view.refreshing||view.busy||sending,onClick:()=>load(true)},view.refreshing?'正在后台更新…':checking?'正在检查…':'检测状态与更新')),
      h('div',{className:'statusline',role:'status','aria-live':'polite'},
        h('span',null,line),
        h('span',null,'上次检查：'+checked),
        view.cacheSource&&h('span',{className:'chip'},view.source==='local'?'浏览器缓存':CACHE_SOURCE[view.cacheSource]||'缓存快照'),
        !live&&h('span',{className:'chip'},'操作待状态同步后开放')),
      error&&h('div',{className:'notice error',role:'alert'},error,h('div',{className:'actions'},h('button',{onClick:()=>load(true),disabled:checking},checking?'重试中…':'重试'))),
      notice&&h('div',{className:'notice',role:'status'},notice),
      view.cacheWarning&&h('div',{className:'notice warn'},view.cacheWarning),
      view.errors&&view.errors.length>0&&h('details',{className:'notice warn'},h('summary',null,'部分发布无法验证（'+view.errors.length+'）'),h('pre',null,view.errors.join('\n'))),
      confirm&&h('div',{className:'dialog',role:'dialog','aria-label':'确认插件操作'},
        h('h3',null,confirm.payload.action==='install'?'确认安装／更新':'确认更改启用状态'),
        h('p',null,confirm.title),
        h('p',null,confirm.payload.action==='install'?'目标版本：'+(confirm.payload.version||'待检查')+'；来源：指定GitHub仓库的Release，执行前重新校验。':confirm.payload.enabled?'启用此插件。':'停用此插件，保留用户配置。'),
        h('p',null,'由DSH执行，保留现有配置；如需重启将明确提示。'),
        h('div',{className:'actions'},
          h('button',{className:'primary',disabled:sending||!canAct,onClick:act},sending?'正在提交…':'确认执行'),
          h('button',{disabled:sending,onClick:()=>setConfirm(null)},'取消'))),
      jobs.length>0&&h('details',{className:'notice',open:true},
        h('summary',null,'最近操作'),
        h('div',{className:'jobs'},jobs.map(j=>h('div',{key:j.id||j.name+j.message,className:'job '+j.status},
          h('span',{className:'dot'}),
          h('div',null,h('span',null,({running:'进行中 · ',done:'完成 · ',failed:'失败 · ',uncertain:'待核对 · '}[j.status]||'待核对 · ')+(META[j.name]&&META[j.name].title||j.name||'插件')+'：'+(j.message||'结果待核对')),j.detail&&h('details',null,h('summary',null,'完整诊断'),h('pre',null,j.detail))))))),
      h('div',{className:'grid'},
        shown.map(i=>{
          const tag=tagOf(i);
          return h('article',{key:i.name,'data-plugin':i.name,'data-status':i.status},
            h('div',{className:'head'},
              h(PluginIcon,{name:i.name,title:titleOf(i)}),
              h('div',{className:'meta'},h('h2',null,titleOf(i)),h('div',{className:'pkg'},i.name))),
            h('span',{className:'tag '+tag.cls},tag.label),
            h(TrafficLight,{health:displayHealth(i,healthCtx)}),
            h('p',{className:'desc'},descOf(i)||'暂无描述'),
            h('div',{className:'versions'},
              h('div',null,h('small',null,'本地版本'),h('strong',null,i.installedVersion||(live?'未安装':'待确认'))),
              h('div',null,h('small',null,trust?'仓库最新版':'仓库版本'),h('strong',null,i.version||'待检查'))),
            i.protected&&h('span',{className:'chip'},'受保护插件'),
            h('div',{className:'actions'},
              (i.status==='available'||i.status==='update')&&h('button',{className:'primary',disabled:!canAct||!i.version,title:!live?'状态同步后可操作':'',onClick:()=>openConfirm(i,'install')},i.status==='update'?'更新插件':'安装插件'),
              i.installedVersion&&!i.protected&&h('button',{disabled:!canAct,onClick:()=>openConfirm(i,i.enabled?'disable':'enable')},i.enabled?'停用':'启用'),
              i.releaseURL&&h('a',{className:'link',href:i.releaseURL,target:'_blank',rel:'noreferrer'},'查看发布 ↗')),
            h('details',null,h('summary',null,'发布说明'),h('pre',null,i.notes||'此发布未提供发布说明。')));
        })),
      shown.length===0&&h('p',{className:'muted'},items.length?'没有匹配当前搜索／筛选的插件。':'仓库暂未提供可验证的安装发布。'),
      h('footer',null,
        h('span',null,'仓库管理器 1.1.1'),
        h('span',null,'仅管理此仓库的DSH插件'),
        h('span',null,'下载后校验 SHA-256')));
  }
  function Icon(){return h('svg',{width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,role:'img','aria-label':'仓库'} ,h('path',{d:'M3 7h18M5 7v12a1 1 0 001 1h12a1 1 0 001-1V7M9 11h6',strokeLinecap:'round',strokeLinejoin:'round'}),h('path',{d:'M8 7l1.4-3h5.2L16 7',strokeLinecap:'round',strokeLinejoin:'round'}));}
  return {name:'dsh-repo-manager-ui',inject:['slots'],apply(ctx){
    ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',key:'dsh-repo-manager'},Panel));
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'whale-repo-manager'},Panel));
    ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'whale-repo-manager',order:31,label:()=> '鲸鱼娘插件仓库'},Icon));
  }};
}});
