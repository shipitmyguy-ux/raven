function Assert-RavenTunnelCredentials {
  param($Credentials)
  if($Credentials -isnot [System.Collections.IDictionary] -or $Credentials.Count -ne 2){throw 'Invalid protected tunnel credentials.'}
  foreach($name in @('CONTROL_PLANE_API_KEY','SUPABASE_SERVICE_ROLE_KEY')){
    $entry=$Credentials[$name]
    if($entry -isnot [Management.Automation.PSCredential] -or $entry.UserName -ne $name -or $entry.Password.Length -eq 0){throw 'Invalid protected tunnel credentials.'}
  }
}
function Save-RavenTunnelCredentials {
  param([Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)]$Credentials)
  if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Protected tunnel credential storage requires Windows.'}
  Assert-RavenTunnelCredentials $Credentials
  $temporary=$Path+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
  try{
    Export-Clixml -InputObject $Credentials -LiteralPath $temporary -Depth 4
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl=[Security.AccessControl.FileSecurity]::new()
    $acl.SetOwner($identity)
    $acl.SetAccessRuleProtection($true,$false)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','Allow'))
    Set-Acl -LiteralPath $temporary -AclObject $acl
    Move-Item -LiteralPath $temporary -Destination $Path -Force
  }finally{
    if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary -Force}
  }
}
function Get-RavenTunnelCredentials {
  param([Parameter(Mandatory=$true)][string]$Path,[switch]$ResetSavedKeys)
  if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){throw 'Protected tunnel credential storage requires Windows.'}
  if((Test-Path -LiteralPath $Path) -and -not $ResetSavedKeys){
    try{
      $credentials=Import-Clixml -LiteralPath $Path
      Assert-RavenTunnelCredentials $credentials
      return $credentials
    }catch{throw 'Saved tunnel keys cannot be loaded by this Windows account/computer. Run the launcher with -ResetSavedKeys to replace them.'}
  }
  $credentials=@{}
  try{
    Write-Host 'One-time setup: keys will be encrypted by Windows for this account and computer.'
    foreach($entry in @(@('CONTROL_PLANE_API_KEY','OpenAI tunnel runtime key'),@('SUPABASE_SERVICE_ROLE_KEY','Supabase legacy service_role key'))){
      $secure=Read-Host $entry[1] -AsSecureString
      if($secure.Length -eq 0){$secure.Dispose();throw 'A credential is required.'}
      $credentials[$entry[0]]=[Management.Automation.PSCredential]::new($entry[0],$secure)
    }
    Save-RavenTunnelCredentials -Path $Path -Credentials $credentials
    return $credentials
  }catch{
    foreach($entry in $credentials.Values){$entry.Password.Dispose()}
    throw
  }
}
