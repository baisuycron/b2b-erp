# B2B ERP Backend

这是 B2B ERP 项目的第一版 Java 后端，使用 Spring Boot 3、Java 21、MySQL 8 和 Flyway。

## 已包含功能

- 客户管理：查询客户、新增客户。
- 商品管理：查询商品、新增商品。
- 销售订单：创建订单、付款、发货、完成订单。
- 库存扣减：创建订单时校验库存并扣减。
- 数据库初始化：首次启动时自动建表并写入少量真实业务种子数据。
- 数据修复：升级到新版本时自动修复一期种子数据中文乱码。

## 运行前准备

服务器上需要已经有：

- Java 21
- Maven 3.9+
- MySQL 8
- 数据库 `b2b_erp`

不要把数据库密码写进代码或提交到 Git。

如果服务器已经跑过旧版本，升级启动时会执行后续迁移脚本修复数据。旧版本已经保存成问号的收货人、收货地址、备注无法自动还原，需要重新创建新订单验证中文输入。

## 本地或服务器启动

在 PowerShell 中执行：

```powershell
$env:DB_USERNAME = "root"
$env:DB_PASSWORD = "你的MySQL密码"
$env:DB_URL = "jdbc:mysql://127.0.0.1:3306/b2b_erp?useUnicode=true&characterEncoding=UTF-8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=Asia/Shanghai"

cd C:\erp\b2b-api-source
java -jar target\b2b-api-0.1.0-SNAPSHOT.jar
```

服务器上也可以用启动脚本，它会提示输入 MySQL 密码，不需要把密码写进文件：

```powershell
cd C:\erp\b2b-api-source
.\scripts\start-server.ps1
```

如果是在仓库源码目录运行，也可以先打包：

```powershell
cd backend
mvn -DskipTests package
java -jar target\b2b-api-0.1.0-SNAPSHOT.jar
```

## 快速验收

服务启动后，打开新的 PowerShell 执行：

```powershell
$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8
Invoke-RestMethod http://127.0.0.1:8080/api/health | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:8080/api/customers | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:8080/api/products | ConvertTo-Json -Depth 5
```

创建一笔测试订单：

```powershell
$body = @{
  customerId = 1
  paymentMethod = "ONLINE_PAY"
  receiverName = "王小禾"
  receiverPhone = "13800010001"
  receiverAddress = "上海市浦东新区测试路 1 号"
  remark = "一期联调测试订单"
  items = @(@{ productId = 1; quantity = 2 })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri http://127.0.0.1:8080/api/orders -Method Post -ContentType "application/json" -Body $body
```

推进订单状态：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8080/api/orders/1/pay -Method Post
Invoke-RestMethod -Uri http://127.0.0.1:8080/api/orders/1/ship -Method Post -ContentType "application/json" -Body '{"logisticsCompany":"顺丰速运","logisticsNo":"SF10000001"}'
Invoke-RestMethod -Uri http://127.0.0.1:8080/api/orders/1/complete -Method Post
```

## 当前一期边界

这一版先把“真实数据库 + 真实订单链路”打通，后面再继续补：

- 登录和权限
- 采购、入库、退货
- 财务收款、发票
- 前端页面对接后端接口
- Windows 服务化部署和 Nginx 反向代理
