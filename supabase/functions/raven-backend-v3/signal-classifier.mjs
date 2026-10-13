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

const CONDITIONAL_INTERVIEW_PATTERNS=[
  /\b(?:we(?:'ll| will)|we may|we might) (?:be in touch to )?(?:schedule|arrange|set up) (?:an? )?interview\b[\s\S]{0,120}\bif\b/i,
  /\bif (?:your|the) (?:background|experience|qualifications|skills)[\s\S]{0,120}\b(?:match|align|meet)\b[\s\S]{0,120}\b(?:schedule|invite|contact)\b/i,
  /\bif selected\b[\s\S]{0,120}\b(?:interview|contact|next step)\b/i
];

const STRONG_INTERVIEW_PATTERNS=[
  {re:/\b(?:would|we'd|we would) like to (?:invite you to|schedule) (?:an? )?interview\b/i,reason:"explicit-interview-invitation"},
  {re:/\binvite you to (?:a|an|the|our) (?:first|second|final|virtual|phone|video|onsite|on-site )?interview\b/i,reason:"invite-to-interview"},
  {re:/\b(?:schedule|set up|arrange) (?:a|an|your) (?:phone |video |virtual |onsite |on-site )?(?:screen|screening|interview)\b/i,reason:"schedule-interview"},
  {re:/\b(?:choose|select|pick) (?:a|one of the following) (?:time|times|time slots?)\b[\s\S]{0,180}\binterview\b/i,reason:"choose-interview-time"},
  {re:/\b(?:meet|speak|chat) with (?:the |our )?(?:hiring manager|recruiter|team|manager)\b[\s\S]{0,160}\b(?:role|position|opportunity|interview)\b/i,reason:"meet-hiring-team"},
  {re:/\bnext step(?:s)?\b[\s\S]{0,160}\b(?:interview|phone screen|screening call)\b/i,reason:"next-step-interview"}
];

const STRONG_OFFER_PATTERNS=[
  {re:/\b(?:pleased|excited|delighted|happy) to offer you (?:the |a )?.{1,100}\bposition\b/i,reason:"pleased-to-offer-position"},
  {re:/\b(?:we|i) would like to (?:formally )?offer you (?:the |a )?.{1,100}\b(?:position|role|job)\b/i,reason:"formal-offer"},
  {re:/\bformal offer letter\b/i,reason:"formal-offer-letter"},
  {re:/\bofficial offer letter\b/i,reason:"official-offer-letter"},
  {re:/\bjob offer from\b/i,reason:"job-offer-subject-language"},
  {re:/\b(?:to accept|if you accept|accept this) (?:the |this )?(?:job )?offer\b/i,reason:"offer-acceptance-language"},
  {re:/\b(?:offer|offering) you (?:an? )?(?:annual|hourly|starting )?(?:salary|rate|compensation)\b/i,reason:"offer-compensation-language"},
  {re:/\b(?:anticipated|expected|proposed) start date\b[\s\S]{0,140}\b(?:offer|position|role)\b/i,reason:"offer-start-date"}
];

const APPLICATION_RECEIVED_PATTERNS=[
  /\bwe (?:received|have received) your application\b/i,
  /\bwe've received your application\b/i,
  /\byour application has been received\b/i,
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
  for(const pattern of STRONG_OFFER_PATTERNS){
    const match=normalized.match(pattern.re);
    if(match){
      return {
        type:"offer",
        confidence:0.99,
        evidence:String(match[0]||"").slice(0,240),
        reason:pattern.reason
      };
    }
  }
  const conditionalInterview=CONDITIONAL_INTERVIEW_PATTERNS.some(pattern=>pattern.test(normalized));
  if(!conditionalInterview) for(const pattern of STRONG_INTERVIEW_PATTERNS){
    const match=normalized.match(pattern.re);
    if(match){
      return {
        type:"interview",
        confidence:0.97,
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
