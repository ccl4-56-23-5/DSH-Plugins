  function registerStarMap(ctx){
    const KIND='storydeck-star-map',TYPE='dsh-storydeck-star-map';
    const icon=()=>h('img',{src:ROOT+'icon',alt:'',style:{width:20,height:20,objectFit:'contain'}});
    function Frame({sessionId,useTabInfo}){
      const frame=useRef(),[books,setBooks]=useState(false),tab=useTabInfo?.().tab;
      useEffect(()=>{const receive=event=>{if(event.source!==frame.current?.contentWindow||event.origin!==location.origin)return;
        if(event.data?.type==='storydeck-starmap-books')setBooks(true);
        if(event.data?.type==='storydeck-starmap-expand'){const target=ctx.sidebarRight.commandTarget(null);if(target&&target.sessionId===sessionId&&(!tab||target.tabId===tab.id))ctx.sidebarRight.toggleFullscreen(target);}
      };window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[sessionId,tab?.id]);
      return h(React.Fragment,null,h('iframe',{key:sessionId,ref:frame,title:'万象星图',src:ROOT+'star-map?sessionId='+encodeURIComponent(sessionId),style:{width:'100%',height:'100%',minHeight:300,border:0,display:'block',background:'#151a21'}}),books&&h(Console,{sessionId,onSaved:()=>{if(frame.current)frame.current.src=frame.current.src;},onClose:()=>{setBooks(false);if(frame.current)frame.current.src=frame.current.src;}}));
    }
    function Main({useSessions}){
      const current=useSessions(s=>Object.values(s.byId).find(v=>(v.retainedBy?.mainView??0)>0)?.id);
      const [sid,setSid]=useState(current??''),[sessions,setSessions]=useState([]),[error,setError]=useState('');
      useEffect(()=>{if(current)setSid(current);},[current]);useEffect(()=>{let alive=true;api('sessions').then(v=>{if(alive)setSessions(v.items)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false};},[]);
      return h('div',{style:{height:'100%',display:'flex',flexDirection:'column',background:'#151a21',color:'#dde3ea'}},h('div',{style:{padding:10,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}},icon(),h('span',null,'万象星图'),h('select',{'aria-label':'星图所属对话',value:sid,onChange:e=>setSid(e.target.value),style:{maxWidth:360,background:'#1a2129',color:'inherit',padding:6,border:'1px solid #313b47',borderRadius:6}},h('option',{value:''},'选择对话以读取工作区世界书'),...sessions.map(s=>h('option',{key:s.sessionId,value:s.sessionId},s.title))),h('button',{type:'button',onClick:()=>{try{ctx.sidebarRight.openTab(KIND)}catch(e){setError('请先打开对应对话，再从右侧“更多工具”打开万象星图。')}},style:{background:'transparent',color:'inherit',border:'1px solid #313b47',borderRadius:6,padding:6}},'在右侧栏打开'),error&&h('span',{role:'status'},error)),h('div',{style:{flex:1,minHeight:0}},sid?h(Frame,{key:sid,sessionId:sid}):h('p',{style:{padding:24}},'选择已有对话后开始，不会创建新对话或发送消息。')));
    }
    ctx.effect(()=>ctx.sidebarRightTabs.register({id:TYPE,kind:KIND,title:()=> '万象星图',guide:[{id:'star-map',order:25,title:()=> '万象星图',description:()=> '故事中控台 · 世界书设定网与AI整理',icon}]}));
    ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:TYPE},Frame));
    ctx.slots.inject('sidebar.right.pane.tab.title',()=>ctx.slots.register({name:'sidebar.right.pane.tab.title',key:TYPE},()=>h(React.Fragment,null,icon(),' 万象星图')));
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:TYPE},Main));
    ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:TYPE,order:32,label:()=> '万象星图'},icon));
  }
