(function(global){
"use strict";
// Shared identity for discovery, saved jobs, browser display and import. No rows are deleted.
const OFFICIAL = new Set(['ashby','greenhouse','lever','workable','smartrecruiters','bamboohr','icims','avature','jobylon','teamtailor','breezy','recruitee']);
const BOARDS = new Set(['workwithindies','remotegamejobs','artstation','blenderartists','epicforum','hitmarker','eightbit','skillsearch','gamesjobsdirect','ingamejob']);
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
function employer(value) {
  const name=normalize(value), alias=name.replace(/[\s-]/g,'');
  if (['halfmermaid','halfmermaidproductions'].includes(alias)) return 'half mermaid';
  if (alias==='smilebreak') return 'smile break';
  if (!name || /\b(?:undisclosed|unknown)\s+client\b/.test(name) || /^(?:undisclosed|unknown)\b/.test(name) || /^(?:unknown(?: employer)?|unspecified|confidential|anonymous|indie studio|studio|company|n\/a)$/.test(name)) return '';
  return name;
}
function provider(row) {
  const match=/^Studio:([a-z]+)$/.exec(String(row?.source || ''));
  return match && (OFFICIAL.has(match[1]) || BOARDS.has(match[1])) ? match[1] : '';
}
// Exact board-to-employer posting evidence: docs/board-duplicate-identities.json.
// These aliases waive only location phrasing equality, never employer/title/remote.
const VERIFIED_POSTINGS = new Map([
  [
    "https://www.workwithindies.com/careers/half-mermaid-environment-artist",
    {
      "posting": "https://app.trinethire.com/companies/30538-half-mermaid-productions/jobs/125496-environment-artist",
      "company": "half mermaid",
      "title": "environment artist",
      "provider": "workwithindies"
    }
  ],
  [
    "https://remotegamejobs.com/jobs/half-mermaid-productions-environment-artist-remote-job",
    {
      "posting": "https://app.trinethire.com/companies/30538-half-mermaid-productions/jobs/125496-environment-artist",
      "company": "half mermaid",
      "title": "environment artist",
      "provider": "remotegamejobs"
    }
  ],
  [
    "https://www.workwithindies.com/careers/half-mermaid-senior-environment-artist",
    {
      "posting": "https://app.trinethire.com/companies/30538-half-mermaid-productions/jobs/125495-senior-environment-artist",
      "company": "half mermaid",
      "title": "senior environment artist",
      "provider": "workwithindies"
    }
  ],
  [
    "https://remotegamejobs.com/jobs/half-mermaid-productions-senior-environment-artist-remote-job-f3701dac-2485-4691-bb10-3933a0b0337b",
    {
      "posting": "https://app.trinethire.com/companies/30538-half-mermaid-productions/jobs/125495-senior-environment-artist",
      "company": "half mermaid",
      "title": "senior environment artist",
      "provider": "remotegamejobs"
    }
  ],
  [
    "https://www.artstation.com/jobs/QKn9",
    {
      "posting": "https://www.useparallel.com/smilebreak/careers/6ab429f63bd186aa38742a13",
      "company": "smile break",
      "title": "senior environment artist",
      "provider": "artstation"
    }
  ],
  [
    "https://remotegamejobs.com/jobs/smile-break-senior-environment-artist-remote-job",
    {
      "posting": "https://www.useparallel.com/smilebreak/careers/6ab429f63bd186aa38742a13",
      "company": "smile break",
      "title": "senior environment artist",
      "provider": "remotegamejobs"
    }
  ],
  [
    "https://hitmarker.net/jobs/hyperhug-3d-artist-weapon-skins-4737280",
    {
      "posting": "https://jobs.ashbyhq.com/hyperhug/5470c42c-1502-42aa-a3de-3ce213fb62d8",
      "company": "hyperhug",
      "title": "3d artist (weapon skins)",
      "provider": "hitmarker"
    }
  ],
  [
    "https://jobs.ashbyhq.com/hyperhug/5470c42c-1502-42aa-a3de-3ce213fb62d8",
    {
      "posting": "https://jobs.ashbyhq.com/hyperhug/5470c42c-1502-42aa-a3de-3ce213fb62d8",
      "company": "hyperhug",
      "title": "3d artist (weapon skins)",
      "provider": "ashby"
    }
  ]
]);
// Additional saved-record audit evidence: docs/qa/2026-10-13-all-jobs-dedup.md.
for(const [url,posting,company,title,source] of [
  ['https://remotegamejobs.com/jobs/eleventh-hour-games-senior-environment-artist-remote-job-0969af74-f18a-4318-af57-ede0884e5bd1','https://job-boards.greenhouse.io/eleventhhourgames/jobs/8501085002','eleventh hour games','senior environment artist','remotegamejobs'],
  ['https://www.linkedin.com/jobs/view/senior-environment-artist-at-eleventh-hour-games-4399058671','https://job-boards.greenhouse.io/eleventhhourgames/jobs/8501085002','eleventh hour games','senior environment artist','linkedin'],
  ['https://job-boards.greenhouse.io/eleventhhourgames/jobs/8501085002','https://job-boards.greenhouse.io/eleventhhourgames/jobs/8501085002','eleventh hour games','senior environment artist','greenhouse'],
  ['https://hitmarker.net/jobs/mob-entertainment-principal-environment-artist-5151006','https://job-boards.greenhouse.io/mobentertainment/jobs/5259693007','mob entertainment','principal environment artist','hitmarker'],
  ['https://www.linkedin.com/jobs/view/principal-environment-artist-at-mob-entertainment-4474473548','https://job-boards.greenhouse.io/mobentertainment/jobs/5259693007','mob entertainment','principal environment artist','linkedin'],
])VERIFIED_POSTINGS.set(url,{posting,company,title,provider:source});
function identity(row) {
  const company=employer(row.company), title=normalize(row.title), location=normalize(row.location);
  // Unknown remote status or geography cannot establish compatible constraints.
  if (!company || !title || !location || typeof row.remote!=='boolean') return '';
  const posting=VERIFIED_POSTINGS.get(row.url);
  if (posting) {
    if (company!==posting.company || title!==posting.title || provider(row)!==posting.provider) return '';
    return JSON.stringify(['verified-posting',posting.posting,company,title,row.remote]);
  }
  return JSON.stringify([company,title,location,row.remote]);
}
function better(a,b) {
  const officialA=OFFICIAL.has(provider(a)), officialB=OFFICIAL.has(provider(b));
  if (officialA!==officialB) return officialB ? b : a;
  return String(b.snippet || '').length > String(a.snippet || '').length ? b : a;
}
function deduplicateStudioResults(rows) {
  const groups=new Map();
  for (const row of rows) {
    const source=provider(row), key=source && identity(row);
    if (!key) continue;
    const group=groups.get(key) || [];
    group.push(row);groups.set(key,group);
  }
  const replacements=new Map(), hidden=new Set();
  for (const group of groups.values()) {
    const providers=new Set(group.map(provider));
    // More than one posting on one provider makes cross-provider identity
    // ambiguous: retain the entire group rather than guess which job matches.
    if (group.length<2 || providers.size!==group.length) continue;
    const winner=group.reduce(better);
    replacements.set(group[0],winner);
    for (const row of group.slice(1)) hidden.add(row);
  }
  return rows.filter(row=>!hidden.has(row)).map(row=>replacements.get(row) || row);
}


function canonicalUrl(value) {
  try {
    const u=new URL(String(value||'').trim().replace(/&amp;/g,'&'));
    if (!['http:','https:'].includes(u.protocol)||u.username||u.password) return '';
    u.hash='';
    for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k)||['source','gh_src','trackingId','trk','refId'].includes(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    u.pathname=u.pathname.replace(/\/+$/,'')||'/';
    return u.toString().replace(/\/$/,'');
  } catch {return '';}
}
function atsKey(value) {
  const url=canonicalUrl(value); if(!url)return '';
  const u=new URL(url),h=u.hostname.toLowerCase(),p=u.pathname;let m;
  if(['www.linkedin.com','linkedin.com'].includes(h)&&(m=p.match(/^\/jobs\/view\/(?:[^/]*-)?(\d{6,})\/?$/)))return 'linkedin:'+m[1];
  if(['www.useparallel.com','useparallel.com'].includes(h)&& (m=p.match(/^\/([^/]+)\/careers\/([a-f0-9]{24})(?:\/apply)?$/i)))return 'parallel-id:'+m[2].toLowerCase();
  if(['www.useparallel.com','useparallel.com'].includes(h)&& (m=p.match(/^\/app\/candidate\/job\/([a-f0-9]{24})$/i)))return 'parallel-id:'+m[1].toLowerCase();
  if(['boards.greenhouse.io','job-boards.greenhouse.io','boards.eu.greenhouse.io','job-boards.eu.greenhouse.io'].includes(h)&& (m=p.match(/^\/([^/]+)\/jobs\/(\d+)(?:\/application)?$/)))return 'greenhouse:'+m[1].toLowerCase()+':'+m[2];
  if(h==='jobs.ashbyhq.com'&&(m=p.match(/^\/([^/]+)\/([a-f0-9-]{36})(?:\/application)?$/i)))return 'ashby:'+m[1].toLowerCase()+':'+m[2].toLowerCase();
  if(['jobs.lever.co','jobs.eu.lever.co'].includes(h)&&(m=p.match(/^\/([^/]+)\/([a-f0-9-]{36})(?:\/apply)?$/i)))return 'lever:'+m[1].toLowerCase()+':'+m[2].toLowerCase();
  if(h==='jobs.smartrecruiters.com'&&(m=p.match(/^\/([^/]+)\/(\d+)(?:-[^/]+)?$/)))return 'smartrecruiters:'+m[1].toLowerCase()+':'+m[2];
  if(h==='apply.workable.com'&&(m=p.match(/^\/([^/]+)\/j\/([a-z0-9]+)(?:\/apply)?$/i)))return 'workable:'+m[1].toLowerCase()+':'+m[2].toUpperCase();
  if(h==='apply.workable.com'&&(m=p.match(/^\/j\/([a-z0-9]+)(?:\/apply)?$/i)))return 'workable-id:'+m[1].toUpperCase();
  if(/^[a-z0-9-]+\.bamboohr\.com$/.test(h)&&(m=p.match(/^\/(?:careers|jobs\/view\.php)\/?(\d+)?$/i))){const id=m[1]||u.searchParams.get('id');if(/^\d+$/.test(id||''))return 'bamboohr:'+h.split('.')[0]+':'+id;}
  if(/^[a-z0-9-]+\.icims\.com$/.test(h)&&(m=p.match(/^\/jobs\/(\d+)(?:\/[^/]+(?:\/job)?)?$/i)))return 'icims:'+h+':'+m[1];
  if(h==='app.trinethire.com'&&(m=p.match(/^\/companies\/(\d+)[^/]*\/jobs\/(\d+)[^/]*(?:\/apply)?$/)))return 'trinethire:'+m[1]+':'+m[2];
  return '';
}
function titleKey(value){return normalize(value).replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function remoteValue(row){return row.remote===true||normalize(row.remote)==='remote'?true:row.remote===false||row.remote===''?false:null;}
function description(row){return String(row.snippet||row.notes||'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp);/g,' ').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function postingKeys(row) {
  const keys=new Set(),url=canonicalUrl(row.url),alias=VERIFIED_POSTINGS.get(url);
  const company=employer(row.company),title=normalize(row.title);
  if(alias&&company===alias.company&&title===alias.title){const key=atsKey(alias.posting);if(key)keys.add(key);}
  const direct=atsKey(row.url);if(direct)keys.add(direct);
  // Only explicitly labelled application links; never infer identity from a
  // company-homepage, portfolio, unrelated job link or credential-bearing URL.
  const raw=String(row.snippet||row.notes||'');
  for(const m of raw.matchAll(/(?:how to apply|apply (?:here|now|at)|application url)\s*:\s*(https?:\/\/[^\s<>"']+)/gi)){
    const key=atsKey(m[1].replace(/[).,;]+$/,''));if(key)keys.add(key);
  }
  return keys;
}
function sameJob(a,b) {
  const au=canonicalUrl(a.url),bu=canonicalUrl(b.url);
  if(au&&au===bu)return true;
  const company=employer(a.company);
  if(!company||company!==employer(b.company))return false;
  const ak=postingKeys(a),bk=postingKeys(b);
  // The exact employer requisition remains the same vacancy when a board
  // translates or abbreviates its title. Unverified board aliases do not gain
  // a key when their verified employer/title evidence fails above.
  if([...ak].some(key=>!key.startsWith('linkedin:')&&bk.has(key)))return true;
  if(!titleKey(a.title)||titleKey(a.title)!==titleKey(b.title))return false;
  // Exact employer posting identity is stronger than board location labels.
  if(ak.size&&bk.size)return [...ak].some(key=>bk.has(key));
  if(a.track&&b.track&&normalize(a.track)!==normalize(b.track))return false;
  // Similar titles alone never merge jobs. The fallback requires full identical
  // descriptions, compatible work scopes and distinct verified source providers.
  const ap=provider(a),bp=provider(b),ar=remoteValue(a),br=remoteValue(b);
  if(!ap||!bp||ap===bp||ar===null||ar!==br||!normalize(a.location)||normalize(a.location)!==normalize(b.location))return false;
  const ad=description(a),bd=description(b);
  return ad.length>=600&&ad===bd;
}
function saved(row){return !row._discovered&&!/^DISC-/i.test(String(row.id||''))&&normalize(row.status)!=='discovered';}
function lifecycleRank(row){
  const status=normalize(row.status);
  if(row.applied_date||row.appliedDate||['applied','interview','offer','rejected'].includes(status))return 50;
  if(row.resume||row.cover_letter||row.coverLetter)return 40;
  if(status==='ignored'||row.listing_state==='closed')return 30;
  return saved(row)?20:0;
}
function preferred(a,b){
  const ar=lifecycleRank(a),br=lifecycleRank(b);
  if(ar!==br)return br>ar?b:a;
  if(saved(a)!==saved(b))return saved(b)?b:a;
  const ad=Boolean(a.resume||a.cover_letter||a.coverLetter),bd=Boolean(b.resume||b.cover_letter||b.coverLetter);
  if(ad!==bd)return bd?b:a;
  const aa=Boolean(atsKey(a.url))&&!atsKey(a.url).startsWith('linkedin:'),ba=Boolean(atsKey(b.url))&&!atsKey(b.url).startsWith('linkedin:');if(aa!==ba)return ba?b:a;
  return String(b.snippet||b.notes||'').length>String(a.snippet||a.notes||'').length?b:a;
}
function deduplicateJobs(rows){
  // Compare against every member, and refuse ambiguous matches across two
  // groups. This prevents a generic board copy bridging different requisitions.
  const groups=[];
  for(const row of rows){
    const matches=groups.filter(group=>group.every(other=>sameJob(row,other)));
    if(matches.length===1)matches[0].push(row);else groups.push([row]);
  }
  return groups.map(group=>group.reduce(preferred));
}
function findExistingJob(input,rows){
  const matches=rows.filter(row=>sameJob(input,row));
  if(!matches.length)return null;
  // If weaker evidence hits distinct vacancies, preserve them rather than guess.
  if(matches.some(a=>matches.some(b=>!sameJob(a,b))))return null;
  return matches.reduce(preferred);
}
global.RavenJobDedup=Object.freeze({canonicalUrl,atsKey,postingKeys,sameJob,deduplicateJobs,findExistingJob,deduplicateStudioResults});

})(typeof window!=="undefined"?window:globalThis);
