import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
process.loadEnvFile('.env');
const {openCloudStore}=await import('../server/cloud-store.js');
const snapshot=await openCloudStore().read();
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const directory=`data/backups/${stamp}`;
await mkdir(`${directory}/images`,{recursive:true});
const images=[];
for(const [index,url] of [...new Set(snapshot.menu.map(m=>m.photo).filter(url=>url?.startsWith(`${process.env.SUPABASE_URL}/storage/`)))].entries()) {
  const response=await fetch(url);if(!response.ok)throw new Error('Cannot back up a menu image');
  const buffer=Buffer.from(await response.arrayBuffer()),file=`images/${index}.webp`;
  await writeFile(`${directory}/${file}`,buffer);images.push({url,file,sha256:createHash('sha256').update(buffer).digest('hex')});
}
await writeFile(`${directory}/snapshot.json`,JSON.stringify({format:1,createdAt:new Date().toISOString(),state:snapshot,images},null,2));
console.log(`Backup saved in ${directory}. Contains private data; keep it outside source control.`);
