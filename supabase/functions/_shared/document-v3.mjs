import {WriterError,evidenceCatalog} from "./document-writer.mjs";

export const DOCUMENT_V3_VERSION="resume-v3-shadow-alpha3";
export const DOCUMENT_SCHEMA_VERSION=3;

const str={type:"string"};
const arr=(items,minItems=0,maxItems=20)=>({type:"array",items,minItems,maxItems});
const obj=(properties)=>({type:"object",properties,required:Object.keys(properties),additionalProperties:false});
const claimSchema=obj({text:str,fact_ids:arr(str,1,8)});
const draftSchema=obj({
  headline:claimSchema,
  summary:claimSchema,
  experience:arr(obj({experience_id:str,bullets:arr(claimSchema,1,4)}),1,12),
  additional:arr(claimSchema,0,4)
});

const STOP=new Set(("a an and are as at be been being by for from had has have i in into is it its my of on or our that the their this to was were will with you your"+
  " job role team company work working position candidate candidates experience years year responsibilities requirements preferred required about who what why how"+
  " opportunity opportunities including include includes using use used").split(/\s+/));
const MARKETING=/\b(?:about us|who we are|our mission|our vision|our culture|why join|benefits|equal opportunity|award[- ]winning|world[- ]class|industry[- ]leading|fast[- ]growing|we are a|we are an|founded in|our portfolio|our company|join a workplace|together we|we empower|we believe|member of|recognized as|our team members|our undeniable passion)\b/i;
const COMP_BENEFITS=/\b(?:compensation|salary|pay range|benefits?|health insurance|pto|paid time off|401k|retirement|equal opportunity|affirmative action|accommodation)\b/i;
const DIRECT_ROLE=/\b(?:you will|you'll|you are responsible|your responsibilities|your duties|what you.ll do|what you will do|as (?:an?|the) [^,.]{2,80},? you|this role (?:owns|leads|manages|supports|coordinates|is responsible))\b|^responsible for\b/i;
const STARTS_ACTION=/^(?:manage|lead|coordinate|build|create|develop|deliver|design|maintain|support|train|implement|oversee|produce|model|texture|light|schedule|repair|service|operate|facilitate|analyze|own|plan|execute|mentor|supervise|install|troubleshoot|track|report|document|review|monitor|collaborate|optimize|prototype|sculpt|render|assemble|debug)\w*\b/i;
const ACTION=/\b(?:manage|lead|coordinate|build|create|develop|deliver|design|maintain|support|train|implement|oversee|produce|model|texture|light|schedule|repair|service|operate|facilitate|analyze|own|plan|execute|mentor|supervise|install|troubleshoot|track|report|document|review|monitor|collaborate|optimize|prototype|sculpt|render|assemble|debug)\w*\b/i;
const REQUIREMENT=/\b(?:require|required|must|minimum|qualification|preferred|years? of|proficien|knowledge|skill|degree|bachelor|master|experience with|familiarity)\b/i;
const TRANSFERABLE=/\b(?:lead|mentor|train|onboard|project|deliver|workflow|troubleshoot|excel|automat|database|metadata|report|query|cross[- ]functional|coordinate|collaborat|meeting|maintenance|repair|schedule|document|implement|operation|customer|support)\w*\b/i;
const ART=/\b(?:environment art(?:ist)?|3d(?: art| artist| model| environment)?|artist|unreal(?: engine)?|unity|zbrush|substance(?: painter| designer)?|maya|texture(?: artist| painting)?|material(?:s| artist)?|shader(?:s)?|lighting(?: artist)?|world building|level art(?:ist)?|asset creation|3d model(?:ing)?|sculpt(?:ing)?|render(?:ing)?)\b/i;
const OPAQUE=/\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}|[A-Fa-f0-9]{32,}|[A-Za-z0-9+/]{36,}={0,2})\b/;
const RISKY=["optimized","photorealistic","exceptional","robust","extensive","proven expertise","proven track record","strict standards","rigorous standards","improved efficiency","measurable impact","critical equipment","expert in","specialist in"];

