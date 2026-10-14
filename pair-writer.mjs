import {PAIR_KEY,QUEUE_URL} from './remote-writer-client.mjs';
const status=document.querySelector('#status'),link=document.querySelector('#link');
const candidate=location.hash.slice(1);history.replaceState(null,'',location.pathname+location.search);
if(/^[a-f0-9]{64}$/.test(candidate)){
 document.querySelector('#connect').hidden=false;document.querySelector('#pair').hidden=true;
 document.querySelector('#intro').textContent='Connect this device to your local Raven writer. It can request new documents and read the results until the pairing expires.';
}
document.querySelector('#connect').onclick=async()=>{
 try{const r=await fetch(QUEUE_URL,{method:'POST',headers:{'Content-Type':'application/json','x-raven-device':candidate},body:JSON.stringify({action:'health'})});const data=await r.json();if(!r.ok)throw Error(data.error);localStorage.setItem(PAIR_KEY,candidate);status.textContent=data.online?'Connected. Return to Raven and choose Generate both.':'Connected. Requests will wait until your computer’s writer is online.';}catch(e){status.textContent=e.message;}
};
document.querySelector('#forget').onclick=()=>{localStorage.removeItem(PAIR_KEY);status.textContent='Disconnected on this device. Creating a new pairing link on your computer revokes the old link everywhere.';};
document.querySelector('#pair').onclick=async()=>{
 try{
  const headers={'Content-Type':'application/json','X-Raven-Local-Client':'raven-web-v1'};
  const s=await fetch('http://127.0.0.1:8766/session',{method:'POST',headers,body:'{}',referrerPolicy:'unsafe-url'});const session=await s.json();if(!s.ok||!session.token)throw Error('Start your Raven helper on this computer first.');
  const r=await fetch('http://127.0.0.1:8766/pair',{method:'POST',headers:{...headers,Authorization:'Bearer '+session.token},body:'{}',referrerPolicy:'unsafe-url'});const data=await r.json();if(!r.ok)throw Error(data.error);
  link.value=data.url;link.hidden=false;status.textContent='Open this private link on your phone. It expires '+new Date(data.expires_at).toLocaleDateString()+'. Previous pairing links are now revoked.';
 }catch(e){status.textContent='Pairing failed: '+e.message;}
};
