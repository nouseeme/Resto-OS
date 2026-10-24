import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env');
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY for the target test project.');
const client=createClient(url,key,{auth:{persistSession:false}});
for(const rpc of ['resto_snapshot','resto_commit']){
 const {error}=await client.rpc(rpc,rpc==='resto_commit'?{expected_version:0,changes:{}}:undefined);
 assert.ok(error,`Anonymous ${rpc} must be rejected`);assert.ok(['42501','PGRST202'].includes(error.code),`Unexpected error code ${error.code}`);
 console.log(`PASS anonymous ${rpc} is denied`);
}
const {error}=await client.storage.from('menu-images').upload('unauthorized-test.webp',Buffer.from('denied'),{contentType:'image/webp'});
assert.ok(error);console.log('PASS anonymous Storage upload is denied');
const hidden=await fetch(url+'/rest/v1/menu',{headers:{apikey:key}});assert.equal(hidden.status,404);console.log('PASS private tables are not exposed through Data API');
