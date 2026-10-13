import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createMcpHandler,sha256} from '../supabase/functions/_shared/mcp-bridge.mjs';
import {workflowTools,createDocumentWorkflow} from './private-document-workflow.mjs';

export const MAX_LINE=200000;
// This adapter has no network listener. Only its parent tunnel process can call it.
// An ephemeral internal credential reuses the existing handler and all save gates.
export async function createPrivateDispatcher({config,serviceKey,fetchImpl=fetch,now=()=>Date.now()}){
  if(!config||config.supabaseUrl!=='https://umvmilulnqnmeqvfoxxc.supabase.co'||
    !Array.isArray(config.jobIds)||(config.jobIds.length<1&&config.allowSavedJobs!==true)||config.jobIds.length>200||
    !config.jobIds.every(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(id))||
    !Number.isFinite(Date.parse(config.expiresAt))||Date.parse(config.expiresAt)<=now()||
    !serviceKey)throw new Error('PRIVATE_BRIDGE_NOT_CONFIGURED');
  const token=randomBytes(32).toString('base64url');
  const env={SUPABASE_URL:config.supabaseUrl,SUPABASE_SERVICE_ROLE_KEY:serviceKey,
    RAVEN_MCP_OWNER_SUBJECT:'private-tunnel',RAVEN_MCP_GRANTS:JSON.stringify([{
      token_sha256:await sha256(token),subject:'private-tunnel',expires_at:config.expiresAt,
      job_ids:config.jobIds,scopes:['jobs:read','profile:read','documents:create']}])};
  const handler=createMcpHandler({getEnv:name=>env[name],fetchImpl,now});
  const rest=async(path,init={})=>{
    const response=await fetchImpl(config.supabaseUrl+'/rest/v1/'+path,{...init,signal:AbortSignal.timeout(15000),headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',...init.headers}});
    if(!response.ok)throw Error('DATABASE_UNAVAILABLE');return response.json();
  };
  const invoke=async rpc=>{
    const response=await handler(new Request('https://private.invalid/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(rpc)}));
    return {status:response.status,payload:response.status===202?null:await response.json()};
  };
  const workflow=createDocumentWorkflow({config,rest,readDocument:async args=>{
    const {payload}=await invoke({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_document',arguments:{job_id:args.job_id,document_type:args.document_type}}});
    if(!payload?.result||payload.result.isError)throw Error(payload?.result?.content?.[0]?.text||'UNAUTHORIZED');
    return payload.result.structuredContent;
  }});
  return async line=>{
    let rpc;try{rpc=JSON.parse(line);}catch{rpc=null;}
    // Explicit local owner opt-in applies only to this private tunnel, never public OAuth.
    if(config.allowSavedJobs===true&&Date.parse(config.expiresAt)>now()&&rpc?.jsonrpc==='2.0'&&Object.hasOwn(rpc,'id')&&rpc?.method==='tools/call'){
      let ids=config.jobIds;
      if(rpc.params?.name==='list_jobs'){
        const query=rpc.params?.arguments?.query;
        if(Object.keys(rpc.params.arguments||{}).some(k=>k!=='query')||(query!==undefined&&(typeof query!=='string'||query.length>200)))return JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:{content:[{type:'text',text:'INVALID_ARGUMENTS'}],isError:true}});
        const rows=await rest('raven_jobs?select=id,title,company,track,last_updated,resume,cover_letter&order=last_updated.desc&limit=200');
        const jobs=rows.filter(row=>!query||(row.title+' '+row.company).toLowerCase().includes(query.toLowerCase())).map(row=>({id:row.id,title:row.title,company:row.company,track:row.track,expected_version:row.last_updated,has_resume:Boolean(row.resume),has_cover_letter:Boolean(row.cover_letter)}));
        return JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:{content:[{type:'text',text:JSON.stringify({jobs,limit:200})}],structuredContent:{jobs,limit:200},isError:false}});
      }else if(/^[A-Za-z0-9_-]{1,160}$/.test(rpc.params?.arguments?.job_id||''))ids=[rpc.params.arguments.job_id];
      const grants=JSON.parse(env.RAVEN_MCP_GRANTS);grants[0].job_ids=ids.length?ids:['JT-no-authorized-jobs'];env.RAVEN_MCP_GRANTS=JSON.stringify(grants);
    }
    let payload;
    if(config.documentWorkflow===true&&rpc?.jsonrpc==='2.0'&&rpc?.method==='tools/call'&&workflowTools.some(t=>t.name===rpc.params?.name)){
      try{const data=await workflow(rpc.params.name,rpc.params.arguments);payload={jsonrpc:'2.0',id:rpc.id,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false}};}
      catch(error){payload={jsonrpc:'2.0',id:rpc.id,result:{content:[{type:'text',text:error.message==='VERSION_CONFLICT'?'VERSION_CONFLICT':'PDF_OR_DRIVE_EXPORT_FAILED'}],isError:true}};}
    }else{
      const response=await handler(new Request('https://private.invalid/mcp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:line}));
      if(response.status===202)return null;payload=await response.json();
    }
    if(payload.result?.tools){
      if(config.documentWorkflow===true)payload.result.tools.push(...workflowTools);
      payload.result.tools=payload.result.tools.map(tool=>({...tool,securitySchemes:[{type:'noauth'}]}));
    }
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
