export function csvCells(record) {
  const out=[];
  let cell="",quoted=false;
  for(let i=0;i<record.length;i++){
    const ch=record[i];
    if(ch==='"'){
      if(quoted&&record[i+1]==='"'){cell+='"';i++;}
      else quoted=!quoted;
    }else if(ch===","&&!quoted){
      out.push(cell);
      cell="";
    }else{
      cell+=ch;
    }
  }
  out.push(cell);
  return out;
}

export function splitCsvRecords(buffer, flush=false) {
  const records=[];
  let quoted=false;
  let start=0;
  for(let i=0;i<buffer.length;i++){
    const ch=buffer[i];
    if(ch==='"'){
      if(quoted&&buffer[i+1]==='"'){i++;continue;}
      quoted=!quoted;
      continue;
    }
    if(!quoted&&(ch==="\n"||ch==="\r")){
      const record=buffer.slice(start,i);
      if(record) records.push(record);
      if(ch==="\r"&&buffer[i+1]==="\n") i++;
      start=i+1;
    }
  }
  let remainder=buffer.slice(start);
  if(flush&&remainder&&!quoted){records.push(remainder);remainder="";}
  return {records,remainder};
}

export function validAtsRow(title,url) {
  const cleanTitle=String(title||"").trim();
  const cleanUrl=String(url||"").trim();
  if(!cleanTitle||cleanTitle.length>240||/[\r\n]/.test(cleanTitle)) return false;
  try{
    const parsed=new URL(cleanUrl);
    return parsed.protocol==="http:"||parsed.protocol==="https:";
  }catch{
    return false;
  }
}
