import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createCodexAdapters,verifiedDriveReceipt} from '../scripts/oneclick-codex.mjs';

const metadata={id:'file1234567890',mime_type:'application/pdf',parent_ids:['folder12345'],title:'resume.pdf'};
const readEvent={type:'mcp_tool_call',tool:'google_drive.get_file_metadata',status:'completed',arguments:{fileId:metadata.id},result:{structured_content:metadata}};

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
    child.stdout.write(JSON.stringify({type:'item.completed',item:readEvent})+'\n');
    child.emit('close',0);
   });return child;
  }});
  await adapters.verifyUpload({fileId:metadata.id,folderId:'folder12345'});
  await adapters.uploadPdf({pdf:{file_path:pdfPath},folderId:'folder12345',fileName:'resume.pdf'});
  const [readArgs,uploadArgs]=invocations;
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
