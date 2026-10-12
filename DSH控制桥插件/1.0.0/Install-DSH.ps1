param([string]$DshRoot='D:\DeepSeekHarness',[string]$Profile='desktop')
$ErrorActionPreference='Stop'
$cli=Join-Path $DshRoot 'resources\runtime\cli\bin\dsh.cmd'
$package=Join-Path $PSScriptRoot 'dsh-control-bridge-1.0.0.tgz'
if (!(Test-Path -LiteralPath $cli) -or !(Test-Path -LiteralPath $package)) { throw 'DSH CLI or package missing.' }
$profileDir=Join-Path $env:USERPROFILE ('.dsh\profiles\'+$Profile)
$backup=Join-Path $env:USERPROFILE ('.dsh\control-bridge\deployment-backups\'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach($name in @('package.json','pnpm-lock.yaml','cordis.patch.yml')) { $p=Join-Path $profileDir $name; if(Test-Path -LiteralPath $p){Copy-Item -LiteralPath $p -Destination $backup} }
$digest=(Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash.ToLowerInvariant()
$release=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'release-manifest.json') -Raw|ConvertFrom-Json
if($digest -ne $release.files.'dsh-control-bridge-1.0.0.tgz'.sha256){throw 'Package SHA-256 mismatch'}
$staged=Join-Path $profileDir ('dsh-control-bridge-1.0.0-'+$digest.Substring(0,12)+'.tgz')
Copy-Item -LiteralPath $package -Destination $staged -Force
& $cli plugin --profile $Profile add $staged --offline --ignore-scripts --config.auto-install-peers=false
if($LASTEXITCODE -ne 0){throw "Install failed. Preserve existing state and inspect backup: $backup"}
$installed=Get-Content -LiteralPath (Join-Path $profileDir 'node_modules\dsh-control-bridge\package.json') -Raw | ConvertFrom-Json
if($installed.version -ne '1.0.0'){throw 'Installed version mismatch'}
Write-Output "DSH bridge installed. If not hot loaded, restart DSH when current tasks are idle. Backup: $backup"
