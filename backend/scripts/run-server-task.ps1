$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$runtimeDir = Join-Path $appRoot ".runtime"
$envFile = Join-Path $runtimeDir "db.env.ps1"
$logDir = Join-Path $runtimeDir "logs"
$jarPath = Join-Path $appRoot "target\b2b-api-0.1.0-SNAPSHOT.jar"

if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Missing runtime env file: $envFile"
}

if (-not (Test-Path -LiteralPath $jarPath)) {
  throw "Missing jar: $jarPath"
}

New-Item -ItemType Directory -Force $logDir | Out-Null
. $envFile

$stdoutLog = Join-Path $logDir "b2b-api.out.log"
$stderrLog = Join-Path $logDir "b2b-api.err.log"

Set-Location $appRoot
java -jar $jarPath 1>> $stdoutLog 2>> $stderrLog
