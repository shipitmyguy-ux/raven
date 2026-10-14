const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function createQueueHandler({rest,now=()=>Date.now()}){
 return async req=>{
  const origin=req.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin==='https://shipitmyguy-ux.github.io')Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,x-raven-device','Access-Control-Allow-Methods':'POST,OPTIONS'});
  const send=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&origin!=='https://shipitmyguy-ux.github.io')return send(403,{error:'Untrusted origin.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return send(405,{error:'POST required.'});
  const token=req.headers.get('x-raven-device')||'';
  if(!/^[a-f0-9]{64}$/.test(token))return send(401,{error:'Pair this device with your Raven computer first.'});
  try{
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('');
   const devices=await rest('raven_local_devices?token_hash=eq.'+hash+'&select=id,worker_id,expires_at,revoked&limit=1');
   const device=devices[0];
   if(!device||device.revoked||Date.parse(device.expires_at)<=now())return send(401,{error:'Device pairing expired or was revoked. Pair again on your Raven computer.'});
   // Bound the actual stream rather than trusting Content-Length.
   const reader=req.body?.getReader();let size=0,chunks=[];
   if(!reader)return send(400,{error:'JSON required.'});
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return send(413,{error:'Request too large.'});}chunks.push(value);}
   const raw=new Uint8Array(size);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.length;}
   let input;try{input=JSON.parse(new TextDecoder().decode(raw));}catch{return send(400,{error:'Invalid JSON.'});}
   if(!input||typeof input!=='object'||Array.isArray(input))return send(400,{error:'Invalid request.'});
   const workers=await rest('raven_local_workers?id=eq.'+device.worker_id+'&select=last_seen&limit=1');
   const online=Boolean(workers[0]&&now()-Date.parse(workers[0].last_seen)<90000);
   if(input.action==='health')return send(200,{online});
   if(input.action==='enqueue'){
    if(Object.keys(input).some(k=>!['action','job_id','document_type'].includes(k))||!/^[A-Za-z0-9_-]{1,160}$/.test(input.job_id||'')||!['resume','coverLetter','both'].includes(input.document_type))return send(400,{error:'Invalid document request.'});
    const rows=await rest('rpc/raven_enqueue_local',{method:'POST',body:JSON.stringify({p_device:device.id,p_job:input.job_id,p_kind:input.document_type})});
    if(!rows[0])return send(429,{error:'Queue full or job unavailable. Check existing requests.'});
    return send(202,{...rows[0],online});
   }
   if(input.action==='status'&&uuid.test(input.run_id||'')){
    const rows=await rest('raven_local_queue?run_id=eq.'+input.run_id+'&device_id=eq.'+device.id+'&select=run_id,job_id,document_type,stage,error,documents&limit=1');
    return rows[0]?send(200,{...rows[0],online}):send(404,{error:'Request not found.'});
   }
   return send(400,{error:'Unknown action.'});
  }catch{return send(503,{error:'Raven queue is unavailable. Your saved documents are unchanged.'});}
 };
}
