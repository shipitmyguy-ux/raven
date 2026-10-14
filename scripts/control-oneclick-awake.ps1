param([ValidateSet('Status','Stop')][string]$Action='Status')
$ErrorActionPreference='Stop'
$scriptPath=Join-Path $PSScriptRoot 'oneclick-awake.ps1'
$holders=@(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($scriptPath) })
$active=0
foreach($holder in $holders){
 try{$event=[Threading.EventWaitHandle]::OpenExisting(('Local\RavenJobAwake-'+$holder.ProcessId))}catch [Threading.WaitHandleCannotBeOpenedException]{continue}
 try{$active++;if($Action -eq 'Stop'){[void]$event.Set()}}finally{$event.Dispose()}
}
if($Action -eq 'Stop'){
 if($active){Write-Host 'Raven keep-awake stopped. Your jobs continue; normal Windows sleep settings apply.';Write-Host 'The next batch of jobs will enable keep-awake again.'}
 else{Write-Host 'Raven is not keeping the laptop awake.'}
}elseif($active){Write-Host 'Raven is keeping the laptop awake while jobs run.';Write-Host 'Use Stop Raven keep-awake to release it without cancelling jobs.'}
else{Write-Host 'Raven is not keeping the laptop awake. Normal Windows sleep settings apply.'}
