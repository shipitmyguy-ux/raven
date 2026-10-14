$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$mutex=[Threading.Mutex]::new($false,'Local\RavenOneClickSupervisor')
$locked=$false
try{
 try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
 if(!$locked){exit 0}
 $launcher=Join-Path $PSScriptRoot 'start-oneclick-raven.ps1'
 $exe=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
 while($true){
  # If a manually launched helper owns the port, do not start another worker.
  $healthy=$false
  try{$health=Invoke-RestMethod -Uri 'http://127.0.0.1:8766/health' -TimeoutSec 3;$healthy=$health.app -eq 'raven-one-click'}catch{}
  $child=$null
  if(!$healthy){$child=Start-Process -FilePath $exe -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+$launcher+'"')) -WorkingDirectory $root -WindowStyle Hidden -PassThru}
  do{
   Start-Sleep -Seconds 30
   if($child){$child.Refresh();$healthy=!$child.HasExited}else{try{$health=Invoke-RestMethod -Uri 'http://127.0.0.1:8766/health' -TimeoutSec 3;$healthy=$health.app -eq 'raven-one-click'}catch{$healthy=$false}}
  }while($healthy)
  if($child){$child.Dispose()}
  Start-Sleep -Seconds 30
 }
}finally{
 if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()
}
