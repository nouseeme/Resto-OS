$ErrorActionPreference = 'Stop'
$assetsRoot = Join-Path $PSScriptRoot '../public'
$assets = @{
  'fonts/newsreader.woff2' = 'https://cdn.jsdelivr.net/fontsource/fonts/newsreader:vf@latest/latin-wght-normal.woff2'
  'fonts/manrope.woff2' = 'https://cdn.jsdelivr.net/fontsource/fonts/manrope:vf@latest/latin-wght-normal.woff2'
  'images/nasi.jpg' = 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=900&q=85&fit=crop'
  'images/ayam.jpg' = 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=900&q=85&fit=crop'
  'images/mie.jpg' = 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=900&q=85&fit=crop'
  'images/tahu.jpg' = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&q=85&fit=crop'
  'images/pangsit.jpg' = 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=900&q=85&fit=crop'
  'images/teh.jpg' = 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=900&q=85&fit=crop'
  'images/jeruk.jpg' = 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=900&q=85&fit=crop'
  'images/puding.jpg' = 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900&q=85&fit=crop'
}
foreach ($asset in $assets.GetEnumerator()) {
  $target = Join-Path $assetsRoot $asset.Key
  New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
  try { Invoke-WebRequest -Uri $asset.Value -OutFile $target -TimeoutSec 30; Write-Output "Saved $($asset.Key)" }
  catch { Write-Output "Unavailable: $($asset.Key) — $($_.Exception.Message)" }
}
