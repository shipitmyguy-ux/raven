import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINS=new Set(["https://raven.floot.app","https://shipitmyguy-ux.github.io","http://localhost:3000","http://localhost:5173"]);
const BLOCK=/\b(submit|apply|finalize|send application|complete application|submit application)\b/i;
const ALLOWED=new Set(["ping","start","stop","open","snapshot","screenshot","click","type","select","wait","smoke"]);

function H(q:Request){
  const o=q.headers.get("origin")||"";
  return {"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":ORIGINS.has(o)?o:"https://raven.floot.app","access-control-allow-headers":"content-type,x-raven-client","access-control-allow-methods":"POST,OPTIONS","vary":"Origin"};
}
function O(q:Request,d:any,s=200){return new Response(JSON.stringify(d),{status:s,headers:H(q)})}
const audit=async(action:string,status:string,detail:any={})=>{try{const u=Deno.env.get("SUPABASE_URL"),k=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(u&&k)await createClient(u,k).from("raven_control_events").insert({action,status,detail})}catch{}};

function steelKey(){const k=Deno.env.get("STEEL_API_KEY");if(!k)throw Error("STEEL_API_KEY unavailable");return k}
async function steel(path:string,init:RequestInit={}){
  const r=await fetch("https://api.steel.dev"+path,{...init,headers:{"steel-api-key":steelKey(),"content-type":"application/json",...(init.headers||{})}});
  const t=await r.text();let b:any={};try{b=t?JSON.parse(t):{}}catch{b={raw:t.slice(0,500)}}
  if(!r.ok)throw Error(b?.message||b?.error||("Steel API "+r.status));return b;
}
async function start(){
  return await steel("/v1/sessions",{method:"POST",body:JSON.stringify({timeout:600000,inactivityTimeout:120000,dimensions:{width:1440,height:1000}})});
}
async function stop(id:string){return await steel("/v1/sessions/"+encodeURIComponent(id)+"/release",{method:"POST"})}

class C{
  ws:WebSocket;n=0;p=new Map<number,any>();
  constructor(w:WebSocket){this.ws=w;w.onmessage=e=>{try{const m=JSON.parse(String(e.data)),p=this.p.get(m.id);if(!p)return;clearTimeout(p.t);this.p.delete(m.id);m.error?p.j(Error(m.error.message)):p.r(m.result||{})}catch{}}}
  send(method:string,params:any={},sessionId?:string){const id=++this.n;return new Promise<any>((r,j)=>{const t=setTimeout(()=>{this.p.delete(id);j(Error("CDP timeout: "+method))},15000);this.p.set(id,{r,j,t});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))})}
}
async function conn(id:string){
  const w=new WebSocket("wss://connect.steel.dev?apiKey="+encodeURIComponent(steelKey())+"&sessionId="+encodeURIComponent(id));
  await new Promise<void>((r,j)=>{const t=setTimeout(()=>j(Error("Steel websocket timeout")),15000);w.onopen=()=>{clearTimeout(t);r()};w.onerror=()=>j(Error("Steel websocket connection failed"))});return w;
}
async function page(c:C){
  const x=await c.send("Target.getTargets"),p=(x.targetInfos||[]).find((v:any)=>v.type==="page");if(!p)throw Error("No page target found");
  return (await c.send("Target.attachToTarget",{targetId:p.targetId,flatten:true})).sessionId;
}
async function ev(c:C,s:string,e:string){
  const r=await c.send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true},s);if(r.exceptionDetails)throw Error(r.exceptionDetails.text||"Page evaluation failed");return r?.result?.value;
}
async function withPage(id:string,fn:(c:C,s:string)=>Promise<any>){
  const w=await conn(id),c=new C(w);try{const s=await page(c);await c.send("Runtime.enable",{},s);return await fn(c,s)}finally{w.close()}
}

