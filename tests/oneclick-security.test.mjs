import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createCodexAdapters,verifiedDriveReceipt,observedDrivePdf} from '../scripts/oneclick-codex.mjs';

const metadata={id:'file1234567890',mime_type:'application/pdf',parent_ids:['folder12345'],title:'resume.pdf'};
const readEvent={type:'mcp_tool_call',tool:'google_drive.get_file_metadata',status:'completed',arguments:{fileId:metadata.id},result:{structured_content:metadata}};

test('game subprocess cannot select SoundAir and regenerates stale full-profile guidance',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'raven-game-profile-'));
 let prompt='',schema;
 try{
  const adapters=createCodexAdapters({codexPath:'synthetic',workDir:dir,spawnImpl:(_path,args)=>{
   const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>child.emit('close',1);
   child.stdin.on('data',chunk=>prompt+=chunk);
   child.stdin.on('finish',async()=>{
    schema=JSON.parse(await (await import('node:fs/promises')).readFile(args[args.indexOf('--output-schema')+1],'utf8'));
    await writeFile(args[args.indexOf('-o')+1],'{}');child.emit('close',0);
   });return child;
  }});
  await adapters.generateDraft({job:{track:'Games / 3D',title:'Artist'},profile:{skills:['Unity'],experience:[{id:'art',company:'Studio',facts:[{id:'art1',text:'Built worlds.'}]},{id:'exp_soundair',company:'SoundAir',facts:[{id:'soundair_1',text:'Repaired coffee makers.'}]}],resume_required_experience_ids:['art']},writingPrompt:'Stale evidence: soundair_1 Repaired coffee makers.',documentType:'resume'});
  assert.deepEqual(schema.properties.experience.items.properties.experience_id.enum,['art']);
  assert.ok(!prompt.includes('soundair_1'));assert.ok(!prompt.includes('Repaired coffee makers.'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Drive receipt requires observed matching tool output rather than model prose',()=>{
 assert.throws(()=>verifiedDriveReceipt([{type:'agent_message',text:JSON.stringify(metadata)}],{fileId:metadata.id,folderId:'folder12345'}),/DRIVE_METADATA_NOT_CONFIRMED/);
 assert.throws(()=>verifiedDriveReceipt([readEvent],{fileId:'other1234567890',folderId:'folder12345'}),/DRIVE_METADATA_NOT_CONFIRMED/);
 assert.throws(()=>verifiedDriveReceipt([readEvent],{fileId:metadata.id,folderId:'wrongfolder'}),/DRIVE_METADATA_NOT_CONFIRMED/);
 assert.equal(verifiedDriveReceipt([readEvent],{fileId:metadata.id,folderId:'folder12345'}).file_id,metadata.id);
});

test('writer subprocess disables tools and excludes inherited server/API credentials',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'raven-oneclick-security-'));
 let captured;
 const saved=process.env.RAVEN_SECURITY_TEST_SECRET;
 process.env.RAVEN_SECURITY_TEST_SECRET='synthetic-secret';
 try{
  const adapters=createCodexAdapters({codexPath:'synthetic-codex',workDir:dir,spawnImpl:(path,args,options)=>{
   captured={path,args,options};
   const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>child.emit('close',1);
   child.stdin.on('finish',async()=>{
    await writeFile(args[args.indexOf('-o')+1],JSON.stringify({draft:true}));
    child.emit('close',0);
   });
   return child;
  }});
  await adapters.generateDraft({job:{id:'JT-test'},profile:{},writingPrompt:'Use verified facts',documentType:'resume'});
  assert.equal(captured.options.env.RAVEN_SECURITY_TEST_SECRET,undefined);
  for(const name of ['SUPABASE_SERVICE_ROLE_KEY','CONTROL_PLANE_API_KEY','OPENAI_API_KEY','CODEX_API_KEY','GH_TOKEN','GITHUB_TOKEN'])assert.equal(captured.options.env[name],undefined);
  assert.equal(captured.options.windowsHide,true);
  assert.ok(captured.args.includes('--ignore-user-config'));
  assert.equal(captured.args[captured.args.indexOf('--sandbox')+1],'read-only');
  for(const flag of ['shell_tool','unified_exec','apps'])assert.ok(captured.args.some((arg,index)=>arg==='--disable'&&captured.args[index+1]===flag));
 }finally{
  if(saved===undefined)delete process.env.RAVEN_SECURITY_TEST_SECRET;else process.env.RAVEN_SECURITY_TEST_SECRET=saved;
  await rm(dir,{recursive:true,force:true});
 }
});

