// Cross-feed duplicate evidence. Never merge solely on similar boilerplate.
const stop=new Set('the and for with from this that your our you are will have has job role team company benefits equal opportunity employer apply application requirements qualifications experience work position'.split(' '));
export function normalizeIdentity(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
export function canonicalJobUrl(raw){try{const u=new URL(raw);if(u.protocol!=='https:')return '';u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|ref$|source$|gh_src$|rs$)/i.test(k))u.searchParams.delete(k);u.hostname=u.hostname.toLowerCase();u.pathname=u.pathname.replace(/\/$/,'');return u.toString();}catch{return '';}}
export function descriptionTokens(s){return new Set(String(s||'').toLowerCase().replace(/<[^>]*>/g,' ').split(/\n|[.!?]/).filter(line=>!/(equal opportunity|benefits include|about (us|the company)|privacy policy|accommodation)/i.test(line)).join(' ').match(/[a-z][a-z0-9+#-]{2,}/g)?.filter(t=>!stop.has(t))||[]);}
export function textSimilarity(a,b){const x=descriptionTokens(a),y=descriptionTokens(b);if(x.size<30||y.size<30)return null;let shared=0;for(const t of x)if(y.has(t))shared++;return shared/(x.size+y.size-shared);}
export function duplicateEvidence(a,b){
 const sameCompany=normalizeIdentity(a.company)===normalizeIdentity(b.company)&&!!normalizeIdentity(a.company);
 const sameUrl=!!canonicalJobUrl(a.url)&&canonicalJobUrl(a.url)===canonicalJobUrl(b.url);
 const sameATS=!!a.ats_id&&!!b.ats_id&&String(a.ats_id)===String(b.ats_id)&&normalizeIdentity(a.ats_provider)===normalizeIdentity(b.ats_provider);
 const sameTitle=normalizeIdentity(a.title)===normalizeIdentity(b.title);
 const sameLocation=normalizeIdentity(a.location)===normalizeIdentity(b.location);
 const similarity=sameCompany?textSimilarity(a.description||a.snippet,b.description||b.snippet):null;
 const differentSeniority=/\b(junior|senior|principal|lead|intern)\b/g;
 const levels=s=>[...normalizeIdentity(s).matchAll(differentSeniority)].map(m=>m[0]).join('|');
 const conflictingLevel=!!levels(a.title)&&!!levels(b.title)&&levels(a.title)!==levels(b.title);
 const conflictingLocation=!!normalizeIdentity(a.location)&&!!normalizeIdentity(b.location)&&!sameLocation;
 let decision='distinct';
 if(sameUrl||sameATS)decision='duplicate';
 else if(sameCompany&&!conflictingLevel&&!conflictingLocation&&sameTitle&&(similarity===null||similarity>=0.85))decision='review';
 else if(sameCompany&&!conflictingLevel&&!conflictingLocation&&similarity!==null&&similarity>=0.95)decision='review';
 return {decision,sameUrl,sameATS,sameCompany,sameTitle,sameLocation,similarity,conflictingLevel,conflictingLocation};
}
