param(
  [Parameter(Mandatory=$true)][ValidatePattern('^tunnel_[a-zA-Z0-9_]+$')][string]$TunnelId
)
$ErrorActionPreference = 'Stop'
$client = Join-Path $PSScriptRoot '../private/tunnel-client/tunnel-client.exe'
if (-not (Test-Path -LiteralPath $client)) { throw 'Install the verified official tunnel-client in private/tunnel-client first.' }
Write-Host 'Raven private tunnel connection test. This exposes only harmless demo tools.'
Write-Host 'Paste a restricted OpenAI runtime key with Tunnels Read + Use. It will not be displayed or saved.'
$key = Read-Host 'Runtime key' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($key)
$previousKey = $env:CONTROL_PLANE_API_KEY
try {
  $env:CONTROL_PLANE_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ([string]::IsNullOrWhiteSpace($env:CONTROL_PLANE_API_KEY)) { throw 'A runtime key is required.' }
  & $client run --embedded-stateless-mcp-stub --control-plane.tunnel-id $TunnelId --control-plane.api-key env:CONTROL_PLANE_API_KEY --health.listen-addr 127.0.0.1:0
  if ($LASTEXITCODE -ne 0) { throw 'The tunnel connection test stopped with an error.' }
} finally {
  $env:CONTROL_PLANE_API_KEY = $previousKey
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $key.Dispose()
}
