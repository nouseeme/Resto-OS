import { existsSync } from 'node:fs';
if (existsSync('.env') && process.env.RESTO_DB !== ':memory:') process.loadEnvFile('.env');
const { app } = await import('./app.js');
const { default: express } = await import('express');
const { default: path } = await import('node:path');
if(process.argv.includes('--production')) {
  app.use(express.static(path.resolve('dist'),{index:false}));
  app.get(['/portal','/ruang-staf'],(req,res)=>res.sendFile(path.resolve('dist/index.html')));
  app.use((req,res)=>res.status(404).type('text').send('Halaman tidak ditemukan.'));
} else {
  const {createServer}=await import('vite');
  const vite=await createServer({server:{middlewareMode:true,hmr:{port:Number(process.env.PORT??3000)+20000}},appType:'spa'});
  app.use(vite.middlewares);
}
const port=Number(process.env.PORT??3000);
app.listen(port,process.env.HOST??'127.0.0.1',()=>console.log(`restoOS siap di http://localhost:${port}`));
