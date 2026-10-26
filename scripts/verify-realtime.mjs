import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env');
const publicKey=process.env.SUPABASE_PUBLISHABLE_KEY;
assert.ok(publicKey,'Configure SUPABASE_PUBLISHABLE_KEY for the target project');
const config={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const anon=createClient(process.env.SUPABASE_URL,publicKey,config);
const service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,config);
let channel,staff;
try{
  channel=anon.channel('resto:catalog',{config:{private:true}}).on('broadcast',{event:'changed'},()=>{});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Catalog subscription timed out')),20000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve()}else if(status==='CHANNEL_ERROR'){clearTimeout(timer);reject(Error('Catalog subscription denied'))}})});
  const marker=crypto.randomUUID();
  const received=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Notification not received')),12000);channel.on('broadcast',{event:'changed'},({payload})=>{if(payload.probe===marker){clearTimeout(timer);resolve()}})});
  const result=await service.channel('resto:catalog',{config:{private:true}}).httpSend('changed',{probe:marker});
  assert.ok(result.success);await received;
  staff=anon.channel('resto:staff',{config:{private:true}}).on('broadcast',{event:'changed'},()=>{});
  const denied=await new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),12000);staff.subscribe(status=>{if(['CHANNEL_ERROR','TIMED_OUT'].includes(status)){clearTimeout(timer);resolve(true)}else if(status==='SUBSCRIBED'){clearTimeout(timer);resolve(false)}})});
  assert.equal(denied,true,'Public clients must not subscribe to staff events');
  console.log(JSON.stringify({catalogSubscription:true,notificationDelivery:true,anonymousStaffSubscriptionDenied:true}));
}finally{await anon.removeAllChannels();await service.removeAllChannels();}
