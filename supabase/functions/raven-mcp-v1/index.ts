import {createMcpHandler} from '../_shared/mcp-bridge.mjs';
import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.2.12';
// Both OAuth JWTs and existing dedicated credentials remain bound to explicit grants.
// Default-deny applies when owner/grants have not been provisioned.
const url=Deno.env.get('SUPABASE_URL');
const jwks=url?createRemoteJWKSet(new URL(url+'/auth/v1/.well-known/jwks.json'),{timeoutDuration:5000,cacheMaxAge:60000}):null;
Deno.serve(createMcpHandler({getEnv:(name:string)=>Deno.env.get(name),
 verifyJwt:(token:string,_config:unknown,options:Parameters<typeof jwtVerify>[2])=>{
  if(!jwks)throw new Error('SERVER_NOT_CONFIGURED');
  return jwtVerify(token,jwks,options);
 }}));
