import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createDocumentHandler} from "../_shared/document-handler.mjs";

Deno.serve(createDocumentHandler("coverLetter",{getEnv:(name:string)=>Deno.env.get(name)}));
