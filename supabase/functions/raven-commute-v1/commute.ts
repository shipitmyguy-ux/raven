import { getCommute, putCommute } from "./db.ts";

const HOME={lat:40.5853,lon:-105.0844};

function key(location:string){
  return String(location||"").trim().toLowerCase().replace(/\s+/g," ");
}

export async function commuteMinutes(location:string){
  const k=key(location);
  if(!k) return null;
  const cached=await getCommute(k);
  if(cached?.minutes!==undefined){
    const age=Date.now()-Date.parse(cached.updated_at||"");
    if(Number.isFinite(age)&&age<30*86400000) return Number(cached.minutes);
  }
  try{
    const q=encodeURIComponent(location+", USA");
    const geo=await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q="+q,{headers:{"User-Agent":"RavenJobSearch/3.0 (commute estimator)"},signal:AbortSignal.timeout(7000)});
    if(!geo.ok) return cached?.minutes??null;
    const gj=await geo.json();
    if(!Array.isArray(gj)||!gj[0]) return cached?.minutes??null;
    const lat=Number(gj[0].lat),lon=Number(gj[0].lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)) return cached?.minutes??null;
    const route=await fetch("https://router.project-osrm.org/route/v1/driving/"+HOME.lon+","+HOME.lat+";"+lon+","+lat+"?overview=false&alternatives=false&steps=false",{headers:{"User-Agent":"RavenJobSearch/3.0"},signal:AbortSignal.timeout(7000)});
    if(!route.ok) return cached?.minutes??null;
    const rj=await route.json();
    const seconds=Number(rj?.routes?.[0]?.duration);
    if(!Number.isFinite(seconds)) return cached?.minutes??null;
    const minutes=Math.max(1,Math.round(seconds/60));
    await putCommute(k,location,minutes);
    return minutes;
  }catch{
    return cached?.minutes??null;
  }
}