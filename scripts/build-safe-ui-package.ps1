$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$adminIndex = Join-Path $root ".tools\server-index-restored.html"
$adminAdapter = Join-Path $root ".tools\server-admin-api-adapter.js"
$mallHtml = Join-Path $root "web\mall.html"
$miniHtml = Join-Path $root "web\mini.html"
$commerceAdapter = Join-Path $root "web\commerce-api-adapter.js"
$packageDir = Join-Path $root ".tools\ui-safe-package"
$zip = Join-Path $root ".tools\ui-only-deploy\ui-only.zip"

function Require-File($path) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Required deployment source file is missing: $path"
  }
}

function Require-Marker($content, $marker, $label) {
  if (-not $content.Contains($marker)) {
    throw "$label is missing required marker: $marker"
  }
}

function Forbid-Marker($content, $marker, $label) {
  if ($content.Contains($marker)) {
    throw "$label contains forbidden marker: $marker"
  }
}

Require-File $adminIndex
Require-File $adminAdapter
Require-File $mallHtml
Require-File $miniHtml
Require-File $commerceAdapter

$adminIndexText = Get-Content -Raw -Encoding UTF8 $adminIndex
$adminAdapterText = Get-Content -Raw -Encoding UTF8 $adminAdapter
$mallText = Get-Content -Raw -Encoding UTF8 $mallHtml
$miniText = Get-Content -Raw -Encoding UTF8 $miniHtml
$commerceText = Get-Content -Raw -Encoding UTF8 $commerceAdapter
$cancelledText = -join ([char]0x5DF2, [char]0x53D6, [char]0x6D88)
$invoiceTitleText = -join ([char]0x53D1, [char]0x7968, [char]0x62AC, [char]0x5934)
$connectionToastText = -join (
  [char]0x5DF2, [char]0x8FDE, [char]0x63A5, [char]0x540E, [char]0x7AEF,
  [char]0x5546, [char]0x57CE, [char]0x63A5, [char]0x53E3
)

Require-Marker $adminIndexText "admin-api-adapter.js" "admin index"
Require-Marker $adminIndexText "product-category" "admin index"
Require-Marker $adminIndexText "adminLogout" "admin index"
Require-Marker $adminAdapterText "dashboardTrend" "admin adapter"
Require-Marker $adminAdapterText "apiSetDashboardRange" "admin adapter"

Require-Marker $mallText $cancelledText "mall page"
Require-Marker $mallText $invoiceTitleText "mall page"
Require-Marker $miniText $cancelledText "mini page"
Require-Marker $miniText $invoiceTitleText "mini page"
Require-Marker $commerceText "CANCELLED" "commerce adapter"
Forbid-Marker $commerceText $connectionToastText "commerce adapter"

if (Test-Path -LiteralPath $packageDir) {
  Remove-Item -LiteralPath $packageDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $zip) | Out-Null

Copy-Item -LiteralPath $adminIndex -Destination (Join-Path $packageDir 'index.html') -Force
Copy-Item -LiteralPath $adminIndex -Destination (Join-Path $packageDir 'admin.html') -Force
Copy-Item -LiteralPath $adminAdapter -Destination (Join-Path $packageDir 'admin-api-adapter.js') -Force
Copy-Item -LiteralPath $mallHtml -Destination (Join-Path $packageDir 'mall.html') -Force
Copy-Item -LiteralPath $miniHtml -Destination (Join-Path $packageDir 'mini.html') -Force
Copy-Item -LiteralPath $commerceAdapter -Destination (Join-Path $packageDir 'commerce-api-adapter.js') -Force

if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}
$archivePath = Join-Path $packageDir '*'
Compress-Archive -Path $archivePath -DestinationPath $zip -Force

Get-Item -LiteralPath $zip | Select-Object FullName, Length, LastWriteTime
