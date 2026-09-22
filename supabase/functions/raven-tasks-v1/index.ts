const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...CORS,"Content-Type":"application/json","Cache-Control":"no-store"}});}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method==="GET") return json({
    ok:true,
    service:"raven-tasks-v1",
    status:"retired",
    retired:true,
    replacement:"raven-generate-v1",
    health_classification:{
      category:"historical_legacy",
      isSystemFailure:false,
      note:"Legacy task queue endpoint is retired; historical queue rows do not count as active system failures."
    }
  });
  return json({ok:false,error:"Legacy Raven document queue is retired. Use raven-generate-v1 through the Raven web application.",retired:true},410);
});
