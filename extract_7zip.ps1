Add-Type -AssemblyName System.IO.Compression.FileSystem
 = [System.IO.Compression.ZipFile]::OpenRead('C:/src/flutter.zip')
foreach ( in .Entries) {
     = [System.IO.Path]::Combine('C:/src', .FullName)
     = [System.IO.Path]::GetDirectoryName()
    if (-not [System.IO.Directory]::Exists()) {
        [System.IO.Directory]::CreateDirectory() | Out-Null
    }
    if (.Name -ne '') {
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile(, , )
    }
}
.Dispose()
Write-Host 'Extraction complete via ZipFile extensions!'