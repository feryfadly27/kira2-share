# =====================================================================
#  Push project ke GitHub dengan token Anda sendiri.
#  Token TIDAK disimpan di repo ini dan tidak ikut ter-commit.
#
#  Cara pakai (PowerShell):
#    $env:GH_TOKEN = "ghp_xxxxxxxxxxxxxxxx"
#    powershell -ExecutionPolicy Bypass -File ".\push-github.ps1"
#
#  Repo: https://github.com/feryfadly27/kira2-share  (private)
# =====================================================================
param(
  [string]$Repo = 'feryfadly27/kira2-share',
  [string]$RemoteName = 'origin',
  [bool]$Private = $true
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- token ---
$token = $env:GH_TOKEN

# Fallback 1: ambil dari credential store GitHub CLI (gh auth login --web)
if (-not $token) {
  $gh = 'C:\Program Files\GitHub CLI\gh.exe'
  if (Test-Path $gh) {
    $token = (& $gh auth token 2>$null | Out-String).Trim()
    if ($token) { Write-Host '[OK] Token diambil dari GitHub CLI' -ForegroundColor Green }
  }
}

# Fallback 2: input manual (tidak disimpan ke file mana pun)
if (-not $token) {
  Write-Host ''
  Write-Host 'Token GitHub tidak ditemukan di environment / GitHub CLI.' -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'PILIH SALAH SATU:' -ForegroundColor Cyan
  Write-Host '  A) Pakai GitHub CLI (paling gampang, tanpa copy-paste):' -ForegroundColor White
  Write-Host '     gh auth login --hostname github.com --git-protocol https --web' -ForegroundColor Gray
  Write-Host ''
  Write-Host '  B) Tempel PAT (classic) dengan scope "repo":' -ForegroundColor White
  Write-Host '     https://github.com/settings/tokens/new' -ForegroundColor Gray
  Write-Host ''
  $token = Read-Host 'Tempel token di sini (tidak disimpan)'
}
if (-not $token) { Write-Host 'Dibatalkan.' -ForegroundColor Red; exit 1 }

$headers = @{
  Authorization  = "Bearer $token"
  Accept        = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
}

# --- validasi ---
try {
  $me = Invoke-RestMethod 'https://api.github.com/user' -Headers $headers
} catch {
  Write-Host "Token ditolak: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Pastikan token Active dan punya scope "repo".' -ForegroundColor Yellow
  exit 1
}
Write-Host "[OK] Token valid untuk akun: $($me.login)" -ForegroundColor Green

# --- pastikan repo ada (private) ---
$owner = $Repo.Split('/')[0]
$name  = $Repo.Split('/')[1]
$exists = $false
try {
  $null = Invoke-RestMethod "https://api.github.com/repos/$Repo" -Headers $headers
  $exists = $true
  Write-Host "[OK] Repo sudah ada: $Repo" -ForegroundColor Green
} catch { }

if (-not $exists) {
  $body = @{
    name        = $name
    private     = $Private
    description = 'Kira2-Share - replika self-hosted LumaBooth/Fotoshare + integrasi dslrBooth (foto & QR share ke server sendiri)'
    auto_init   = $false
  } | ConvertTo-Json
  try {
    $repo = Invoke-RestMethod 'https://api.github.com/user/repos' -Method Post -Headers $headers -Body $body -ContentType 'application/json'
    Write-Host "[OK] Repo dibuat: $($repo.full_name) (private=$($repo.private))" -ForegroundColor Green
  } catch {
    Write-Host "Gagal membuat repo: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}

# --- remote & push ---
Set-Location $root
$url = "https://github.com/$Repo.git"
if (git remote get-url $RemoteName 2>$null) {
  git remote set-url $RemoteName $url
} else {
  git remote add $RemoteName $url
}
Write-Host "[..] Push -> $url" -ForegroundColor Cyan

# kredensial via header (token tidak ditulis ke .git/config)
$env:GIT_TERMINAL_PROMPT = '0'
$basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$token"))
git -c "http.https://github.com/.extraheader=Authorization: Basic $basic" push -u $RemoteName main
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Push gagal.' -ForegroundColor Red
  exit 1
}
Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'PUSH SELESAI' -ForegroundColor Green
Write-Host "  https://github.com/$Repo" -ForegroundColor Cyan
Write-Host ''
Write-Host 'Recomended: revoke token ini di' -ForegroundColor Yellow
Write-Host '  https://github.com/settings/tokens' -ForegroundColor Yellow
Write-Host '(token hanya perlu untuk push pertama)' -ForegroundColor DarkGray
