param(
    [string]$srcPath,
    [string]$dstPath,
    [int]$threshold = 242
)

if (-not ([System.Management.Automation.PSTypeName]'FastBgRemover').Type) {
    Add-Type -TypeDefinition @"
    using System;
    using System.Drawing;
    using System.Drawing.Imaging;

    public class FastBgRemover {
        public static void Process(string srcPath, string dstPath, int threshold) {
            using (Bitmap src = new Bitmap(srcPath)) {
                int width = src.Width;
                int height = src.Height;
                using (Bitmap dst = new Bitmap(width, height, PixelFormat.Format32bppArgb)) {
                    BitmapData srcData = src.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format32bppRgb);
                    BitmapData dstData = dst.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                    
                    int stride = srcData.Stride;
                    int bytes = Math.Abs(stride) * height;
                    byte[] rgbValues = new byte[bytes];
                    byte[] dstValues = new byte[bytes];

                    System.Runtime.InteropServices.Marshal.Copy(srcData.Scan0, rgbValues, 0, bytes);

                    for (int y = 0; y < height; y++) {
                        for (int x = 0; x < width; x++) {
                            int idx = y * stride + x * 4;
                            byte b = rgbValues[idx];
                            byte g = rgbValues[idx + 1];
                            byte r = rgbValues[idx + 2];

                            if (r >= threshold && g >= threshold && b >= threshold) {
                                dstValues[idx] = 0;
                                dstValues[idx + 1] = 0;
                                dstValues[idx + 2] = 0;
                                dstValues[idx + 3] = 0;
                            } else if (r >= threshold - 30 && g >= threshold - 30 && b >= threshold - 30) {
                                int avg = (r + g + b) / 3;
                                byte alpha = (byte)Math.Max(0, Math.Min(255, (255 - avg) * 8));
                                dstValues[idx] = b;
                                dstValues[idx + 1] = g;
                                dstValues[idx + 2] = r;
                                dstValues[idx + 3] = alpha;
                            } else {
                                dstValues[idx] = b;
                                dstValues[idx + 1] = g;
                                dstValues[idx + 2] = r;
                                dstValues[idx + 3] = 255;
                            }
                        }
                    }

                    System.Runtime.InteropServices.Marshal.Copy(dstValues, 0, dstData.Scan0, bytes);
                    src.UnlockBits(srcData);
                    dst.UnlockBits(dstData);

                    dst.Save(dstPath, ImageFormat.Png);
                }
            }
        }
    }
"@ -ReferencedAssemblies System.Drawing
}

[FastBgRemover]::Process($srcPath, $dstPath, $threshold)
Write-Host "Processed transparent PNG saved to: $dstPath"
