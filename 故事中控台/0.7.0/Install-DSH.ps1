param([string]$Profile='desktop')
$ErrorActionPreference='Stop'
$bundle=Join-Path $PSScriptRoot 'dsh-storydeck-0.7.0.tgz'
$manifest=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'release-manifest.json') | ConvertFrom-Json
$expected=$manifest.files.'dsh-storydeck-0.7.0.tgz'.sha256
if((Get-FileHash -LiteralPath $bundle -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw 'Package SHA-256 mismatch.'}
$launcher=Get-Command dsh -ErrorAction Stop
& $launcher.Source plugin --profile $Profile add $bundle
if($LASTEXITCODE -ne 0){throw 'DSH install failed. Existing sessions were not restarted.'}
Write-Output 'Installed. Open a conversation and click the hanging whale mascot at the top right. Restart only if requested by DSH and your running work is saved.'
