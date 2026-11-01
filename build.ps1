param(
    [switch]$DebugOnly,
    [switch]$ReleaseOnly
)

$versionJson = Get-Content -Raw "version.json" | ConvertFrom-Json
$version = $versionJson.version
Write-Host "Starting build for version: $version"

$root = Get-Location
$clientDir = Join-Path $root "client"
$artifactsDir = Join-Path $root "artifacts"

if (-not (Test-Path $artifactsDir)) {
    New-Item -ItemType Directory -Path $artifactsDir
}

# Ensure we are in the client directory for flutter commands
Set-Location $clientDir

$flutter = "..\client\flutter_sdk\bin\flutter.bat" # Need to adjust this.
# Wait, $clientDir = Join-Path $root "client"
# Set-Location $clientDir
# So if I am in $root, flutter is at client\flutter_sdk\bin\flutter.bat
# If I am in $clientDir, flutter is at flutter_sdk\bin\flutter.bat

# Let's set the variable before Set-Location
$flutter = Join-Path $root "client\flutter_sdk\bin\flutter.bat"

if (-not $ReleaseOnly) {
    Write-Host "Building Android Debug..."
    & $flutter build apk --debug --build-name=$version
    Copy-Item "build/app/outputs/flutter-apk/app-debug.apk" (Join-Path $artifactsDir "MY_FREE_VPN_v$version`_debug.apk")

    Write-Host "Building Windows Debug..."
    & $flutter build windows --debug
    # Windows debug typically lives in build/windows/runner/Debug
}

if (-not $DebugOnly) {
    Write-Host "Building Android Release..."
    & $flutter build apk --release --build-name=$version
    Copy-Item "build/app/outputs/flutter-apk/app-release.apk" (Join-Path $artifactsDir "MY_FREE_VPN_v$version`_release.apk")

    Write-Host "Building Windows Release..."
    & $flutter build windows --release
    # Windows release typically lives in build/windows/runner/Release
}

Set-Location $root
Write-Host "Build complete. Artifacts in $artifactsDir"
