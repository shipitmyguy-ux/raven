const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const transferable=/\b(?:mentor\w*|train\w*|onboard\w*|collaborat\w*|cross[- ]functional|workflow development|workflow coordination|(?:define|defined|improve|improved) workflows?|project[- ]management|deliver\w*|meeting\w*|automat\w*|reporting|quer(?:y|ies|ying)|troubleshoot\w*)\b/i;
const production=/\b(?:sculpt\w*|textur\w*|pbr|world ?building|lighting|materials? and shaders?|asset creation|terrain|look development|visual fidelity)\b/i;
const families=[/mentor|train|onboard|coach|enablement/i,/collaborat|coordinate|cross[- ]functional|stakeholder|meeting/i,/project|deliver|launch|timeline|schedule/i,/workflow|process|troubleshoot|issue|tool/i,/automat|script|module/i,/report|quer|metadata|database|excel/i];
const domains=[['banking',/\b(?:bank\w*|underwriting|credit risk|cash flow|financial modeling)\b/i],['regulatory governance',/\b(?:regulatory|compliance|audit|governance)\b/i],['SaaS',/\bsaas\b/i],['SQL',/\bsql\b/i],['algorithms',/\b(?:algorithms?|optimization and estimation)\b/i],['customer ownership',/\b(?:customer retention|customer accounts?|pooled inbox|customer success experience)\b/i]];
const factsOf=profile=>[...(profile.experience||[]).flatMap(role=>(role.facts||[]).map(f=>({...f,experience_id:role.id}))),...(profile.transferable_facts||[])];
const score=(text,posting)=>families.reduce((sum,re)=>sum+Number(re.test(text)&&re.test(posting)),0);
export function buildRoleEvidencePlan(profile,target){
 if(target?.track!=='Professional')return null;
 const posting=[target.title,target.description].filter(Boolean).join('\n');
 const facts=factsOf(profile),allEvidence=[...facts.map(f=>f.text),...(profile.skills||[])].join('\n');
 const requirements=String(target.description||'').split(/\n|[•●]|(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>30&&s.length<1100&&!/^(?:about us|about \w+|benefits|salary|compensation|equal opportunity|our mission|we are a|founded in)/i.test(s)&&/^(?:lead|manage|own|build|coordinate|develop|design|maintain|establish|translate|evaluate|monitor|partner|drive|identify|use|support|mentor|train|\d+\+? years)|\b(?:required|must have|experience in|experience with|years of experience)\b/i.test(s)).slice(0,18).map(text=>{
  const matched=facts.filter(f=>transferable.test(f.text)&&score(f.text,text)>0).sort((a,b)=>score(b.text,text)-score(a.text,text)).slice(0,5);
  const unverified=domains.filter(([,re])=>re.test(text)&&!re.test(allEvidence)).map(([name])=>name);
  return {text,matched_fact_ids:matched.map(f=>f.id),status:matched.length?'transferable':'gap',unverified_domains:unverified};
 });
 const ranked=list=>list.filter(f=>transferable.test(f.text)).map(f=>({id:f.id,text:f.text,score:score(f.text,posting)})).sort((a,b)=>b.score-a.score).map(({score,...f})=>f);
 return {requirements,employer_evidence:(profile.experience||[]).map(role=>({experience_id:role.id,priority_facts:ranked(role.facts||[])})),general_evidence:ranked(profile.transferable_facts||[]),gaps:[...new Set(domains.filter(([,re])=>re.test(posting)&&!re.test(allEvidence)).map(([name])=>name))],policy:'This is a relevance plan, not proof of domain qualifications. Employer facts stay at that employer. General delivery/meetings/skills belong in summary or separate highlights. Select concrete examples and explain prospective relevance without inventing outcomes, customer ownership, domain tenure or tools. Missing domain qualifications describe fit; they do not invalidate truthful transferable evidence.'};
}
export function isArtDominatedDocument(kind,document,target){
 if(target?.track!=='Professional'||production.test(target.title||''))return false;
 const artDuty=String(target.description||'').split(/\n|[•●]|(?<=[.!?])\s+/).some(line=>/^(?:coordinate|lead|manage|create|develop|design|build|produce)\b/i.test(line.trim())&&production.test(line));
 if(artDuty)return false;
 const opening=kind==='coverLetter'?(document.paragraphs||[])[0]:String(document.headline||'')+' '+String(document.summary||'').split(/(?<=[.!?])\s+/)[0];
 if(/\b(?:environment[- ]art|game[- ]art|sculpt\w*|textur\w*|pbr|world ?building)\b/i.test(opening)&&!transferable.test(opening))return true;
 const text=kind==='coverLetter'?(document.paragraphs||[]):(document.experience||[]).flatMap(r=>r.bullets||[]);
 const art=text.filter(s=>production.test(s)&&!transferable.test(s)).length;
 return art>=2&&art>text.length/2;
}
// Reconcile only bare, already-verified general capability statements. A number,
// domain, tool or employer-specific responsibility cannot enter this exception.
export function isVerifiedCapabilityStatement(text,profile){
 let rest=normalize(text);if(!rest||/\d/.test(rest)||!factsOf(profile).length)return false;
 const skills=[...(profile.skills||[]),'team leadership','mentoring','cross-functional collaboration','project management'].filter(skill=>[...(profile.skills||[]),...factsOf(profile).map(f=>f.text)].some(source=>normalize(source).includes(normalize(skill))));
 let matched=false;
 for(const skill of skills.sort((a,b)=>b.length-a.length)){const phrase=normalize(skill);if(rest.includes(phrase)){matched=true;rest=rest.split(phrase).join(' ');}}
 if(!matched)return false;
 const furniture=new Set('a an and as at with in of the for to my i has have experience experienced professional highly strong background skills skilled strengths results driven motivated individual offering bringing'.split(' '));
 return rest.trim().split(/\s+/).every(word=>furniture.has(word));
}
export function reconcileReviewIssues(issues,{kind,document,profile,target}){
 const passages=kind==='coverLetter'?(document.paragraphs||[]).map((text,i)=>({path:'paragraphs.'+i,text})):[{path:'headline',text:document.headline},{path:'summary',text:document.summary},...(document.experience||[]).flatMap((r,i)=>(r.bullets||[]).map((text,j)=>({path:`experience.${i}.bullets.${j}`,text})))];
 return issues.filter(issue=>{
  const passage=passages.find(p=>p.path===issue.path)?.text||'';
  if(issue.code==='irrelevant_framing')return isArtDominatedDocument(kind,document,target)&&production.test(issue.quote)&&!transferable.test(issue.quote);
  if(issue.code==='unsupported_claim'&&['headline','summary'].includes(issue.path)&&isVerifiedCapabilityStatement(passage,profile))return false;
  if(issue.code==='unsupported_claim'&&/^experience\.\d+\.bullets\.\d+$/.test(issue.path)){
   const row=document.experience?.[Number(issue.path.split('.')[1])];
   const original=(profile.experience||[]).find(r=>r.role===row?.role&&r.company===row?.company&&r.dates===row?.dates);
   if(original?.facts?.some(f=>normalize(f.text)===normalize(passage)))return false;
  }
  return true;
 });
}
export function professionalSummaryIssue(draft,profile,target){
 if(target?.track!=='Professional')return null;
 const available=(profile.transferable_facts||[]).some(f=>/on[- ]time delivery|meetings with internal|internal[- ]team meetings/i.test(f.text));
 const summary=draft?.summary?.text||'',highlights=(draft?.additional||[]).map(c=>c.text||'').join(' ');
 const concrete=/on[- ]time|internal.{0,15}meetings?|meetings?.{0,15}internal|diagnos\w*|defin\w*.{0,15}workflows?|metadata|automation modules/i;
 return available&&/highly (?:motivated|experienced)|results[- ]driven|proven track record|strong background/i.test(summary)&&!concrete.test(summary+' '+highlights)
  ? 'Replace generic self-praise with concrete verified project delivery or internal-team coordination evidence. Connect its prospective relevance to this posting; keep general facts separate from employer bullets and do not invent industry experience.' : null;
}
