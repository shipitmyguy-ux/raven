export function json(data:unknown,status=200,extra:Record<string,string>={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Headers":"content-type",
      "Access-Control-Allow-Methods":"GET, OPTIONS",
      "Content-Type":"application/json",
      "Cache-Control":"no-store",
      ...extra
    }
  });
}

export function decodeHtml(s:string){
  return String(s||"")
    .replace(/<(?:br|\/p|\/li|\/div|\/section|\/h[1-6])\s*\/?>/gi,"\n")
    .replace(/<li[^>]*>/gi,"• ")
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ")
    .replace(/<[^>]*>/g," ")
    .replace(/[ \t]+/g," ").replace(/\n\s*\n+/g,"\n\n").trim();
}

export function normalizeUrl(raw:string){
  try{
    const u=new URL(decodeHtml(raw));
    ["position","pageNum","refId","trackingId","trk","utm_source","utm_medium","utm_campaign","utm_term","utm_content","gh_src","source"].forEach(k=>u.searchParams.delete(k));
    u.hash="";
    return u.toString().replace(/\?$/,"");
  }catch{return String(raw||"").trim();}
}
