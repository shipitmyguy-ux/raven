// Closure requires explicit evidence from the requested listing, never a fetch failure.
export function listingEvidence({status=200,html='',url='',finalUrl=url,now=Date.now()}) {
  const unknown=reason=>({state:'unconfirmed',reason});
  if(status!==200) return unknown('Source returned HTTP '+status);
  const visible=String(html).replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/g,' ').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();
  if(/captcha|verify (?:that )?you are human|access denied|unusual traffic|sign in to (?:view|continue)/i.test(visible)) return unknown('Source access is restricted');
  try { if(new URL(finalUrl).pathname!==new URL(url).pathname) return unknown('Source redirected away from this listing'); } catch {return unknown('Invalid source URL');}
  const notice=visible.match(/\b(?:(?:this|the) (?:job|position|role|vacancy|listing|posting) (?:is |has been |was )?(?:no longer available|no longer accepting applications|closed|filled|expired)|(?:this|the) (?:job|position|role|vacancy|listing|posting) has (?:closed|expired)|no longer accepting applications|this job is no longer posted)\b/i);
  if(notice) return {state:'closed',reason:notice[0].slice(0,240)};
  for(const match of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk=v=>Array.isArray(v)?v.flatMap(walk):v&&typeof v==='object'?[v,...walk(v['@graph']||[])]:[];
      for(const job of walk(JSON.parse(match[1]))) {
        if(job['@type']!=='JobPosting' && !job['@type']?.includes?.('JobPosting')) continue;
        // A page can contain related vacancies; structured evidence must identify this URL.
        if(!job.url || new URL(job.url,url).host!==new URL(url).host || new URL(job.url,url).pathname!==new URL(url).pathname) continue;
        const expiry=Date.parse(job.validThrough);
        if(Number.isFinite(expiry)&&expiry<now) return {state:'closed',reason:'JobPosting validThrough expired: '+job.validThrough};
        if(job.title&&job.description) return {state:'open',reason:'Current JobPosting found at listing URL'};
      }
    } catch {}
  }
  return unknown('No definitive listing availability evidence');
}

export async function checkListing(url,fetcher=fetch) {
  try {
    const response=await fetcher(url,{headers:{'User-Agent':'Mozilla/5.0 RavenJobSearch/3.0'},redirect:'follow',signal:AbortSignal.timeout(7000)});
    const html=response.ok?await response.text():'';
    return {...listingEvidence({status:response.status,html,url,finalUrl:response.url||url}),checked_at:new Date().toISOString(),http_status:response.status};
  } catch {return {state:'unconfirmed',reason:'Source request timed out or failed',checked_at:new Date().toISOString(),http_status:0};}
}
