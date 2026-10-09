import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT,jwtVerify,createLocalJWKSet} from 'jose';
import {createOAuthAuthenticator,oauthConfiguration} from '../supabase/functions/_shared/mcp-oauth.mjs';
import {createMcpHandler} from '../supabase/functions/_shared/mcp-bridge.mjs';
const clock=Date.parse('2026-10-09T18:00:00Z'),seconds=clock/1000;
const key=await generateKeyPair('ES256'),other=await generateKeyPair('ES256');
const publicKey=await exportJWK(key.publicKey);
const jwks=createLocalJWKSet({keys:[{...publicKey,kid:'test',alg:'ES256',use:'sig'}]});
const verifyJwt=(token,_config,options)=>jwtVerify(token,jwks,options);
function fixture(){
 const env={SUPABASE_URL:'https://db.test',RAVEN_MCP_OWNER_SUBJECT:'owner',
  RAVEN_MCP_OAUTH_GRANTS:JSON.stringify([{client_id:'client',subject:'owner',job_ids:['JT-test'],scopes:['jobs:read'],expires_at:'2026-10-10T00:00:00Z'}])};
 const getEnv=k=>env[k],config=oauthConfiguration(getEnv);
 const authenticate=createOAuthAuthenticator({getEnv,verifyJwt,now:()=>clock});
 const token=async(overrides={},privateKey=key.privateKey)=>new SignJWT({role:'authenticated',client_id:'client',session_id:'session',
  iss:config.issuer,aud:config.resource,sub:'owner',exp:seconds+60,iat:seconds,...overrides})
  .setProtectedHeader({alg:'ES256',kid:'test'}).sign(privateKey);
 const request=t=>new Request(config.resource,{method:'POST',headers:{authorization:'Bearer '+t,'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
 return {env,getEnv,config,authenticate,token,request};
}
test('signed owner OAuth access token yields only explicitly granted job permissions',async()=>{
 const f=fixture(),grant=await f.authenticate(f.request(await f.token()));
 assert.deepEqual(grant,{subject:'owner',client_id:'client',job_ids:['JT-test'],scopes:['jobs:read']});
});
test('signature, issuer, resource audience, lifetime, owner and OAuth client/session are mandatory',async()=>{
 for(const claims of [{iss:'https://attacker.test'},{aud:'authenticated'},{aud:'client'}, {exp:seconds},
  {exp:undefined},{iat:seconds+1},{sub:'other'},{client_id:undefined},{client_id:'other'},
  {session_id:undefined},{role:'anon'},{role:'service_role'},{is_anonymous:true}]){
  const f=fixture();await assert.rejects(f.authenticate(f.request(await f.token(claims))),/UNAUTHORIZED/);
 }
 const f=fixture();await assert.rejects(f.authenticate(f.request(await f.token({},other.privateKey))),/UNAUTHORIZED/);
});
test('server grant removal, expiry, owner binding and malformed permissions deny access',async()=>{
 const f=fixture(),req=f.request(await f.token());await f.authenticate(req);
 f.env.RAVEN_MCP_OAUTH_GRANTS='[]';await assert.rejects(f.authenticate(req),/UNAUTHORIZED/);
 for(const override of [{expires_at:'2020-01-01'},{expires_at:'invalid'},{subject:'other'},
  {job_ids:[]},{job_ids:['invalid,filter']},{scopes:['admin']},{scopes:[]}]){
  const g=fixture(),grant=JSON.parse(g.env.RAVEN_MCP_OAUTH_GRANTS)[0];
  g.env.RAVEN_MCP_OAUTH_GRANTS=JSON.stringify([{...grant,...override}]);
  await assert.rejects(g.authenticate(g.request(await g.token())),/UNAUTHORIZED/);
 }
 f.env.RAVEN_MCP_OAUTH_GRANTS='broken';await assert.rejects(f.authenticate(req),/SERVER_NOT_CONFIGURED/);
});
test('public discovery and 401 challenge expose no jobs, profile or credentials',async()=>{
 const f=fixture();let reads=0;
 const handler=createMcpHandler({getEnv:f.getEnv,verifyJwt,now:()=>clock,fetchImpl:async()=>{reads++;throw new Error('unexpected storage');}});
 const r=await handler(new Request(f.config.metadataUrl));assert.equal(r.status,200);
 assert.deepEqual((await r.json()).scopes_supported,['email']);assert.equal(reads,0);
 for(const path of ['/raven-mcp-v1/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource'])
  assert.equal((await handler(new Request('https://gateway.test'+path))).status,200);
 const denied=await handler(f.request('bad'));assert.equal(denied.status,401);
 assert.match(denied.headers.get('www-authenticate'),/resource_metadata="https:\/\/db.test\/functions\/v1\/raven-mcp-v1\//);
 assert.equal(reads,0);
 const discovered=await handler(f.request(await f.token()));assert.equal(discovered.status,200);
 const tools=(await discovered.json()).result.tools;assert.equal(tools.length,3);
 assert.equal(tools.some(t=>t.name==='save_generated_document'),false);assert.equal(reads,0);
 const invalid=await handler(f.request(await f.token({aud:'authenticated'})));assert.equal(invalid.status,401);assert.equal(reads,0);
});
