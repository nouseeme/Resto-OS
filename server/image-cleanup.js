const prefix='image-cleanup:';
export function queueImageCleanup(state,url){
  if(url)state.requests[prefix+url]={url};
}
export function createImageCleanup(store,removeImage){
  let running;
  return function cleanup(){
    if(running)return running;
    running=(async()=>{
      const pending=Object.entries((await store.read()).requests).filter(([key])=>key.startsWith(prefix)).slice(0,20);
      for(const [key,{url}] of pending){
        try{
          if((await store.read()).menu.some(item=>item.photo===url))continue;
          await removeImage(url);
          await store.transaction(state=>{delete state.requests[key]});
        }catch{ /* Keep durable queue entry for the next authenticated request. */ }
      }
      return Object.keys((await store.read()).requests).filter(key=>key.startsWith(prefix)).length;
    })().finally(()=>{running=null});
    return running;
  };
}
