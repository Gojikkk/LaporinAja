param([switch]$CheckOnly)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $root "backend\.env"
$frontendDir = Join-Path $root "frontend"
$viteEntry = Join-Path $frontendDir "node_modules\vite\bin\vite.js"
$project = "laporinaja-preview"
$startedProcesses = @()
$composeStarted = $false
$logPrefix = Join-Path $env:TEMP ("laporinaja-staging-" + [guid]::NewGuid().ToString("N"))

function Invoke-Compose {
  param([string[]]$ComposeArgs)
  & docker compose -p $project --env-file $envFile @ComposeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose gagal (exit code $LASTEXITCODE)."
  }
}

function Test-PortAvailable {
  param([int]$Port)
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
  try {
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    $listener.Stop()
  }
}

function Find-FreePort {
  param([int]$First, [int]$Last)
  for ($port = $First; $port -le $Last; $port++) {
    if (Test-PortAvailable -Port $port) {
      return $port
    }
  }
  throw "Tidak menemukan port kosong antara $First dan $Last."
}

function Get-EnvValue {
  param([string]$Path, [string]$Name)
  if (!(Test-Path $Path)) {
    return ""
  }
  $pattern = "^\s*" + [regex]::Escape($Name) + "\s*="
  $line = Get-Content $Path | Where-Object { $_ -match $pattern } | Select-Object -Last 1
  if (!$line) {
    return ""
  }
  return ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
}

function Find-Cloudflared {
  $command = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $packageRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
  $installed = Get-ChildItem $packageRoot -Directory -Filter "Cloudflare.cloudflared*" -ErrorAction SilentlyContinue |
    ForEach-Object { Get-ChildItem $_.FullName -Filter "cloudflared.exe" -ErrorAction SilentlyContinue } |
    Select-Object -First 1
  if ($installed) {
    return $installed.FullName
  }
  return $null
}

