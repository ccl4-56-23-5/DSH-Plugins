param(
  [string]$DshRoot = 'D:\DeepSeekHarness',
  [string]$DshHome = (Join-Path $env:USERPROFILE '.dsh'),
  [string]$Profile = 'desktop',
  [string]$Package = (Join-Path $PSScriptRoot 'dsh-api-switcher-2.1.3.tgz'),
  [switch]$CloseDsh,
  [switch]$RestartDsh
)
$ErrorActionPreference = 'Stop'
if ($Profile -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Invalid profile name.' }
$profileDir = Join-Path $DshHome ('profiles\' + $Profile)
$manifestFile = Join-Path $profileDir 'package.json'
$nodeExe = Join-Path $DshRoot 'resources\runtime\primary-runtime\dependencies\node\bin\node.exe'
$pnpmFile = Join-Path $DshRoot 'resources\runtime\pnpm\bin\pnpm.mjs'
$desktopExe = Join-Path $DshRoot 'DeepSeek Harness.exe'
$verificationScript = Join-Path $PSScriptRoot 'Verify-Package.mjs'
$workspaceFile = Join-Path $profileDir 'pnpm-workspace.yaml'
$workspaceOriginal = if (Test-Path -LiteralPath $workspaceFile) { [IO.File]::ReadAllBytes($workspaceFile) } else { $null }
# pnpm11.7 ignores later version rules for the same package. Merge only the
# pre-existing rules for this install, then restore the exact original bytes.
function Normalize-ExistingVersionRules([string]$document) {
  foreach ($key in @('minimumReleaseAgeExclude', 'trustPolicyExclude')) {
    $pattern = '(?m)^' + [regex]::Escape($key) + ':\s*\r?\n(?:[ \t]+[^\r\n]*(?:\r?\n|$))*'
    $block = [regex]::Match($document, $pattern)
    if (-not $block.Success) { continue }
    $rules = @(); $parseable = $true
    foreach ($line in ($block.Value -split '\r?\n' | Select-Object -Skip 1)) {
      if (-not $line.Trim()) { continue }
      if ($line -notmatch '^\s+-\s+(.+?)\s*$') { $parseable = $false; break }
      $rule = $Matches[1].Trim()
      if ($rule.StartsWith("'")) { $rule = $rule.Trim("'") }
      elseif ($rule.StartsWith('"')) { $rule = $rule | ConvertFrom-Json }
      if ($rule -match '#' -or $rule -match '[\r\n]') { $parseable = $false; break }
      $rules += $rule
    }
    if (-not $parseable) { continue }
    $grouped = [ordered]@{}; $other = @(); $merged = $false
    foreach ($rule in $rules) {
      if ($rule -match '^(@[^/]+/[^@]+|[^@]+)@(.+)$') {
        $ruleName = $Matches[1]; $ruleRange = $Matches[2]
        if ($grouped.Contains($ruleName)) { $grouped[$ruleName] += ' || ' + $ruleRange; $merged = $true }
        else { $grouped[$ruleName] = $ruleRange }
      } else { $other += $rule }
    }
    if ($merged) {
      $newRules = @($grouped.Keys | ForEach-Object { $_ + '@' + $grouped[$_] }) + $other
      $replacement = $key + ":`n" + (($newRules | ForEach-Object { "  - '" + $_.Replace("'", "''") + "'" }) -join "`n") + "`n"
      $document = $document.Substring(0, $block.Index) + $replacement + $document.Substring($block.Index + $block.Length)
    }
  }
  return $document
}
foreach ($file in @($Package, $manifestFile, $nodeExe, $pnpmFile, $desktopExe, $verificationScript)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing file: $file" }
}
$actualHash = (Get-FileHash -LiteralPath $Package -Algorithm SHA256).Hash
$sumsFile = Join-Path $PSScriptRoot 'SHA256SUMS.txt'
if (-not (Test-Path -LiteralPath $sumsFile)) { throw 'SHA256SUMS.txt is required.' }
$hashRow = @(Get-Content -LiteralPath $sumsFile | Where-Object { $_ -match '\s+dsh-api-switcher-2\.1\.3\.tgz$' })
if ($hashRow.Count -ne 1 -or ($hashRow[0] -split '\s+')[0] -ne $actualHash) { throw 'Package SHA-256 verification failed.' }
$protectedFiles = @((Join-Path $DshHome '.credentials.yaml'), (Join-Path $DshHome 'top-directive\config.json'))
$protectedHashes = @{}
foreach ($file in $protectedFiles) {
  $protectedHashes[$file] = if (Test-Path -LiteralPath $file) { (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash } else { $null }
}
$running = @(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $desktopExe })
$wasRunning = $running.Count -gt 0
if ($wasRunning -and -not $CloseDsh) { throw '请先退出DSH，或传入-CloseDsh。安装器会重启DSH，请先结束其他正在运行的任务。' }
if ($wasRunning) {
  foreach ($process in $running) { if ($process.MainWindowHandle -ne 0) { $process.CloseMainWindow() | Out-Null } }
  Start-Sleep -Seconds 2
  Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $desktopExe } | Stop-Process -Force
}
$backupDir = Join-Path $DshHome ('api-switcher\deployment-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$metadataFile = Join-Path $DshHome 'api-switcher\state.json'
if (Test-Path -LiteralPath $metadataFile) { Copy-Item -LiteralPath $metadataFile -Destination (Join-Path $backupDir 'api-switcher-state.json') }
foreach ($relative in @('package.json', 'pnpm-lock.yaml', 'cordis.patch.yml', 'cordis.yml', 'pnpm-workspace.yaml')) {
  $file = Join-Path $profileDir $relative
  if (Test-Path -LiteralPath $file) { Copy-Item -LiteralPath $file -Destination (Join-Path $backupDir $relative) }
}
$targetName = 'dsh-api-switcher-2.1.3-' + $actualHash.Substring(0, 12).ToLowerInvariant() + '.tgz'
$targetPackage = Join-Path $profileDir $targetName
if (Test-Path -LiteralPath $targetPackage) { Copy-Item -LiteralPath $targetPackage -Destination (Join-Path $backupDir 'previous-package.tgz') }
$success = $false
try {
  if ($workspaceOriginal) {
    $document = [Text.Encoding]::UTF8.GetString($workspaceOriginal)
    $normalized = Normalize-ExistingVersionRules $document
    if ($normalized -ne $document) { [IO.File]::WriteAllText($workspaceFile, $normalized, [Text.UTF8Encoding]::new($false)) }
  }
  Copy-Item -LiteralPath $Package -Destination $targetPackage -Force
  $manifest = Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $manifest.dependencies) { $manifest | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{}) }
  $manifest.dependencies | Add-Member -NotePropertyName 'dsh-api-switcher' -NotePropertyValue ('file:./' + $targetName) -Force
  $manifest.dsh.profile.bundles = @(@($manifest.dsh.profile.bundles | Where-Object { $_ -ne 'dsh-api-switcher' }) + 'dsh-api-switcher')
  $json = $manifest | ConvertTo-Json -Depth 60
  [IO.File]::WriteAllText($manifestFile, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
  Push-Location -LiteralPath $profileDir
  try {
    & $nodeExe $pnpmFile install --offline --ignore-scripts --no-frozen-lockfile --config.auto-install-peers=false
    if ($LASTEXITCODE -ne 0) { throw "pnpm install exited $LASTEXITCODE" }
  } finally { Pop-Location }
  $installed = Get-Content -LiteralPath (Join-Path $profileDir 'node_modules\dsh-api-switcher\package.json') -Raw | ConvertFrom-Json
  if ($installed.version -ne '2.1.3') { throw 'Installed version mismatch.' }
  & $nodeExe $verificationScript $Package (Join-Path $profileDir 'node_modules\dsh-api-switcher')
  if ($LASTEXITCODE -ne 0) { throw 'Installed files do not match the package.' }
  foreach ($file in $protectedFiles) {
    $nowHash = if (Test-Path -LiteralPath $file) { (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash } else { $null }
    if ($protectedHashes[$file] -ne $nowHash) { throw 'Protected user configuration changed during installation.' }
  }
  $success = $true
} catch {
  foreach ($relative in @('package.json', 'pnpm-lock.yaml', 'cordis.patch.yml', 'cordis.yml')) {
    $backup = Join-Path $backupDir $relative
    if (Test-Path -LiteralPath $backup) { Copy-Item -LiteralPath $backup -Destination (Join-Path $profileDir $relative) -Force }
  }
  if (Test-Path -LiteralPath (Join-Path $backupDir 'previous-package.tgz')) { Copy-Item -LiteralPath (Join-Path $backupDir 'previous-package.tgz') -Destination $targetPackage -Force }
  Push-Location -LiteralPath $profileDir
  try { & $nodeExe $pnpmFile install --offline --ignore-scripts --no-frozen-lockfile --config.auto-install-peers=false | Out-Null } finally { Pop-Location }
  throw "安装失败，已尝试恢复原配置。备份：$backupDir。$($_.Exception.Message)"
} finally {
  if ($workspaceOriginal) { [IO.File]::WriteAllBytes($workspaceFile, $workspaceOriginal) }
  if ($RestartDsh -and ($success -or $wasRunning)) { Start-Process -FilePath $desktopExe -WindowStyle Hidden }
}
[pscustomobject]@{ installed = 'dsh-api-switcher@2.1.3'; packageSHA256 = $actualHash; profile = $profileDir; backup = $backupDir; userCredentialsAndPromptPreserved = $true } | ConvertTo-Json
