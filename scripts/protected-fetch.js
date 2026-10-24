import {spawn} from 'node:child_process';

// Use Vercel's supported authenticated HTTP path; no protection settings change.
export function useProtectedFetch(origin) {
  const nativeFetch=globalThis.fetch;
  const team=process.env.VERCEL_TEAM_ID;
  if(!team||!/^[a-zA-Z0-9_-]+$/.test(team))throw new Error('Set VERCEL_TEAM_ID for the linked test project.');
  globalThis.fetch=async(input,options={})=>{
    const url=String(input);
    if(new URL(url).origin!==origin)return nativeFetch(input,options);
    if(!/^https:\/\/[a-z0-9-]+\.vercel\.app\/[a-zA-Z0-9/_?=.-]*$/.test(url))throw new Error('Unexpected protected test URL');
    const config=['silent','show-error','include','max-time = 30',`request = ${JSON.stringify(options.method??'GET')}`];
    for(const [name,value] of Object.entries(options.headers??{})) config.push(`header = ${JSON.stringify(`${name}: ${value}`)}`);
    if(options.body)config.push(`data = ${JSON.stringify(options.body)}`);
    const raw=await new Promise((resolve,reject)=>{
      const child=spawn('cmd.exe',['/d','/s','/c',`vercel curl ${url} --scope ${team} -- --config -`],{stdio:['pipe','pipe','pipe'],windowsHide:true});
      let out='';child.stdout.on('data',chunk=>out+=chunk);child.on('error',reject);child.on('exit',code=>code===0?resolve(out):reject(new Error(`Authenticated HTTP failed (${code})`)));child.stdin.end(config.join('\n')+'\n');
    });
    const start=raw.search(/HTTP\/\S+ \d{3}/);if(start<0)throw new Error('Authenticated request returned no HTTP response');
    const text=raw.slice(start),boundary=text.indexOf('\r\n\r\n');
    const head=text.slice(0,boundary).split('\r\n'),status=Number(head.shift().split(' ')[1]),headers=new Headers();
    for(const line of head){const colon=line.indexOf(':');if(colon>0)headers.append(line.slice(0,colon),line.slice(colon+1).trim())}
    return new Response(status===204?null:text.slice(boundary+4),{status,headers});
  };
}
