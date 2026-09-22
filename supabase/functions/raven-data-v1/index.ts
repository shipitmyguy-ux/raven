const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...CORS,"Content-Type":"application/json","Cache-Control":"no-store"}});}
Deno.serve((req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method==="GET"){
    const u=new URL(req.url);
    if(u.searchParams.get("action")==="health") return json({ok:true,service:"raven-data-v1",retired:true,replacement:"raven-backend-v3",note:"Saved-job CRUD moved to raven-backend-v3."});
  }
  return json({ok:false,error:"raven-data-v1 is retired.",replacement:"raven-backend-v3",note:"Saved-job CRUD moved to raven-backend-v3."},410);
});
