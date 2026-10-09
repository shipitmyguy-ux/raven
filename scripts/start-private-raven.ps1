param(
  [Parameter(Mandatory=$true)][ValidatePattern('^tunnel_[a-zA-Z0-9_]+$')][string]$TunnelId,
  [switch]$ResetSavedKeys,
  [ValidateRange(0,10)][int]$RestartLimit=5
)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$client=Join-Path $root 'private/tunnel-client/tunnel-client.exe'
$config=Join-Path $root 'private/raven-tunnel.json'
$credentialPath=Join-Path $root 'private/raven-tunnel.credentials.clixml'
. (Join-Path $PSScriptRoot 'private-tunnel-credentials.ps1')
$nodeCommand=Get-Command node -ErrorAction SilentlyContinue
$node=if($nodeCommand){$nodeCommand.Source}else{Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'}
if(-not(Test-Path -LiteralPath $node)){throw 'Node.js is required; install Node 22 or pass it through PATH.'}
$bridge=Join-Path $PSScriptRoot 'private-mcp-stdio.mjs'
if(-not(Test-Path -LiteralPath $client)-or -not(Test-Path -LiteralPath $config)){throw 'Local tunnel client/configuration is missing.'}
if(Get-Process -Name tunnel-client -ErrorAction SilentlyContinue){throw 'Close the existing tunnel window first. Only one client may run for this tunnel.'}
Write-Host 'Raven Private: scoped reads and creation of new documents; existing documents are preserved.'
Write-Host 'Saved keys are Windows-encrypted locally. Future starts reuse them without prompts.'
Write-Host 'Close this window to stop access. Use -ResetSavedKeys only to replace saved keys.'
$previous=@{}
$credentials=$null
foreach($name in @('CONTROL_PLANE_API_KEY','SUPABASE_SERVICE_ROLE_KEY','RAVEN_PRIVATE_CONFIG')){$previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
try{
  $credentials=Get-RavenTunnelCredentials -Path $credentialPath -ResetSavedKeys:$ResetSavedKeys
  foreach($name in @('CONTROL_PLANE_API_KEY','SUPABASE_SERVICE_ROLE_KEY')){
    $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($credentials[$name].Password)
    try{
      $value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
      if([string]::IsNullOrWhiteSpace($value)){throw 'A credential is required.'}
      [Environment]::SetEnvironmentVariable($name,$value,'Process')
      $value=$null
    }finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
  }
  $env:RAVEN_PRIVATE_CONFIG=$config
  # The tunnel client parses command strings using shell-style escaping; use forward slashes.
  $node=$node.Replace('\','/')
  $bridge=$bridge.Replace('\','/')
  $command='"'+$node+'" "'+$bridge+'"'
  $restarts=0
  while($true){
    & $client run --mcp.command $command --control-plane.tunnel-id $TunnelId --control-plane.api-key env:CONTROL_PLANE_API_KEY --health.listen-addr 127.0.0.1:0
    if($restarts -ge $RestartLimit){throw 'Tunnel stopped after its restart limit. Start the launcher again; saved keys will be reused.'}
    $restarts++
    Write-Host ('Tunnel stopped. Reconnecting '+$restarts+'/'+$RestartLimit+' using protected saved keys.')
    Start-Sleep -Seconds ([Math]::Min(10,2*$restarts))
  }
}finally{
  foreach($name in $previous.Keys){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')}
  if($credentials){foreach($entry in $credentials.Values){$entry.Password.Dispose()}}
}
