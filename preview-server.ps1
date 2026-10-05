# Local preview server for the Infinite Financial Group site.
# Needs nothing but Windows PowerShell. Run START-PREVIEW.bat, or:
#   powershell -ExecutionPolicy Bypass -File preview-server.ps1 [-Port 8080] [-NoBrowser]
param([int]$Port = 8080, [switch]$NoBrowser)
$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)

$mime = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8";
  ".css" = "text/css; charset=utf-8"; ".png" = "image/png"; ".jpg" = "image/jpeg";
  ".jpeg" = "image/jpeg"; ".webp" = "image/webp"; ".svg" = "image/svg+xml";
  ".ico" = "image/x-icon"; ".mp4" = "video/mp4"; ".woff2" = "font/woff2";
  ".json" = "application/json"; ".txt" = "text/plain; charset=utf-8"; ".xml" = "application/xml"
}

$listener = New-Object System.Net.HttpListener
$last = $Port + 10
while ($Port -lt $last) {
  try { $listener.Prefixes.Clear(); $listener.Prefixes.Add("http://localhost:$Port/"); $listener.Start(); break }
  catch { $Port++ }
}
if (-not $listener.IsListening) { Write-Host "Could not start the preview server (ports busy)."; exit 1 }

$url = "http://localhost:$Port/"
Write-Host "Infinite Financial Group preview running at $url"
Write-Host "Leave this window open while you look around. Close it to stop."
if (-not $NoBrowser) { Start-Process $url }

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart("/")
    if ($rel -eq "") { $rel = "index.html" }
    $path = [System.IO.Path]::GetFullPath((Join-Path $root ($rel -replace "/", "\")))
    if ((Test-Path $path -PathType Container)) { $path = Join-Path $path "index.html" }
    if ($path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path $path -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $ctx.Response.Headers["Cache-Control"] = "no-cache"
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch { }
}
