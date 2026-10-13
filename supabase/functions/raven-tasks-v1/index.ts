const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...CORS,"Content-Type":"application/json","Cache-Control":"no-store"}});}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method==="GET") return json({ok:true,service:"raven-tasks-v1",retired:true,replacement:"raven-generate-v1"});
  return json({ok:false,error:"Legacy Raven document queue is retired. Use raven-generate-v1 through the Raven web application."},410);
});
