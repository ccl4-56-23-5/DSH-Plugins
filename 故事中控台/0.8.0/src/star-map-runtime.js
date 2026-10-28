(function(){
'use strict';
const NS='http://www.w3.org/2000/svg',$=(s,r=document)=>r.querySelector(s),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SVGNS=(n,attrs)=>{const x=document.createElementNS(NS,n);for(const k in attrs)x.setAttribute(k,attrs[k]);return x;};
const sid=new URLSearchParams(location.search).get('sessionId');
let data=null,allNodes=[],visibleNodes=[],visibleEdges=[],requestSerial=0,nodeMap=new Map(),nodeElements=new Map(),worldW=0,worldH=0,graphGeneration=0;
const state={tab:'map',view:'sidebar',filter:'全部',labels:true,pinned:null,peekId:null,zoom:1,panX:0,panY:0,fitted:false,fitMode:true,off:new Set(),busy:false,jobId:null,active:true};
if(new URLSearchParams(location.search).get('embedded')==='1')document.body.classList.add('is-embedded');
const el={app:$('#app'),stage:$('#stage'),field:$('#field'),svg:$('#edges'),nodes:$('#nodes'),labels:$('#labels'),peek:$('#peek'),detail:$('#detail'),live:$('#live'),deckCount:$('#deckCount'),stageHint:$('#stageHint'),result:$('#result'),footOn:$('#footOn'),footTotal:$('#footTotal'),filters:$('#filters'),bookList:$('#bookList'),tabMap:$('#tabMap'),tabBooks:$('#tabBooks'),paneMap:$('#paneMap'),paneBooks:$('#paneBooks'),tabMapNum:$('#tabMapNum'),tabBooksNum:$('#tabBooksNum'),btnExpand:$('#btnExpand'),btnLabels:$('#btnLabels'),compose:$('#compose'),input:$('#inputNote')};
const entries=()=>visibleNodes,edges=()=>visibleEdges,byId=id=>nodeMap.get(id),nodeEl=id=>nodeElements.get(id),relCount=id=>(data?.relations??[]).filter(e=>e.a===id||e.b===id).length,isOff=e=>!e.enabled,matches=(e,f)=>f==='全部'||(f==='补充'?e.kind==='mine':e.type===f);
function announce(text){el.live.textContent=text;}
function checkSelf(){}
function postParent(type){if(parent!==window)parent.postMessage({type},location.origin==='null'?'*':location.origin);}
async function api(leaf,body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetch('/storydeck/api/'+leaf,{method:body?'POST':'GET',headers:{'x-storydeck':'1',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});const out=await r.json();if(!r.ok||!out.ok)throw Error(out.error||'请求失败');return out.value;}finally{clearTimeout(timer);}}
function storage(key,value){try{const k='storydeck:star-map:'+sid+':'+(data?.bookId??'none')+':'+key;if(arguments.length===1)return sessionStorage.getItem(k);if(value===null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,value);}catch{}return null;}
function setResult(kind,text){el.result.textContent=text;el.result.className='result '+(kind==='error'?'warn':kind);}
function busy(value){state.busy=value;$('#btnOrganize').disabled=value||!data?.bookId||!data?.model;$('#linkExisting').disabled=value||!data?.bookId||!data?.model;$('#newBook').disabled=value;$('#createSubmit').disabled=value;$('#bookSelect').disabled=value;el.input.disabled=value;$('#visibility').disabled=value;$('#refresh').disabled=value;renderBooks();}
async function load(bookId=data?.bookId){
  if(!sid)throw Error('请先打开一个对话，再打开万象星图');const serial=++requestSerial;
  const next=await api('graph?sessionId='+encodeURIComponent(sid)+(bookId?'&bookId='+encodeURIComponent(bookId):''));if(serial!==requestSerial)return;
  const previous=data,same=!!previous&&previous.bookId===next.bookId&&previous.revision===next.revision&&JSON.stringify(previous.nodes)===JSON.stringify(next.nodes)&&JSON.stringify(previous.relations)===JSON.stringify(next.relations)&&JSON.stringify(previous.selection)===JSON.stringify(next.selection)&&previous.scope?.workspaceId===next.scope?.workspaceId;
  data=next;try{sessionStorage.setItem('storydeck:star-map:'+sid+':active-book',data.bookId??'');}catch{}
  if(same){$('#workspaceTitle').textContent=data.scope.title;return;}
  const newBook=!previous||previous.bookId!==data.bookId;
  allNodes=data.nodes.map(n=>({...n,size:38,x:50,y:50}));nodeMap=new Map(allNodes.map(n=>[n.id,n]));
  state.off=new Set(allNodes.filter(n=>!n.enabled).map(n=>n.id));if(!byId(state.pinned))state.pinned=null;
  const select=$('#bookSelect');select.replaceChildren();for(const b of data.books){const option=document.createElement('option');option.value=b.id;option.textContent=b.title+(b.enabled?'':'（未启用）');select.append(option);}select.value=data.bookId??'';
  $('#workspaceTitle').textContent=data.scope.title;$('#organizeHint').textContent=data.model?'模型：'+data.model.model+' · 只参考当前已启用且可读的条目':'请先在DSH配置默认模型';
  paint(newBook);busy(state.busy);renderActions();
}
function filtered(){const query=$('#search').value.trim().toLocaleLowerCase();return allNodes.filter(e=>matches(e,state.filter)&&(!query||(e.title+' '+e.body).toLocaleLowerCase().includes(query)));}
function paint(fit=false){
  graphGeneration++;visibleNodes=filtered();
  const degrees=new Map();for(const r of data?.relations??[]){degrees.set(r.a,(degrees.get(r.a)||0)+1);degrees.set(r.b,(degrees.get(r.b)||0)+1);}
  const sorted=[...visibleNodes].sort((a,b)=>(degrees.get(b.id)||0)-(degrees.get(a.id)||0)||a.id.localeCompare(b.id));
  const stageW=el.stage.clientWidth||700,stageH=el.stage.clientHeight||400;
  if(sorted.length<=20){worldW=stageW;worldH=stageH;sorted.forEach((e,i)=>{const angle=i*2.399963229728653,r=sorted.length===1?0:17+26*Math.sqrt(i/Math.max(1,sorted.length-1));e.x=50+r*Math.cos(angle);e.y=49+r*.91*Math.sin(angle);});}
  else{const radius=70*Math.sqrt(sorted.length)+100;worldW=Math.max(stageW,Math.ceil(radius*2));worldH=Math.max(stageH,Math.ceil(radius*2));sorted.forEach((e,i)=>{const angle=i*2.399963229728653,r=70*Math.sqrt(i);e.x=(worldW/2+r*Math.cos(angle))/worldW*100;e.y=(worldH/2+r*Math.sin(angle))/worldH*100;});}
  el.field.style.width=worldW+'px';el.field.style.height=worldH+'px';
  const ids=new Set(visibleNodes.map(n=>n.id));visibleEdges=(data?.relations??[]).filter(r=>ids.has(r.a)&&ids.has(r.b));
  hidePeek();el.nodes.replaceChildren();nodeElements.clear();buildAllNodes();layout();if(fit||!state.fitted)fitGraph();else applyZoom();renderDetail();renderBooks();updateCounts();
  $('#emptyMap').hidden=visibleNodes.length>0;$('#emptyMap').textContent=!data?.books.length?'书库还是空的，请先打开完整世界书管理并导入。':!allNodes.length?'这本书还没有条目。输入设定后，AI会整理成初始星点。':'没有匹配的条目。';
}
function renderDetail(){
  const e=byId(state.pinned);if(!e){el.detail.innerHTML='<div class="detail-empty">悬停预览设定，点击球体固定详情。键盘方向键移动，Esc取消。</div>';return;}
  const rels=(data.relations??[]).filter(r=>r.a===e.id||r.b===e.id);
  el.detail.innerHTML='<div class="d-head"><div class="d-title"><div class="d-kicker">'+(e.kind==='mine'?'AI整理归档':'世界书条目')+'</div><h3>'+esc(e.title)+' <small>'+esc(e.type)+'</small></h3></div><button class="icon-btn d-close" aria-label="取消固定" type="button">×</button></div><div class="d-source">来源 · '+esc(e.source)+(e.visibility==='author'?' · 作者隐藏':'')+' · '+(e.enabled?'已启用':'已停用')+'</div><p class="d-text">'+esc(e.body)+'</p>'+(e.sourceQuote?'<div class="d-note">来源原文：'+esc(e.sourceQuote)+'</div>':'')+'<div class="d-sec"><div class="d-sec-h">关系 '+rels.length+' 条</div><div class="rel-list">'+rels.map(r=>{const other=byId(r.a===e.id?r.b:r.a);return '<button type="button" class="rel-row" data-goto="'+esc(other?.id??'')+'"><span>'+(r.a===e.id?'→':'←')+'</span><span>'+esc(other?.title??'未显示条目')+' · '+esc(r.label)+(r.inferred?' · 推定':'')+'</span></button><small style="display:block;color:var(--ink-3);padding:3px 8px">依据：'+esc(r.evidence)+'</small>';}).join('')+'</div></div>';
  el.detail.querySelector('.d-close').onclick=clearPin;el.detail.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>{const id=b.dataset.goto;if(!nodeEl(id)){state.filter='全部';$('#search').value='';paint(true);}pin(id);});
}
function renderBooks(){
  if(!data||state.tab!=='books')return;const book=data.books.find(b=>b.id===data.bookId),enabled=!!book?.enabled,rows=filtered();
  el.bookList.innerHTML=book?'<div class="book-group-h"><span>'+esc(book.title)+'</span><button class="switch" type="button" role="switch" aria-label="启用世界书" aria-checked="'+enabled+'" id="bookSwitch" '+(state.busy?'disabled':'')+'></button></div>'+rows.map(e=>'<div class="book-row'+(e.enabled?'':' is-off')+'"><button class="book-jump" type="button" data-jump="'+e.id+'"><span class="book-dot"></span><span class="book-main"><span class="book-name">'+esc(e.title)+'<small>'+esc(e.type)+'</small></span><span class="book-meta">'+(e.visibility==='author'?'作者隐藏 · ':'')+esc(e.source)+'</span></span></button><button type="button" class="switch" role="switch" aria-label="启用条目：'+esc(e.title)+'" aria-checked="'+e.enabled+'" data-toggle="'+e.id+'" '+(state.busy||!enabled?'disabled':'')+'></button></div>').join(''):'没有世界书，请先导入。';
  const sw=$('#bookSwitch');if(sw)sw.onclick=()=>toggleBook(!enabled);
  el.bookList.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>toggleEntry(b.dataset.toggle));el.bookList.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{switchTab('map');pin(b.dataset.jump);});
}
async function saveSelection(selection){
  busy(true);try{await api('action',{action:'selectBooks',sessionId:sid,requestId:crypto.randomUUID(),revision:data.revision,bookIds:selection.bookIds,entryIds:selection.entryIds});await load();setResult('ok','开关已保存，对'+data.scope.title+'生效。');}
  catch(e){try{await load();}catch{}setResult('error','保存未完成或待核对：'+e.message+'。已重新读取时以实际开关为准。');}finally{busy(false);}
}
function toggleBook(on){if(state.busy)return;const next=structuredClone(data.selection);next.bookIds=on?[...new Set([...next.bookIds,data.bookId])]:next.bookIds.filter(id=>id!==data.bookId);next.entryIds[data.bookId]??=allNodes.filter(n=>n.defaultEnabled).map(n=>n.entryId);void saveSelection(next);}
function toggleEntry(id){if(state.busy)return;const e=byId(id),next=structuredClone(data.selection);if(!e||!next.bookIds.includes(data.bookId))return;const ids=next.entryIds[data.bookId]??[];next.entryIds[data.bookId]=e.enabled?ids.filter(id=>id!==e.entryId):[...new Set([...ids,e.entryId])];void saveSelection(next);}
const TYPES=['全部','人物','地点','组织','器物','规则','事件','设定','补充'];
function buildFilters(){TYPES.forEach(t=>{const b=document.createElement('button');b.type='button';b.className='chip';b.dataset.filter=t;b.textContent=t;b.onclick=()=>{state.filter=t;paint(true);};el.filters.append(b);});}
function updateCounts(){if(!data)return;el.deckCount.textContent=allNodes.length+' 星点 · '+data.relations.length+' 关系';el.footOn.textContent=allNodes.filter(n=>n.enabled).length;el.footTotal.textContent=allNodes.length;el.tabMapNum.textContent=allNodes.length;el.tabBooksNum.textContent=allNodes.length;el.stageHint.textContent=visibleNodes.length+' 星点 '+visibleEdges.length+' 关系';el.filters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter)));}
function setView(view){state.view=view;el.app.dataset.view='expanded';el.btnExpand.setAttribute('aria-pressed',String(view==='expanded'));el.btnExpand.setAttribute('aria-label',view==='expanded'?'收起关系网':'展开关系网');postParent('storydeck-starmap-expand');requestAnimationFrame(layout);}
function applyZoom(){el.field.style.transform='translate('+state.panX+'px,'+state.panY+'px) scale('+state.zoom+')';}
function fitGraph(){const w=el.stage.clientWidth,h=el.stage.clientHeight;if(!w||!h||!worldW||!worldH)return;state.zoom=Math.min(1,w/worldW,h/worldH)*.96;state.panX=(w-worldW*state.zoom)/2;state.panY=(h-worldH*state.zoom)/2;state.fitted=true;state.fitMode=true;applyZoom();}
function zoomAt(value,x=el.stage.clientWidth/2,y=el.stage.clientHeight/2){const old=state.zoom,next=clamp(value,.015,4),wx=(x-state.panX)/old,wy=(y-state.panY)/old;state.zoom=next;state.fitMode=false;state.panX=x-wx*next;state.panY=y-wy*next;applyZoom();hidePeek();}
function revealNode(id){const n=byId(id);if(!n)return;const x=n.x/100*worldW*state.zoom+state.panX,y=n.y/100*worldH*state.zoom+state.panY,w=el.stage.clientWidth,h=el.stage.clientHeight;if(x<35||x>w-35||y<35||y>h-35){state.panX=w/2-n.x/100*worldW*state.zoom;state.panY=h/2-n.y/100*worldH*state.zoom;applyZoom();}}

