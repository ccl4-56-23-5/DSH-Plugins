function buildAllNodes(){
  const fragment=document.createDocumentFragment();entries().forEach(e=>{const node=makeNode(e);nodeElements.set(e.id,node);fragment.append(node);});el.nodes.append(fragment);
}
function makeNode(e){
  const b=document.createElement('button');
  b.type='button'; b.className='starnode'; b.dataset.id=e.id; b.dataset.kind=e.kind;
  b.style.left=e.x+'%'; b.style.top=e.y+'%';
  b.innerHTML='<span class="hit"></span><span class="orb-wrap"><span class="orb"></span>'
    +'<span class="badge" aria-hidden="true">补</span></span>'
    +'<span class="orb-name"></span>';
  const off=isOff(e);b.classList.toggle('is-off',off);b.style.zIndex=String(off?1:e.kind==='mine'?5:3);
  b.querySelector('.orb-name').textContent=e.title+(off?' · 停用':'');
  b.setAttribute('aria-label',e.title+'，'+e.type+(off?'，已停用':'')+'。'+e.body+'。使用方向键切换星点，回车固定详情。');
  b.addEventListener('pointerenter',ev=>{
    if(ev.pointerType!=='mouse'||state.pinned===e.id) return;
    showPeek(e.id);
  });
  b.addEventListener('pointerleave',ev=>{
    if(ev.pointerType!=='mouse') return;
    if(state.peekId===e.id&&!el.peek.contains(ev.relatedTarget)) hidePeek();
  });
  b.addEventListener('focus',()=>{ if(state.pinned!==e.id) showPeek(e.id); });
  b.addEventListener('blur',()=>{ if(state.peekId===e.id) hidePeek(); });
  b.addEventListener('click',ev=>{ ev.stopPropagation(); pin(e.id); });
  return b;
}

let sizes={},layoutKey=null,previousPinned=null,hotEdges=new Set(),adjacency=new Map();
function layout(){
  const W=worldW, H=worldH;
  if(!W||!H) return;
  const key=W+':'+H+':'+graphGeneration;if(layoutKey===key){syncClasses();return;}layoutKey=key;
  const k=1;
  const map={};
  entries().forEach(e=>{
    map[e.id]=Math.max(26,Math.round(e.size*k));
    const n=nodeEl(e.id);
    if(n){
      n.style.setProperty('--s',map[e.id]+'px');
      n.style.left=e.x+'%'; n.style.top=e.y+'%';
    }
  });
  sizes=map;
  drawGraph(W,H);
  syncClasses();
  checkSelf(W,H);
}

