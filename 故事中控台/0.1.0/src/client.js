window.__ModuleLoader__.load({id:'dsh-storydeck',factory:require=>{
  const React=require('react'),h=React.createElement,{useState,useEffect}=React;
  const ROOT='storydeck/api/';
  async function api(leaf,body) {
    const r=await fetch(ROOT+leaf,{method:body?'POST':'GET',headers:{'x-storydeck':'1',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const out=await r.json();if(!r.ok||!out.ok)throw new Error(out.error||'请求失败');return out.value;
  }
  const uid=()=>crypto.randomUUID();
  const pretty=v=>JSON.stringify(v,null,2);
  function Panel() {
    const [data,setData]=useState(null),[storyId,setStoryId]=useState(''),[bookText,setBookText]=useState(''),[query,setQuery]=useState(''),[preview,setPreview]=useState(null),[tab,setTab]=useState('state'),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[sessions,setSessions]=useState([]),[session,setSession]=useState(''),[patch,setPatch]=useState('{}'),[source,setSource]=useState('');
    const [storyTitle,setStoryTitle]=useState(''),[bookId,setBookId]=useState('');
    const [draft,setDraft]=useState({}),[known,setKnown]=useState([]);
    const refresh=async()=>{const d=await api('state');setData(d);setStoryId(old=>d.stories[old]?old:Object.keys(d.stories)[0]||'');setBookId(old=>d.books[old]?old:Object.keys(d.books)[0]||'');return d;};
    useEffect(()=>{refresh().catch(e=>setError(e.message));api('sessions').then(v=>{const items=v.items||v.sessions||[];setSessions(Array.isArray(items)?items:[]);}).catch(()=>{});},[]);
    const story=data?.stories[storyId],book=story&&data.books[story.bookId];
    useEffect(()=>{if(story){setDraft(structuredClone(story.state));setKnown([...story.knownIds]);}},[story?.id,story?.revision]);
    async function run(fn) {if(busy)return;setBusy(true);setError('');setMessage('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}}
    async function action(kind,args) {const v=await api('action',{action:kind,revision:data.revision,requestId:uid(),...args});await refresh();setPreview(null);setMessage('已保存');return v;}
    const button=(label,fn,primary=false)=>h('button',{type:'button',disabled:busy,onClick:()=>run(fn),className:primary?'primary':''},label);
    const options=(items,key,label)=>items.map(v=>h('option',{key:key(v),value:key(v)},label(v)));
    const textArea=(label,value,set,rows=8)=>h('label',null,label,h('textarea',{value,onChange:e=>set(e.target.value),rows,spellCheck:false}));
    function download() {const blob=new Blob([pretty(data)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='storydeck-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(!data)return h('div',{className:'sd'},h('p',null,error||'正在读取本地世界书…'));
    return h('div',{className:'sd'},
      h('style',null,'.sd{padding:24px;max-width:1100px;margin:0 auto;line-height:1.6;color:inherit}.sd *{box-sizing:border-box}.sd header{display:flex;gap:18px;align-items:center;margin-bottom:20px}.sd .logo{width:88px;height:88px;object-fit:contain}.sd h1{font-size:25px;margin:0}.sd h2{font-size:18px;margin:20px 0 10px}.sd p{margin:8px 0}.sd .sub{opacity:.7}.sd nav,.sd .actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.sd button,.sd input,.sd select,.sd textarea{font:inherit;color:inherit;border:1px solid rgba(140,150,170,.4);border-radius:8px;padding:8px 12px;background:transparent}.sd button{cursor:pointer}.sd button.primary,.sd button[aria-selected=true]{background:rgba(80,160,205,.18);border-color:rgba(80,160,205,.6)}.sd button:disabled{opacity:.5;cursor:default}.sd label{display:block;margin:12px 0}.sd label>input,.sd label>select,.sd textarea{display:block;width:100%;margin-top:5px}.sd textarea{resize:vertical;font-family:ui-monospace,Consolas,monospace}.sd .row{display:flex;gap:12px;flex-wrap:wrap;align-items:end}.sd .row>label{flex:1;min-width:180px}.sd .notice{border-left:3px solid currentColor;padding:8px 12px}.sd .error{color:#d75d5d}.sd pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;background:rgba(140,150,170,.09);border-radius:8px}.sd article{border-bottom:1px solid rgba(140,150,170,.3);padding:12px 0}.sd article h3{margin:0 0 5px;font-size:16px}.sd .rule{display:flex;justify-content:space-between;gap:12px;padding:6px 0}.sd small{opacity:.75}.sd :focus-visible{outline:2px solid currentColor;outline-offset:2px}@media(max-width:560px){.sd{padding:16px}.sd header{gap:12px}.sd .logo{width:64px;height:64px}.sd h1{font-size:21px}}'),
      h('style',null,'.sd input[type=checkbox]{width:auto;display:inline-block;margin-right:8px}'),
      h('header',null,h('img',{className:'logo',src:ROOT+'logo',alt:'故事中控台Logo',width:88,height:88}),h('div',null,h('h1',null,'故事中控台'),h('div',{className:'sub'},'StoryDeck · 世界书调度器 0.1.0'))),
      h('nav',{'aria-label':'中控台页面'},...['state','book','retrieve','events'].map((t,i)=>h('button',{key:t,type:'button','aria-selected':tab===t,onClick:()=>setTab(t)},['剧情状态','世界书','检索预览','事件记录'][i]))),
      error&&h('p',{className:'notice error',role:'alert'},error),message&&h('p',{className:'notice',role:'status'},message),
      h('div',{className:'row'},h('label',null,'当前剧情 / 分支',h('select',{value:storyId,onChange:e=>{setStoryId(e.target.value);setPreview(null);setPatch('{}');}},h('option',{value:''},'请选择'),...options(Object.values(data.stories),v=>v.id,v=>v.title+' · '+v.id))),button('刷新',refresh),button('导出本地备份',async()=>download())),
      tab==='book'&&h('section',null,
        h('h2',null,'底层世界书'),
        h('p',{className:'sub'},'设定由作者编辑。DSH工具只读取条目和修改剧情状态。已关联剧情的世界书请另存新ID，避免规则静默变化。'),
        h('div',{className:'actions'},button('载入修真示例',async()=>setBookText(pretty(await api('example')))),...Object.values(data.books).map(b=>button('编辑：'+b.title,async()=>setBookText(pretty(b))))),
        h('label',null,'导入世界书JSON',h('input',{type:'file',accept:'.json,application/json',onChange:e=>{const f=e.target.files[0];if(f){if(f.size>4*1024*1024)setError('文件超过4MiB');else f.text().then(setBookText).catch(x=>setError(x.message));}}})),
        textArea('世界书JSON：字段、初始状态、条目、触发条件',bookText,setBookText,20),
        button('保存世界书',()=>action('saveBook',{book:JSON.parse(bookText)}),true),
        h('p',{className:'sub'},'visibility：public=规则允许即可读取；known=还需剧情已知；author=作者隐藏。always不绕过条件。枚举顺序决定gte/lte范围。')),
      tab==='state'&&h('section',null,
        h('h2',null,'创建剧情'),
        h('div',{className:'row'},h('label',null,'世界书',h('select',{value:bookId,onChange:e=>setBookId(e.target.value)},h('option',{value:''},'先保存世界书'),...options(Object.values(data.books),v=>v.id,v=>v.title))),h('label',null,'剧情名称',h('input',{value:storyTitle,onChange:e=>setStoryTitle(e.target.value),placeholder:'例如：主线 · 第一卷'}))),
        button('创建剧情',()=>action('createStory',{id:uid(),title:storyTitle,bookId}),true),
        story&&h('div',null,h('h2',null,'状态与会话关联'),h('pre',null,pretty(story.state)),
          h('small',null,'状态版本 '+story.revision+' · 世界书 '+book.title+' · 已知条目 '+story.knownIds.join('、')),
          h('label',null,'DSH会话ID',h('input',{value:session,onChange:e=>setSession(e.target.value),list:'sd-sessions',placeholder:'选择下方已有会话，或粘贴会话ID'})),
          h('datalist',{id:'sd-sessions'},...sessions.map(s=>h('option',{key:s.id||s.sessionId,value:s.id||s.sessionId},s.title||s.name||s.id||s.sessionId))),
          h('div',{className:'actions'},button('关联此会话',()=>action('bind',{sessionId:session,storyId}),true),button('解除此会话关联',()=>action('unbind',{sessionId:session}))),
          h('p',{className:'sub'},'已关联：'+Object.entries(data.bindings).filter(([,v])=>v===storyId).map(([k])=>k).join('、')),
          h('h2',null,'记录事件 / 修正状态'),
          ...book.fields.map(f=>h('label',{key:f.key},f.label,
            f.type==='enum'?h('select',{value:draft[f.key]??'',onChange:e=>setDraft(v=>({...v,[f.key]:e.target.value}))},...f.values.map(v=>h('option',{key:v,value:v},v))):
            f.type==='boolean'?h('input',{type:'checkbox',checked:!!draft[f.key],onChange:e=>setDraft(v=>({...v,[f.key]:e.target.checked}))}):
            h('input',{type:f.type==='number'?'number':'text',value:f.type==='tags'?(draft[f.key]||[]).join('、'):(draft[f.key]??''),onChange:e=>setDraft(v=>({...v,[f.key]:f.type==='number'?Number(e.target.value):f.type==='tags'?e.target.value.split(/[、,，]/).map(s=>s.trim()).filter(Boolean):e.target.value}))}))),
          h('details',null,h('summary',null,'角色已经知晓的条目'),...book.entries.filter(e=>e.visibility==='known').map(e=>h('label',{key:e.id},h('input',{type:'checkbox',checked:known.includes(e.id),onChange:event=>setKnown(v=>event.target.checked?[...v,e.id]:v.filter(id=>id!==e.id))}),e.title))),
          textArea('已发生事件的来源正文',source,setSource,3),
          button('保存状态事件',()=>action('commit',{storyId,event:{expectedStateRevision:story.revision,certainty:'confirmed',summary:'作者在中控台记录状态变化',source,patch:draft,knownIds:known}})),
          h('details',null,h('summary',null,'高级：直接提交状态JSON'),textArea('状态变更JSON（仅写变更字段）',patch,setPatch,5),button('提交JSON事件',()=>action('commit',{storyId,event:{expectedStateRevision:story.revision,certainty:'confirmed',summary:'作者提交状态JSON',source,patch:JSON.parse(patch)}}))),
          button('从当前状态创建分支',()=>action('forkStory',{sourceId:storyId,id:uid(),title:story.title+' · 分支'})),
          h('p',{className:'sub'},'关联后，DSH可使用storydeck_context与storydeck_commit自动读取及更新；来源为DSH报告的正文，不代表插件能独立判断剧情真伪。'))),
      tab==='retrieve'&&h('section',null,h('h2',null,'本轮可读取什么'),
        h('label',null,'场景 / 设定查询',h('input',{value:query,onChange:e=>setQuery(e.target.value),placeholder:'例如：筑基 御剑 青云宗'})),
        button('预览检索',async()=>setPreview(await api('preview?storyId='+encodeURIComponent(storyId)+'&query='+encodeURIComponent(query))),true),
        preview&&h('div',null,h('p',null,'返回 '+preview.entries.length+' 条 · 正文预算使用 '+preview.usedChars+' 字符'),
          ...preview.entries.map(e=>h('article',{key:e.id},h('h3',null,e.title),h('small',null,e.reason),h('p',null,e.body))),
          h('details',null,h('summary',null,'作者查看筛选原因（不会向DSH暴露未通过条目）'),...preview.rules.map(r=>h('div',{className:'rule',key:r.id},h('span',null,r.title),h('span',null,(r.allowed?'允许 · ':'排除 · ')+r.reason)))))),
      tab==='events'&&h('section',null,h('h2',null,'可追溯的状态变化'),story&&[...story.events].reverse().map(e=>h('article',{key:e.id},h('h3',null,e.summary+(e.undoneAt?' · 已撤回':'')),h('small',null,e.at+' · '+e.actor),h('p',null,e.source),h('pre',null,pretty({before:e.before,after:e.after})),!e.undoneAt&&e.id===story.events.filter(v=>!v.undoneAt).at(-1)?.id&&button('撤回最新事件',()=>action('undo',{storyId,eventId:e.id}))))),
      h('p',{className:'sub'},'数据仅存本机。条目筛选控制本插件返回的资料，不能抹除模型已有知识或会话历史。')
    );
  }
  function Icon(){return h('img',{src:ROOT+'icon',alt:'故事中控台',width:22,height:22,style:{objectFit:'contain'}});}
  return {name:'storydeck-ui',inject:['slots'],apply(ctx){
    ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',key:'dsh-storydeck'},Panel));
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'storydeck'},Panel));
    ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'storydeck',order:32,label:()=> '故事中控台'},Icon));
  }};
}});
