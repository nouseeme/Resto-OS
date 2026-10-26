// Runtime discovery keeps the deployment flag server-owned, including on Vercel.
export async function initializeDemo() {
  const nativeFetch=window.fetch.bind(window);
  const config=await nativeFetch('/api/demo-config').then(r=>r.json());
  if(!config.demo)return;
  const key='resto-demo-v1';
  let queue=Promise.resolve();
  window.fetch=(input,options={})=>{
    if(typeof input!=='string' || !input.startsWith('/api/'))return nativeFetch(input,options);
    const run=async()=>{
      let state;
      try{state=JSON.parse(localStorage.getItem(key)??'null')}catch{state=null}
      const response=await nativeFetch('/api/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,path:input.slice(4),method:options.method??'GET',body:options.body?JSON.parse(options.body):undefined})});
      if(!response.headers.get('content-type')?.includes('application/json'))return response;
      const payload=await response.json();
      if(!payload.demo)return new Response(JSON.stringify(payload),{status:response.status,headers:response.headers});
      localStorage.setItem(key,JSON.stringify(payload.state));
      return new Response(JSON.stringify(payload.value),{status:response.status,headers:response.headers});
    };
    // Web Locks also serialize read/modify/write across tabs in the same browser.
    const operation=()=>navigator.locks?navigator.locks.request(key,run):run();
    const result=queue.then(operation,operation);queue=result.catch(()=>{});return result;
  };
  const banner=document.createElement('div');
  banner.className='notice';banner.setAttribute('role','region');banner.setAttribute('aria-label','Mode demo');
  banner.append('Mode demo · Semua data fiktif dan tersimpan di browser ini. ');
  const staff=document.createElement('a');staff.href='/ruang-staf';staff.textContent='Masuk ruang staf';staff.className='button';banner.append(staff,' · ');
  const reset=document.createElement('button');reset.className='text-link';reset.textContent='Reset demo';
  reset.onclick=async()=>{await queue;const clear=()=>{localStorage.removeItem(key);localStorage.removeItem('resto-portal-draft');sessionStorage.clear();location.reload()};if(navigator.locks)await navigator.locks.request(key,clear);else clear()};
  banner.append(reset);document.body.prepend(banner);
}
