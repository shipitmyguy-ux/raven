import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createResumeV3Handler} from "../_shared/document-v3-handler.mjs";

Deno.serve(createResumeV3Handler({getEnv:(name:string)=>Deno.env.get(name)}));
