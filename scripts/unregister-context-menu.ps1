# Video Annotator - Remove context menu registration
# Run as Administrator: Right-click > Run with PowerShell (as Admin)

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Video Annotator - Remove Context Menu" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
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

Write-Host "Removing context menu entries..." -ForegroundColor Yellow
Write-Host ""

foreach ($ext in $extensions) {
    try {
        $keyPath = "Registry::HKEY_CLASSES_ROOT\SystemFileAssociations\$ext\shell\VideoAnnotator"

        if (Test-Path $keyPath) {
            Remove-Item -Path $keyPath -Recurse -Force
            Write-Host "  [OK] $ext - Removed" -ForegroundColor Green
        } else {
            Write-Host "  [--] $ext - Not found (already removed)" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "  [FAIL] $ext - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Removal Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"
