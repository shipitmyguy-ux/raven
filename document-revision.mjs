// Explicitly targeted edits must never pass through the full-document renderer.
export function revisionSection(kind,instructions){
  if(kind!=="resume")return "";
  const text=String(instructions||"").toLowerCase();
  // Ignore clauses that ask to preserve other sections, not edit them.
  const edits=text
    .replace(/\b(?:leave|keep)\b[^.!?;]*?\b(?:unchanged|untouched|the same|as[- ]is)\b/g,"")
    .replace(/\b(?:do not|don't|never)\s+(?:change|edit|rewrite|revise|touch)\b[^.!?;]*/g,"");
  if(!/\bsummary\b/.test(edits))return "";
  const exclusive=/\b(?:only|just)\s+(?:(?:rewrite|revise|change|edit|update)\s+)?(?:(?:the|my|professional|resume)\s+)*summary\b|\bsummary(?:\s+section)?[- ,]+only\b/.test(edits);
  if(exclusive&&!/\b(?:not|more than)\s+(?:just|only)\b|\bsummary\s*(?:,|and|&)\s*(?:(?:the|my)\s+)?(?:headline|skills|experience|education|bullets)\b/.test(edits))return "summary";
  if(/\b(?:headline|skills|experience|history|bullets?|education|highlights|qualifications|contact)\b/.test(edits))return "";
  if(/\b(?:whole|entire|full)\s+(?:resume|document)\b|\b(?:resume|document)\s+(?:overall|throughout)\b/.test(edits))return "";
  return /\b(?:rewrite|revise|change|edit|update|shorten|expand|rework|make|tighten|summary[- ]only|only|just)\b/.test(edits)?"summary":"";
}

export function summaryRange(html){
  const slots=[];
  for(const match of String(html).matchAll(/<p\b[^>]*>[\s\S]*?<\/p\s*>/gi)){
    const open=match[0].slice(0,match[0].indexOf(">")+1);
    const classes=open.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2]?.split(/\s+/)||[];
    if(classes.includes("summary"))slots.push({start:match.index+open.length,end:match.index+match[0].search(/<\/p\s*>$/i)});
  }
  if(slots.length!==1)throw new Error("This saved resume has no unique editable summary. Your previous document is unchanged. Generate a new draft before editing its summary.");
  return slots[0];
}

export function applySummaryRevision(html,text){
  if(typeof text!=="string"||!text.trim()||text.length>1600)throw new Error("The summary revision was incomplete. Your previous document is unchanged.");
  const {start,end}=summaryRange(html);
  const escaped=text.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  return html.slice(0,start)+escaped+html.slice(end);
}
