# Windows-only synthetic credential regression tests; never read private/ or launch a tunnel.
$ErrorActionPreference='Stop'
# Reproduce the launcher failure: Security cmdlets cannot autoload. Utility and
# Management remain available for XML persistence and temporary-file operations.
Import-Module Microsoft.PowerShell.Utility
Import-Module Microsoft.PowerShell.Management
Remove-Module Microsoft.PowerShell.Security -ErrorAction SilentlyContinue
$PSModuleAutoLoadingPreference='None'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'scripts/private-tunnel-credentials.ps1')
function Assert-Test($Condition,$Message){if(-not $Condition){throw $Message}}
function Assert-Throws($Action,$Message){$threw=$false;try{& $Action}catch{$threw=$true};Assert-Test $threw $Message}
function New-TestSecureString([string]$Text){
  $secure=[Security.SecureString]::new()
  foreach($character in $Text.ToCharArray()){$secure.AppendChar($character)}
  $secure.MakeReadOnly()
  return $secure
}
$launcher=Join-Path (Split-Path $PSScriptRoot -Parent) 'scripts/start-private-raven.ps1'
$tokens=$null;$parseErrors=$null
$launcherAst=[Management.Automation.Language.Parser]::ParseFile($launcher,[ref]$tokens,[ref]$parseErrors)
Assert-Test ($parseErrors.Count -eq 0) 'Launcher syntax errors.'
$helperErrors=$null
[Management.Automation.Language.Parser]::ParseFile((Join-Path (Split-Path $PSScriptRoot -Parent) 'scripts/private-tunnel-credentials.ps1'),[ref]$tokens,[ref]$helperErrors) | Out-Null
Assert-Test ($helperErrors.Count -eq 0) 'Credential helper syntax errors.'
function New-TestCredentials($Suffix){
  $map=@{}
  foreach($name in @('CONTROL_PLANE_API_KEY','SUPABASE_SERVICE_ROLE_KEY')){
    $map[$name]=[Management.Automation.PSCredential]::new($name,(New-TestSecureString ('synthetic-'+$name+'-'+$Suffix)))
  }
  return $map
}
$directory=Join-Path ([IO.Path]::GetTempPath()) ('raven-credential-tests-'+[guid]::NewGuid())
New-Item -ItemType Directory -Path $directory | Out-Null
$path=Join-Path $directory 'synthetic.clixml'
$script:promptCount=0
$script:promptSuffix='initial'
function Read-Host {
  param($Prompt,[switch]$AsSecureString)
  Assert-Test $AsSecureString 'Credential prompt must be masked.'
  $script:promptCount++
  New-TestSecureString ('synthetic-prompt-'+$script:promptSuffix+'-'+$script:promptCount)
}
try{
  $first=Get-RavenTunnelCredentials -Path $path
  Assert-Test ($script:promptCount -eq 2) 'Initial setup should prompt exactly twice.'
  $xml=[IO.File]::ReadAllText($path)
  Assert-Test (-not $xml.Contains('synthetic-prompt-')) 'Plaintext credential persisted.'
  if($PSVersionTable.PSEdition -eq 'Core'){
    $acl=[IO.FileSystemAclExtensions]::GetAccessControl([IO.FileInfo]::new($path))
  }else{
    $acl=[IO.File]::GetAccessControl($path)
  }
  Assert-Test $acl.AreAccessRulesProtected 'Credential ACL should disable inherited rules.'
  $rules=@($acl.Access)
  Assert-Test ($rules.Count -eq 1) 'Credential ACL should grant only its owner.'
  $reload=Get-RavenTunnelCredentials -Path $path
  Assert-Test ($script:promptCount -eq 2) 'Reload should not prompt.'
  foreach($name in $first.Keys){
    Assert-Test ($reload[$name].GetNetworkCredential().Password -eq $first[$name].GetNetworkCredential().Password) 'DPAPI roundtrip mismatch.'
  }
  $script:promptSuffix='reset'
  $reset=Get-RavenTunnelCredentials -Path $path -ResetSavedKeys
  Assert-Test ($script:promptCount -eq 4) 'Reset should prompt twice.'
  Assert-Test ($reset.CONTROL_PLANE_API_KEY.GetNetworkCredential().Password -ne $first.CONTROL_PLANE_API_KEY.GetNetworkCredential().Password) 'Reset did not replace cached credential.'
  $afterReset=Get-RavenTunnelCredentials -Path $path
  Assert-Test ($script:promptCount -eq 4) 'Reload after reset should not prompt.'
  Assert-Test ($afterReset.CONTROL_PLANE_API_KEY.GetNetworkCredential().Password -eq $reset.CONTROL_PLANE_API_KEY.GetNetworkCredential().Password) 'Reset not durably persisted.'
  Assert-Throws {Save-RavenTunnelCredentials -Path $path -Credentials @{CONTROL_PLANE_API_KEY='plaintext';SUPABASE_SERVICE_ROLE_KEY='plaintext'}} 'Plaintext map should be rejected.'
  $empty=New-TestCredentials 'empty'
  $empty.CONTROL_PLANE_API_KEY=[Management.Automation.PSCredential]::new('CONTROL_PLANE_API_KEY',[Security.SecureString]::new())
  Assert-Throws {Save-RavenTunnelCredentials -Path $path -Credentials $empty} 'Empty credential should be rejected.'
  $wrong=New-TestCredentials 'wrong-user'
  $wrong.CONTROL_PLANE_API_KEY=[Management.Automation.PSCredential]::new('wrong',(New-TestSecureString 'synthetic-only'))
  Assert-Throws {Save-RavenTunnelCredentials -Path $path -Credentials $wrong} 'Wrong credential username should be rejected.'
  [IO.File]::WriteAllText($path,'malformed synthetic XML')
  Assert-Throws {Get-RavenTunnelCredentials -Path $path} 'Malformed cache should fail closed.'
  Assert-Test ($script:promptCount -eq 4) 'Malformed cache must not silently prompt or replace.'
  Get-RavenTunnelCredentials -Path $path -ResetSavedKeys | Out-Null
  Assert-Test ($script:promptCount -eq 6) 'Explicit reset should repair malformed cache.'
  Assert-Test (@(Get-ChildItem -LiteralPath $directory -Filter '*.tmp').Count -eq 0) 'Temporary cache files leaked.'
  # Execute only the launcher's main try/finally with a fake client and synthetic cache.
  # This checks retries and cleanup without evaluating its private-path prelude.
  $client='Invoke-SyntheticTunnelClient'
  $script:clientCalls=0;$script:sleepCalls=0
  function Invoke-SyntheticTunnelClient {$script:clientCalls++;$global:LASTEXITCODE=1}
  function Start-Sleep {param($Seconds);$script:sleepCalls++}
  $credentialPath=$path;$ResetSavedKeys=$false;$RestartLimit=2
  $config='synthetic-config';$node='synthetic-node';$bridge='synthetic-bridge'
  $originalEnvironment=@{};$previous=@{}
  foreach($name in @('CONTROL_PLANE_API_KEY','SUPABASE_SERVICE_ROLE_KEY','RAVEN_PRIVATE_CONFIG')){
    $originalEnvironment[$name]=[Environment]::GetEnvironmentVariable($name,'Process')
    $previous[$name]='synthetic-previous-'+$name
    [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')
  }
  try{
    $launchTry=@($launcherAst.EndBlock.Statements | Where-Object {$_ -is [Management.Automation.Language.TryStatementAst]})[-1]
    Assert-Test ($null -ne $launchTry) 'Launcher cleanup block missing.'
    Assert-Throws {& ([ScriptBlock]::Create($launchTry.Extent.Text))} 'Exhausted restart limit should stop.'
    Assert-Test ($script:clientCalls -eq 3) 'Two restarts should mean exactly three attempts.'
    Assert-Test ($script:sleepCalls -eq 2) 'Restart delays must be bounded.'
    Assert-Test ($script:promptCount -eq 6) 'Restart loop must reuse saved credentials without prompts.'
    foreach($name in $previous.Keys){
      Assert-Test ([Environment]::GetEnvironmentVariable($name,'Process') -eq $previous[$name]) 'Launcher did not restore process environment.'
    }
  }finally{
    foreach($name in $originalEnvironment.Keys){[Environment]::SetEnvironmentVariable($name,$originalEnvironment[$name],'Process')}
  }
  Assert-Test (-not (Get-Module Microsoft.PowerShell.Security)) 'Security module must remain unloaded during regression.'
  Write-Host 'PASS: Security autoload disabled; masked one-time setup; Windows DPAPI/no plaintext; owner ACL; prompt-free reload; durable reset; invalid/malformed fail-closed; explicit recovery.'
}finally{
  # Delete only the uniquely created synthetic directory, never real private credentials.
  foreach($file in @(Get-ChildItem -LiteralPath $directory -File)){Remove-Item -LiteralPath $file.FullName -Force}
  Remove-Item -LiteralPath $directory -Force
}
