import type { Candidate, Track } from "./types.ts";
import { enrichCandidate } from "./enrich.ts";
import { markExpired, updateDescription } from "./db.ts";
import { normalizeUrl, json } from "./utils.ts";

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS"}});
  if(req.method!=="GET") return json({error:"GET required"},405);
  try{
    const u=new URL(req.url);
    if(u.searchParams.get("action")==="health") return json({ok:true,service:"raven-enrich-v1"});
    const url=normalizeUrl(String(u.searchParams.get("url")||""));
    if(!url) return json({error:"URL required"},400);
    let parsed:URL; try{parsed=new URL(url);}catch{return json({error:"Invalid URL"},400);}
    if(!["http:","https:"].includes(parsed.protocol)) return json({error:"Invalid URL"},400);
    const track=(String(u.searchParams.get("track")||"Professional")) as Track;
    const c:Candidate={
      track,title:String(u.searchParams.get("title")||""),company:String(u.searchParams.get("company")||""),
      location:String(u.searchParams.get("location")||""),remote:String(u.searchParams.get("remote")||"")==="true",
      salary_text:String(u.searchParams.get("salary_text")||""),url,source:String(u.searchParams.get("source")||"Web"),snippet:""
    };
    const e=await enrichCandidate(c) as Candidate & {_httpStatus?:number;_expired?:boolean};
    if(e._expired) await markExpired(url,e._httpStatus||0).catch(()=>{});
    else await updateDescription(url,e).catch(()=>{});
    return json({ok:true,url,expired:Boolean(e._expired),http_status:e._httpStatus||200,description:String(e.snippet||""),company:e.company||"",location:e.location||"",remote:Boolean(e.remote),salary_text:e.salary_text||""});
  }catch(e){return json({error:e instanceof Error?e.message:String(e)},500);}
});