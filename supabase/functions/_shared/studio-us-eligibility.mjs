// US-based Raven game-art geographic guard. A generic "remote" flag does not
// override a known country/timezone restriction. Unknown regions are left for
// individual vacancy verification rather than guessed to be worldwide.
const countries=/\b(?:Canada|United Kingdom|UK|Europe|EMEA|European Union|APAC|Australia|New Zealand|India|Poland|Germany|France|Spain|Japan|China|Hong Kong)\b/i;
const usa=/\b(?:United States(?: of America)?|USA|U\.S\.A\.|North America|Americas|US)\b/i;
const worldwide=/\b(?:Worldwide|Global|Anywhere in the world)\b/i;
const narrowGMT=/(?:\+\/-\s*[0-3]\s*h|-\s*\+\/-\s*[0-3]\s*h|within\s*[0-3]\s*hours?)\s*(?:from|of)?\s*(?:GMT|UTC|CET|CEST)\s*\+?\d*/i;
const mandatoryOutsideUS=/\b(?:must (?:be|reside|live|work|be located)|required to (?:be|reside|live|work)|only open to|based (?:in|within))\b.{0,70}\b(?:Canada|United Kingdom|UK|Europe|EMEA|European Union|APAC|Australia|India|Poland|Germany|France|Spain|Japan|China|Hong Kong)\b/i;
export function usStudioScopeAllowed(job) {
 const location=String(job?.location||'').replace(/\s+/g,' ').trim();
 const detail=String(job?.snippet||job?.description||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,20000);
 if(mandatoryOutsideUS.test(detail)&&!/\b(?:United States|USA|US)\b/i.test(location))return false;
 if(narrowGMT.test(location))return false;
 if(usa.test(location))return true;
 if(worldwide.test(location))return true;
 if(/\bwithin\s*\d+\s*hours?\s*of\s*Pacific Time\b/i.test(location))return true;
 if(countries.test(location))return false;
 return true;
}