function drawGraph(W,H){
  el.svg.setAttribute('viewBox','0 0 '+W+' '+H);
  el.svg.setAttribute('width',W); el.svg.setAttribute('height',H);
  [...el.svg.querySelectorAll('path.edge')].forEach(p=>p.remove());
  el.labels.textContent='';
  if(!el.svg.querySelector('defs')){
    const defs=SVGNS('defs',{});
    defs.append(SVGNS('marker',{id:'wx-arrow',viewBox:'0 0 8 8',refX:'7',refY:'4',
      markerWidth:'6.5',markerHeight:'6.5',orient:'auto'}));
    defs.querySelector('marker').append(SVGNS('path',{d:'M1 1.4L7 4L1 6.6Z',fill:'#6b7d92'}));
    el.svg.append(defs);
  }

  const geom={};
  const orbList=entries().map(e=>{
    const r=(sizes[e.id]||40)/2;
    return {id:e.id,x:e.x/100*W,y:e.y/100*H,r:r};
  });

  edges().forEach((e,i)=>{
    const A=byId(e.a), B=byId(e.b); if(!A||!B) return;
    const ax=A.x/100*W, ay=A.y/100*H, bx=B.x/100*W, by=B.y/100*H;
    const dx=bx-ax, dy=by-ay, len=Math.hypot(dx,dy)||1;
    const nx=-dy/len, ny=dx/len;
    let bulge=(typeof e.bulge==='number')?e.bulge:((i%2?1:-1)*Math.min(11,len*.055));
    bulge=clamp(bulge,-len*.5,len*.5);
    const mx=(ax+bx)/2, my=(ay+by)/2;
    const cx=mx+nx*bulge, cy=my+ny*bulge;
    const rA=(sizes[A.id]||40)/2+4, rB=(sizes[B.id]||40)/2+11;
    const tA={x:cx-ax,y:cy-ay}, lA=Math.hypot(tA.x,tA.y)||1;
    const tB={x:bx-cx,y:by-cy}, lB=Math.hypot(tB.x,tB.y)||1;
    const p0={x:ax+tA.x/lA*rA, y:ay+tA.y/lA*rA};
    const p1={x:bx-tB.x/lB*rB, y:by-tB.y/lB*rB};
    const d='M'+p0.x.toFixed(1)+' '+p0.y.toFixed(1)+'Q'+cx.toFixed(1)+' '+cy.toFixed(1)+' '+p1.x.toFixed(1)+' '+p1.y.toFixed(1);
    const path=SVGNS('path',{class:'edge'+(e.inferred?' is-inferred':''),d:d,'data-i':i});
    if(!e.inferred) path.setAttribute('marker-end','url(#wx-arrow)');
    el.svg.append(path);
    const pt=t=>{
      const u=1-t;
      return {x:u*u*p0.x+2*u*t*cx+t*t*p1.x, y:u*u*p0.y+2*u*t*cy+t*t*p1.y};
    };
    geom[i]={path:path,pt:pt,nx:nx,ny:ny,len:len,inferred:e.inferred,el:e,label:null};
  });

  /* 标签：在沿线的候选位置里选第一个不压球、不压标签的点 */
  const order=edges().map((e,i)=>({e:e,i:i,info:geom[i]})).filter(o=>o.info)
    .sort((a,b)=>a.info.len-b.info.len);
  const placed=[];
  order.forEach(o=>{
    const label=document.createElement('div');
    label.className='elabel'+(o.e.inferred?' is-inferred':''); label.textContent=o.e.label; label.dataset.i=o.i;
    el.labels.append(label);o.info.label=label;
    if(entries().length>100||edges().length>100){const p=o.info.pt(.5);label.style.left=p.x+'px';label.style.top=p.y+'px';if(!state.labels)label.hidden=true;placed.push({x:p.x,y:p.y,i:o.i});return;}
    const w=label.offsetWidth||46, h=label.offsetHeight||16;
    const cands=[];
    const ts=[o.e.t!=null?o.e.t:.5,.5,.44,.56,.38,.62,.32,.68,.26,.74,.2];
    const offs=[0,-9,9,-18,18,-27,27,-36,36];
    ts.forEach(t=>offs.forEach(off=>{
      const p=o.info.pt(t);
      cands.push({x:p.x+o.info.nx*off, y:p.y+o.info.ny*off, t:t, off:off, w:w, h:h});
    }));
    let best=null, bestScore=1e9;
    for(const c of cands){
      if(c.x-w/2<4||c.x+w/2>W-4||c.y-h/2<4||c.y+h/2>H-4) continue;
      let score=0;
      orbList.forEach(ob=>{
        const d=Math.hypot(ob.x-c.x, ob.y-c.y);
        const need=ob.r+16;
        if(d<need) score+=(need-d)*12;
      });
      placed.forEach(p=>{
        const ox=Math.max(0,Math.min(c.x+c.w/2,p.x+p.w/2)-Math.max(c.x-c.w/2,p.x-p.w/2));
        const oy=Math.max(0,Math.min(c.y+c.h/2,p.y+p.h/2)-Math.max(c.y-c.h/2,p.y-p.h/2));
        if(ox>0&&oy>0) score+=ox*oy;
      });
      score+=Math.abs(c.off)*.35;
      if(score<bestScore){bestScore=score;best=c;}
      if(score===0) break;
    }
    if(!best) best={x:o.info.pt(.5).x,y:o.info.pt(.5).y,w:w,h:h};
    best.i=o.i;
    placed.push(best);
    o.info.labelPos=best;
    label.style.left=best.x+'px'; label.style.top=best.y+'px';
    if(!state.labels) label.hidden=true;
  });

  /* 记录几何，供样式同步 */
  edgeGeom=geom;hotEdges=new Set();previousPinned=null;adjacency=new Map();
  edges().forEach((edge,i)=>{for(const id of [edge.a,edge.b]){if(!adjacency.has(id))adjacency.set(id,[]);adjacency.get(id).push(i);}});
  labelMap={};
  placed.forEach(p=>{labelMap[p.i]=p;});
}
let edgeGeom={}, labelMap={};

