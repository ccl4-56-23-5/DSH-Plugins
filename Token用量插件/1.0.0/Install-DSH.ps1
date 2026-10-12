param(
  [string]$DshRoot = 'D:\DeepSeekHarness',
  [string]$DshHome = (Join-Path $env:USERPROFILE '.dsh'),
  [string]$Package = (Join-Path $PSScriptRoot 'dsh-usage-statistics-panel-1.0.0.tgz')
)
$ErrorActionPreference = 'Stop'
$profileDir = Join-Path $DshHome 'profiles\desktop'
$manifestFile = Join-Path $profileDir 'package.json'
$nodeExe = Join-Path $DshRoot 'resources\runtime\primary-runtime\dependencies\node\bin\node.exe'
$pnpmFile = Join-Path $DshRoot 'resources\runtime\pnpm\bin\pnpm.mjs'
foreach ($file in @($Package,$manifestFile,$nodeExe,$pnpmFile)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing file: $file" }
}
if (@(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue).Count) { throw '请先退出DSH桌面，再运行安装器。' }
$lockFile = Join-Path $profileDir '.token-usage-install.lock'
$lock = [IO.File]::Open($lockFile,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try {
  $manifest = Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
  $backup = Join-Path $DshHome ('token-usage\deployment-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  foreach ($name in @('package.json','pnpm-lock.yaml','cordis.patch.yml')) {
    $file = Join-Path $profileDir $name
    if (Test-Path -LiteralPath $file) { Copy-Item -LiteralPath $file -Destination $backup }
  }
  $digest = (Get-FileHash -LiteralPath $Package -Algorithm SHA256).Hash.ToLower()
  $packageName = 'dsh-usage-statistics-panel-1.0.0-' + $digest.Substring(0,12) + '.tgz'
  Copy-Item -LiteralPath $Package -Destination (Join-Path $profileDir $packageName) -Force
  if (-not $manifest.dependencies) { $manifest | Add-Member dependencies ([pscustomobject]@{}) }
  $manifest.dependencies | Add-Member 'dsh-usage-statistics-panel' ('file:./'+$packageName) -Force
  $manifest.dsh.profile.bundles = @(@($manifest.dsh.profile.bundles | Where-Object { $_ -ne 'dsh-usage-statistics-panel' }) + 'dsh-usage-statistics-panel')
  $manifest | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $manifestFile -Encoding UTF8
  Push-Location -LiteralPath $profileDir
  try {
    & $nodeExe $pnpmFile install --offline --ignore-scripts --no-frozen-lockfile --config.auto-install-peers=false
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed: $LASTEXITCODE" }
    $installedDir = Join-Path $profileDir 'node_modules\dsh-usage-statistics-panel'
    $installed = Get-Content (Join-Path $installedDir 'package.json') -Raw | ConvertFrom-Json
    if ($installed.version -ne '1.0.0') { throw 'Installed version mismatch' }
    $release = Get-Content (Join-Path $PSScriptRoot 'release-manifest.json') -Raw | ConvertFrom-Json
    foreach ($entry in $release.packageFileSHA256.PSObject.Properties) {
      if ((Get-FileHash -LiteralPath (Join-Path $installedDir $entry.Name) -Algorithm SHA256).Hash.ToLower() -ne $entry.Value) { throw "Installed content mismatch: $($entry.Name)" }
    }
  } catch {
    $failure = $_
    Copy-Item -LiteralPath (Join-Path $backup 'package.json') -Destination $manifestFile -Force
    if (Test-Path (Join-Path $backup 'pnpm-lock.yaml')) { Copy-Item -LiteralPath (Join-Path $backup 'pnpm-lock.yaml') -Destination (Join-Path $profileDir 'pnpm-lock.yaml') -Force }
    & $nodeExe $pnpmFile install --offline --ignore-scripts --no-frozen-lockfile --config.auto-install-peers=false
    throw "Install failed; original manifest restored. Backup: $backup. $failure"
  } finally { Pop-Location }
  [pscustomobject]@{installed='dsh-usage-statistics-panel@1.0.0';sha256=$digest;backup=$backup;entry='主界面左上角：使用统计'} | ConvertTo-Json
} finally { $lock.Dispose() }
