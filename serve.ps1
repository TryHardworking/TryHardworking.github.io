# Local static server for the new TRY/HARD portfolio.
# Serves the PARENT (workspace root) directory so relative links to the
# sibling projects work: ../nexus-crm/, ../sdvig/, ../sistema-krasoti/, etc.
#
# Run:    powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
# Open:   http://localhost:8901/tryhard-portfolio-new/
# CRM:    http://localhost:8901/nexus-crm/
#
# NEXUS CRM uses ES modules and requires a real HTTP server:
# opening index.html directly via file:// will not start the CRM.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$port = 8901

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$port/"
Write-Host "New portfolio: http://localhost:$port/tryhard-portfolio-new/"
Write-Host "NEXUS CRM:     http://localhost:$port/nexus-crm/"
Write-Host "Press Ctrl+C to stop"

$types = @{
  '.html'  = 'text/html; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.js'    = 'text/javascript; charset=utf-8'
  '.mjs'   = 'text/javascript; charset=utf-8'
  '.svg'   = 'image/svg+xml'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.jpeg'  = 'image/jpeg'
  '.webp'  = 'image/webp'
  '.ico'   = 'image/x-icon'
  '.woff2' = 'font/woff2'
  '.woff'  = 'font/woff'
  '.json'  = 'application/json; charset=utf-8'
  '.txt'   = 'text/plain; charset=utf-8'
  '.md'    = 'text/plain; charset=utf-8'
  '.map'   = 'application/json; charset=utf-8'
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $isHead = $ctx.Request.HttpMethod -eq 'HEAD'
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path -eq '/') { $path = '/tryhard-portfolio-new/index.html' }
    if ($path.EndsWith('/')) { $path = $path + 'index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $path))
    if ($file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $file -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
      $mime = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ctx.Response.ContentType = $mime
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.AddHeader('Cache-Control', 'no-cache')
      if (-not $isHead) { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes('404 - file not found')
      $ctx.Response.ContentType = 'text/plain; charset=utf-8'
      if (-not $isHead) { $ctx.Response.OutputStream.Write($msg, 0, $msg.Length) }
    }
  } catch {
    try { $ctx.Response.StatusCode = 500 } catch {}
  } finally {
    try { $ctx.Response.OutputStream.Close() } catch {}
  }
}