async function act(a:string,b:any){
  const id=String(b.sessionId||"");if(!id)throw Error("sessionId required");
  return await withPage(id,async(c,s)=>{
    if(a==="open"){
      const u=String(b.url||"");if(!/^https?:\/\//i.test(u))throw Error("Valid URL required");
      await c.send("Page.enable",{},s);await c.send("Page.navigate",{url:u},s);await audit(a,"ok",{host:new URL(u).hostname});return{ok:true,action:a,url:u};
    }
    if(a==="wait"){const ms=Math.max(0,Math.min(10000,Number(b.ms||500)));await new Promise(r=>setTimeout(r,ms));return{ok:true,action:a,ms}}
    if(a==="snapshot"){const v=await ev(c,s,"JSON.stringify({url:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,20000)})");await audit(a,"ok");return{ok:true,action:a,snapshot:JSON.parse(v||"{}")}}
    if(a==="screenshot"){await c.send("Page.enable",{},s);const r=await c.send("Page.captureScreenshot",{format:"png",fromSurface:true},s);await audit(a,"ok",{bytes:Math.round((r.data?.length||0)*.75)});return{ok:true,action:a,mime:"image/png",data:r.data,bytes:Math.round((r.data?.length||0)*.75)}}

    const selector=String(b.selector||"");if(!selector)throw Error("selector required");
    const combined=[a,selector,b.text,b.url].filter(Boolean).join(" ");if(BLOCK.test(combined)){await audit(a,"blocked",{reason:"final_submission_guard"});throw Error("Employer final submission is permanently blocked.")}
    const sel=JSON.stringify(selector);

    if(a==="click"){
      const v=await ev(c,s,`(()=>{const e=document.querySelector(${sel});if(!e)return {ok:false,error:'Element not found'};const label=(e.innerText||e.getAttribute('aria-label')||e.getAttribute('value')||'');if(/\\b(submit|apply|finalize|send application|complete application|submit application)\\b/i.test(label))return {ok:false,blocked:true,error:'Employer final submission is permanently blocked.'};e.click();return {ok:true,label:label.slice(0,200)}})()`);
      await audit(a,v?.blocked?"blocked":v?.ok?"ok":"not_found",{label:v?.label});
      if(v?.blocked)throw Error(v.error);if(!v?.ok)throw Error(v?.error||"Click failed");return{ok:true,action:a,label:v.label};
    }

    if(a==="select"){
      const val=JSON.stringify(String(b.text??b.value??""));
      const v=await ev(c,s,`(()=>{const e=document.querySelector(${sel});if(!e)return {ok:false,error:'Element not found'};if(!(e instanceof HTMLSelectElement))return {ok:false,error:'Element is not a select'};e.value=${val};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return {ok:true,value:e.value}})()`);
      await audit(a,v?.ok?"ok":"error");if(!v?.ok)throw Error(v?.error||"Select failed");return{ok:true,action:a,value:v.value};
    }

    const txt=JSON.stringify(String(b.text||""));
    const v=await ev(c,s,`(()=>{const e=document.querySelector(${sel});if(!e)return {ok:false,error:'Element not found'};e.focus();const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const set=Object.getOwnPropertyDescriptor(proto,'value')?.set;set?set.call(e,${txt}):e.value=${txt};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return {ok:true,value:e.value}})()`);
    await audit(a,v?.ok?"ok":"not_found");if(!v?.ok)throw Error(v?.error||"Type failed");return{ok:true,action:a,value:v.value};
  });
}

async function smoke(){
  const target="https://shipitmyguy-ux.github.io/raven/",session=await start(),id=String(session.id||"");if(!id)throw Error("Steel did not return a session id");
  await audit("smoke","running",{target,sessionId:id});
  try{
    const result=await withPage(id,async(c,s)=>{
      await c.send("Page.enable",{},s);await c.send("Page.navigate",{url:target},s);await new Promise(r=>setTimeout(r,2200));
      const initial=await ev(c,s,"({title:document.title,h1:document.querySelector('h1')?.textContent||'',sync:document.querySelector('#syncStatus')?.textContent||'',activeTrack:document.querySelector('.track-tab.active')?.dataset.track||'',cards:document.querySelectorAll('.job-card').length})");
      const clicked=await ev(c,s,"(()=>{const e=document.querySelector('.track-tab[data-track=Professional]');if(!e)return false;e.click();return true})()");
      if(!clicked)throw Error("Professional tab not found");
      const typed=await ev(c,s,"(()=>{const e=document.querySelector('#searchBox');if(!e)return false;const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;set?set.call(e,'Project'):e.value='Project';e.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
      if(!typed)throw Error("Search box not found");
      await new Promise(r=>setTimeout(r,300));
      const final=await ev(c,s,"({url:location.href,activeTrack:document.querySelector('.track-tab.active')?.dataset.track||'',professionalSelected:document.querySelector('.track-tab[data-track=Professional]')?.getAttribute('aria-selected')||'',searchValue:document.querySelector('#searchBox')?.value||'',cards:document.querySelectorAll('.job-card').length,sync:document.querySelector('#syncStatus')?.textContent||''})");
      const shot=await c.send("Page.captureScreenshot",{format:"png",fromSurface:true},s);
      const ok=String(initial?.title||"").includes("Raven")&&String(initial?.h1||"").trim()==="Raven"&&final?.activeTrack==="Professional"&&final?.searchValue==="Project";
      return{ok,action:"smoke",target,sessionId:id,viewerUrl:session.sessionViewerUrl||session.debugUrl||null,initial,final,screenshotBytes:Math.round((shot.data?.length||0)*.75)};
    });
    await audit("smoke",result.ok?"ok":"failed",{target,initial:result.initial,final:result.final,screenshotBytes:result.screenshotBytes});
    return result;
  }finally{try{await stop(id);await audit("stop","ok",{sessionId:id,source:"smoke"})}catch(e){await audit("stop","error",{sessionId:id,error:e instanceof Error?e.message:String(e)})}}
}

Deno.serve(async q=>{
  if(q.method==="OPTIONS")return new Response("ok",{headers:H(q)});
  if(q.method!=="POST")return O(q,{error:"POST required"},405);
  const o=q.headers.get("origin")||"";if(o&&!ORIGINS.has(o))return O(q,{error:"Origin not allowed"},403);
  if(q.headers.get("x-raven-client")!=="raven-web-v1")return O(q,{error:"Raven client header required"},403);

  let action="unknown";
  try{
    const b=await q.json(),a=action=String(b.action||"");
    if(!ALLOWED.has(a))return O(q,{error:"Unsupported browser action"},400);
    if(a==="ping")return O(q,{ok:true,service:"raven-browser-worker",version:7,steel_key_configured:!!Deno.env.get("STEEL_API_KEY")});
    if(a==="start"){const s=await start();await audit(a,"ok",{sessionId:s.id});return O(q,{ok:true,action:a,sessionId:s.id,viewerUrl:s.sessionViewerUrl||s.debugUrl||null})}
    if(a==="stop"){const id=String(b.sessionId||"");if(!id)return O(q,{error:"sessionId required"},400);await stop(id);await audit(a,"ok",{sessionId:id});return O(q,{ok:true,action:a,sessionId:id})}
    if(a==="smoke"){const r=await smoke();return O(q,r,r.ok?200:500)}
    return O(q,await act(a,b));
  }catch(e){
    await audit(action,"error",{error:e instanceof Error?e.message:String(e)});
    return O(q,{ok:false,error:e instanceof Error?e.message:String(e)},500);
  }
});