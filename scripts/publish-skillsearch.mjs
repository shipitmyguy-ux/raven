// Publish validated public HTML to a dedicated feed branch; no Supabase credentials.
import {readFile} from 'node:fs/promises';

if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Publishing requires GitHub Actions on main');
const repository=process.env.GITHUB_REPOSITORY;
const token=process.env.GITHUB_TOKEN;
if(repository!=='shipitmyguy-ux/raven'||!token)throw Error('Expected repository and scoped GitHub token required');
const raw=await readFile('artifacts/skillsearch-snapshot.json');
if(raw.length>3500000)throw Error('Snapshot exceeds 3.5 MB');
const snapshot=JSON.parse(raw.toString('utf8'));
if(snapshot.schema!==1||snapshot.provider!=='skillsearch'||snapshot.provenance?.repository!==repository||snapshot.provenance?.run_id!==process.env.GITHUB_RUN_ID||snapshot.provenance?.commit!==process.env.GITHUB_SHA||!Array.isArray(snapshot.pages)||!snapshot.pages.length)throw Error('Snapshot provenance invalid');
const branch='skillsearch-feed';
const root=`https://api.github.com/repos/${repository}`;
async function api(path,method='GET',body,allow404=false) {
  const response=await fetch(root+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{})});
  if(allow404&&response.status===404)return null;
  if(!response.ok)throw Error(`GitHub ${method} request failed (${response.status})`);
  return response.json();
}
if(!await api(`/git/ref/heads/${branch}`,'GET',undefined,true))await api('/git/refs','POST',{ref:`refs/heads/${branch}`,sha:process.env.GITHUB_SHA});
// Contents lookup returns only metadata for snapshots above GitHub's inline size limit.
const existing=await api(`/contents/skillsearch-snapshot.json?ref=${branch}`,'GET',undefined,true);
await api('/contents/skillsearch-snapshot.json','PUT',{
  message:`Refresh Skillsearch public snapshot (run ${snapshot.provenance.run_id})`,branch,
  content:raw.toString('base64'),...(existing?.sha?{sha:existing.sha}:{})
});
console.log(`Published Skillsearch snapshot: ${snapshot.pages.length} verified public pages, ${raw.length} bytes.`);
