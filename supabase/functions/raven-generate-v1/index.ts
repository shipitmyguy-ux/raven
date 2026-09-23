import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS=new Set(["https://shipitmyguy-ux.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  return {
    "Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://shipitmyguy-ux.github.io",
    "Vary":"Origin",
    "Access-Control-Allow-Headers":"content-type,x-raven-client",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Content-Type":"application/json",
    "Cache-Control":"no-store"
  };
}
function json(req:Request,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:cors(req)});}
function allowed(req:Request){
  const origin=req.headers.get("origin")||"";
  if(origin&&!ALLOWED_ORIGINS.has(origin))return false;
  return req.headers.get("x-raven-client")==="raven-web-v1"||req.method==="GET";
}
function base(){return Deno.env.get("SUPABASE_URL")||"";}
async function proxy(req:Request,slug:string,body:any){
  const url=base()+"/functions/v1/"+slug;
  const init={
    method:"POST",
    headers:{"Content-Type":"application/json","x-raven-client":"raven-web-v1"},
    body:JSON.stringify(body)
  };
  let lastStatus=502;
  let lastText="";
  for(let attempt=0;attempt<2;attempt++){
    try{
      const r=await fetch(url,init);
      const text=await r.text();
      lastStatus=r.status;
      lastText=text;
      const structured=/^\s*[{[]/.test(text);
      const retryableBareFailure=r.status>=500&&!structured;
      if(!retryableBareFailure||attempt===1){
        const headers=cors(req);
        if(retryableBareFailure){
          return new Response(JSON.stringify({error:"Generator upstream unavailable",retryable:true,upstreamStatus:r.status}),{status:502,headers});
        }
        return new Response(text,{status:r.status,headers});
      }
    }catch(error){
      lastStatus=502;
      lastText=error instanceof Error?error.message:String(error);
      if(attempt===1){
        return json(req,{error:"Generator upstream unavailable",retryable:true,detail:lastText},502);
      }
    }
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  return json(req,{error:"Generator upstream unavailable",retryable:true,detail:lastText,upstreamStatus:lastStatus},502);
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(!allowed(req))return json(req,{error:"Forbidden"},403);
  if(req.method==="GET"){
    return json(req,{
      ok:true,
      service:"raven-generate-v1",
      version:17,
      resume_engine:"raven-generate-v2",
      resume_architecture:"canonical-profile+fact-selection",
      cover_letter_engine:"raven-cover-v2"
    });
  }
  if(req.method!=="POST")return json(req,{error:"GET or POST required"},405);
  let body:any={};
  try{body=JSON.parse(await req.text()||"{}");}catch{return json(req,{error:"Invalid JSON"},400);}
  if(body.documentType==="coverLetter"){
    return await proxy(req,"raven-cover-v2",body);
  }
  const next={
    track:String(body.track||"Professional"),
    jobTitle:String(body.jobTitle||""),
    company:String(body.company||""),
    jobDescription:String(body.jobDescription||body.description||"")
  };
  return await proxy(req,"raven-generate-v2",next);
});