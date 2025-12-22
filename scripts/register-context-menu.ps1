# Video Annotator - Register context menu for image files
# Run as Administrator: Right-click > Run with PowerShell (as Admin)

$ErrorActionPreference = "Stop"

# Find the exe path - check multiple locations
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$possiblePaths = @(
    (Join-Path $scriptDir "..\release\Video Annotator.exe"),
    (Join-Path $scriptDir "..\Video Annotator.exe"),
    (Join-Path $scriptDir "Video Annotator.exe")
)

$exePath = $null
foreach ($path in $possiblePaths) {
    $resolved = [System.IO.Path]::GetFullPath($path)
    if (Test-Path $resolved) {
        $exePath = $resolved
        break
    }
}

if (-not $exePath) {
    Write-Host "ERROR: Video Annotator.exe not found!" -ForegroundColor Red
    Write-Host "Searched in:" -ForegroundColor Yellow
    foreach ($path in $possiblePaths) {
        Write-Host "  - $([System.IO.Path]::GetFullPath($path))" -ForegroundColor Gray
    }
    Write-Host "`nPlease run this script from the scripts folder or place Video Annotator.exe nearby." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Video Annotator - Context Menu Registration" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Exe Path: $exePath" -ForegroundColor Green
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script requires Administrator privileges!" -ForegroundColor Red
    Write-Host "Right-click the script and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

$extensions = @(".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif")

Write-Host "Registering context menu for image files..." -ForegroundColor Yellow
Write-Host ""

foreach ($ext in $extensions) {
    try {
        $keyPath = "Registry::HKEY_CLASSES_ROOT\SystemFileAssociations\$ext\shell\VideoAnnotator"
        $commandPath = "$keyPath\command"

        # Create shell key
        if (-not (Test-Path $keyPath)) {
            New-Item -Path $keyPath -Force | Out-Null
        }
        Set-ItemProperty -Path $keyPath -Name "(Default)" -Value "Annotate with Video Annotator"
        Set-ItemProperty -Path $keyPath -Name "Icon" -Value "`"$exePath`",0"

        # Create command key - simple format: "exePath" "%1"
        if (-not (Test-Path $commandPath)) {
            New-Item -Path $commandPath -Force | Out-Null
        }
        Set-ItemProperty -Path $commandPath -Name "(Default)" -Value "`"$exePath`" `"%1`""

        Write-Host "  [OK] $ext" -ForegroundColor Green
    }
    catch {
        Write-Host "  [FAIL] $ext - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Registration Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Right-click any image file to see 'Annotate with Video Annotator'" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
