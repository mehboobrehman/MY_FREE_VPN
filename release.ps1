$versionJson = Get-Content -Raw "version.json" | ConvertFrom-Json
$version = $versionJson.version
$tagName = "v$version"

Write-Host "Preparing release for $tagName"

# 1. Tag and Push
if (git rev-parse $tagName -q) {
    Write-Host "Tag $tagName already exists. Skipping tagging."
} else {
    Write-Host "Tagging with $tagName"
    git tag $tagName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to tag repository."
        exit 1
    }
    git push origin $tagName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to push tag."
        exit 1
    }
}

# 2. Setup GitHub CLI
$gh = "gh"
if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
    $gh = ".\gh_extracted\bin\gh.exe"
}

# 3. Create Release
if (& $gh release view $tagName 2>$null) {
    Write-Host "Release $tagName already exists."
} else {
    Write-Host "Creating GitHub release $tagName"
    & $gh release create $tagName --title "Release $tagName" --notes "Automated release for version $version"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create GitHub release."
        exit 1
    }
}


# 4. Upload artifacts
Write-Host "Uploading artifacts from artifacts/ folder..."
$files = Get-ChildItem -Path "artifacts/*"
foreach ($file in $files) {
    Write-Host "Uploading $($file.Name)"
    & $gh release upload $tagName $file.FullName --clobber
}

Write-Host "Release and upload complete."
