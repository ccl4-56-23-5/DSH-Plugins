param(
  [string]$DshRoot = 'D:\DeepSeekHarness',
  [string]$NodeExe,
  [string]$OutputDir = (Join-Path $PSScriptRoot 'dist')
)
$ErrorActionPreference = 'Stop'
if (-not $NodeExe) {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  $NodeExe = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $DshRoot 'resources\runtime\primary-runtime\dependencies\node\bin\node.exe' }
}
if (-not (Test-Path -LiteralPath $NodeExe -PathType Leaf)) { throw 'Node>=20 is required. Pass -NodeExe or -DshRoot.' }
$outputPath = [IO.Path]::GetFullPath($OutputDir)
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
& $NodeExe (Join-Path $PSScriptRoot 'scripts\build-release.mjs') $outputPath
if ($LASTEXITCODE -ne 0) { throw 'Build checks failed.' }
$archiveName = $manifest.name + '-' + $manifest.version + '.tgz'
$zipName = $manifest.name + '-' + $manifest.version + '-Windows.zip'
$stageRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '.work'))
$stage = [IO.Path]::GetFullPath((Join-Path $stageRoot 'windows-package'))
if (-not $stage.StartsWith($stageRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe staging path.' }
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $outputPath $archiveName) -Destination $stage
foreach ($entry in @('Install-DSH.ps1','Verify-Package.mjs','安装.cmd','README.md','LICENSE','CHANGELOG.md','SECURITY.md','THIRD_PARTY_NOTICES.md','docs','lib')) {
  if ($entry -eq 'lib') {
    New-Item -ItemType Directory -Path (Join-Path $stage 'lib\assets') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'lib\assets\logo.png') -Destination (Join-Path $stage 'lib\assets')
  } else { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $entry) -Destination $stage -Recurse }
}
# README links and license references remain usable in the extracted ZIP.
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'CONTRIBUTING.md') -Destination $stage
New-Item -ItemType Directory -Path (Join-Path $stage 'test\fixtures') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'test\fixtures\LICENSE') -Destination (Join-Path $stage 'test\fixtures')
Copy-Item -LiteralPath (Join-Path $outputPath 'release-manifest.json') -Destination $stage
$rows = @(Get-ChildItem -LiteralPath $stage -File -Recurse | Sort-Object FullName | ForEach-Object {
  (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $_.FullName.Substring($stage.Length + 1).Replace('\','/')
})
[IO.File]::WriteAllText((Join-Path $stage 'SHA256SUMS.txt'), ($rows -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
$zipPath = Join-Path $outputPath $zipName
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath -CompressionLevel Optimal
$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$externalRows = @(@($archiveName, 'release-manifest.json', $zipName) | ForEach-Object {
  (Get-FileHash -LiteralPath (Join-Path $outputPath $_) -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $_
})
[IO.File]::WriteAllText((Join-Path $outputPath 'SHA256SUMS.txt'), ($externalRows -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
[pscustomobject]@{ version = $manifest.version; archive = $archiveName; windowsZIP = $zipName; windowsSHA256 = $zipHash; filesInZIP = $rows.Count + 1 } | ConvertTo-Json
