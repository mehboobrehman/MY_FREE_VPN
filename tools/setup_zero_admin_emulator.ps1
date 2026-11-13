# tools/setup_zero_admin_emulator.ps1
# Sets up Android SDK in user space, sets ENV vars, and installs components without admin rights.

$ErrorActionPreference = "Stop"

$sdkPath = Join-Path $env:USERPROFILE "Android\sdk"
$cmdlineToolsPath = Join-Path $sdkPath "cmdline-tools"
$latestToolsPath = Join-Path $cmdlineToolsPath "latest"

Write-Host "--- MY_FREE_VPN Zero-Admin Android SDK Setup ---"
Write-Host "SDK Path: $sdkPath"

# 1. Create directory structure
if (-not (Test-Path $sdkPath)) {
    New-Item -ItemType Directory -Force -Path $sdkPath | Out-Null
}
if (-not (Test-Path $latestToolsPath)) {
    New-Item -ItemType Directory -Force -Path $latestToolsPath | Out-Null
}

# 2. Download command-line tools if not present
if (-not (Test-Path (Join-Path $latestToolsPath "bin\sdkmanager.bat"))) {
    Write-Host "Downloading Android Command-line Tools..."
    $url = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    $zipPath = Join-Path $env:TEMP "commandlinetools.zip"
    
    Invoke-WebRequest -Uri $url -OutFile $zipPath
    
    Write-Host "Extracting..."
    $extractPath = Join-Path $env:TEMP "cmdline-tools-extract"
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
    
    # Move extracted contents to cmdline-tools/latest
    # The structure in the zip is cmdline-tools/bin, etc.
    # We need to move the contents of cmdline-tools-extract\cmdline-tools to latest
    $source = Join-Path $extractPath "cmdline-tools"
    Get-ChildItem $source | Move-Item -Destination $latestToolsPath -Force
    
    Remove-Item -Path $zipPath -Force
    Remove-Item -Path $extractPath -Recurse -Force
    Write-Host "Command-line tools installed."
}

# 3. Set Environment Variables (User scope)
Write-Host "Setting Environment Variables..."
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkPath, "User")

$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$newPaths = @(
    Join-Path $sdkPath "platform-tools",
    Join-Path $sdkPath "emulator",
    Join-Path $latestToolsPath "bin"
)

foreach ($p in $newPaths) {
    if ($currentPath -notlike "*$p*") {
        $currentPath = "$currentPath;$p"
    }
}
[Environment]::SetEnvironmentVariable("PATH", $currentPath, "User")

# Refresh current session
$env:ANDROID_HOME = $sdkPath
$env:PATH = [Environment]::GetEnvironmentVariable("PATH", "User")

# 4. Install components
$sdkmanager = Join-Path $latestToolsPath "bin\sdkmanager.bat"
Write-Host "Installing components (this may take a few minutes)..."
# Use 'yes' to accept licenses
& $sdkmanager --licenses | Out-Null
& $sdkmanager "platform-tools" "emulator" "platforms;android-34" "system-images;android-34;google_apis;x86_64" | Out-Null

# 5. Create AVD
$avdmanager = Join-Path $latestToolsPath "bin\avdmanager.bat"
$avdName = "Pixel_6_API_34"
Write-Host "Creating AVD: $avdName..."
# Use echo 'no' to not create hardware profile (defaults to device)
echo "no" | & $avdmanager create avd -n $avdName -k "system-images;android-34;google_apis;x86_64" --device "pixel_6" | Out-Null

Write-Host "--- Setup Complete! ---"
Write-Host "1. To launch emulator: emulator -avd $avdName"
Write-Host "2. After emulator starts, run: adb reverse tcp:48392 tcp:48392"
Write-Host "3. Then run: flutter run (in client/ directory)"
