$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$archivePath = Join-Path $projectRoot 'handoff\manos-video-generator-trial-source.zip'
if (-not (Test-Path -LiteralPath $archivePath)) { throw 'Run npm.cmd run handoff first.' }
Get-Command git -ErrorAction Stop | Out-Null
Get-Command gh -ErrorAction Stop | Out-Null
gh auth status
if ($LASTEXITCODE -ne 0) {
    gh auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) { throw 'GitHub sign-in failed.' }
}
$githubLogin = gh api user --jq .login
if ($LASTEXITCODE -ne 0 -or $githubLogin.Trim() -ne 'Crcs1225') { throw 'Sign in as Crcs1225 before publishing.' }
gh auth setup-git
if ($LASTEXITCODE -ne 0) { throw 'Git authentication setup failed.' }
$handoffRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'handoff'))
$publishRoot = [System.IO.Path]::GetFullPath((Join-Path $handoffRoot ('github-publish-' + [guid]::NewGuid().ToString('N'))))
if (-not $publishRoot.StartsWith($handoffRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid publishing directory.' }
Expand-Archive -LiteralPath $archivePath -DestinationPath $publishRoot
$sourceRoot = Join-Path $publishRoot (Split-Path -Leaf $projectRoot)
if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'package.json'))) { throw 'Source archive is invalid.' }
Push-Location $sourceRoot
try {
    git init -b main
    if ($LASTEXITCODE -ne 0) { throw 'Git initialization failed.' }
    git add -- .
    if ($LASTEXITCODE -ne 0) { throw 'Staging failed.' }
    git -c user.name=Crcs1225 -c user.email=117502889+Crcs1225@users.noreply.github.com commit -m 'Add reviewed TypeScript video generator prototype'
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed.' }
    git remote add origin https://github.com/Crcs1225/manos-video-generator.git
    if ($LASTEXITCODE -ne 0) { throw 'Remote configuration failed.' }
    git push -u origin main
    if ($LASTEXITCODE -ne 0) { throw 'Push failed. Existing remote commits are preserved; no force push was attempted.' }
    Write-Output 'Published: https://github.com/Crcs1225/manos-video-generator'
} finally { Pop-Location }
