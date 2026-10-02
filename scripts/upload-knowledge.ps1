param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')][string]$ProjectId,
    [string]$Source
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) { throw 'Install the Google Cloud CLI and run gcloud auth login first.' }
$repo = Split-Path -Parent $PSScriptRoot
if (-not $Source) { $Source = Join-Path (Split-Path -Parent $repo) 'Data\06 App Knowledge' }
$root = (Resolve-Path -LiteralPath $Source).Path.TrimEnd('\')
$manifestFolder = Join-Path $root '_manifests'
$expected = @('_manifests/gemini-canonical-markdown.jsonl', '_manifests/blob-upload-manifest.json', '_manifests/worksheet-sections.json', '_manifests/build-report.json')
$documents = Get-Content -LiteralPath (Join-Path $manifestFolder 'gemini-canonical-markdown.jsonl') | ForEach-Object { $_ | ConvertFrom-Json }
$assets = Get-Content -LiteralPath (Join-Path $manifestFolder 'blob-upload-manifest.json') -Raw | ConvertFrom-Json
$expected += @($documents | ForEach-Object { $_.path })
$expected += @($assets.files | ForEach-Object { $_.path })
foreach ($relative in $expected) {
    if ($relative -match '(^/|\\|(^|/)\.\.?(/|$))') { throw 'A corpus manifest contains an unsafe file path.' }
    $target = [IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $target.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'A corpus file escapes its root.' }
    $item = Get-Item -LiteralPath $target
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Only regular corpus files may be uploaded.' }
}
$items = @(Get-ChildItem -LiteralPath $root -Recurse -Force)
if (@($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Linked directories are not allowed in the upload bundle.' }
foreach ($file in @($items | Where-Object { -not $_.PSIsContainer })) {
    $relative = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
    if ($relative -notin $expected) { throw 'The bundle contains an extra file. Rebuild the teaching corpus before uploading.' }
}
$bucket = "$ProjectId-lexipath-knowledge"
& gcloud storage buckets describe "gs://$bucket" "--project=$ProjectId" '--format=value(name)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Create the private knowledge bucket with scripts/setup-gcp.ps1 first.' }
# Upload only the validated generated bundle; the original Data folder is never uploaded wholesale.
& gcloud storage rsync $root "gs://$bucket" '--recursive' "--project=$ProjectId"
if ($LASTEXITCODE -ne 0) { throw 'Teaching resource upload failed.' }
Write-Host 'Teaching corpus uploaded to the private Google Cloud Storage bucket.'
