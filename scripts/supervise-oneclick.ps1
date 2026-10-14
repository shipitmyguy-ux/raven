$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$mutex=[Threading.Mutex]::new($false,'Local\RavenOneClickSupervisor')
$locked=$false
try{
 try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
 if(!$locked){exit 0}
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class RavenPower {
 [StructLayout(LayoutKind.Sequential)] public struct Status { public byte ACLineStatus, BatteryFlag, BatteryLifePercent, SystemStatusFlag; public uint BatteryLifeTime, BatteryFullLifeTime; }
 [DllImport("kernel32.dll")] public static extern bool GetSystemPowerStatus(out Status s);
 [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
}
'@
 $launcher=Join-Path $PSScriptRoot 'start-oneclick-raven.ps1'
 $exe=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
 while($true){
  # If a manually launched helper owns the port, do not start another worker.
  $healthy=$false
  try{$health=Invoke-RestMethod -Uri 'http://127.0.0.1:8766/health' -TimeoutSec 3;$healthy=$health.app -eq 'raven-one-click'}catch{}
  $child=$null
  if(!$healthy){$child=Start-Process -FilePath $exe -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+$launcher+'"')) -WorkingDirectory $root -WindowStyle Hidden -PassThru}
  do{
   $power=New-Object RavenPower+Status
   if([RavenPower]::GetSystemPowerStatus([ref]$power) -and $power.ACLineStatus -eq 1){[void][RavenPower]::SetThreadExecutionState([uint32]2147483649)}else{[void][RavenPower]::SetThreadExecutionState([uint32]2147483648)}
   Start-Sleep -Seconds 30
   if($child){$child.Refresh();$healthy=!$child.HasExited}else{try{$health=Invoke-RestMethod -Uri 'http://127.0.0.1:8766/health' -TimeoutSec 3;$healthy=$health.app -eq 'raven-one-click'}catch{$healthy=$false}}
  }while($healthy)
  if($child){$child.Dispose()}
  Start-Sleep -Seconds 30
 }
}finally{
 if('RavenPower' -as [type]){[void][RavenPower]::SetThreadExecutionState([uint32]2147483648)}
 if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()
}
