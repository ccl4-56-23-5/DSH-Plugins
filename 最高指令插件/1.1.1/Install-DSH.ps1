param(
  [string]$DshRoot = 'D:\DeepSeekHarness',
  [string]$DshHome = (Join-Path $env:USERPROFILE '.dsh'),
  [string]$Package = (Join-Path $PSScriptRoot 'dsh-top-directive-1.1.1.tgz')
)
$ErrorActionPreference = 'Stop'
$profileDir = Join-Path $DshHome 'profiles\desktop'
$manifestFile = Join-Path $profileDir 'package.json'
$nodeExe = Join-Path $DshRoot 'resources\runtime\primary-runtime\dependencies\node\bin\node.exe'
$pnpmFile = Join-Path $DshRoot 'resources\runtime\pnpm\bin\pnpm.mjs'
foreach ($requiredFile in @($Package, $manifestFile, $nodeExe, $pnpmFile)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) { throw "Missing file: $requiredFile" }
}
$running = @(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue)
if ($running.Count -gt 0) { throw '请先退出DSH桌面，再运行安装器。' }
$backupDir = Join-Path $DshHome ('top-directive\deployment-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
foreach ($relative in @('package.json', 'pnpm-lock.yaml', 'cordis.patch.yml', 'dsh-top-directive-1.0.0.tgz')) {
  $file = Join-Path $profileDir $relative
  if (Test-Path -LiteralPath $file -PathType Leaf) { Copy-Item -LiteralPath $file -Destination $backupDir }
}
$stateFile = Join-Path $DshHome 'top-directive\config.json'
$oldStateHash = if (Test-Path -LiteralPath $stateFile -PathType Leaf) { (Get-FileHash -LiteralPath $stateFile -Algorithm SHA256).Hash } else { $null }
if ($oldStateHash) { Copy-Item -LiteralPath $stateFile -Destination (Join-Path $backupDir 'prompt-config.json') }
Copy-Item -LiteralPath $Package -Destination (Join-Path $profileDir 'dsh-top-directive-1.1.1.tgz') -Force
$manifest = Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
$manifest.dependencies.PSObject.Properties.Remove('dsh-initial-prompt')
$manifest.dependencies.'dsh-top-directive' = 'file:./dsh-top-directive-1.1.1.tgz'
$bundles = @($manifest.dsh.profile.bundles | Where-Object { $_ -ne 'dsh-initial-prompt' -and $_ -ne 'dsh-top-directive' })
$manifest.dsh.profile.bundles = @($bundles + 'dsh-top-directive')
$manifest | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $manifestFile -Encoding UTF8
Push-Location -LiteralPath $profileDir
try {
  & $nodeExe $pnpmFile install --offline --ignore-scripts --no-frozen-lockfile --config.auto-install-peers=false
  if ($LASTEXITCODE -ne 0) { throw "pnpm install exited $LASTEXITCODE. Backup: $backupDir" }
} catch {
  Copy-Item -LiteralPath (Join-Path $backupDir 'package.json') -Destination $manifestFile -Force
  if (Test-Path -LiteralPath (Join-Path $backupDir 'pnpm-lock.yaml')) { Copy-Item -LiteralPath (Join-Path $backupDir 'pnpm-lock.yaml') -Destination (Join-Path $profileDir 'pnpm-lock.yaml') -Force }
  throw
} finally { Pop-Location }
$installed = Get-Content -LiteralPath (Join-Path $profileDir 'node_modules\dsh-top-directive\package.json') -Raw | ConvertFrom-Json
if ($installed.version -ne '1.1.1') { throw 'Installed version verification failed.' }
if ($oldStateHash -and (Get-FileHash -LiteralPath $stateFile -Algorithm SHA256).Hash -ne $oldStateHash) { throw 'User prompt changed during installation.' }
[pscustomobject]@{ installed = $installed.version; package = (Get-FileHash -LiteralPath $Package -Algorithm SHA256).Hash; backup = $backupDir; promptPreserved = $true } | ConvertTo-Json

