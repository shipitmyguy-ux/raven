export type ApplicationSignalClassification={
  type:string;
  confidence:number;
  evidence:string;
  reason:string;
};

const STRONG_REJECTION_PATTERNS=[
  {re:/\bdecided to pursue other candidates\b/i,reason:"pursue-other-candidates"},
  {re:/\b(?:have|has) not been selected for further consideration\b/i,reason:"not-selected-further-consideration"},
  {re:/\b(?:we|they) (?:have )?selected (?:another|other) candidate(?:s)?\b/i,reason:"selected-other-candidate"},
  {re:/\b(?:will|have decided to) move forward with (?:another|other) candidate(?:s)?\b/i,reason:"move-forward-other-candidates"},
  {re:/\b(?:will|have decided to) pursue (?:another|other) candidate(?:s)?\b/i,reason:"pursue-other-candidates"},
  {re:/\bwe regret to inform you\b[\s\S]{0,220}\bnot (?:been )?selected\b/i,reason:"regret-not-selected"},
  {re:/\bnot selected to move forward\b/i,reason:"not-selected-move-forward"}
];

const APPLICATION_RECEIVED_PATTERNS=[
  /\b(?:we(?:'ve| have)|your application has been) received your application\b/i,
  /\bapplication (?:has been )?received\b/i,
  /\bapplication submitted\b/i
];

export function classifyApplicationMessage(text:string):ApplicationSignalClassification|null{
  const normalized=String(text||"").replace(/\s+/g," ").trim();
  if(!normalized) return null;
  for(const pattern of STRONG_REJECTION_PATTERNS){
    const match=normalized.match(pattern.re);
    if(match){
      return {
        type:"rejection",
        confidence:0.99,
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
