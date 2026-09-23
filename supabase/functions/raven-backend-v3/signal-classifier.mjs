export const STRONG_REJECTION_PATTERNS=[
  // Observed real-world examples from the user's mailbox.
  {re:/\bdecided to pursue other candidates\b/i,reason:"pursue-other-candidates"},
  {re:/\b(?:have|has) not been selected for further consideration\b/i,reason:"not-selected-further-consideration"},

  // Common public-template formulations.
  {re:/\b(?:we|they) (?:have )?selected (?:another|other) candidate(?:s)?\b/i,reason:"selected-other-candidate"},
  {re:/\bselected other candidates for further consideration\b/i,reason:"selected-other-candidates-further-consideration"},
  {re:/\b(?:will|have decided to|decided to) (?:move|proceed) forward with (?:another|other) candidate(?:s)?\b/i,reason:"move-forward-other-candidates"},
  {re:/\b(?:will|have decided to|decided to) pursue (?:another|other) candidate(?:s)?\b/i,reason:"pursue-other-candidates"},
  {re:/\b(?:won't|will not|do not plan to|have decided not to) move forward with (?:your|the) application\b/i,reason:"not-moving-forward-application"},
  {re:/\bwe regret to inform you\b[\s\S]{0,220}\bnot (?:been )?selected\b/i,reason:"regret-not-selected"},
  {re:/\bnot selected to move forward\b/i,reason:"not-selected-move-forward"},

  // Softer language: a decision is stated through comparative alignment instead of explicit rejection.
  {re:/\b(?:selected|chosen|moving forward with|proceeding with) (?:a |the |other )?candidate(?:s)? whose (?:background|experience|qualifications|skills)[\s\S]{0,120}\bmore closely (?:align|aligned|match|matched)\b/i,reason:"closer-alignment-other-candidate"},
  {re:/\b(?:chosen|decided) to continue (?:the )?(?:process|search) with candidate(?:s)? whose (?:background|experience|qualifications|skills)[\s\S]{0,120}\b(?:more closely )?(?:align|match)\b/i,reason:"continue-with-closer-aligned-candidates"},
  {re:/\bmoving ahead with applicant(?:s)? whose (?:background|experience|qualifications|skills)[\s\S]{0,120}\b(?:more closely )?(?:align|match)\b/i,reason:"moving-ahead-closer-aligned-applicants"}
];

const APPLICATION_RECEIVED_PATTERNS=[
  /\b(?:we(?:'ve| have)|your application has been) received your application\b/i,
  /\bapplication (?:has been )?received\b/i,
  /\bapplication submitted\b/i
];

export function classifyApplicationMessage(text){
  const normalized=String(text||"").replace(/\s+/g," ").trim();
  if(!normalized) return null;
  for(const pattern of STRONG_REJECTION_PATTERNS){
    const match=normalized.match(pattern.re);
    if(match){
      return {
        type:"rejection",
        confidence:/closer-alignment|continue-with|moving-ahead/.test(pattern.reason)?0.95:0.99,
        evidence:String(match[0]||"").slice(0,240),
        reason:pattern.reason
      };
    }
  }
  if(APPLICATION_RECEIVED_PATTERNS.some(pattern=>pattern.test(normalized))){
    return {
      type:"application_submitted",
      confidence:0.96,
      evidence:"Application receipt/submission language detected.",
      reason:"application-received"
    };
  }
  return null;
}
