// Raven game-art eligibility: time-zone overlap and geographic labels are
// information, not automatic rejection criteria. Reject ONLY listings that
// explicitly make a work visa or work permit mandatory. Missing or ambiguous
// visa information is not evidence of ineligibility.
const requirementPatterns=[
  /\b(?:work|employment|working)?\s*visas?\s+(?:(?:are|is)\s+)?(?:required|mandatory|necessary|needed)\b/i,
  /\bwork\s+permits?\s+(?:(?:are|is)\s+)?(?:required|mandatory|necessary|needed)\b/i,
  /\b(?:require|requires|requiring)\s+(?:a\s+|an\s+|valid\s+|existing\s+|current\s+){0,5}(?:work\s+visa|employment\s+visa|working\s+visa|visa|work\s+permit)\b/i,
  /\b(?:must|need(?:s)?\s+to|required\s+to)\s+(?:(?:already|currently)\s+)?(?:have|hold|obtain|secure|possess|present)\s+(?:a\s+|an\s+|valid\s+|existing\s+|current\s+){0,5}(?:work\s+visa|employment\s+visa|working\s+visa|visa|work\s+permit)\b/i,
  /\b(?:valid|existing|current)\s+(?:work\s+visa|employment\s+visa|visa|work\s+permit)\s+(?:must\s+be\s+)?(?:required|mandatory|needed)\b/i
];
const negatedRequirement=[
  /\b(?:no|without)\s+(?:work\s+|employment\s+|working\s+)?visas?\s+(?:(?:are|is)\s+)?(?:required|mandatory|necessary|needed)\b/i,
  /\b(?:no|without)\s+work\s+permits?\s+(?:(?:are|is)\s+)?(?:required|mandatory|necessary|needed)\b/i,
  /\b(?:visa|visas|work\s+visa|work\s+permit)\s+(?:(?:is|are)\s+)?(?:not|never)\s+(?:required|mandatory|necessary|needed)\b/i,
  /\b(?:do\s+not|don't|does\s+not|doesn't|need\s+not)\s+(?:need|require|have\s+to\s+obtain)\s+(?:a\s+)?(?:work\s+visa|visa|work\s+permit)\b/i
];
export function requiresVisaOrWorkPermit(job) {
 const text=[job?.title,job?.location,job?.snippet,job?.description,job?.notes]
   .filter(v=>typeof v==='string'&&v.trim())
   .join('\n')
   .replace(/<[^>]*>/g,' ')
   .slice(0,25000);
 // Test each sentence/line separately, not across unrelated statements in
 // company boilerplate. A sponsorship question or "no sponsorship offered"
 // is NOT evidence that the job requires a visa.
 const clauses=text.split(/[\n.!?;]+/).map(s=>s.trim()).filter(Boolean);
 for(const clause of clauses){
   if(!/\b(?:visa|visas|work\s+permit|work\s+permits)\b/i.test(clause))continue;
   if(negatedRequirement.some(re=>re.test(clause)))continue;
   if(/\b(?:visa|visas|work\s+permit)\s+sponsorship\b/i.test(clause)
      && !/\b(?:work\s+visa|visa|work\s+permit)\s+(?:required|mandatory)\b/i.test(clause))continue;
   if(requirementPatterns.some(re=>re.test(clause)))return true;
 }
 return false;
}
// Retain stable exported name for existing caller compatibility. This checks
// only explicit visa/work-permit requirements, not US residence or time zones.
export function usStudioScopeAllowed(job) {
 return !requiresVisaOrWorkPermit(job);
}
