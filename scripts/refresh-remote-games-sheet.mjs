// Refresh the public remote-games spreadsheet snapshot. Fails closed on inaccessible/partial feeds.
import fs from 'node:fs/promises';
const id='1Kue4iGy1WNpItNyCpaMT9__A_228NmbQ9s_uUcc3wb8';
const endpoint='https://docs.google.com/spreadsheets/d/'+id+'/export?format=csv&gid=601103783';
function csv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}if(quoted)throw Error('Unclosed CSV quote');if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
const response=await fetch(endpoint,{signal:AbortSignal.timeout(25000),headers:{'User-Agent':'Raven-Spreadsheet-Feed/1.0'}});
if(!response.ok)throw Error('Sheet fetch HTTP '+response.status);
const body=await response.text();if(body.length>3000000||body.length<1000)throw Error('Unexpected spreadsheet response size');
const rows=csv(body),headerIndex=rows.findIndex(r=>r[0]==='Company'&&r[3]==='Job'&&r[6]==='Link');
if(headerIndex<0)throw Error('Expected spreadsheet header missing; check sheet access');
const jobs=rows.slice(headerIndex+1).filter(r=>r[0]?.trim()&&r[3]?.trim()&&/^https:\/\//.test(r[6]||'')).map(r=>({company:r[0].trim(),category:(r[1]||'').trim(),job_category:(r[2]||'').trim(),title:r[3].trim(),type:(r[4]||'').trim(),remote_scope:(r[5]||'').trim(),url:r[6].trim(),added:(r[7]||'').trim()}));
if(jobs.length<100||jobs.length>2000)throw Error('Unexpected job count '+jobs.length);
const path='data/remote-games-sheet-jobs.json';const old=JSON.parse(await fs.readFile(path,'utf8'));const updated={...old,jobs};await fs.writeFile(path,JSON.stringify(updated,null,2)+'\n');console.log('Spreadsheet ping and pull succeeded:',jobs.length,'jobs');
