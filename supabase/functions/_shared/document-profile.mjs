// Scope generation input, not the canonical profile or saved employment history.
export function generationProfile(profile,target,instructions=''){
 if(target?.track!=='Games / 3D'||/\bsound\s*air\b/i.test(String(instructions)))return profile;
 const experience=(profile.experience||[]).filter(row=>row.id!=='exp_soundair'&&!/^sound\s*air$/i.test(String(row.company||'').trim()));
 const allowed=new Set(experience.map(row=>row.id));
 return {...profile,experience,resume_required_experience_ids:(profile.resume_required_experience_ids||[]).filter(id=>allowed.has(id))};
}
