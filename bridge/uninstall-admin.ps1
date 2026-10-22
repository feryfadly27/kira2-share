# =====================================================================
#  LumaBooth Bridge - Pembatalan (jalankan sebagai Administrator)
#  Menghapus CA bridge dari Trusted Root & mematikan proxy sistem.
# =====================================================================
$ErrorActionPreference = 'Continue'
$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$caFile = Join-Path $bridgeDir 'ca\ca.crt'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: harus dijalankan sebagai Administrator." -ForegroundColor Red
    Read-Host "Tekan Enter untuk keluar"; exit 1
}

if (Test-Path $caFile) {
    $pem = Get-Content $caFile -Raw
    $b64 = (($pem -split "`n" | Where-Object { $_ -notmatch '-----' }) -join '').Trim()
    $der = [Convert]::FromBase64String($b64)
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList @(,$der)
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'LocalMachine')
    try {
        $store.Open('ReadWrite'); $store.Remove($cert); $store.Close()
        Write-Host "[1/2] CA bridge dihapus dari Trusted Root." -ForegroundColor Green
    } catch { Write-Host "[1/2] GAGAL hapus CA: $($_.Exception.Message)" -ForegroundColor Red }
}

Write-Host "[2/2] Proxy sistem dimatikan." -ForegroundColor Green
$k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
Set-ItemProperty -Path $k -Name ProxyEnable -Value 0 -Type DWord
Write-Host ""
Read-Host "Tekan Enter untuk keluar"
