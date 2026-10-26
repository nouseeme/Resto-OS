import { AsyncLocalStorage } from 'node:async_hooks';
import { createDemoState } from './demo-seed.js';
import { tick, assert } from './store.js';

export { demoEnabled } from './demo-mode.js';
const context = new AsyncLocalStorage();
export const demoStore = {
  read() { return structuredClone(context.getStore().state); },
  transaction(fn) {
    const current=context.getStore(), next=structuredClone(current.state);
    const result=fn(next);
    current.state=next;
    return result;
  },
};
// Demo state is intentionally visitor-controlled. It never enters a real store.
export function demoMiddleware(req,res,next) {
  if(req.method!=='POST' || req.path!=='/demo') return res.status(400).json({error:'Gunakan sesi demo browser.'});
  const {state,path,body,method}=req.body ?? {};
  assert(typeof path==='string' && /^\/[a-z][a-z0-9-]*(?:\/[a-z]+)?(?:\?[^\r\n]*)?$/.test(path) && !path.startsWith('/demo'),'Rute demo tidak valid.');
  assert(['GET','POST'].includes(method),'Metode demo tidak valid.');
  const session={state:state ?? createDemoState()};
  tick(session.state);
  const json=res.json.bind(res);
  res.json=value=>json({demo:true,value,state:session.state});
  req.url=path;
  req.method=method;
  req.body=body ?? {};
  context.run(session,next);
}
