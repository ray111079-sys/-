$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '.'))
$crlf = [char]13 + [char]10

function Get-ContentType([string]$path) {
  switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.htm'  { 'text/html; charset=utf-8' }
    '.js'   { 'text/javascript; charset=utf-8' }
    '.mjs'  { 'text/javascript; charset=utf-8' }
    '.css'  { 'text/css; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.svg'  { 'image/svg+xml' }
    '.png'  { 'image/png' }
    '.jpg'  { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.webp' { 'image/webp' }
    '.ico'  { 'image/x-icon' }
    '.txt'  { 'text/plain; charset=utf-8' }
    default { 'application/octet-stream' }
  }
}

function New-LoopbackListener([int]$port) {
  return New-Object -TypeName System.Net.Sockets.TcpListener -ArgumentList @([System.Net.IPAddress]::Loopback, $port)
}

function Get-AvailablePort([int]$startPort, [int]$maxPort) {
  for ($p = $startPort; $p -le $maxPort; $p++) {
    $probe = $null
    try {
      $probe = New-LoopbackListener $p
      $probe.Start()
      $probe.Stop()
      return $p
    } catch {
      if ($probe) { try { $probe.Stop() } catch {} }
    }
  }
  throw "No free localhost port was found in range $startPort-$maxPort."
}

function Send-Response($stream, [int]$statusCode, [string]$statusText, [string]$contentType, [byte[]]$body) {
  $header = "HTTP/1.1 $statusCode $statusText" + $crlf +
            "Content-Type: $contentType" + $crlf +
            "Content-Length: $($body.Length)" + $crlf +
            "Cache-Control: no-cache" + $crlf +
            "Connection: close" + $crlf + $crlf
  $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($hb, 0, $hb.Length)
  $stream.Write($body, 0, $body.Length)
}

$port = Get-AvailablePort 7209 7219
$url = "http://127.0.0.1:$port/"
$listener = New-LoopbackListener $port
$listener.Start()

Write-Host "Web game server started: $url"
Write-Host "Keep this window open while playing."
Start-Process $url

try {
  while ($true) {
    $client = $null
    $stream = $null
    $reader = $null
    try {
      $client = $listener.AcceptTcpClient()
      $stream = $client.GetStream()
      $reader = New-Object -TypeName System.IO.StreamReader -ArgumentList @($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }

      while ($true) {
        $line = $reader.ReadLine()
        if ($null -eq $line -or $line -eq '') { break }
      }

      $parts = $requestLine.Split(' ')
      if ($parts.Count -lt 2 -or $parts[0] -ne 'GET') {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
        Send-Response $stream 405 'Method Not Allowed' 'text/plain; charset=utf-8' $body
        continue
      }

      $rawPath = $parts[1].Split('?')[0]
      try { $rawPath = [System.Uri]::UnescapeDataString($rawPath) } catch {}
      if ([string]::IsNullOrWhiteSpace($rawPath) -or $rawPath -eq '/') { $rawPath = '/index.html' }
      $relative = $rawPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)

      if ($relative.Contains('..')) {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
        Send-Response $stream 403 'Forbidden' 'text/plain; charset=utf-8' $body
        continue
      }

      $full = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
      $rootWithSep = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
      if (-not $full.StartsWith($rootWithSep, [System.StringComparison]::OrdinalIgnoreCase) -and $full -ne (Join-Path $root 'index.html')) {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
        Send-Response $stream 403 'Forbidden' 'text/plain; charset=utf-8' $body
        continue
      }

      if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' $body
        continue
      }

      $body = [System.IO.File]::ReadAllBytes($full)
      $type = Get-ContentType $full
      Send-Response $stream 200 'OK' $type $body
    } catch {
      Write-Host ("Request error: " + $_.Exception.Message)
    } finally {
      if ($reader) { $reader.Dispose() }
      if ($stream) { $stream.Dispose() }
      if ($client) { $client.Dispose() }
    }
  }
} finally {
  $listener.Stop()
}
