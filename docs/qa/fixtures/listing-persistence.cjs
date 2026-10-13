const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec("create table raven_jobs(id text primary key,url text,status text,resume text,cover_letter text,applied_date timestamptz);create table raven_search_results(id text primary key,url text,status text);");
 await db.exec(fs.readFileSync(require('node:path').resolve(__dirname,'../../../supabase/migrations/20261008_listing_availability.sql'),'utf8'));
 await db.exec("insert into raven_jobs values('qa','https://example.test/job','Interview','original resume','original cover','2026-10-01');insert into raven_search_results(id,url,status) values('qa','https://example.test/job','Discovered');");
 await db.exec("update raven_jobs set listing_state='closed',listing_reason='JobPosting validThrough expired',listing_checked_at='2026-10-08',listing_source_url=url,listing_http_status=200 where id='qa';update raven_search_results set listing_state='closed',listing_reason='JobPosting validThrough expired',listing_checked_at='2026-10-08',listing_source_url=url,listing_http_status=200,status='Expired' where id='qa';");
 await db.exec("update raven_search_results set status='Discovered',listing_state=null,listing_reason=null where id='qa';");
 const job=(await db.query("select * from raven_jobs")).rows[0],search=(await db.query("select * from raven_search_results")).rows[0];
 assert.equal(new Date(job.applied_date).toISOString(),'2026-10-01T00:00:00.000Z');assert.equal(job.status,'Interview');assert.equal(job.resume,'original resume');assert.equal(job.cover_letter,'original cover');assert.equal(job.listing_state,'closed');assert.equal(search.status,'Expired');assert.equal(search.listing_reason,'JobPosting validThrough expired');
 assert.equal((await db.query("select * from raven_search_results where status='Discovered'")).rows.length,0);
 console.log(JSON.stringify({engine:'PGlite PostgreSQL',migration:'applied in isolated fixture database',saved:{status:job.status,resumePreserved:true,coverPreserved:true,appliedDatePreserved:true,listing_state:job.listing_state},search:{status:search.status,reason:search.listing_reason,activeResults:0},productionMutation:false},null,2));await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
