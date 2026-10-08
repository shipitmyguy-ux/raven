// Closure requires source evidence. Transport errors never imply closure.
export function listingAvailability({status=0,html='',posting=null,atsInactive=false,checkedAt=new Date().toISOString(),sourceUrl=''}={}) {
 const base={state:'unconfirmed',reason:'Source did not confirm availability',checked_at:checkedAt,source_url:sourceUrl,http_status:status};
 if(atsInactive) return {...base,state:'closed',reason:'Authoritative ATS reports this posting inactive'};
 if(status===403||status===429||status>=500||!status) return {...base,reason:'Source check blocked or unavailable'};
 if(posting){
  const state=String(posting.jobStatus||posting.status||'').toLowerCase();
  if(/^(closed|filled|expired|inactive)$/.test(state)) return {...base,state:'closed',reason:'JobPosting status: '+state};
  const expiry=String(posting.validThrough||'');
  const date=Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(expiry)?expiry+'T23:59:59.999Z':expiry);
  if(Number.isFinite(date)&&date<Date.parse(checkedAt)) return {...base,state:'closed',reason:'JobPosting validThrough expired: '+expiry};
 }
 // Ignore scripts, styles and hidden comments: matching these can hide a live listing.
 const bodyHtml=String(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ');
 const visible=bodyHtml.replace(/<\/?(?:p|div|section|article|h[1-6]|li)\b[^>]*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/[ \t]+/g,' ');
 const match=visible.match(/(?:^|[.!?]\s*|\n\s*)(?:this (?:job|position|listing|posting) (?:is (?:no longer available|closed|expired)|has (?:been filled|closed|expired))|(?:this job|this position|this listing) is no longer accepting applications|no longer accepting applications (?:for|to) this (?:job|position))(?=[.!?]|\s*$)/im);
 const closureLabel=bodyHtml.match(/>\s*(No longer accepting applications|This job is no longer available|The job you are looking for is no longer available)\s*</i);
 if(closureLabel) return {...base,state:'closed',reason:'Source states: '+closureLabel[1]};
 if(match) return {...base,state:'closed',reason:'Source states: '+match[0]};
 return base;
}
export function authoritativePostingEndpoint(url){
 try{
  const u=new URL(url),p=u.pathname.split('/').filter(Boolean);
  if(u.hostname==='jobs.lever.co'&&p.length>=2&&/^[a-f\d-]{36}$/i.test(p[1])) return 'https://api.lever.co/v0/postings/'+encodeURIComponent(p[0])+'/'+p[1];
  const id=u.searchParams.get('gh_jid')||p.at(-1);
  if(['boards.greenhouse.io','job-boards.greenhouse.io'].includes(u.hostname)&&p[0]&&/^\d+$/.test(id||'')) return 'https://boards-api.greenhouse.io/v1/boards/'+encodeURIComponent(p[0])+'/jobs/'+id;
 }catch{}
 return '';
}
