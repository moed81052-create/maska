Add-Type -AssemblyName System.Drawing

param(
    [string]$srcPath,
    [string]$dstPath,
    [int]$threshold = 240
)

$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$width = $src.Width
$height = $src.Height

# Create ARGB bitmap
$dst = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $pixel = $src.GetPixel($x, $y)
        $r = $pixel.R
        $g = $pixel.G
        $b = $pixel.B
        
        # Check if near white
        if ($r -gt $threshold -and $g -gt $threshold -and $b -gt $threshold) {
            # Completely transparent
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($r -gt ($threshold - 25) -and $g -gt ($threshold - 25) -and $b -gt ($threshold - 25)) {
            # Smooth feathered edge
            $avg = ($r + $g + $b) / 3.0
            $alpha = [int]([Math]::Max(0, [Math]::Min(255, (255 - $avg) * 10)))
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $r, $g, $b))
        } else {
            # Keep original opaque pixel
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $g, $b))
        }
    }
}

$src.Dispose()
$dst.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()

Write-Host "Saved transparent PNG to $dstPath ($width x $height)"

