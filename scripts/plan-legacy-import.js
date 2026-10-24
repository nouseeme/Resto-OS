import { readFile,writeFile } from 'node:fs/promises';
import { parseLegacyWorkbook,applyLegacyImport } from '../server/legacy-import.js';
import { decodeState,encodeState,stateChanges } from '../server/cloud-store.js';
import assert from 'node:assert/strict';

const [configPath,snapshotPath,outPath]=process.argv.slice(2);
assert(configPath&&snapshotPath&&outPath,'Usage: node scripts/plan-legacy-import.js config.json snapshot.json plan.json');
const config=JSON.parse(await readFile(configPath,'utf8'));
const snap=JSON.parse(await readFile(snapshotPath,'utf8'));
const parsed=await parseLegacyWorkbook(await readFile(config.file),config);
const rows={sessions:[],bans:[],requests:[],login_attempts:[],users:[],audit:[],...snap.rows};
const state=decodeState(rows),before=structuredClone(encodeState(state));
const result=applyLegacyImport(state,parsed,config);
const after=encodeState(state),changes=stateChanges(before,after);
if(result.alreadyImported){
  assert.deepEqual(after,before,'An already imported batch must not change data.');
  await writeFile(outPath,JSON.stringify({version:snap.version,summary:result,changes:{}},null,2));
  console.log(JSON.stringify({alreadyImported:true,changes:0},null,2));
  process.exit(0);
}
for(const [table,change] of Object.entries(changes)){
  assert(!change.delete.length,'Imports must not delete existing data.');
  const existing=new Set(before[table].map(r=>r.id));assert(change.upsert.every(r=>!existing.has(r.key)),`Import tries to modify ${table} records.`);
}
for(const table of Object.keys(before))assert.deepEqual(after[table].slice(0,before[table].length),before[table],`Existing ${table} records changed.`);
const newTabIds=new Set(changes.tabs.upsert.map(r=>r.key));
for(const row of changes.orders.upsert)assert(newTabIds.has(row.body.tabId),'Imported order attaches to an existing live transaction.');
for(const row of changes.payments.upsert)assert(newTabIds.has(row.body.tabId),'Imported payment attaches to an existing live transaction.');
const proof=applyLegacyImport(state,parsed,config);assert.equal(proof.alreadyImported,true);
assert.deepEqual(encodeState(state),after,'Re-import duplicated data.');
await writeFile(outPath,JSON.stringify({version:snap.version,summary:result,changes},null,2));
console.log(JSON.stringify({summary:result,newRows:Object.fromEntries(Object.entries(changes).map(([t,c])=>[t,c.upsert.length])),existingRecordsUnchanged:true,reimportIsIdempotent:true},null,2));
