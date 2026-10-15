// Tim Plöger's public game-industry remote-job sheet.
// Fixed source only; never fetch URLs from spreadsheet cells or follow application redirects.
export const REMOTE_GAME_SHEET_KEY='tim-ploeger-remote-games';
export const REMOTE_GAME_SHEET_URL='https://docs.google.com/spreadsheets/d/1Kue4iGy1WNpItNyCpaMT9__A_228NmbQ9s_uUcc3wb8/export?format=csv&gid=601103783';
const MAX_BYTES=3000000;
function parseCSV(csv) {
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(quoted){if(c==='"'&&csv[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
  else if(c==='"')quoted=true;
  else if(c===','){row.push(cell);cell='';}
  else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('Remote game sheet truncated quoted field');
 if(cell||row.length){row.push(cell);rows.push(row);}
 return rows;
}
export function usCompatibleScope(value) {
 const scope=String(value||'').trim();
 if(!scope||/\b(?:onsite|on-site|hybrid)\b/i.test(scope))return false;
 if(/\b(?:USA|U\.S\.A\.|United States|North America|Americas|US)\b/i.test(scope))return true;
 if(/within\s+\d+\s+hours?\s+of\s+Pacific\s+Time/i.test(scope))return true;
 if(/\bworldwide\b/i.test(scope)){
  // Worldwide roles may still specify binding incompatible working hours.
  if(/\b(?:required|must be|only|within|strictly)\b.*\b(?:GMT|UTC|CET|CEST|Europe|EMEA)\b/i.test(scope))return false;
  if(/(?:\+\/-\s*\d+\s*h|-\s*\+\/-\s*\d+\s*h)\s*(?:from\s*)?(?:GMT|UTC|CET)/i.test(scope))return false;
  return true;
 }
 return false;
}
export function parseRemoteGameSheet(source,raw) {
 if(source?.provider!=='remotegamessheet'||source?.board_key!==REMOTE_GAME_SHEET_KEY)throw Error('Unexpected remote game sheet source');
 if(typeof raw!=='string'||raw.length<100||raw.length>MAX_BYTES)throw Error('Invalid remote game sheet response size');
 const rows=parseCSV(raw);
 const heading=rows.findIndex(r=>r[0]?.trim()==='Company'&&r[3]?.trim()==='Job'&&r[6]?.trim()==='Link');
 if(heading<0||heading>10)throw Error('Remote game sheet expected header missing');
 const published=rows.slice(0,heading).map(r=>r.join(' ')).join(' ');
 const declared=Number(/(\d+)\s+listed remote jobs in total/i.exec(published)?.[1]);
 if(!Number.isInteger(declared)||declared<100||declared>2000)throw Error('Remote game sheet declared count missing');
 const listed=rows.slice(heading+1).filter(r=>r.some(c=>String(c||'').trim()));
 if(listed.length!==declared)throw Error('Remote game sheet incomplete: '+listed.length+' of '+declared);
 const jobs=[];const seen=new Set();let skippedSharedUrls=0;
 const urls=new Map();
 for(const r of listed){
  const company=String(r[0]||'').trim(),title=String(r[3]||'').replace(/\s+/g,' ').trim(),url=String(r[6]||'').trim();
  if(!company||!title||!/^https:\/\/[^@ \n\r]+$/i.test(url))throw Error('Remote game sheet invalid required field');
  urls.set(url,(urls.get(url)||0)+1);
 }
 for(const r of listed){
  const company=String(r[0]).trim(),title=String(r[3]).replace(/\s+/g,' ').trim();
  const location=String(r[5]||'').replace(/\s+/g,' ').trim(),url=String(r[6]).trim();
  if(!usCompatibleScope(location))continue;
  // Different vacancies sharing one careers-home URL cannot be represented by
  // Raven's unique-URL discovery table. Hold them rather than conflate.
  if(urls.get(url)>1){skippedSharedUrls++;continue;}
  if(seen.has(url))continue;seen.add(url);
  jobs.push({title,company,location,remote:true,url,snippet:'',provider_job_id:url});
 }
 return {jobs,fetched:listed.length,details:{status:'not_needed',error:null,attempted:0,completed:0,deferred:0},skippedSharedUrls};
}
export async function collectRemoteGameSheet(source,{fetcher=fetch}={}) {
 if(source?.provider!=='remotegamessheet'||source?.board_key!==REMOTE_GAME_SHEET_KEY)throw Error('Invalid remote game sheet configuration');
 const response=await fetcher(REMOTE_GAME_SHEET_URL,{headers:{Accept:'text/csv'},redirect:'follow',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Remote game sheet HTTP '+response.status);
 const bytes=Number(response.headers.get('content-length')||0);
 if(bytes>MAX_BYTES)throw Error('Remote game sheet content length exceeded');
 if(!response.body)throw Error('Remote game sheet empty');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>MAX_BYTES)throw Error('Remote game sheet response too large');chunks.push(r.value);}}
 finally{await reader.cancel();}
 const buffer=new Uint8Array(size);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}
 return parseRemoteGameSheet(source,new TextDecoder().decode(buffer));
}
