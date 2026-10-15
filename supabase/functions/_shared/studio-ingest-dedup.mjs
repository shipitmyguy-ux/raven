// Cross-source discovery planning. Conservative: never delete or rewrite a
// saved application, and never auto-merge jobs based only on descriptions.
import {canonicalJobUrl, duplicateEvidence, normalizeIdentity} from './job-duplicate-evidence.mjs';
import {sameJob} from './studio-result-dedup.mjs';
function scope(value){
 const s=normalizeIdentity(value);
 const country=s.replace(/\b(united states of america|united states|u s a|usa|u s|us)\b/g,'us')
  .replace(/\b(remote|fully remote|work from home)\b/g,' ').trim().replace(/\s+/g,' ');
 if(country==='us'||/^(?:us only|us based|us applicants only)$/.test(country))return 'country:us';
 if(country==='canada'||country==='canada only')return 'country:ca';
 if(!s||s==='remote'||s==='fully remote')return 'unspecified:remote';
 return s;
}
function compatibleGeography(a,b){
 const x=scope(a.location),y=scope(b.location);
 if(x===y)return true;
 // Unspecified remote flags warrant review, not definitive identity.
 return a.remote===true&&b.remote===true&&(x==='unspecified:remote'||y==='unspecified:remote');
}
function reviewReason(a,b,ev){
 if(!ev.sameCompany)return '';
 // Distinct vacancy IDs from one verified ATS may represent multiple hires.
 if(/^Studio:/.test(String(a.source||''))&&a.source===b.source&&a.url!==b.url)return '';
 if(/^(unknown|undisclosed|anonymous|confidential|studio|company|n a)( employer| client)?$/.test(normalizeIdentity(a.company)))return '';
 if(typeof a.remote==='boolean'&&typeof b.remote==='boolean'&&a.remote!==b.remote)return '';
 if(ev.conflictingLevel)return '';
 if(ev.sameTitle&&compatibleGeography(a,b))return 'same-employer-title-and-compatible-scope';
 if(ev.similarity!==null&&ev.similarity>=0.95&&compatibleGeography(a,b))return 'near-identical-description';
 return '';
}
function exactIdentity(a,b){
 const u=canonicalJobUrl(a.url),v=canonicalJobUrl(b.url);
 if(u&&v&&u===v){
  // Generic careers page reused by multiple vacancies is not a unique job ID.
  if(normalizeIdentity(a.title)!==normalizeIdentity(b.title)||normalizeIdentity(a.company)!==normalizeIdentity(b.company)){
   return {type:'review',reason:'shared-application-url'};
  }
  return {type:'duplicate',reason:'identical-application-url'};
 }
 if(sameJob(a,b))return {type:'duplicate',reason:'verified-posting-identity'};
 return null;
}
/**
 * Return only safe new discoveries. Existing discovery and saved application
 * rows are not mutated here. Caller persists ambiguous pairs for review.
 */
export function planStudioIngestion(incoming,existing,sourceLabel,{isSheet=false}={}){
 const known=[...(existing||[])],inserts=[],refresh=[],updates=[],reviews=[];
 let skippedExact=0,heldForReview=0;
 for(const job of incoming||[]){
  if(!job?.url||!job?.title||!job?.company)continue;
  const proposal={...job,source:sourceLabel,track:'Games / 3D',status:'Discovered'};
  let exact=null,review=null;
  for(const row of known){
   const identity=exactIdentity(proposal,row);
   if(identity?.type==='duplicate'){exact={row,reason:identity.reason};break;}
   if(identity?.type==='review'&&!review){review={row,reason:identity.reason,similarity:null};continue;}
   const ev=duplicateEvidence(proposal,row);
   const reason=reviewReason(proposal,row,ev);
   if(reason&&!review)review={row,reason,similarity:ev.similarity};
  }
  if(exact){
   skippedExact++;
   const row=exact.row;
   if(row.source===sourceLabel&&row.status==='Discovered'&&row.url===job.url){
    if(isSheet)refresh.push(job.url);
    else updates.push(job);
   }
   continue;
  }
  if(review){
   heldForReview++;
   reviews.push({
    track:'Games / 3D',candidate_url:String(job.url),existing_url:String(review.row.url),
    candidate_source:sourceLabel,candidate_title:String(job.title).slice(0,500),
    candidate_company:String(job.company).slice(0,500),
    candidate_location:String(job.location||'').slice(0,500),
    reason:review.reason,similarity:review.similarity,status:'pending'
   });
   continue;
  }
  inserts.push(job);known.push(proposal);
 }
 return {inserts,updates,refresh,reviews,skippedExact,heldForReview};
}
