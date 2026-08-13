Add-Type -AssemblyName System.Drawing
foreach ($name in @('cdp_f1','cdp_f2','cdp_f3','cdp_f4','cdp_f5')) {
  $path = "D:\embed-quickref\vshots\$name.png"
  $bmp = [System.Drawing.Bitmap]::FromFile($path)
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle(0,0,$w,$h)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object 'System.Byte[]' ($data.Stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)
  # 不透明纯白（alpha>200 且 RGB>245）的包围盒 —— 全窗固定白框会表现为全窗口
  $minX = 99999; $minY = 99999; $maxX = -1; $maxY = -1; $cnt = 0
  # 半透明白（alpha 10-200 且 RGB>245）的包围盒 —— 卡片背景淡出
  $sminX = 99999; $sminY = 99999; $smaxX = -1; $smaxY = -1; $scnt = 0
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $i = $y * $data.Stride + $x * 4
      $b = $bytes[$i]; $g = $bytes[$i+1]; $r = $bytes[$i+2]; $a = $bytes[$i+3]
      if ($a -gt 200 -and $r -gt 245 -and $g -gt 245 -and $b -gt 245) {
        $cnt++
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      } elseif ($a -ge 10 -and $a -le 200 -and $r -gt 245 -and $g -gt 245 -and $b -gt 245) {
        $scnt++
        if ($x -lt $sminX) { $sminX = $x }; if ($x -gt $smaxX) { $smaxX = $x }
        if ($y -lt $sminY) { $sminY = $y }; if ($y -gt $smaxY) { $smaxY = $y }
      }
    }
  }
  $bmp.Dispose()
  Write-Output ("{0} {1}x{2}: 不透明白={3,6} bbox=({4},{5})-({6},{7}) | 半透明白={8,6} bbox=({9},{10})-({11},{12})" -f $name, $w, $h, $cnt, $minX, $minY, $maxX, $maxY, $scnt, $sminX, $sminY, $smaxX, $smaxY)
}
