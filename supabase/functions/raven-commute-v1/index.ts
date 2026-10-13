import { commuteMinutes } from "./commute.ts";
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{"Access-Control-Allow-Origin":"*","Content-Type":"application/json","Cache-Control":"no-store"}});}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS"}});
  if(req.method!=="GET") return json({error:"GET required"},405);
  try{
    const u=new URL(req.url);
    if(u.searchParams.get("action")==="health") return json({ok:true,service:"raven-commute-v1"});
    const location=String(u.searchParams.get("location")||"").trim();
    if(!location) return json({error:"Location required"},400);
    return json({ok:true,location,minutes:await commuteMinutes(location)});
  }catch(e){return json({error:e instanceof Error?e.message:String(e)},500);}
});