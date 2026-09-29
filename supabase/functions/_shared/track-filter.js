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
  root.RavenTrackFilter={gameArtRoleAllowed,hasWholePhrase};
})(globalThis);