function switchTab(name){state.tab=name;el.tabMap.setAttribute('aria-selected',String(name==='map'));el.tabBooks.setAttribute('aria-selected',String(name==='books'));el.paneMap.hidden=name!=='map';el.paneBooks.hidden=name!=='books';if(name==='books')renderBooks();requestAnimationFrame(layout);}
function moveFocus(dx,dy){const active=document.activeElement?.closest('.starnode'),id=active?.dataset.id,origin=byId(id);if(!origin)return;let best,score=Infinity;for(const n of visibleNodes){const x=n.x-origin.x,y=n.y-origin.y,len=Math.hypot(x,y),dot=(x*dx+y*dy)/(len||1);if(dot>.35&&len*(2-dot)<score){best=n;score=len*(2-dot);}}if(best){revealNode(best.id);nodeEl(best.id)?.focus({preventScroll:true});}}
function renderActions(){const box=$('#jobActions');box.replaceChildren();const batch=data?.batches?.at(-1);if(batch&&!state.busy){const b=document.createElement('button');b.type='button';b.textContent='撤销最近归档（'+batch.count+'条）';b.disabled=!batch.canUndo;b.onclick=async()=>{busy(true);try{await api('undo-archive',{sessionId:sid,requestId:crypto.randomUUID(),revision:data.revision,batchId:batch.id});await load();setResult('ok','已撤销最近归档');}catch(e){setResult('error',e.message);try{await load();}catch{}}finally{busy(false);renderActions();}};box.append(b);if(!batch.canUndo){const note=document.createElement('span');note.textContent='已有后续修改，可在世界书页停用条目。';box.append(note);}}}
function recovery(message){busy(false);setResult('error',message);const box=$('#jobActions');box.replaceChildren();const read=document.createElement('button');read.type='button';read.textContent='重新读取整理结果';read.onclick=()=>recover();const again=document.createElement('button');again.type='button';again.textContent='重新整理（再次调用AI）';again.onclick=()=>{state.jobId=null;storage('job',null);void organize();};box.append(read,again);}
async function follow(job){
  state.jobId=job.id;storage('job',job.id);busy(true);renderActions();
  while(job.status==='running'){setResult('ok','AI正在整理，结果会自动归档；请稍候…');await new Promise(r=>setTimeout(r,1200));job=await api('organize?sessionId='+encodeURIComponent(sid)+'&jobId='+encodeURIComponent(job.id));}
  if(job.status==='done'){const result=job.result;state.jobId=null;storage('job',null);if(job.mode!=='relations'){storage('draft',null);el.input.value='';}state.filter='全部';await load(job.bookId);const id=result.nodeIds?.[0];if(id){paint();pin(id);}setResult('ok',job.mode==='relations'?'已保存 '+result.relations+' 条关系。':'已归档 '+result.entries+' 个条目、'+result.relations+' 条关系到世界书。');busy(false);renderActions();}
  else if(job.status==='failed'){state.jobId=null;storage('job',null);busy(false);setResult('error','整理未归档：'+job.error+'。输入已保留，可修改后重试。');renderActions();}
  else if(job.status==='undone'){state.jobId=null;storage('job',null);busy(false);await load();setResult('ok','该次归档已撤销。');}
  else recovery('上次整理的执行结果待核对，未显示为保存成功。输入已保留。');
}
async function recover(){const id=state.jobId??storage('job');if(!id)return;state.jobId=id;try{await follow(await api('organize?sessionId='+encodeURIComponent(sid)+'&jobId='+encodeURIComponent(id)));}catch(e){recovery('无法核对上次整理：'+e.message);}}
async function organize(mode='archive'){
  if(state.busy)return;if(state.jobId){void recover();return;}const input=mode==='relations'?'梳理本书当前可读条目之间的明确关系与推定关系，严格保留不确定性。':el.input.value.trim();if(!input){setResult('error','请先输入设定');return;}if(!data?.bookId){setResult('error','请先导入并选择世界书');return;}
  const id=crypto.randomUUID();state.jobId=id;storage('job',id);storage('draft',el.input.value);busy(true);renderActions();
  try{await follow(await api('organize',{sessionId:sid,requestId:id,revision:data.revision,bookId:data.bookId,input,visibility:$('#visibility').value,mode}));}
  catch(e){recovery('整理请求结果待核对：'+e.message);}
}
function bind(){
  window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='storydeck-host-view'||typeof event.data.active!=='boolean')return;state.active=event.data.active;if(state.active&&data&&!state.busy)void load().catch(()=>{});});
  $('#newBook').onclick=()=>{$('#createBook').hidden=!$('#createBook').hidden;$('#bookName').focus();};
  $('#createBook').onsubmit=async e=>{e.preventDefault();const title=$('#bookName').value.trim();if(!title){setResult('error','请输入世界书名称');return;}busy(true);const id='book-'+crypto.randomUUID();try{await api('action',{action:'saveBook',sessionId:sid,requestId:crypto.randomUUID(),revision:data.revision,book:{id,title,fields:[],initialState:{},entries:[]}});await load(id);const selection=structuredClone(data.selection);selection.bookIds.push(id);selection.entryIds[id]=[];await api('action',{action:'selectBooks',sessionId:sid,requestId:crypto.randomUUID(),revision:data.revision,bookIds:selection.bookIds,entryIds:selection.entryIds});await load(id);$('#createBook').hidden=true;$('#bookName').value='';setResult('ok','世界书已创建并在当前工作区启用。');}catch(error){try{await load(id);}catch{}setResult('error','创建或启用未完成，请核对世界书页：'+error.message);}finally{busy(false);}};
  $('#linkExisting').onclick=()=>organize('relations');
  el.tabMap.onclick=()=>switchTab('map');el.tabBooks.onclick=()=>switchTab('books');el.btnExpand.onclick=()=>setView(state.view==='expanded'?'sidebar':'expanded');el.btnLabels.onclick=()=>{state.labels=!state.labels;el.btnLabels.setAttribute('aria-pressed',String(state.labels));syncClasses();};
  $('#zoomIn').onclick=()=>zoomAt(state.zoom*1.25);$('#zoomOut').onclick=()=>zoomAt(state.zoom/1.25);$('#zoomReset').onclick=()=>{fitGraph();hidePeek();};
  let searchTimer;$('#search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>paint(true),120);};
  $('#bookSelect').onchange=async e=>{storage('draft',el.input.value);state.filter='全部';state.pinned=null;try{await load(e.target.value);el.input.value=storage('draft')??'';state.jobId=storage('job');if(state.jobId)void recover();}catch(e){setResult('error',e.message);}};
  $('#refresh').onclick=()=>load().catch(e=>setResult('error',e.message));$('#btnFootBooks').onclick=()=>switchTab('books');$('#manageBooks').onclick=()=>{switchTab('map');postParent('storydeck-starmap-books');};
  el.input.oninput=()=>storage('draft',el.input.value);el.compose.onsubmit=e=>{e.preventDefault();void organize();};el.compose.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void organize();}};
  let gesture=null,suppressClick=false;const points=new Map(),local=e=>{const r=el.stage.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  const resetGesture=()=>{const p=[...points.values()];if(p.length>=2){const mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};gesture={pinch:true,dist:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1,zoom:state.zoom,wx:(mid.x-state.panX)/state.zoom,wy:(mid.y-state.panY)/state.zoom};}else if(p.length===1){gesture={pinch:false,start:p[0],panX:state.panX,panY:state.panY};}else gesture=null;};
  el.stage.addEventListener('pointerdown',e=>{if((e.pointerType==='mouse'&&e.button!==0)||e.target.closest('.starnode,.peek,.zoom'))return;points.set(e.pointerId,local(e));el.stage.setPointerCapture(e.pointerId);resetGesture();el.stage.classList.add('is-dragging');});
  el.stage.addEventListener('pointermove',e=>{if(!points.has(e.pointerId)||!gesture)return;points.set(e.pointerId,local(e));const p=[...points.values()];if(gesture.pinch&&p.length>=2){const mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},dist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);state.zoom=clamp(gesture.zoom*dist/gesture.dist,.015,4);state.panX=mid.x-gesture.wx*state.zoom;state.panY=mid.y-gesture.wy*state.zoom;state.fitMode=false;suppressClick=true;}else if(!gesture.pinch&&p.length===1){const dx=p[0].x-gesture.start.x,dy=p[0].y-gesture.start.y;if(Math.hypot(dx,dy)>3){suppressClick=true;state.fitMode=false;}state.panX=gesture.panX+dx;state.panY=gesture.panY+dy;}applyZoom();hidePeek();e.preventDefault();});
  const endPointer=e=>{if(!points.has(e.pointerId))return;points.delete(e.pointerId);resetGesture();if(!points.size)el.stage.classList.remove('is-dragging');};el.stage.addEventListener('pointerup',endPointer);el.stage.addEventListener('pointercancel',endPointer);el.stage.addEventListener('lostpointercapture',endPointer);
  el.stage.addEventListener('wheel',e=>{e.preventDefault();const p=local(e);zoomAt(state.zoom*Math.exp(-e.deltaY*.0015),p.x,p.y);},{passive:false});
  el.stage.onclick=e=>{if(suppressClick){suppressClick=false;return;}if(!e.target.closest('.starnode,.peek,.zoom'))clearPin();};el.stage.onkeydown=e=>{const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(keys[e.key]&&e.target.closest('.starnode')){e.preventDefault();moveFocus(...keys[e.key]);}if(e.key==='Escape'){clearPin();hidePeek();}};
  el.peek.onpointerleave=()=>hidePeek();document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.view==='expanded')setView('sidebar');});(()=>{let previous=null;new ResizeObserver(()=>{const current={width:el.stage.clientWidth,height:el.stage.clientHeight};if(!current.width||!current.height)return;if(previous&&state.fitted&&current.width&&current.height&&(current.width!==previous.width||current.height!==previous.height)){if(state.fitMode)fitGraph();else{state.panX+=(current.width-previous.width)/2;state.panY+=(current.height-previous.height)/2;applyZoom();}}previous=current;layout();if(state.peekId)positionPeek(state.peekId);}).observe(el.stage);})();
  window.addEventListener('focus',()=>{if(state.active&&!state.busy)void load().catch(()=>{});});
  setInterval(()=>{if(state.active&&!state.busy&&document.visibilityState==='visible')void load().catch(()=>{});},8000);
}
/*__GEOMETRY__*/
async function boot(){buildFilters();bind();try{let preferred;try{preferred=sessionStorage.getItem('storydeck:star-map:'+sid+':active-book');}catch{}await load(preferred);el.input.value=storage('draft')??'';state.jobId=storage('job');if(state.jobId)void recover();}catch(e){setResult('error',e.message);$('#emptyMap').hidden=false;$('#emptyMap').textContent=e.message;}window.__storydeckMap={state,get data(){return data;}};postParent('storydeck-ready');}
void boot();
})();
