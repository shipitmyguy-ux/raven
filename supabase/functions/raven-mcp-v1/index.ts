import {createMcpHandler} from '../_shared/mcp-bridge.mjs';
// Deploy with verify_jwt=false only after dedicated grants are configured.
// The handler validates its own scoped bridge credential on every request.
Deno.serve(createMcpHandler({getEnv:(name:string)=>Deno.env.get(name)}));
