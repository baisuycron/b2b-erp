$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8

Invoke-RestMethod http://127.0.0.1:8080/api/health | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:8080/api/customers | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:8080/api/products | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:8080/api/admin/products | ConvertTo-Json -Depth 5
