import fs from "node:fs";
import path from "node:path";

const ROOT=process.cwd();
const SKIP_DIRS=new Set([".git","node_modules","playwright-report","test-results"]);
const SKIP_FILES=new Set(["scripts/check-secrets.mjs"]);
const TEXT_EXT=/\.(?:js|mjs|cjs|ts|tsx|json|md|html|css|yml|yaml|toml|sql|txt)$/i;
const checks=[
  ["Google API key",/AIza[0-9A-Za-z_-]{30,}/g],
  ["OpenAI-style secret",/\bsk-[0-9A-Za-z_-]{20,}\b/g],
  ["Supabase secret key",/\bsb_secret_[0-9A-Za-z_-]{20,}\b/g],
  ["Private key",/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["Service-role literal",/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'`][^"'\`$<]{20,}["'`]/g],
  ["Gemini key literal",/GEMINI_API_KEY\s*[:=]\s*["'`][^"'\`$<]{20,}["'`]/g]
];

function walk(dir,out=[]){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(SKIP_DIRS.has(entry.name)) continue;
    const full=path.join(dir,entry.name);
    const rel=path.relative(ROOT,full).replaceAll(path.sep,"/");
    if(entry.isDirectory()) walk(full,out);
    else if(TEXT_EXT.test(entry.name)&&!SKIP_FILES.has(rel)) out.push({full,rel});
  }
  return out;
}

const findings=[];
for(const file of walk(ROOT)){
  const text=fs.readFileSync(file.full,"utf8");
  for(const [label,rx] of checks){
    rx.lastIndex=0;
    for(const match of text.matchAll(rx)){
      const line=text.slice(0,match.index).split("\n").length;
      findings.push(`${file.rel}:${line} ${label}`);
    }
  }
}
if(findings.length){
  console.error("Potential committed secrets found:\n"+findings.join("\n"));
  process.exit(1);
}
console.log("repository secret scan passed");
