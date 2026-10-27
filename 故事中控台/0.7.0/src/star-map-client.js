  // Components registered here share the same hanging StoryDeck entry.
  const CENTER_MODULES=[{id:'worldbook',label:'世界书'},{id:'star',label:'万象星图'}];
  function StarMapFrame({sessionId,onBooks,onExpand}){
    const frame=useRef();
    useEffect(()=>{
      const receive=event=>{
        if(event.source!==frame.current?.contentWindow||event.origin!==location.origin)return;
        if(event.data?.type==='storydeck-starmap-books')onBooks();
        if(event.data?.type==='storydeck-starmap-expand')onExpand();
      };
      window.addEventListener('message',receive);
      return()=>window.removeEventListener('message',receive);
    },[onBooks,onExpand]);
    return h('iframe',{key:sessionId,ref:frame,title:'万象星图',src:ROOT+'star-map?sessionId='+encodeURIComponent(sessionId),className:'sd-star-frame'});
  }
