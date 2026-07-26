# Regenerates images/og-image.jpg (1200x630) by compositing images/band-bg.jpg
# with images/logo.png, using the same dark gradient treatment as the CSS .hero-bg.
# Usage: powershell -File scripts/generate-og-image.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$bgPath = Join-Path $root "images\band-bg.jpg"
$logoPath = Join-Path $root "images\logo.png"
$outPath = Join-Path $root "images\og-image.jpg"

$canvasW = 1200
$canvasH = 630

$bg = [System.Drawing.Image]::FromFile($bgPath)
$scale = $canvasW / $bg.Width
$scaledH = [int][Math]::Round($bg.Height * $scale)

$bitmap = New-Object System.Drawing.Bitmap($canvasW, $canvasH)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Draw background scaled to canvas width, top-aligned (matches CSS "top center" cover)
$g.DrawImage($bg, 0, 0, $canvasW, $scaledH)
$bg.Dispose()

# Dark gradient overlay (matches .hero-bg: rgba(0,0,0,.35) 0% -> rgba(0,0,0,.75) 70% -> #000 100%)
$rect = New-Object System.Drawing.Rectangle(0, 0, $canvasW, $canvasH)
$blend = New-Object System.Drawing.Drawing2D.ColorBlend(4)
$blend.Colors = @(
  [System.Drawing.Color]::FromArgb([int](0.35*255), 0, 0, 0),
  [System.Drawing.Color]::FromArgb([int](0.55*255), 0, 0, 0),
  [System.Drawing.Color]::FromArgb([int](0.75*255), 0, 0, 0),
  [System.Drawing.Color]::FromArgb(255, 0, 0, 0)
)
$blend.Positions = @(0.0, 0.35, 0.7, 1.0)
$gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::Black, [System.Drawing.Color]::Black, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
$gradBrush.InterpolationColors = $blend
$g.FillRectangle($gradBrush, $rect)
$gradBrush.Dispose()

# Composite logo, centered, sized to ~62% canvas width (keeps aspect ratio)
$logo = [System.Drawing.Image]::FromFile($logoPath)
$logoW = [int]($canvasW * 0.62)
$logoH = [int]($logoW * $logo.Height / $logo.Width)
$logoX = [int](($canvasW - $logoW) / 2)
$logoY = [int](($canvasH - $logoH) / 2)
$g.DrawImage($logo, $logoX, $logoY, $logoW, $logoH)
$logo.Dispose()

$g.Dispose()

# Encode as JPEG with high quality
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]90)
$bitmap.Save($outPath, $jpegCodec, $encParams)
$bitmap.Dispose()

Write-Output "Wrote $outPath"
