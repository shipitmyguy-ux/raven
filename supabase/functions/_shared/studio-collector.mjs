// Bounded official-provider reads. Detail failures do not masquerade as list failures.
import {providerDetailEndpoint, providerDetailRecord, normalizeStudioJobs} from './studio-providers.mjs';
export async function fetchStudioText(url, fetcher=fetch) {
 const res=await fetcher(url,{headers:{Accept:'application/json,text/html;q=0.9'},redirect:'error',signal:AbortSignal.timeout(6000)});
 if(!res.ok)throw Error('Provider HTTP '+res.status);
 if(Number(res.headers.get('content-length')||0)>4000000)throw Error('Provider response too large');
 if(!res.body)throw Error('Provider response empty');
 const reader=res.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4000000)throw Error('Provider response too large');chunks.push(value);}}
 finally{await reader.cancel();}
 const bytes=new Uint8Array(size);let position=0;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.length;}
 return new TextDecoder().decode(bytes);
}
export async function fetchStudioJson(url,fetcher=fetch){return JSON.parse(await fetchStudioText(url,fetcher));}
export function reuseFreshStudioDescriptions(jobs,existing,now=Date.now()) {
 const byUrl=new Map(existing.map(row=>[row.url,row]));
 for(const job of jobs){
  if(job.snippet)continue;
  const cached=byUrl.get(job.url),stamp=Date.parse(cached?.studio_description_updated_at||''),published=Date.parse(job.posted_at||'');
  if(cached?.snippet&&Number.isFinite(stamp)&&stamp<=now&&now-stamp<24*3600000&&(!Number.isFinite(published)||published<=stamp)){
   job.snippet=cached.snippet;job.studio_description_updated_at=cached.studio_description_updated_at;
  }
 }
}
export async function enrichStudioDetails(source,jobs,{fetcher=fetch,maxDetails=12,concurrency=2,deadline=Date.now()+40000}={}) {
 if(!['smartrecruiters','bamboohr'].includes(source.provider))return {status:'not_needed',error:null,attempted:0,completed:0,deferred:0};
 const pending=jobs.filter(j=>!j.snippet),selected=pending.slice(0,maxDetails);
 let completed=0,attempted=0;const errors=[];
 for(let i=0;i<selected.length;i+=concurrency){if(Date.now()+6000>deadline)break;await Promise.all(selected.slice(i,i+concurrency).map(async job=>{
  attempted++;try{
   const payload=await fetchStudioJson(providerDetailEndpoint(source.provider,source.board_key,job.provider_job_id),fetcher);
   const record=providerDetailRecord(source.provider,payload,job.provider_job_id);
   const detail=normalizeStudioJobs({...source,job_scope:null},source.provider==='smartrecruiters'?{content:[record]}:{result:[record]})[0];
   if(!detail?.snippet)throw Error('Posting description missing');
   // The list's URL and eligibility remain authoritative; only enrich the description.
   job.snippet=detail.snippet;job.studio_description_updated_at=new Date().toISOString();completed++;
  }catch(e){errors.push(String(e instanceof Error?e.message:e));}
 }));}
 const deferred=Math.max(0,pending.length-attempted),missing=pending.length-completed;
 return {status:missing?(completed||jobs.some(j=>j.snippet)?'partial':'failed'):'complete',attempted,completed,deferred,error:missing?[...new Set(errors),...(deferred?[deferred+' descriptions deferred by scan budget']:[])].join('; ').slice(0,1000):null};
}
