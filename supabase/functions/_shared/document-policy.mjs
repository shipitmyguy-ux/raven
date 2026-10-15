// Owner-directed document identity and bounded writing contract. Never rewrite saved documents.
export const CANDIDATE_NAME='Mike Rodriguez';
export const DOCUMENT_LIMITS=Object.freeze({headline:160,summary:1600,skill:160,bullet:850,highlight:850,greeting:160,closing:160,paragraph:2200});
export function documentProfile(profile){return {...profile,name:CANDIDATE_NAME};}

// Only document-specific posting constraints, or explicit revision instructions, set a total cap.
// Do not confuse salary, word counts, API tokens, other application answers or job requirements with document length.
export function characterLimit(kind,target={},instructions=''){
 const label=({resume:'(?:resume|résumé|cv)',coverLetter:'cover[- ]letter',headline:'headline',summary:'summary',skill:'(?:skill|skills)',bullet:'(?:bullet|bullets)',highlight:'(?:highlight|highlights)',paragraph:'(?:paragraph|paragraphs)',greeting:'greeting',closing:'closing'})[kind];
 if(!label)return null;
 const genericInstruction=['resume','coverLetter'].includes(kind)&&!(/\b(?:summary|headline|bullet|highlight|paragraph|greeting|closing|answer|resume|résumé|cv|cover[- ]letter)\b/i.test(instructions));
 const number='([1-9][0-9,]{0,8})';
 const unit='(?:characters?|chars?)(?:\\s+including\\s+spaces)?';
 const cap='(?:max(?:imum)?(?:\\s+of)?|limit(?:ed)?(?:\\s+to)?|no\\s+more\\s+than|at\\s+most|must\\s+not\\s+exceed|not\\s+exceed(?:ing)?|up\\s+to)';
 const patterns=[new RegExp('\\b'+label+'\\b[^.!?\\n]{0,55}?\\b'+cap+'[ :()\\-]*'+number+'\\s*'+unit,'gi'),new RegExp('\\b'+label+'\\b[^.!?\\n]{0,35}?'+number+'\\s*'+unit+'\\s*(?:max(?:imum)?|limit)\\b','gi'),new RegExp('\\b'+number+'[- ]character\\s+'+label+'\\b','gi')];
 const limits=[];
 for(const text of [String(target?.description||target?.notes||''),String(instructions||'')])for(const pattern of patterns)for(const match of text.matchAll(pattern)){const value=Number(match[1].replaceAll(',',''));if(Number.isSafeInteger(value)&&value>0&&value<=100000&&!/\b(?:answer|question|email|password)\b/i.test(match[0])&&(!['resume','coverLetter'].includes(kind)||!/\b(?:summary|headline|bullet|highlight|paragraph|greeting|closing)\b/i.test(match[0])))limits.push(value);}
 // A revision request is scoped to the requested document; posting-wide generic limits are deliberately ignored.
 for(const match of (genericInstruction?String(instructions||''):'').matchAll(new RegExp('\\b'+cap+'[ :()\\-]*'+number+'\\s*'+unit,'gi'))){const value=Number(match[1].replaceAll(',',''));if(Number.isSafeInteger(value)&&value>0&&value<=100000)limits.push(value);}
 for(const text of [String(target?.description||target?.notes||''),String(instructions||'')]){
  const under=new RegExp('\\b'+label+'\\b[^.!?\\n]{0,40}?\\b(?:under|less\\s+than)\\s+'+number+'\\s*'+unit,'gi');
  for(const match of text.matchAll(under)){const value=Number(match[1].replaceAll(',',''))-1;if(Number.isSafeInteger(value)&&value>0&&value<=100000&&(!['resume','coverLetter'].includes(kind)||!/\b(?:summary|headline|bullet|highlight|paragraph|greeting|closing|answer|question)\b/i.test(match[0])))limits.push(value);}
 }
 if(genericInstruction)for(const match of String(instructions).matchAll(new RegExp('\\b(?:under|less\\s+than)\\s+'+number+'\\s*'+unit,'gi'))){const value=Number(match[1].replaceAll(',',''))-1;if(Number.isSafeInteger(value)&&value>0&&value<=100000)limits.push(value);}
 return limits.length?Math.min(...limits):null;
}
export function documentPolicyGuidance(kind,target,instructions=''){
 const total=kind==='both'?['resume','coverLetter'].map(k=>[k,characterLimit(k,target,instructions)]):[[kind,characterLimit(kind,target,instructions)]];
 return `Candidate identity: Raven must render ${CANDIDATE_NAME} as the resume name and cover-letter signature. Never use a placeholder or another candidate name. Raven restores these fields; do not insert a signature into body paragraphs. Character limits (including spaces, UTF-16 units): headline 160; summary 1600; each skill 160; each resume bullet or highlight 850; cover greeting and closing 160 each; each cover paragraph 2200. Aim below these maxima and shorten prose without cutting sentences or removing required facts. ${total.filter(([,n])=>n).map(([k,n])=>`The complete ${k}, including identity/contact/section labels, must be at most ${n} characters of rendered visible text (whitespace collapsed to one space).`).join(' ')} Explicit revision section caps: ${Object.keys(DOCUMENT_LIMITS).map(field=>field+" "+sectionCharacterLimit(field,instructions)).join("; ")}. Any supplied total character cap takes priority over word-count targets. If evidence and required history cannot fit, report the limit failure rather than silently truncating or inventing content.`;
}
export function visibleDocumentText(html){
 const body=String(html).match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]||String(html);
 return body.replace(/<(?:style|script)\b[^>]*>[\s\S]*?<\/(?:style|script)>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&apos;':"'",'&nbsp;':' '})[s]).replace(/\s+/g,' ').trim();
}

export function sectionCharacterLimit(field,instructions=''){return Math.min(DOCUMENT_LIMITS[field],characterLimit(field,{},instructions)||DOCUMENT_LIMITS[field]);}
