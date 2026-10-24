import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../server/store.js';
import {encodeState,decodeState,openCloudStore} from '../server/cloud-store.js';
import {validateImage} from '../server/media.js';
import sharp from 'sharp';

test('new application state contains no demo catalog, staff, or transactions',()=>{
  const state=initialState();
  for(const key of ['menu','tabs','orders','payments','users','sessions','audit'])assert.deepEqual(state[key],[]);
  assert.equal(state.settings.name,'Restoran Anda');assert.equal(state.settings.tagline,'');
});

test('cloud adapter preserves snapshots, maps and portions; retries against fresh state on conflict',async()=>{
  const initial=initialState();initial.sessions=[];initial.loginAttempts={};
  assert.deepEqual(decodeState(encodeState(initial)),initial);
  let state=structuredClone(initial),version=0,conflict=true,commits=0;
  const client={async rpc(name,args){
    if(name==='resto_snapshot')return {data:{version,rows:encodeState(structuredClone(state))}};
    commits++;
    if(conflict){conflict=false;state.settings.tagline='Concurrent edit';version++;return {data:false}};
    assert.equal(args.expected_version,version);
    const rows=encodeState(state);
    for(const [table,change] of Object.entries(args.changes)){
      rows[table]=rows[table].filter(x=>!change.delete.includes(x.id));
      for(const x of change.upsert){const i=rows[table].findIndex(y=>y.id===x.key);if(i<0)rows[table].push(x.body);else rows[table][i]=x.body}
    }
    state=decodeState(rows);version++;return {data:true};
  }};
  await openCloudStore(client).transaction(s=>{s.settings.paused=true});
  assert.equal(commits,2);assert.equal(state.settings.paused,true);assert.equal(state.settings.tagline,'Concurrent edit');
});
test('image validation rejects spoofed, oversized and corrupt files and converts real images to WebP',async()=>{
  await assert.rejects(validateImage('data:image/svg+xml;base64,PHN2Zz4='),/PNG/);
  await assert.rejects(validateImage('data:image/png;base64,aGVsbG8='),/rusak/);
  await assert.rejects(validateImage('data:image/png;base64,'+'A'.repeat(2800001)),/2 MB/);
  const input=await sharp({create:{width:1800,height:400,channels:3,background:'#a43c2d'}}).png().toBuffer();
  const output=await validateImage(`data:image/png;base64,${input.toString('base64')}`);
  const meta=await sharp(output).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,1280);
});
