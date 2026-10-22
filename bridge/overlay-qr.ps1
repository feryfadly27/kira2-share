# =====================================================================
#  LumaBooth QR Overlay
#  Menampilkan QR self-host (dari backend replika) tepat di atas popup
#  QR milik dslrBooth, jadi QR yang dilihat tamu = QR server kita.
#
#  Cara kerja:
#   - Memantau window dslrBooth yang judulnya mengandung "QR"
#   - Saat popup itu muncul, jendela overlay (always-on-top) ditampilkan
#     di posisi yang sama, berisi PNG QR dari backend.
#   - Saat popup hilang, overlay disembunyikan.
#
#  Jalankan:  powershell -ExecutionPolicy Bypass -File overlay-qr.ps1
#  Hentikan  : Ctrl+C
# =====================================================================
param(
  [string]$QrFile = 'C:\dslrBooth\lumabooth-qr.png',
  [string]$TitleMatch = 'QR',
  [int]$PollMs = 300
)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

$src = @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class U {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
Add-Type -TypeDefinition $src -ErrorAction SilentlyContinue

function Get-BoothWindows {
  $pids = @(Get-Process dslrBooth -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
  if (-not $pids) { return @() }
  $res = New-Object System.Collections.ArrayList
  $cb = [U+EnumProc]{
    param($h, $l)
    $p = 0
    [void][U]::GetWindowThreadProcessId($h, [ref]$p)
    if ($pids -contains $p -and [U]::IsWindowVisible($h)) {
      $t = New-Object System.Text.StringBuilder 512
      [void][U]::GetWindowText($h, $t, 512)
      $r = New-Object U+RECT
      [void][U]::GetWindowRect($h, [ref]$r)
      if (($r.Right - $r.Left) -gt 50) {
        [void]$res.Add([pscustomobject]@{ H = $h; Title = $t.ToString(); L = $r.Left; T = $r.Top; W = $r.Right - $r.Left; H2 = $r.Bottom - $r.Top })
      }
    }
    return $true
  }
  [void][U]::EnumWindows($cb, [IntPtr]::Zero)
  return $res
}

# --- buat jendela overlay ---
[xml]$xaml = @"
<Window xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation'
        xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml'
        WindowStyle='None' AllowsTransparency='True' Background='Transparent'
        ShowInTaskbar='False' Topmost='True' ResizeMode='NoResize' WindowStartupLocation='Manual'>
  <Border Background='#FF101018' BorderBrush='#FF6D28D9' BorderThickness='3' CornerRadius='12'>
    <Grid>
      <Image x:Name='Qr' Stretch='Uniform' Margin='10'/>
      <TextBlock x:Name='Cap' Foreground='White' FontSize='15' HorizontalAlignment='Center'
                 VerticalAlignment='Bottom' Margin='0,0,0,8' Text='Scan untuk lihat &amp; unduh foto'/>
    </Grid>
  </Border>
</Window>
"@
$reader = New-Object System.Xml.XmlNodeReader $xaml
$win = [Windows.Markup.XamlReader]::Load($reader)
$qrImg = $win.FindName('Qr')
$win.WindowStartupLocation = 'Manual'
$win.Left = 100; $win.Top = 100
$win.Show() | Out-Null
$win.Hide()

Write-Host "[overlay] aktif. mencari window dslrBooth dengan '$TitleMatch' di judulnya..."
$last = $null
while ($true) {
  $target = Get-BoothWindows | Where-Object { $_.Title -match $TitleMatch } | Select-Object -First 1
  if ($target) {
    if ($last -ne $target.H -or -not $win.IsVisible) {
      try {
        if ((Get-Item $QrFile -ErrorAction SilentlyContinue).LastWriteTime -gt (Get-Date).AddSeconds(-10)) {
          $img = New-Object System.Windows.Media.Imaging.BitmapImage
          $img.BeginInit(); $img.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
          $img.UriSource = New-Object System.Uri($QrFile)
          $img.EndInit(); $img.Freeze()
          $qrImg.Source = $img
        }
        $win.Left = $target.L; $win.Top = $target.T
        $win.Width = $target.W; $win.Height = $target.H
        $win.Show(); $win.Activate(); $win.Topmost = $true
        Write-Host "[overlay] QR ditampilkan di atas window '$($target.Title)'"
        $last = $target.H
      } catch { Write-Host "[overlay] error: $($_.Exception.Message)" }
    }
  } else {
    if ($win.IsVisible) { $win.Hide(); $last = $null; Write-Host '[overlay] disembunyikan' }
  }
  Start-Sleep -Milliseconds $PollMs
}
