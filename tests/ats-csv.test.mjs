import {csvCells,splitCsvRecords,validAtsRow} from "../supabase/functions/raven-backend-v3/csv-records.mjs";

const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const sample=[
  'title,company,url,description',
  '"Project Manager","Acme","https://boards.greenhouse.io/acme/jobs/1","Lead programs.',
  'Coordinate internal teams.',
  'Deliver on time."',
  '"Operations Manager","Beta","https://boards.greenhouse.io/beta/jobs/2","Own operations."'
].join("\r\n");

const first=splitCsvRecords(sample.slice(0,110));
assert(first.records.length===1,"partial quoted record must not be split at embedded newline");

const second=splitCsvRecords(first.remainder+sample.slice(110));
assert(second.records.length===2,"multiline Greenhouse description should remain one CSV record");

const header=csvCells(first.records[0]);
const row1=csvCells(second.records[0]);
const row2=csvCells(second.records[1]);
assert(header[0]==="title"&&header[3]==="description","header parse failed");
assert(row1[0]==="Project Manager","first title parse failed");
assert(row1[3].includes("Coordinate internal teams."),"multiline description was truncated");
assert(row2[0]==="Operations Manager","second row parse failed");
assert(validAtsRow(row1[0],row1[2]),"valid ATS row rejected");
assert(!validAtsRow("Lead programs.\nCoordinate internal teams.","https://example.com/job"),"description-like multiline title should be rejected");
assert(!validAtsRow("Project Manager","not-a-url"),"invalid URL should be rejected");

console.log("ATS CSV regression tests passed");
