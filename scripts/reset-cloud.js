process.loadEnvFile('.env');
if(!process.argv.includes('--confirm-total-reset')) throw new Error('Destructive production reset: explicitly pass --confirm-total-reset only after owner authorization.');
const {openCloudStore}=await import('../server/cloud-store.js');
const {initialState}=await import('../server/store.js');
const {supabase}=await import('../server/supabase.js');
const store=openCloudStore();
await store.transaction(s=>{
  const fresh=initialState();fresh.settings.name='Restoran Anda';fresh.settings.tagline='';
  Object.assign(s,fresh,{menu:[],tabs:[],orders:[],payments:[],audit:[],bans:{},requests:{},users:[],sessions:[],loginAttempts:{}});
});
// Only this app's menu-images bucket is within the reset's scope.
async function clearImages(prefix='') {
  const {data,error}=await supabase().storage.from('menu-images').list(prefix,{limit:1000});if(error)throw error;
  for(const item of data??[]) {
    const key=prefix?`${prefix}/${item.name}`:item.name;
    if(item.id){const {error}=await supabase().storage.from('menu-images').remove([key]);if(error)throw error}
    else await clearImages(key);
  }
  if(data?.length===1000)await clearImages(prefix);
}
await clearImages();
const state=await store.read();
for(const key of ['menu','tabs','orders','payments','users','sessions','audit'])if(state[key].length)throw new Error(`${key} is not empty`);
console.log('Total reset verified: no menus, transactions, orders, payments, staff, sessions, audit or uploaded menu images. Default restaurant settings restored.');
