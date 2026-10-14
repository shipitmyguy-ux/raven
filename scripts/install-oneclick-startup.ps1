[CmdletBinding(SupportsShouldProcess=$true)]
param([switch]$Remove)
$ErrorActionPreference='Stop'
$taskName='Raven One Click Helper'
$root=Split-Path $PSScriptRoot -Parent
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Run this installer on your Windows Raven computer.'}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
if($Remove){
 if($PSCmdlet.ShouldProcess($taskName,'Stop and remove automatic startup')){
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
 }
 return
}
foreach($path in @('private/raven-tunnel.credentials.clixml','private/raven-tunnel.json','scripts/start-oneclick-raven.ps1','scripts/supervise-oneclick.ps1')){
 if(!(Test-Path -LiteralPath (Join-Path $root $path))){throw "Complete Raven local helper setup first. Missing: $path"}
}
$powerShell=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$script=Join-Path $PSScriptRoot 'supervise-oneclick.ps1'
$action=New-ScheduledTaskAction -Execute $powerShell -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$script+'"') -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
if($PSCmdlet.ShouldProcess($taskName,'Install current-user startup and start Raven')){
 Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Raven local writer; starts after owner sign-in, recovers crashes, prevents idle sleep only during document jobs.' -Force | Out-Null
 Start-ScheduledTask -TaskName $taskName
 Write-Host 'Raven automatic startup installed. Starts after Windows sign-in. Plug in the computer; closing the lid or signing out can stop processing.'
}
