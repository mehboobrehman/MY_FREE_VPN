Start-Sleep -Seconds 5
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory('C:/src/flutter.zip', 'C:/src')