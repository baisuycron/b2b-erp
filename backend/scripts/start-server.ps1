param(
  [string]$JarPath = "C:\erp\b2b-api-utf8-fix\target\b2b-api-0.1.0-SNAPSHOT.jar",
  [string]$DbUrl = "jdbc:mysql://127.0.0.1:3306/b2b_erp?useUnicode=true&characterEncoding=UTF-8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=Asia/Shanghai",
  [string]$DbUsername = "root"
)

if (-not (Test-Path -LiteralPath $JarPath)) {
  throw "Jar not found: $JarPath"
}

$securePassword = Read-Host "请输入 MySQL 密码" -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $env:DB_URL = $DbUrl
  $env:DB_USERNAME = $DbUsername
  $env:DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
  java -jar $JarPath
}
finally {
  if ($passwordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  }
}
