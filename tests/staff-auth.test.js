import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateStaff, staffStillAllowed, isStaff, createStaff } from '../server/staff-auth.js';

const user = { id: 'auth-id', email: 'staff@example.com', email_confirmed_at: new Date().toISOString(), user_metadata: { name: 'Staf' } };
test('Supabase password login requires confirmed staff without metadata grants', async () => {
  let credentials;
  const client = { auth: { signInWithPassword: async input => { credentials = input; return { data: { user } }; } } };
  const profile = await authenticateStaff(' STAFF@example.com ', 'test-password', client);
  assert.deepEqual(credentials, { email: 'staff@example.com', password: 'test-password' });
  assert.equal(profile.authUserId, user.id);
  assert.equal(profile.password, undefined);
  assert.equal(isStaff({ ...user, app_metadata: {} }), true);
  assert.equal(isStaff({ ...user, email_confirmed_at: null }), false);
  assert.equal(isStaff({ ...user, banned_until: '2999-01-01' }), false);
  await assert.rejects(authenticateStaff('staff@example.com', 'wrong', { auth: { signInWithPassword: async () => ({ error: { status: 400 } }) } }), { status: 401 });
});
test('existing sessions lose access after removal or ban', async () => {
  for (const account of [null, { ...user, banned_until: '2999-01-01' }]) {
    assert.equal(await staffStillAllowed(user.id, { auth: { admin: { getUserById: async () => ({ data: { user: account } }) } } }), false);
  }
  await assert.rejects(staffStillAllowed(user.id, { auth: { admin: { getUserById: async () => ({ error: { status: 500 } }) } } }), { status: 503 });
});

test('Management creates a confirmed Auth account and profile without storing passwords', async () => {
  let created, saved;
  const client = { auth: { admin: { createUser: async input => { created=input; return {data:{user}}; } } } };
  await createStaff({name:' Staf ',email:' STAFF@example.com ',password:'test-password'}, async profile=>{saved=profile;}, client);
  assert.deepEqual(created,{email:'staff@example.com',password:'test-password',email_confirm:true,user_metadata:{name:'Staf'}});
  assert.equal(saved.id,user.id);
  assert.equal(saved.password,undefined);
});
test('invalid and duplicate accounts do not save profiles; failed saves clean up Auth account', async () => {
  let calls=0,deleted;
  const client={auth:{admin:{createUser:async()=>{calls++;return {data:{user}};},deleteUser:async id=>{deleted=id;return {};}}}};
  await assert.rejects(createStaff({name:'Staf',email:'bad',password:'test-password'},()=>{},client),{status:400});
  assert.equal(calls,0);
  await assert.rejects(createStaff({name:'Staf',email:user.email,password:'test-password'},()=>{throw new Error('save failed');},client),/save failed/);
  assert.equal(deleted,user.id);
  let saved=false;
  await assert.rejects(createStaff({name:'Staf',email:user.email,password:'test-password'},()=>{saved=true;},{auth:{admin:{createUser:async()=>({error:{status:422}})}}}),{status:400});
  assert.equal(saved,false);
});
