# B2B ERP API Runbook

## Start in foreground

```powershell
cd C:\erp\b2b-api-utf8-fix
.\scripts\start-server.ps1
```

Keep this PowerShell window open while the API is running.

## Smoke test

Open another PowerShell window:

```powershell
cd C:\erp\b2b-api-utf8-fix
.\scripts\smoke-test.ps1
```

Expected:

- `/api/health` returns `UP`
- `/api/customers` returns seeded customers
- `/api/products` returns seeded products

## Install background startup task

This stores the MySQL password in a local restricted file:

```powershell
cd C:\erp\b2b-api-utf8-fix
.\scripts\install-startup-task.ps1
```

Task name:

```text
B2B ERP API
```

Manual task commands:

```powershell
Start-ScheduledTask -TaskName "B2B ERP API"
Stop-ScheduledTask -TaskName "B2B ERP API"
Get-ScheduledTask -TaskName "B2B ERP API"
```

## Logs

```powershell
Get-Content C:\erp\b2b-api-utf8-fix\.runtime\logs\b2b-api.out.log -Tail 80
Get-Content C:\erp\b2b-api-utf8-fix\.runtime\logs\b2b-api.err.log -Tail 80
```

## Uninstall background task

```powershell
cd C:\erp\b2b-api-utf8-fix
.\scripts\uninstall-startup-task.ps1
```
