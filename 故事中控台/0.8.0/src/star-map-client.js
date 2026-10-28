  const CENTER_MODULES=[{id:'worldbook',label:'世界书'},{id:'star',label:'万象星图'}];
  function StarMapFrame({sessionId,active,onBooks,onExpand,onClose}){
    const frame=useRef(),callbacks=useRef(),[ready,setReady]=useState(false);callbacks.current={onBooks,onExpand,onClose,active};
    const send=()=>frame.current?.contentWindow?.postMessage({type:'storydeck-host-view',active:callbacks.current.active},location.origin);
    useEffect(()=>{const receive=event=>{if(event.source!==frame.current?.contentWindow||event.origin!==location.origin)return;const type=event.data?.type;
      if(type==='storydeck-starmap-books')callbacks.current.onBooks();
      if(type==='storydeck-starmap-expand')callbacks.current.onExpand();
      if(type==='storydeck-starmap-close')callbacks.current.onClose();
      if(type==='storydeck-ready'){setReady(true);send();}
    };window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[]);
    useEffect(send,[active]);
    return h('div',{className:'sd-frame-wrap'+(ready?' is-ready':'')},!ready&&h('div',{className:'sd-loading',role:'status'},'正在连接世界书…'),h('iframe',{key:sessionId,ref:frame,title:'万象星图',src:ROOT+'star-map?sessionId='+encodeURIComponent(sessionId)+'&embedded=1',className:'sd-star-frame',onLoad:send}));
  }
