param(
  [string]$TaskName = "B2B ERP API"
)

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Where-Object { $_.CommandLine -like "*b2b-api-0.1.0-SNAPSHOT.jar*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