function syncClasses(){
  if(previousPinned!==state.pinned){nodeEl(previousPinned)?.classList.remove('is-selected');nodeEl(state.pinned)?.classList.add('is-selected');previousPinned=state.pinned;}
  const active=state.pinned||state.peekId,next=new Set(adjacency.get(active)||[]);
  for(const i of hotEdges)if(!next.has(i)){edgeGeom[i]?.path.classList.remove('is-hot');edgeGeom[i]?.label?.classList.remove('is-hot');}
  for(const i of next)if(!hotEdges.has(i)){edgeGeom[i]?.path.classList.add('is-hot');edgeGeom[i]?.label?.classList.add('is-hot');}
  hotEdges=next;el.field.classList.toggle('has-active',!!active);el.labels.classList.toggle('is-hidden',!state.labels);
}

/* ---------- 悬停预览 ---------- */
function showPeek(id){const e=byId(id);if(!e||state.pinned===id)return;state.peekId=id;el.peek.innerHTML='<div class="pk-type">'+esc(e.type)+'</div><h4>'+esc(e.title)+'</h4><p>'+esc(e.body)+'</p><div class="pk-foot">'+esc(e.source)+' · 点击固定详情</div>';el.peek.hidden=false;el.peek.classList.add('is-on');el.peek.dataset.id=id;positionPeek(id);syncClasses();}
function hidePeek(){
  if(state.peekId===null&&el.peek.hidden) return;
  el.peek.classList.remove('is-on');
  el.peek.hidden=true;
  el.peek.dataset.id='';
  state.peekId=null;
  syncClasses();
}
function positionPeek(id){
  const n=nodeEl(id); if(!n) return;
  const orb=n.querySelector('.orb');
  const sr=el.stage.getBoundingClientRect(), or=orb.getBoundingClientRect();
  const pw=el.peek.offsetWidth, ph=el.peek.offsetHeight;
  const sw=sr.width, sh=sr.height;
  const x=or.left+or.width/2-sr.left, y=or.top+or.height/2-sr.top, r=or.width/2;
  let left=x+r+12, top=y-ph/2;
  if(left+pw>sw-8) left=x-r-12-pw;
  if(left<8){
    left=clamp(x-pw/2,8,Math.max(8,sw-pw-8));
    top=y+r+12;
    if(top+ph>sh-8) top=y-r-12-ph;
  }
  top=clamp(top,8,Math.max(8,sh-ph-8));
  left=clamp(left,8,Math.max(8,sw-pw-8));
  el.peek.style.left=left+'px';
  el.peek.style.top=top+'px';
}

/* ---------- 固定详情 ---------- */
function pin(id){
  const e=byId(id); if(!e) return;
  state.pinned=id;
  hidePeek();
  renderDetail();
  syncClasses();
  revealNode(id);
  const n=nodeEl(id);
  if(n&&document.activeElement!==n) n.focus({preventScroll:true});
  announce('已固定「'+e.title+'」详情。');
}
function clearPin(){
  if(!state.pinned) return;
  state.pinned=null;
  renderDetail(); syncClasses(); announce('已取消固定。');
}
