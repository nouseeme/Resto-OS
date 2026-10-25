import { prepareMenuImage, removeMenuImage } from '../server/media.js';
import { openCloudStore } from '../server/cloud-store.js';
process.loadEnvFile('.env');
const store=openCloudStore();
const original=(await store.read()).settings.logo;
if(original?.startsWith('data:')){
  const uploaded=await prepareMenuImage(original,'branding');
  let changed=false;
  try {
    await store.transaction(s=>{if(s.settings.logo===original){s.settings.logo=uploaded;changed=true}});
    // Re-read after an ambiguous response before considering any deletion.
    const referenced=(await store.read()).settings.logo===uploaded;
    if(!referenced)await removeMenuImage(uploaded);
    console.log(JSON.stringify({brandingMigrated:referenced,concurrentSettingsChange:!changed}));
  }catch(error){console.error('Logo migration requires verification; uploaded file retained.');throw error}
}else console.log(JSON.stringify({brandingMigrated:false,alreadyUsesFile:true}));
