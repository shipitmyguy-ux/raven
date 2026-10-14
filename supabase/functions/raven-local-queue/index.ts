import {createQueueHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const rest=async(path:string,init:RequestInit={})=>{
 const response=await fetch(url+'/rest/v1/'+path,{...init,signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...init.headers}});
 if(!response.ok)throw Error('DATABASE_UNAVAILABLE');
 return response.json();
};
// Custom 256-bit paired-device credentials are checked on every request.
Deno.serve(createQueueHandler({rest}));
