// Cloudflare inference is allowed only after a complete read of account
// subscriptions proves that Workers has no paid subscription. Never upgrade
// billing, add credits or treat an unreadable plan as free.
export async function cloudflareFreeStatus(getEnv,fetchImpl=fetch){
  const token=getEnv('RAVEN_CLOUDFLARE_API_TOKEN')||getEnv('CLOUDFLARE_API_TOKEN')||getEnv('CLOUDFLARE_AUTH_TOKEN');
  const account=getEnv('RAVEN_CLOUDFLARE_ACCOUNT_ID')||getEnv('CLOUDFLARE_ACCOUNT_ID');
  if(!token||!account)return {verified:false,reason:'not_configured'};
  try{
    const response=await fetchImpl('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/subscriptions',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});
    const body=await response.json().catch(()=>null);
    if(!response.ok||body?.success!==true||!Array.isArray(body.result))return {verified:false,reason:'plan_unreadable',status:response.status};
    if(Number(body.result_info?.total_pages||1)>1||Number(body.result_info?.total_count||0)>body.result.length)return {verified:false,reason:'incomplete_plan_list'};
    const plans=body.result.map(row=>({id:String(row.rate_plan?.id||''),name:String(row.rate_plan?.public_name||''),state:String(row.state||'')}));
    const workers=plans.filter(plan=>/workers|workers_ai/i.test(plan.id+' '+plan.name));
    if(workers.some(plan=>!/^workers[_ -]?free$/i.test(plan.id)&&!/^workers free$/i.test(plan.name)))return {verified:false,reason:'paid_workers_plan'};
    // Empty is the normal free account response. Non-Workers subscriptions
    // cannot establish Workers eligibility unless their products are named.
    if(plans.some(plan=>!plan.id&&!plan.name))return {verified:false,reason:'unknown_subscription'};
    return {verified:true,reason:'workers_free',checked_at:new Date().toISOString()};
  }catch{return {verified:false,reason:'plan_check_unavailable'};}
}
