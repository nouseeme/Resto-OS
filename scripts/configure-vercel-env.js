import {spawn} from 'node:child_process';
process.loadEnvFile('.env');
const project=process.env.VERCEL_PROJECT_ID,team=process.env.VERCEL_TEAM_ID;
if(!project||!team||![project,team].every(x=>/^[a-zA-Z0-9_-]+$/.test(x)))throw new Error('Set VERCEL_PROJECT_ID and VERCEL_TEAM_ID before configuring production.');
// Values travel on stdin, never shell arguments, logs, or source control.
for(const name of ['SUPABASE_URL','SUPABASE_SECRET_KEY']) {
  if(!process.env[name])throw new Error(`${name} is missing`);
  await new Promise((resolve,reject)=>{
    const child=spawn('cmd.exe',['/d','/s','/c',`vercel env add ${name} --environment production --type ${name==='SUPABASE_SECRET_KEY'?'secret':'config'} --project ${project} --scope ${team} --yes`],{stdio:['pipe','pipe','pipe'],windowsHide:true});
    child.stdin.end(process.env[name]);
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Failed to configure ${name}; exit ${code}`)));
  });
  console.log(`${name} configured for production.`);
}
