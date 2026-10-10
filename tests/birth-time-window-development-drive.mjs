import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const port=8794,baseURL='http://127.0.0.1:'+port;
const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port',String(port)],{
 cwd:process.cwd(),detached:process.platform!=='win32',
 env:{...process.env,NODE_ENV:'development',ASTRO_PREVIEW_BACKGROUND:'0'},
 stdio:['ignore','pipe','pipe'],
});
let spawnError=null,output=[];
server.on('error',error=>{spawnError=error;});
const record=chunk=>{const text=chunk.toString();output.push(text);if(output.length>80)output.shift();process.stdout.write(text);};
server.stdout.on('data',record);server.stderr.on('data',record);
try{
 const deadline=Date.now()+120000;let ready=false;
 while(Date.now()<deadline){
  if(spawnError)throw spawnError;
  if(server.exitCode!==null)throw new Error('Development server exited '+server.exitCode+'\n'+output.join(''));
  try{const response=await fetch(baseURL+'/birth-chart/',{signal:AbortSignal.timeout(5000)});if(response.status===200){ready=true;break;}}catch{}
  await delay(250);
 }
 if(!ready)throw new Error('Development server did not become ready\n'+output.join(''));
 const child=spawn(process.execPath,['tests/birth-time-window-drive.mjs'],{
  cwd:process.cwd(),env:{...process.env,ZODIACS_TEST_BASE_URL:baseURL,BIRTH_WINDOW_SERVER_MODE:'development'},stdio:'inherit',
 });
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve(code??(signal?1:0)));});
 if(code!==0)throw new Error('Actual development browser controls failed: '+code);
}finally{
 if(server.pid&&server.exitCode===null){
  const kill=signal=>{try{if(process.platform==='win32')server.kill(signal);else process.kill(-server.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}};
  kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),delay(5000)]);
  if(server.exitCode===null)kill('SIGKILL');
 }
}
