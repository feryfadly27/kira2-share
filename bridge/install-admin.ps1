# =====================================================================
#  LumaBooth Bridge - Instalasi (WAJIB dijalankan sebagai Administrator)
#
#  CARA PAKAI:
#   1. Klik kanan file ini -> "Run with PowerShell" (jalankan sebagai Administrator)
#   2. Muncul dialog peringatan sertifikat -> pilih YES
#   3. Selesai, lalu jalankan bridge & dslrBooth
#
#  YANG DILAKUKAN:
#   - Memasang CA bridge ke Trusted Root (LocalMachine) supaya dslrBooth
#     mempercayai sertifikat lokal kita.
#   - Mengaktifkan proxy sistem -> 127.0.0.1:8888 (bridge).
#     Hanya host dslrBooth yang di-intersep; traffic lain diteruskan utuh.
#
#  PEMBATALAN: .\uninstall-admin.ps1
# =====================================================================
$ErrorActionPreference = 'Stop'
$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$caFile = Join-Path $bridgeDir 'ca\ca.crt'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: harus dijalankan sebagai Administrator." -ForegroundColor Red
    Write-Host "Klik kanan file ini -> Run with PowerShell (sebagai Administrator)." -ForegroundColor Yellow
    Read-Host "Tekan Enter untuk keluar"; exit 1
}

if (-not (Test-Path $caFile)) {
    Write-Host "ERROR: CA belum dibuat ($caFile)." -ForegroundColor Red
    Write-Host "Jalankan dulu di folder ini:  node proxy.js   (lalu Ctrl+C)" -ForegroundColor Yellow
    Read-Host "Tekan Enter untuk keluar"; exit 1
}

Write-Host "`n[1/2] Memasang CA bridge ke Trusted Root (LocalMachine)..." -ForegroundColor Cyan
try {
    Import-Certificate -FilePath $caFile -CertStoreLocation 'Cert:\LocalMachine\Root' | Out-Null
    Write-Host "  OK - CA terpasang." -ForegroundColor Green
} catch {
    Write-Host "  GAGAL: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Coba manual:  certutil -addstore Root `"$caFile`"" -ForegroundColor Yellow
}

Write-Host "`n[2/2] Mengaktifkan proxy sistem -> 127.0.0.1:8888 ..." -ForegroundColor Cyan
$k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
Set-ItemProperty -Path $k -Name ProxyEnable -Value 1 -Type DWord
Set-ItemProperty -Path $k -Name ProxyServer -Value '127.0.0.1:8888' -Type String
Set-ItemProperty -Path $k -Name ProxyOverride -Value 'localhost;127.*;<local>' -Type String
Write-Host "  OK - proxy sistem aktif." -ForegroundColor Green

Write-Host "`nSELESAI. Langkah berikutnya:" -ForegroundColor Green
Write-Host "  1. Jalankan bridge :  cd '$bridgeDir'; node proxy.js" -ForegroundColor Cyan
Write-Host "  2. Jalankan backend replika :  cd ..\backend; node src/server.js" -ForegroundColor Cyan
Write-Host "  3. TUTUP dslrBooth lalu buka lagi (perlu restart agar CAtrusted)" -ForegroundColor Cyan
Write-Host "  4. Ambil foto -> pindai QR => QR menunjuk ke galeri self-host" -ForegroundColor Cyan
Write-Host ""
Read-Host "Tekan Enter untuk keluar"