test('metadata verification exposes only the registered Drive read tool, while upload approval is stage-specific',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'raven-oneclick-app-scope-'));
 const invocations=[];
 const drive='apps.connector_5f3c8c41a1e54ad7a76272c89e2554fa';
 const pdfPath=join(dir,'resume.pdf');
 try{
  const adapters=createCodexAdapters({codexPath:'synthetic-codex',workDir:dir,spawnImpl:(_path,args)=>{
   invocations.push(args);
   const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>child.emit('close',1);
   child.stdin.on('finish',async()=>{
    await writeFile(args[args.indexOf('-o')+1],JSON.stringify(metadata));
    if(args.includes(drive+'.tools.upload_file.enabled=true'))child.stdout.write(JSON.stringify({type:'item.completed',item:{type:'mcp_tool_call',tool:'google_drive.upload_file',status:'completed',arguments:{file_uri:pdfPath,parent_folder_id:'folder12345',file_name:'resume.pdf'},result:{structured_content:{success:true,id:metadata.id}}}})+'\n');
    if(args.includes(drive+'.tools.fetch.enabled=true'))child.stdout.write(JSON.stringify({type:'item.completed',item:{type:'mcp_tool_call',tool:'google_drive.fetch',status:'completed',arguments:{url:'https://drive.google.com/file/d/'+metadata.id+'/view',download_raw_file:true,include_base64:true},result:{structured_content:{...metadata,b64_string:Buffer.from('%PDF-1.7 original').toString('base64')}}}})+'\n');
    child.stdout.write(JSON.stringify({type:'item.completed',item:readEvent})+'\n');
    child.emit('close',0);
   });return child;
  }});
  await adapters.verifyUpload({fileId:metadata.id,folderId:'folder12345'});
  await adapters.uploadPdf({pdf:{file_path:pdfPath},folderId:'folder12345',fileName:'resume.pdf'});
  assert.deepEqual(await adapters.downloadPdf({fileId:metadata.id,folderId:'folder12345'}),Buffer.from('%PDF-1.7 original'));
  const [readArgs,uploadArgs,downloadArgs]=invocations;
  assert.ok(downloadArgs.includes(drive+'.tools.fetch.enabled=true'));
  assert.equal(downloadArgs.some(arg=>arg.includes('.tools.upload_file.')),false);
  assert.equal(readArgs.some(arg=>arg.includes('.tools.fetch.')),false);
  assert.equal(uploadArgs.some(arg=>arg.includes('.tools.fetch.')),false);
  for(const args of invocations){
   assert.ok(args.includes('apps._default.enabled=false'));
   assert.ok(args.includes(drive+'.enabled=true'));
   assert.ok(args.includes(drive+'.default_tools_enabled=false'));
   assert.ok(args.includes(drive+'.tools.get_file_metadata.enabled=true'));
   assert.equal(args.includes('apps.google_drive.enabled=true'),false);
  }
  assert.equal(readArgs.some(arg=>arg.includes('.tools.upload_file.')),false);
  assert.ok(uploadArgs.includes(drive+'.tools.upload_file.enabled=true'));
  assert.ok(uploadArgs.includes(drive+'.tools.upload_file.approval_mode="approve"'));
  assert.equal(uploadArgs.some(arg=>arg.includes('default_tools_approval_mode')),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Drive binary reuse accepts only exact authenticated raw tool bytes, never model text or another file',()=>{
 const bytes=Buffer.from('%PDF-1.7 original');const fileId=metadata.id,folderId='folder12345';
 const event={type:'mcp_tool_call',tool:'google_drive.fetch',status:'completed',arguments:{url:'https://drive.google.com/file/d/'+fileId+'/view',download_raw_file:true,include_base64:true},result:{structured_content:{id:fileId,mime_type:'application/pdf',parent_ids:[folderId],b64_string:bytes.toString('base64')}}};
 assert.deepEqual(observedDrivePdf([event],{fileId,folderId}),bytes);
 assert.deepEqual(observedDrivePdf([{...event,result:{structured_content:{...event.result.structured_content,structuredContent:{...metadata,id:fileId}}}}],{fileId,folderId}),bytes);
 for(const changed of [{...event,type:'agent_message'},{...event,status:'failed'},{...event,arguments:{...event.arguments,url:'https://drive.google.com/file/d/other/view'}},{...event,result:{structured_content:{...event.result.structured_content,id:'other'}}},{...event,result:{structured_content:{...event.result.structured_content,parent_ids:['other']}}},{...event,result:{structured_content:{...event.result.structured_content,b64_string:'a'.repeat(3000000)}}}])assert.throws(()=>observedDrivePdf([changed],{fileId,folderId}),/DRIVE_DOWNLOAD_NOT_CONFIRMED/);
});
