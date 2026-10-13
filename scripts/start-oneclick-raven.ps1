$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'private-tunnel-credentials.ps1')
$node=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$codex=(Get-Command codex -ErrorAction Stop).Source
$loginProcess=[Diagnostics.Process]::new()
$loginProcess.StartInfo.FileName=$codex
$loginProcess.StartInfo.Arguments='login status'
$loginProcess.StartInfo.UseShellExecute=$false
$loginProcess.StartInfo.CreateNoWindow=$true
$loginProcess.StartInfo.RedirectStandardOutput=$true
$loginProcess.StartInfo.RedirectStandardError=$true
try{
 [void]$loginProcess.Start()
 $login=$loginProcess.StandardOutput.ReadToEnd()+$loginProcess.StandardError.ReadToEnd()
 $loginProcess.WaitForExit()
 if($loginProcess.ExitCode -ne 0 -or $login -notmatch 'Logged in using ChatGPT'){throw 'Sign into Codex with ChatGPT first. API billing is not enabled for this helper.'}
}finally{$loginProcess.Dispose()}
$credentials=Get-RavenTunnelCredentials -Path (Join-Path $root 'private/raven-tunnel.credentials.clixml')
$previous=@{};foreach($name in @('SUPABASE_SERVICE_ROLE_KEY','RAVEN_PRIVATE_CONFIG','RAVEN_CODEX_CLI_PATH')){$previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($credentials['SUPABASE_SERVICE_ROLE_KEY'].Password)
try{
 $env:SUPABASE_SERVICE_ROLE_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
 $env:RAVEN_PRIVATE_CONFIG=Join-Path $root 'private/raven-tunnel.json'
 $env:RAVEN_CODEX_CLI_PATH=$codex
 Set-Location -LiteralPath $root
 & $node (Join-Path $PSScriptRoot 'oneclick-server.mjs')
}finally{
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
 foreach($name in $previous.Keys){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')}
 foreach($entry in $credentials.Values){$entry.Password.Dispose()}
}