function New-StagingAdminPassword {
  $bytes = New-Object byte[] 36
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Read-StagingAdminPassword {
  param([switch]$CreateIfMissing)
  $credentialDir = Join-Path $env:LOCALAPPDATA "LaporinAja"
  $credentialFile = Join-Path $credentialDir "staging-admin-password.txt"
  if (Test-Path $credentialFile) {
    return (Get-Content $credentialFile -Raw).Trim()
  }
  if (!$CreateIfMissing) {
    throw "File password admin staging tidak ada, padahal database sudah berisi data. Jangan reset otomatis; periksa $credentialFile."
  }

  New-Item -ItemType Directory -Path $credentialDir -Force | Out-Null
  $password = New-StagingAdminPassword
  Set-Content -Path $credentialFile -Value $password -NoNewline
  return $password
}

function Remove-StagingLogs {
  Get-ChildItem "$logPrefix-*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

Push-Location $root
try {
  if (!(Test-Path $envFile)) {
    throw "File backend\.env tidak ditemukan. Lengkapi environment lokal terlebih dahulu."
  }
  if (!(Test-Path $viteEntry)) {
    throw "Dependency frontend belum terpasang. Jalankan npm install di folder frontend."
  }

  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (!$docker) {
    throw "Docker belum terpasang. Install dan buka Docker Desktop terlebih dahulu."
  }
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (!$node) {
    throw "Node.js belum terpasang."
  }
  $cloudflared = Find-Cloudflared
  if (!$cloudflared) {
    throw "cloudflared belum terpasang. Install dengan: winget install --id Cloudflare.cloudflared"
  }

  if ($CheckOnly) {
    if (!(Test-PortAvailable -Port 5173)) {
      throw "Port 5173 sedang dipakai. Hentikan frontend yang memakai port itu, lalu jalankan lagi."
    }
    docker info --format "{{.ServerVersion}}" 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Docker Desktop belum berjalan."
    }
    Write-Host "Setup siap: Docker, Node.js, cloudflared, environment, dan port 5173 tersedia."
    return
  }

  $dockerDesktop = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\Docker Desktop.exe"
  docker info --format "{{.ServerVersion}}" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    if (!(Test-Path $dockerDesktop)) {
      throw "Docker Desktop ditemukan tidak berjalan dan file aplikasinya tidak ditemukan."
    }
    Write-Host "Menyalakan Docker Desktop..."
    Start-Process -FilePath $dockerDesktop
    $dockerReady = $false
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Seconds 2
      docker info --format "{{.ServerVersion}}" 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        $dockerReady = $true
        break
      }
    }
    if (!$dockerReady) {
      throw "Docker Desktop belum siap. Buka Docker Desktop, tunggu sampai berjalan, lalu coba lagi."
    }
  }

  if (!(Test-PortAvailable -Port 5173)) {
    throw "Port 5173 sedang dipakai. Hentikan frontend yang memakai port itu, lalu jalankan lagi."
  }

  $apiPort = Find-FreePort -First 3001 -Last 3010
  $dbPort = Find-FreePort -First 55432 -Last 55450
  $env:POSTGRES_PORT = [string]$dbPort
  $env:API_PUBLISHED_PORT = [string]$apiPort
  $env:CLOUDINARY_FOLDER = "laporinaja-staging"
  Write-Host "Menyalakan database staging terpisah..."
  Invoke-Compose -ComposeArgs @("up", "-d", "db")
  $composeStarted = $true

  $env:VITE_API_URL = "/api"
  $env:VITE_CSRF_COOKIE_NAME = "laporinaja_csrf"
  $env:VITE_CSRF_ENDPOINT = ""
  $env:VITE_GOOGLE_CLIENT_ID = Get-EnvValue -Path $envFile -Name "GOOGLE_CLIENT_ID"
  $env:API_PROXY_TARGET = "http://127.0.0.1:$apiPort"
  $viteOut = "$logPrefix-vite.out"
  $viteErr = "$logPrefix-vite.err"
  $viteProcess = Start-Process -FilePath (Get-Command node).Source `
    -ArgumentList "`"$viteEntry`" --host 0.0.0.0 --strictPort" `
    -WorkingDirectory $frontendDir -PassThru `
    -RedirectStandardOutput $viteOut -RedirectStandardError $viteErr
  $startedProcesses += $viteProcess.Id

  $viteReady = $false
  for ($i = 0; $i -lt 40; $i++) {
    if ($viteProcess.HasExited) {
      throw "Frontend berhenti saat startup. Periksa log: $viteErr"
    }
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        $viteReady = $true
        break
      }
    } catch {}
    Start-Sleep -Seconds 1
  }
  if (!$viteReady) {
    throw "Frontend tidak siap di port 5173. Periksa log: $viteErr"
  }

  $tunnelOut = "$logPrefix-tunnel.out"
  $tunnelErr = "$logPrefix-tunnel.err"
  $tunnelProcess = Start-Process -FilePath $cloudflared `
    -ArgumentList "tunnel --no-autoupdate --url http://127.0.0.1:5173" `
    -PassThru -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr
  $startedProcesses += $tunnelProcess.Id

  $publicUrl = $null
  for ($i = 0; $i -lt 60; $i++) {
    if ($tunnelProcess.HasExited) {
      throw "Cloudflare Tunnel berhenti saat startup. Periksa log: $tunnelErr"
    }
    $tunnelLogs = ""
    if (Test-Path $tunnelOut) { $tunnelLogs += Get-Content $tunnelOut -Raw }
    if (Test-Path $tunnelErr) { $tunnelLogs += Get-Content $tunnelErr -Raw }
    if ($tunnelLogs -match "https://[a-z0-9-]+\.trycloudflare\.com") {
      $publicUrl = $matches[0]
      break
    }
    Start-Sleep -Seconds 1
  }
  if (!$publicUrl) {
    throw "URL Cloudflare Tunnel tidak muncul. Periksa log: $tunnelErr"
  }

  $env:FRONTEND_ORIGINS = $publicUrl
  $env:SESSION_COOKIE_SECURE = "true"
  $env:SESSION_COOKIE_SAME_SITE = "lax"
  Write-Host "Menyalakan API staging dan menjalankan migrasi..."
  Invoke-Compose -ComposeArgs @("up", "-d", "--build", "api")

  $apiReady = $false
  for ($i = 0; $i -lt 90; $i++) {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:$apiPort/health" -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        $apiReady = $true
        break
      }
    } catch {}
    Start-Sleep -Seconds 2
  }
  if (!$apiReady) {
    Invoke-Compose -ComposeArgs @("logs", "--tail", "60", "api")
    throw "API belum siap. Log di atas menunjukkan penyebabnya."
  }

  $userCountText = & docker compose -p $project --env-file $envFile exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM users"'
  if ($LASTEXITCODE -ne 0) {
    throw "Gagal memeriksa database staging."
  }
  $userCount = [int]("$userCountText".Trim())
  if ($userCount -eq 0) {
    $adminPassword = Read-StagingAdminPassword -CreateIfMissing
    Write-Host "Menyiapkan data demo untuk database yang masih kosong..."
    Invoke-Compose -ComposeArgs @("exec", "-T", "-e", "ADMIN_DEMO_PASSWORD=$adminPassword", "api", "npm", "run", "db:seed")
  } else {
    $adminPassword = Read-StagingAdminPassword
  }

  Write-Host ""
  Write-Host "Preview staging aktif: $publicUrl"
  Write-Host "Akun admin staging: admin@demo.test"
  Write-Host "Password admin staging: $adminPassword"
  Write-Host "Password admin disimpan di: $env:LOCALAPPDATA\LaporinAja\staging-admin-password.txt"
  Write-Host "Jangan bagikan password admin atau gunakan data pribadi."
  Write-Host ""
  Write-Host "Biarkan jendela ini tetap terbuka. Tekan Ctrl+C untuk menghentikan tunnel dan preview."

  while (!$viteProcess.HasExited -and !$tunnelProcess.HasExited) {
    Start-Sleep -Seconds 3
  }
  if ($viteProcess.HasExited) {
    throw "Frontend berhenti. Jalankan ulang Start-Staging.bat."
  }
  throw "Cloudflare Tunnel berhenti. Jalankan ulang Start-Staging.bat untuk mendapat URL baru."
} catch {
  Write-Host ""
  Write-Host $_
  Get-ChildItem "$logPrefix-*" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "--- $($_.Name) ---"
    Get-Content $_.FullName -Tail 30 -ErrorAction SilentlyContinue
  }
  throw
} finally {
  foreach ($processId in $startedProcesses) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
  if ($composeStarted) {
    docker compose -p $project --env-file $envFile down --remove-orphans 2>$null | Out-Null
  }
  Remove-StagingLogs
  Pop-Location
}
