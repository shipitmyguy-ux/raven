// Shared by the browser and Edge Functions: eligibility is not a keyword score.
(function(root){
  function hasWholePhrase(value,phrase){
    const escaped=String(phrase).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    return new RegExp("(?:^|[^a-z0-9])"+escaped+"(?=$|[^a-z0-9])","i").test(String(value||""));
  }
  function gameArtRoleAllowed(job){
    const title=String(job?.title||"").replace(/[–—_-]/g," ").replace(/\s+/g," ");
    if(/\b(?:technical artist|technical designer|character artist|vfx artist|animator|programmer|programming|engineer|engineering|developer|community|marketing|sales|recruiter|account executive)\b/i.test(title))return false;
    if(/\b(?:(?:environment|world|level|prop|material|texture|game)\s+artists?|3\s?d\s+(?:(?:environment|visualization)\s+)?(?:artists?|model[el]ers?|generalists?)|(?:environment|prop)\s+model[el]ers?|world\s+builders?|unreal\s+(?:artists?|generalists?))\b/i.test(title))return true;
    // Art leadership must explicitly be connected to environment/3D production.
    return /\b(?:art director|art lead|lead artist)\b/i.test(title)&&/\b(?:environment art|3d art|world building|worldbuilding)\b/i.test([title,job?.snippet,job?.notes].join(" "));
  }

  function professionalRoleAllowed(job){
    const title=String(job?.title||"").replace(/[–—_-]/g," ").replace(/\s+/g," ");
    // Supporting a sales team is different from being responsible for selling.
    const salesSupport=/\bsales\s+(?:operations|enablement|training|support|analytics|administration|administrator)\b/i.test(title);
    if((/\bsales\b/i.test(title)&&!salesSupport)
      || /\bsalesperson\b|\bseller\b|\baccount executive\b|\baccount manager\b|\bbusiness development\b|\b(?:SDR|BDR)\b|\bpre\s?sales\b|\bsolutions? consultant\b|\bcloser\b/i.test(title))return false;
    const body=[job?.snippet,job?.notes,job?.description].filter(Boolean).join(" ").replace(/<[^>]*>/g," ");
    // Catch selling responsibilities hidden behind customer-success or generic
    // operations titles. Incidental mentions of sales, revenue, or colleagues'
    // quotas are intentionally insufficient.
    const responsibility=/\b(?:you(?:'ll| will)?|this role|the role|responsibilities include)\s+(?:will\s+)?(?:personally\s+)?(?:carry|own|meet|hit|achieve)\s+(?:an?\s+|your\s+|the\s+)?(?:sales\s+|revenue\s+)?quota\b|\b(?:own|carry|meet|hit|achieve)\s+(?:an?\s+|your\s+)?(?:sales|revenue)\s+quota\b|\b(?:responsible for|responsibilities include|you(?:'ll| will)?|this role will)\s+(?:personally\s+)?(?:closing\s+(?:new\s+)?(?:sales|deals)|close\s+(?:new\s+)?(?:sales|deals)|selling\s+(?:our\s+)?(?:products|services)|sell\s+(?:our\s+)?(?:products|services)|prospecting\s+(?:for\s+)?(?:new\s+)?(?:customers|clients)|cold\s+calling)\b/i;
    return !responsibility.test(body);
  }
  // Global commute policy. Only an explicit nearby Colorado work
  // location qualifies; employer headquarters and description mentions do not.
  const LOCAL_TOWNS=['Fort Collins','Loveland','Windsor','Timnath','Wellington','Laporte','La Porte','Bellvue','Severance','Greeley','Johnstown','Berthoud','Eaton','Ault'];
  function localLocationAllowed(job){
    const location=String(job?.location||'').trim();
    if(job?.remote===true || /^(?:true|yes|remote)$/i.test(String(job?.remote||'')) || /\b(?:remote|nationwide|statewide|travel|multiple locations)\b/i.test(location))return false;
    // Match a city/state pair, not an incidental local city in another region.
    return LOCAL_TOWNS.some(town=>new RegExp('(?:^|[;,/|])\\s*'+town+'\\s*,?\\s+(?:CO|Colorado)(?=$|[\\s,;()/|])','i').test(location));
  }
  function jobLocationAllowed(job){
    const location=String(job?.location||'');
    const inPerson=/\b(?:hybrid|on[- ]?site|in[- ]office)\b/i.test([location,job?.title].join(' '));
    const remote=job?.remote===true || /^(?:true|yes|remote)$/i.test(String(job?.remote||'')) || /\bremote\b/i.test(location);
    if(remote&&!inPerson)return true;
    // Ignore contradictory remote flags when the work location is in-person.
    return localLocationAllowed({...job,remote:false});
  }
  root.RavenTrackFilter={gameArtRoleAllowed,professionalRoleAllowed,localLocationAllowed,jobLocationAllowed,hasWholePhrase};
})(globalThis);