function fail(message,code="INVALID_DRAFT",status=502){throw new WriterError(message,code,status);}
function rootToken(token){
  let t=String(token||"").toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9+#./-]+$/g,"");
  const groups=[
    [/^(?:lead|leads|leading|led|leadership)$/,"lead"],
    [/^(?:mentor|mentors|mentored|mentoring)$/,"mentor"],
    [/^(?:build|builds|built|building)$/,"build"],
    [/^(?:create|creates|created|creating|creation)$/,"create"],
    [/^(?:manage|manages|managed|managing|management)$/,"manage"],
    [/^(?:coordinate|coordinates|coordinated|coordinating|coordination)$/,"coordinate"],
    [/^(?:deliver|delivers|delivered|delivering|delivery)$/,"deliver"],
    [/^(?:develop|develops|developed|developing|development)$/,"develop"],
    [/^(?:repair|repairs|repaired|repairing)$/,"repair"],
    [/^(?:produce|produces|produced|producing|production)$/,"produce"],
    [/^(?:train|trains|trained|training)$/,"train"],
    [/^(?:implement|implements|implemented|implementing|implementation)$/,"implement"],
    [/^(?:operate|operates|operated|operating|operations)$/,"operate"]
  ];
  for(const [pattern,root] of groups)if(pattern.test(t))return root;
  return t.replace(/(?:ing|ed|es|s)$/,"");
}
function roots(value){
  return (String(value||"").toLowerCase().match(/[a-z][a-z0-9+#./-]{2,}/g)||[])
    .map(rootToken).filter(t=>t&&!STOP.has(t));
}
function sentences(value){
  return String(value||"").replace(/\r/g,"\n").split(/(?:\n+|(?<=[.!?])\s+)/)
    .map(s=>s.replace(/^[-•*]+\s*/,"").replace(/\s+/g," ").trim())
    .filter(s=>s.length>=18&&s.length<=700);
}
function keywordWeights(text){
  const weights=new Map();
  for(const r of roots(text))weights.set(r,(weights.get(r)||0)+1);
  return weights;
}
function overlapScore(text,weights){
  const seen=new Set(roots(text));let score=0;
  for(const r of seen)score+=Math.min(4,weights.get(r)||0);
  return score;
}
function tagSet(text){
  const s=String(text||"");
  const tags=[];
  if(TRANSFERABLE.test(s))tags.push("transferable");
  if(ART.test(s))tags.push("art");
  if(/\b(?:lead|mentor|train|onboard|supervis|manager|director)\w*\b/i.test(s))tags.push("leadership");
  if(/\b(?:excel|database|metadata|report|query|data|analytics?)\w*\b/i.test(s))tags.push("data");
  if(/\b(?:automat|script|ai|workflow|tool|technical|debug|troubleshoot)\w*\b/i.test(s))tags.push("technical");
  if(/\b(?:maintenance|repair|service|install|hands[- ]on|equipment)\w*\b/i.test(s))tags.push("maintenance");
  if(/\b(?:project|schedule|deliver|coordinate|implementation|operation|process|documentation)\w*\b/i.test(s))tags.push("operations");
  return [...new Set(tags)];
}
function topKeywords(weights,limit=20){
  return [...weights.entries()].filter(([k])=>k.length>2).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([k])=>k);
}

function responsibilityScore(s){
  let score=0;
  if(STARTS_ACTION.test(s))score+=7;
  if(DIRECT_ROLE.test(s))score+=6;
  if(ACTION.test(s))score+=3;
  if(REQUIREMENT.test(s))score-=2;
  if(MARKETING.test(s))score-=12;
  if(/^\s*(?:we|our|at [A-Z])/i.test(s)&&!DIRECT_ROLE.test(s)&&!STARTS_ACTION.test(s))score-=5;
  return score;
}
function requirementScore(s){
  let score=REQUIREMENT.test(s)?6:0;
  if(/\b(?:you have|you bring|we.re looking for|qualifications?|minimum|preferred|must have|experience with|proficien)\b/i.test(s))score+=5;
  if(COMP_BENEFITS.test(s))score-=10;
  if(MARKETING.test(s))score-=8;
  return score;
}
function targetIdentity(target){
  const title=String(target?.title||"").toLowerCase();
  if(/implementation|onboarding/.test(title))return "implementation, onboarding, training, and operational delivery";
  if(/project manager|project coordinator|program manager|program coordinator/.test(title))return "project coordination, planning, cross-functional delivery, and execution";
  if(/learning|training|enablement/.test(title))return "learning, training, implementation, and team development";
  if(/customer success|client success|customer service/.test(title))return "customer success, onboarding, support, and operational coordination";
  if(/maintenance|technician|repair|facilities|service shop/.test(title))return "hands-on maintenance, repair, troubleshooting, and technical operations";
  if(/operations|analyst/.test(title))return "operations, analysis, documentation, reporting, and cross-functional execution";
  if(String(target?.track||"")==="Games / 3D")return "environment art, 3D production, world building, and cross-functional game development";
  return "capabilities relevant to "+String(target?.title||"the target role");
}
export function analyzeJobV3(target){
  const description=String(target?.description||"");
  const rows=sentences(description);
  const responsibilities=rows.map(s=>({text:s,score:responsibilityScore(s)}))
    .filter(x=>x.score>=4).sort((a,b)=>b.score-a.score).slice(0,12).map(x=>x.text);
  const requirements=rows.map(s=>({text:s,score:requirementScore(s)}))
    .filter(x=>x.score>=5).sort((a,b)=>b.score-a.score).slice(0,10).map(x=>x.text);
  const useful=[target?.title,...responsibilities,...requirements].filter(Boolean).join(" ");
  const weights=keywordWeights(useful);
  return {
    title:String(target?.title||""),
    company:String(target?.company||""),
    track:String(target?.track||"Professional"),
    identity_focus:targetIdentity(target),
    responsibilities,
    requirements,
    keywords:topKeywords(weights,24),
    target_tags:tagSet(useful),
    weights:Object.fromEntries(weights)
  };
}

function normalizedFactRows(profile){
  return evidenceCatalog(profile).map((fact,index)=>({
    id:String(fact.id||"fact:"+index),
    text:String(fact.text||""),
    experience_id:fact.experience_id||null,
    company:fact.company||null,
    tags:tagSet(fact.text)
  }));
}
function scoreFact(fact,analysis,track){
  const weights=new Map(Object.entries(analysis.weights||{}));
  let score=overlapScore(fact.text,weights)*4;
  const tags=new Set(fact.tags||[]);
  for(const tag of analysis.target_tags||[])if(tags.has(tag))score+=4;
  if(track==="Games / 3D"){
    if(tags.has("art"))score+=12;
    if(fact.experience_id)score+=4;
  }else{
    if(tags.has("transferable"))score+=10;
    if(tags.has("leadership")||tags.has("operations")||tags.has("data")||tags.has("technical"))score+=6;
    if(tags.has("art")&&!tags.has("transferable"))score-=5;
  }
  if(track==="Labor"){
    if(tags.has("maintenance"))score+=18;
    if(/soundair/i.test(String(fact.company||"")))score+=18;
  }
  return score;
}
function experienceScore(exp,factsByExperience,analysis,track,index){
  const facts=factsByExperience.get(exp.id)||[];
  const scores=facts.map(f=>scoreFact(f,analysis,track)).sort((a,b)=>b-a);
  const text=[exp.role,exp.company,...facts.map(f=>f.text)].join(" ");
  let score=(scores[0]||0)+(scores[1]||0)*.55+(scores[2]||0)*.25-Math.min(index*0.35,3);
  if(track==="Labor"){
    if(/soundair|maintenance technician/i.test([exp.company,exp.role].join(" ")))score+=35;
    if(/\b(?:maintenance|repair|service|troubleshoot|equipment)\w*\b/i.test(text))score+=10;
  }else if(track!=="Games / 3D"){
    if(/\b(?:lead|mentor|train|workflow|programmer|technology|cross[- ]functional|project)\w*\b/i.test(text))score+=8;
    if(/\blead\b/i.test(exp.role)&&analysis.target_tags.includes("leadership"))score+=10;
    const targetNeedsMaintenance=analysis.target_tags.includes("maintenance");
    if(/soundair|maintenance technician/i.test([exp.company,exp.role].join(" "))&&!targetNeedsMaintenance)score-=28;
  }
  return score;
}
function selectedSkills(profile,analysis,track){
  const weights=new Map(Object.entries(analysis.weights||{}));
  const laborPreference=new Map([
    ["Troubleshooting",32],
    ["Cross-functional collaboration",18],
    ["Workflow development",14],
    ["Project management",12],
    ["Team leadership",8],
    ["Onboarding and training",7],
    ["Mentoring",6],
    ["Excel (intermediate)",5],
    ["AI/automation scripting and module building",-8],
    ["Asset database metadata and reporting",-10],
    ["Database querying",-10]
  ]);
  const ranked=(profile.skills||[]).map((skill,index)=>{
    let score=overlapScore(skill,weights)*6;
    const tags=tagSet(skill);
    if(track==="Games / 3D"&&tags.includes("art"))score+=12;
    if(track!=="Games / 3D"&&tags.includes("art")&&!tags.includes("transferable"))score-=5;
    if(track!=="Games / 3D"&&tags.some(t=>["leadership","operations","data","technical","transferable"].includes(t)))score+=7;
    if(track==="Labor")score+=laborPreference.get(skill)||0;
    return {skill,index,score};
  }).sort((a,b)=>b.score-a.score||a.index-b.index);
  const desired=track==="Games / 3D"?12:(track==="Labor"?8:10);
  return ranked.slice(0,desired).map(x=>x.skill);
}

export function selectEvidenceV3(profile,analysis){
  const track=analysis.track;
  const allFacts=normalizedFactRows(profile);
  const factsByExperience=new Map();
  for(const f of allFacts){
    if(!f.experience_id)continue;
    if(!factsByExperience.has(f.experience_id))factsByExperience.set(f.experience_id,[]);
    factsByExperience.get(f.experience_id).push(f);
  }

  const experience=(profile.experience||[]);
  let selectedIds=[];
  if(track==="Games / 3D"){
    const required=new Set((profile.resume_required_experience_ids||[]).filter(Boolean));
    selectedIds=experience.filter(e=>required.has(e.id)).map(e=>e.id);
  }else{
    const ranked=experience.map((exp,index)=>({id:exp.id,index,score:experienceScore(exp,factsByExperience,analysis,track,index)}))
      .sort((a,b)=>b.score-a.score||a.index-b.index);
    const count=track==="Labor" ? 3 : Math.min(4,Math.max(3,ranked.filter(x=>x.score>8).length||3));
    selectedIds=ranked.slice(0,count).map(x=>x.id);
  }

  const selectedExperiences=experience.filter(e=>selectedIds.includes(e.id));
  const roleFacts=selectedExperiences.flatMap(e=>(factsByExperience.get(e.id)||[]));
  const generalFacts=allFacts.filter(f=>!f.experience_id)
    .map(f=>({...f,score:scoreFact(f,analysis,track)}))
    .sort((a,b)=>b.score-a.score)
    .filter(f=>f.score>0 || /^education:|^skill:/.test(f.id))
    .slice(0,track==="Games / 3D"?24:18);

  const pool=[...roleFacts,...generalFacts];
  const skills=selectedSkills(profile,analysis,track);
  const allowedSkillFacts=new Set(skills.map(s=>"skill:"+(profile.skills||[]).indexOf(s)));
  const filteredPool=pool.filter(f=>!f.id.startsWith("skill:")||allowedSkillFacts.has(f.id));

  return {
    experience_ids:selectedExperiences.map(exp=>exp.id),
    experiences:selectedExperiences.map((exp,index)=>{
      const factRows=factsByExperience.get(exp.id)||[];
      const ranked=factRows.map(f=>({...f,score:scoreFact(f,analysis,track)})).sort((a,b)=>b.score-a.score);
      const bullet_budget=track==="Games / 3D"
        ? (index<2?3:index<5?2:1)
        : (track==="Labor" ? (exp.id==="exp_soundair"?2:1) : (ranked[0]?.score>=24?2:1));
      return {experience_id:exp.id,role:exp.role,company:exp.company,dates:exp.dates,bullet_budget,ranked_fact_ids:ranked.map(f=>f.id)};
    }),
    skills,
    evidence_pool:filteredPool.map(({score,...f})=>f)
  };
}

function factMap(selection){return new Map((selection.evidence_pool||[]).map(f=>[f.id,f]));}
function claimText(claim,max=1800){
  if(!claim||typeof claim.text!=="string"||!claim.text.trim()||claim.text.length>max)fail("The writer returned an incomplete passage.");
  const text=claim.text.trim();
  if(/<[^>]+>|\[insert\b|\[your name\]|FACT-(?:REQ|RES|EXP|EDU)-/i.test(text))fail("The writer returned markup or placeholder text.");
  if(OPAQUE.test(text))fail("The writer returned unrelated token-like text.");
  return text;
}
function exactNumbers(text){return String(text||"").match(/\b\d+(?:[.,]\d+)?%?\b/g)||[];}
function issueForClaim(claim,allowedIds,map,{roleId=null,profile}={}){
  const issues=[];
  const text=claimText(claim);
  const ids=Array.isArray(claim.fact_ids)?claim.fact_ids:[];
  if(!ids.length)issues.push("Every written passage must cite at least one approved evidence id.");
  if(ids.some(id=>!allowedIds.has(id)))issues.push("The passage cited evidence outside the approved V3 evidence pool.");
  const facts=ids.map(id=>map.get(id)).filter(Boolean);
  if(roleId&&facts.some(f=>f.experience_id!==roleId))issues.push("A work-history bullet cited evidence from a different employer.");
  const evidence=facts.map(f=>f.text).join(" ");
  for(const n of exactNumbers(text))if(!evidence.includes(n))issues.push("The passage introduced an unsupported number: "+n+".");
  if(roleId){
    const employer=(profile.experience||[]).find(e=>e.id===roleId);
    const employerFacts=(employer?.facts||[]).map(f=>f.text).join(" ").toLowerCase();
    for(const skill of (profile.skills||[])){
      if(!text.toLowerCase().includes(String(skill).toLowerCase()))continue;
      if(!employerFacts.includes(String(skill).toLowerCase()) &&
         /^(?:3DS Max|Maya|ZBrush|3DCoat|Quixel Suite|Substance Painter|Substance Designer|Photoshop|Unreal Engine|Unity)$/i.test(skill))
        issues.push(skill+" is verified generally but not for "+(employer?.company||"this employer")+". Move it to Core Skills/Summary or remove it from this bullet.");
    }
  }
  const evidenceRoots=new Set(roots(evidence));
  const claimRoots=roots(text);
  if(claimRoots.length&&evidenceRoots.size&&!claimRoots.some(r=>evidenceRoots.has(r)))
    issues.push("The passage drifted too far from its cited evidence.");
  return {text,ids,issues};
}
function advisoryIssues(text,evidence){
  const lower=String(text||"").toLowerCase(),e=String(evidence||"").toLowerCase(),issues=[];
  for(const term of RISKY)if(lower.includes(term)&&!e.includes(term))issues.push("Consider removing unsupported embellishment: "+term+".");
  return issues;
}

export function validateV3Draft(draft,profile,analysis,selection){
  if(!draft||typeof draft!=="object")fail("The writer returned no V3 document.");
  const allowedIds=new Set((selection.evidence_pool||[]).map(f=>f.id));
  const map=factMap(selection);
  const hard=[];
  const advisory=[];

  const headlineCheck=issueForClaim(draft.headline,allowedIds,map,{profile});
  hard.push(...headlineCheck.issues.map(x=>"Headline: "+x));
  if(analysis.track!=="Games / 3D"&&/\b(?:environment artist|3d artist|game artist|game development|video game)\b/i.test(headlineCheck.text))
    hard.push("Headline: non-game resumes must lead with the target function, not prior game-art identity.");
  advisory.push(...advisoryIssues(headlineCheck.text,headlineCheck.ids.map(id=>map.get(id)?.text||"").join(" ")));

  const summaryCheck=issueForClaim(draft.summary,allowedIds,map,{profile});
  hard.push(...summaryCheck.issues.map(x=>"Summary: "+x));
  advisory.push(...advisoryIssues(summaryCheck.text,summaryCheck.ids.map(id=>map.get(id)?.text||"").join(" ")));

  if(!Array.isArray(draft.experience))hard.push("Work history is missing.");
  const rows=Array.isArray(draft.experience)?draft.experience:[];
  const expected=selection.experiences.map(x=>x.experience_id);
  const actual=rows.map(x=>x?.experience_id);
  if(expected.length!==actual.length||expected.some(id=>!actual.includes(id)))hard.push("The writer changed the V3 work-history blueprint.");

  const experience=[];
  for(const plan of selection.experiences){
    const row=rows.find(x=>x?.experience_id===plan.experience_id);
    const original=(profile.experience||[]).find(e=>e.id===plan.experience_id);
    if(!row||!original)continue;
    const bullets=Array.isArray(row.bullets)?row.bullets:[];
    if(bullets.length<1||bullets.length>plan.bullet_budget)hard.push(original.company+": bullet count exceeded the blueprint.");
    const rendered=[];
    for(const claim of bullets){
      const check=issueForClaim(claim,allowedIds,map,{roleId:plan.experience_id,profile});
      hard.push(...check.issues.map(x=>original.company+": "+x));
      advisory.push(...advisoryIssues(check.text,check.ids.map(id=>map.get(id)?.text||"").join(" ")));
      rendered.push(check.text);
    }
    experience.push({role:original.role,company:original.company,dates:original.dates,bullets:rendered});
  }

  const additional=[];
  for(const claim of Array.isArray(draft.additional)?draft.additional:[]){
    const check=issueForClaim(claim,allowedIds,map,{profile});
    hard.push(...check.issues.map(x=>"Additional: "+x));
    advisory.push(...advisoryIssues(check.text,check.ids.map(id=>map.get(id)?.text||"").join(" ")));
    additional.push(check.text);
  }

  if(hard.length)fail(hard.slice(0,6).join(" | "));
  return {
    document:{
      schema_version:DOCUMENT_SCHEMA_VERSION,
      name:profile.name,
      contact:profile.contact,
      headline:headlineCheck.text,
      summary:summaryCheck.text,
      skills:[...selection.skills],
      experience,
      education:structuredClone(profile.education||[]),
      additional
    },
    diagnostics:{hard_errors:[],advisories:[...new Set(advisory)].slice(0,12)}
  };
}

function compactProfile(profile,selection){
  const selectedIds=new Set(selection.experience_ids||[]);
  const poolIds=new Set((selection.evidence_pool||[]).map(f=>f.id));
  const general=evidenceCatalog(profile).filter(f=>!f.experience_id&&poolIds.has(f.id));
  return {
    name:profile.name,
    contact:profile.contact,
    education:profile.education||[],
    skills:selection.skills,
    experience:(profile.experience||[]).filter(e=>selectedIds.has(e.id)).map(e=>({
      id:e.id,role:e.role,company:e.company,dates:e.dates,
      facts:(e.facts||[]).filter(f=>poolIds.has(f.id))
    })),
    approved_general_evidence:general
  };
}

const V3_INSTRUCTIONS=[
  "You are the wording stage of Raven Resume V3. Raven has already decided which evidence and work-history entries are allowed. Do not select new history or invent new facts.",
  "Write polished resume prose tailored to the target. Use only evidence ids from evidencePool. Each factual passage must cite the ids that support it.",
  "Follow blueprint.identity_focus for the headline and summary framing. For Professional, Labor, and Wildcard resumes, never lead with a prior Environment Artist, 3D Artist, game-art, or game-development identity; frame the candidate around transferable capabilities relevant to the target function.",
  "Follow blueprint.experiences exactly. Return every listed experience_id once and only once. Do not add or remove employers. Do not exceed each role's bullet_budget.",
  "A work-history bullet may cite only evidence whose experience_id matches that role. General skills and transferable evidence belong in headline, summary, skills, or additional—not in an employer bullet unless that employer's evidence establishes them.",
  "Preserve factual restraint. Do not invent numbers, credentials, tools, duties, outcomes, motivations, or company knowledge. A job requirement is not candidate evidence.",
  "Use natural, specific writing. The evidence defines what is true; you control how to communicate it clearly.",
  "Set additional to an empty array. Raven renders selected skills separately; do not create extra uncited sections.",
  "Return JSON only in the requested schema. Do not include markdown or commentary."
].join("\n\n");

export function buildResumeV3Plan(profile,target){
  if(!profile?.name||!Array.isArray(profile.experience)||!profile.experience.length)fail("Verified candidate background is missing.","PROFILE_MISSING",503);
  const analysis=analyzeJobV3(target);
  const selection=selectEvidenceV3(profile,analysis);
  if(!selection.experiences.length)fail("V3 could not select relevant work history.","EVIDENCE_SELECTION_FAILED",502);
  return {
    analysis:{identity_focus:analysis.identity_focus,responsibilities:analysis.responsibilities,requirements:analysis.requirements,keywords:analysis.keywords,target_tags:analysis.target_tags},
    selection:{experience_ids:selection.experience_ids,experiences:selection.experiences,skills:selection.skills,evidence_ids:selection.evidence_pool.map(f=>f.id)},
    internal:{analysis,selection}
  };
}


function cleanFactBullet(value){
  let text=String(value||"").replace(/^Verified skill:\s*/i,"").replace(/\s+/g," ").trim();
  if(!text)return "";
  text=text.replace(/^[•*-]+\s*/,"");
  if(!/[.!?]$/.test(text))text+=".";
  return text.charAt(0).toUpperCase()+text.slice(1);
}
function deterministicHeadline(analysis){
  if(analysis.track==="Games / 3D")return "Environment Artist | 3D Production | World Building";
  if(analysis.track==="Labor")return "Maintenance Technician | Repair | Troubleshooting | Technical Operations";
  const title=String(analysis.title||"").toLowerCase();
  if(/implementation|onboarding/.test(title))return "Implementation & Operations | Onboarding | Training";
  if(/project/.test(title))return "Project Coordination | Cross-Functional Delivery | Operations";
  if(/learning|training|enablement/.test(title))return "Learning & Implementation | Training | Team Development";
  if(/customer success|client success/.test(title))return "Customer Success | Onboarding | Operational Coordination";
  return "Operations | Project Delivery | Cross-Functional Collaboration";
}
function deterministicSummary(analysis,selection){
  const skills=(selection.skills||[]).slice(0,5);
  if(analysis.track==="Games / 3D"){
    return "Environment artist with experience in world building, asset creation, production workflows, cross-functional collaboration, and mentoring across shipped game projects.";
  }
  if(analysis.track==="Labor"){
    return "Hands-on maintenance professional with experience in equipment teardown and repair, troubleshooting, workflow execution, and cross-functional technical collaboration.";
  }
  const lead=analysis.identity_focus
    ? "Professional focused on "+analysis.identity_focus+"."
    : "Professional focused on project delivery and operations.";
  const support=skills.length
    ? " Brings verified strengths in "+skills.join(", ")+"."
    : "";
  return lead+support;
}
export function buildDeterministicResumeV3(profile,target){
  const plan=buildResumeV3Plan(profile,target);
  const analysis=plan.internal.analysis;
  const selection=plan.internal.selection;
  const catalog=new Map(evidenceCatalog(profile).map(f=>[f.id,f]));
  const experience=selection.experiences.map(item=>{
    const original=(profile.experience||[]).find(e=>e.id===item.experience_id);
    const bullets=[];
    for(const id of item.ranked_fact_ids||[]){
      const fact=catalog.get(id);
      if(!fact||fact.experience_id!==item.experience_id)continue;
      const text=cleanFactBullet(fact.text);
      if(!text||bullets.includes(text))continue;
      bullets.push(text);
      if(bullets.length>=item.bullet_budget)break;
    }
    return {
      role:original?.role||item.role||"",
      company:original?.company||item.company||"",
      dates:original?.dates||item.dates||"",
      bullets:bullets.length?bullets:["Contributed verified experience relevant to this role."]
    };
  });
  const used=new Set(experience.flatMap(row=>row.bullets.map(x=>x.toLowerCase())));
  const additional=[];
  for(const id of selection.evidence_pool.map(f=>f.id)){
    if(!/^xfer_/i.test(id))continue;
    const fact=catalog.get(id);
    const text=cleanFactBullet(fact?.text);
    if(!text||used.has(text.toLowerCase())||additional.includes(text))continue;
    additional.push(text);
    if(additional.length>=4)break;
  }
  return {
    document:{
      schema_version:DOCUMENT_SCHEMA_VERSION,
      name:profile.name,
      contact:profile.contact,
      headline:deterministicHeadline(analysis),
      summary:deterministicSummary(analysis,selection),
      skills:[...selection.skills],
      experience,
      education:structuredClone(profile.education||[]),
      additional
    },
    analysis:plan.analysis,
    selection:plan.selection,
    diagnostics:{hard_errors:[],advisories:[]},
    provider:"deterministic",
    model:"none",
    provider_attempts:0,
    architecture:"resume-v3-deterministic"
  };
}

export async function writeResumeV3({profile,target,complete}){
  const plan=buildResumeV3Plan(profile,target);
  const analysis=plan.internal.analysis;
  const selection=plan.internal.selection;
  const map=factMap(selection);

  const general=(selection.evidence_pool||[]).filter(f=>!f.experience_id);
  const summaryEvidence=[
    ...general.slice(0,8),
    ...selection.experiences.flatMap(exp=>
      (exp.ranked_fact_ids||[]).slice(0,1).map(id=>map.get(id)).filter(Boolean)
    )
  ].filter((fact,index,rows)=>fact&&rows.findIndex(x=>x.id===fact.id)===index).slice(0,10);

  const writingExperiences=selection.experiences.map((exp,index)=>{
    const facts=(exp.ranked_fact_ids||[])
      .slice(0,exp.bullet_budget)
      .map(id=>map.get(id))
      .filter(Boolean)
      .map(f=>({id:f.id,text:f.text}));
    return {
      slot:"EXP"+index,
      role:exp.role,
      company:exp.company,
      bullet_facts:facts
    };
  });

  const input={
    target:{track:target.track,title:target.title,company:target.company},
    focus:analysis.identity_focus,
    job_priorities:[
      ...analysis.responsibilities.slice(0,3),
      ...analysis.requirements.slice(0,3)
    ].slice(0,5),
    selected_skills:selection.skills.slice(0,8),
    summary_facts:summaryEvidence.map(f=>f.text),
    experience:writingExperiences.map(row=>({
      slot:row.slot,
      role:row.role,
      company:row.company,
      bullet_facts:row.bullet_facts.map(f=>f.text)
    }))
  };

  const instructions=[
    "You are Raven's resume prose writer. Raven has already selected every fact. Your only job is wording.",
    "Write concise, polished resume prose tailored to the target role. Do not invent facts, numbers, tools, outcomes, credentials, employers, or duties.",
    "Return plain text only. No JSON, markdown, numbering, commentary, or extra lines.",
    "Use exactly this format:",
    "SUMMARY|||<2-3 sentence summary on one line>",
    "Then one line per bullet using the matching experience slot, for example: EXP0|||<bullet text>",
    "Return exactly one bullet line for each bullet_facts item, preserving the input experience order and fact order.",
    "Keep bullets compact: usually 16-30 words.",
    "For non-game targets, frame transferable capabilities around the target function rather than leading with game-art identity.",
    "Do not include names, contact information, evidence IDs, or role IDs."
  ].join("\n");

  function parseProse(value){
    const lines=String(value||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const summaryLine=lines.find(line=>line.toUpperCase().startsWith("SUMMARY|||"));
    const summary=summaryLine?summaryLine.slice("SUMMARY|||".length).trim():"";
    const experience=writingExperiences.map(row=>{
      const prefix=row.slot+"|||";
      return {
        bullets:lines
          .filter(line=>line.toUpperCase().startsWith(prefix))
          .map(line=>line.slice(prefix.length).trim())
          .filter(Boolean)
      };
    });
    if(!summary)fail("The writer returned no summary.");
    for(let i=0;i<writingExperiences.length;i++){
      if(experience[i].bullets.length!==writingExperiences[i].bullet_facts.length)
        fail("The writer returned the wrong number of bullets for "+writingExperiences[i].company+".");
    }
    return {summary,experience};
  }

  let correction=null,lastProvider="",lastModel="";
  for(let attempt=0;attempt<2;attempt++){
    const written=await complete({
      instructions,
      input:{...input,...(correction?{correction}:{})},
      schema:null,
      name:"raven_resume_prose_v3",
      maxOutputTokens:1800,
      responseMode:"text"
    });
    lastProvider=written.provider||"llm";
    lastModel=written.model||"";

    try{
      const prose=parseProse(written.data);
      const headlineIds=summaryEvidence.map(f=>f.id).slice(0,8);
      const draft={
        headline:{
          text:deterministicHeadline(analysis),
          fact_ids:headlineIds.length?headlineIds:[selection.evidence_pool[0]?.id].filter(Boolean)
        },
        summary:{
          text:prose.summary,
          fact_ids:summaryEvidence.map(f=>f.id).slice(0,8)
        },
        experience:selection.experiences.map((exp,index)=>{
          const sourceIds=writingExperiences[index]?.bullet_facts.map(f=>f.id)||[];
          return {
            experience_id:exp.experience_id,
            bullets:sourceIds.map((id,bulletIndex)=>({
              text:prose.experience[index].bullets[bulletIndex],
              fact_ids:[id]
            }))
          };
        }),
        additional:[]
      };

      const validated=validateV3Draft(draft,profile,analysis,selection);
      return {
        ...validated,
        analysis:plan.analysis,
        selection:plan.selection,
        provider:lastProvider,
        model:lastModel,
        provider_attempts:Number(written.providerAttempts||1),
        architecture:DOCUMENT_V3_VERSION
      };
    }catch(error){
      if(!(error instanceof WriterError)||attempt===1)throw error;
      correction={
        issue:error.message,
        instruction:"Return the required SUMMARY||| and EXPn||| lines only. Preserve the exact number and order of bullet lines."
      };
    }
  }
  fail("V3 could not produce a verified resume.","FACT_CHECK_FAILED",502);
}
