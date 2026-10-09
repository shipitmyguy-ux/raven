param([Parameter(Mandatory=$true)][ValidatePattern('^tunnel_[a-zA-Z0-9_]+$')][string]$TunnelId)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$client=Join-Path $root 'private/tunnel-client/tunnel-client.exe'
$config=Join-Path $root 'private/raven-tunnel.json'
$nodeCommand=Get-Command node -ErrorAction SilentlyContinue
$node=if($nodeCommand){$nodeCommand.Source}else{Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'}
if(-not(Test-Path -LiteralPath $node)){throw 'Node.js is required; install Node 22 or pass it through PATH.'}
$bridge=Join-Path $PSScriptRoot 'private-mcp-stdio.mjs'
if(-not(Test-Path $client)-or -not(Test-Path $config)){throw 'Local tunnel client/configuration is missing.'}
if(Get-Process -Name tunnel-client -ErrorAction SilentlyContinue){throw 'Close the existing tunnel test window first. Only one client may run for this tunnel.'}
Write-Host 'Raven Private: job reads, career facts and creation of new documents for configured jobs.'
Write-Host 'Keys are entered locally, hidden, and retained only in process memory. Close this window to stop access.'
$previous=@{}
foreach($name in @('CONTROL_PLANE_API_KEY','SUPABASE_SERVICE_ROLE_KEY','RAVEN_PRIVATE_CONFIG')){$previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
try{
  foreach($entry in @(@('CONTROL_PLANE_API_KEY','OpenAI tunnel runtime key'),@('SUPABASE_SERVICE_ROLE_KEY','Supabase legacy service_role key'))){
    $secure=Read-Host $entry[1] -AsSecureString
    $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try{
      $value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
      if([string]::IsNullOrWhiteSpace($value)){throw 'A credential is required.'}
      [Environment]::SetEnvironmentVariable($entry[0],$value,'Process')
      $value=$null
    }finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$secure.Dispose()}
  }
  $env:RAVEN_PRIVATE_CONFIG=$config
  # The tunnel client parses command strings using shell-style escaping; use forward slashes.
  $node=$node.Replace('\','/')
  $bridge=$bridge.Replace('\','/')
  $command='"'+$node+'" "'+$bridge+'"'
  & $client run --mcp.command $command --control-plane.tunnel-id $TunnelId --control-plane.api-key env:CONTROL_PLANE_API_KEY --health.listen-addr 127.0.0.1:0
  if($LASTEXITCODE -ne 0){throw 'Raven tunnel stopped with an error.'}
}finally{
  foreach($name in $previous.Keys){[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')}
}
