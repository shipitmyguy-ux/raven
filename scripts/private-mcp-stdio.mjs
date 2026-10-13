import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createMcpHandler,sha256} from '../supabase/functions/_shared/mcp-bridge.mjs';

export const MAX_LINE=200000;
// This adapter has no network listener. Only its parent tunnel process can call it.
// An ephemeral internal credential reuses the existing handler and all save gates.
export async function createPrivateDispatcher({config,serviceKey,fetchImpl=fetch,now=()=>Date.now()}){
  if(!config||config.supabaseUrl!=='https://umvmilulnqnmeqvfoxxc.supabase.co'||
    !Array.isArray(config.jobIds)||config.jobIds.length<1||config.jobIds.length>200||
    !config.jobIds.every(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(id))||
    !Number.isFinite(Date.parse(config.expiresAt))||Date.parse(config.expiresAt)<=now()||
    !serviceKey)throw new Error('PRIVATE_BRIDGE_NOT_CONFIGURED');
  const token=randomBytes(32).toString('base64url');
  const env={SUPABASE_URL:config.supabaseUrl,SUPABASE_SERVICE_ROLE_KEY:serviceKey,
    RAVEN_MCP_OWNER_SUBJECT:'private-tunnel',RAVEN_MCP_GRANTS:JSON.stringify([{
      token_sha256:await sha256(token),subject:'private-tunnel',expires_at:config.expiresAt,
      job_ids:config.jobIds,scopes:['jobs:read','profile:read','documents:create']}])};
  const handler=createMcpHandler({getEnv:name=>env[name],fetchImpl,now});
  return async line=>{
    const response=await handler(new Request('https://private.invalid/mcp',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:line}));
    if(response.status===202)return null;
    const payload=await response.json();
    if(payload.result?.tools)payload.result.tools=payload.result.tools.map(tool=>({...tool,securitySchemes:[{type:'noauth'}]}));
    return JSON.stringify(payload);
  };
}

export async function serveStdio(input,output,dispatch){
  let pending=Buffer.alloc(0);
  for await(const chunk of input){
    let start=0;
    for(let i=0;i<chunk.length;i++){
      if(chunk[i]!==10)continue;
      if(pending.length+i-start>MAX_LINE)throw new Error('REQUEST_TOO_LARGE');
      const line=Buffer.concat([pending,chunk.subarray(start,i)]);
      pending=Buffer.alloc(0);start=i+1;
      if(!line.length)continue;
      const result=await dispatch(new TextDecoder('utf-8',{fatal:true}).decode(line));
      if(result!==null)await new Promise((resolve,reject)=>output.write(result+'\n',error=>error?reject(error):resolve()));
    }
    const tail=chunk.subarray(start);
    if(pending.length+tail.length>MAX_LINE)throw new Error('REQUEST_TOO_LARGE');
    pending=Buffer.concat([pending,tail]);
  }
  if(pending.length)throw new Error('INCOMPLETE_REQUEST');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const config=JSON.parse(await readFile(process.env.RAVEN_PRIVATE_CONFIG,'utf8'));
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.CONTROL_PLANE_API_KEY;
    const dispatch=await createPrivateDispatcher({config,serviceKey});
    await serveStdio(process.stdin,process.stdout,dispatch);
  }catch{
    process.stderr.write('Raven private bridge stopped. Check local configuration, credential and request limits.\n');
    process.exitCode=1;
  }
}
