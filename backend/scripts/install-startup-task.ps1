$ErrorActionPreference = "Stop"

param(
  [string]$TaskName = "B2B ERP API",
  [string]$DbUsername = "root",
  [string]$DbUrl = "jdbc:mysql://127.0.0.1:3306/b2b_erp?useUnicode=true&characterEncoding=UTF-8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=Asia/Shanghai"
)

$appRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$runtimeDir = Join-Path $appRoot ".runtime"
$envFile = Join-Path $runtimeDir "db.env.ps1"
$runner = Join-Path $appRoot "scripts\run-server-task.ps1"

New-Item -ItemType Directory -Force $runtimeDir | Out-Null

$securePassword = Read-Host "请输入 MySQL 密码，脚本会保存到本机受限配置文件" -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
  $content = @(
    '$env:DB_USERNAME = "' + ($DbUsername -replace '"', '\"') + '"'
    '$env:DB_PASSWORD = "' + ($dbPassword -replace '"', '\"') + '"'
    '$env:DB_URL = "' + ($DbUrl -replace '"', '\"') + '"'
  )
  Set-Content -LiteralPath $envFile -Value $content -Encoding ascii
}
finally {
  if ($passwordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  }
}

icacls $envFile /inheritance:r | Out-Null
icacls $envFile /grant "Administrator:F" /grant "Administrators:F" /grant "SYSTEM:F" | Out-Null

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "Administrator" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Days 365) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Force | Out-Null

$portInUse = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object -First 1

if (-not $portInUse) {
  Start-ScheduledTask -TaskName $TaskName
  Start-Sleep -Seconds 5
} else {
  Write-Host "Port 8080 is already in use. Task is registered but not started."
  Write-Host "Stop the foreground API window, then run: Start-ScheduledTask -TaskName `"$TaskName`""
}

Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State, OwningProcess
