(function () {
  const state = {
    summary: null,
    products: [],
    suppliers: [],
    purchaseOrders: [],
    purchaseStockIns: [],
    inventory: [],
    inventoryFlows: [],
    orders: [],
    afterSales: [],
    invoices: [],
    payments: [],
    refunds: [],
    accounts: [],
    roles: [],
    logs: [],
    parameters: {},
    currentPage: "dashboard"
  };

  const pageLoaders = {
    "dashboard": () => load("summary"),
    "product-list": () => load("products"),
    "supplier": () => load("suppliers"),
    "purchase-order": () => Promise.all([load("purchaseOrders"), load("products"), load("suppliers")]),
    "purchase-inbound": () => load("purchaseStockIns"),
    "stock-overview": () => load("inventory"),
    "stock-flow": () => load("inventoryFlows"),
    "stock-adjust": () => Promise.all([load("inventory"), load("products")]),
    "order": () => load("orders"),
    "aftersale": () => load("afterSales"),
    "invoice": () => load("invoices"),
    "buyer": () => api("/api/customers").then(data => state.buyers = data).catch(() => state.buyers = []),
    "finance-payment": () => load("payments"),
    "finance-refund": () => load("refunds"),
    "system-user": () => load("accounts"),
    "system-role": () => load("roles"),
    "system-log": () => load("logs"),
    "system-config": () => load("parameters")
  };

  const endpoints = {
    summary: "/api/admin/summary",
    products: "/api/admin/products",
    suppliers: "/api/admin/suppliers",
    purchaseOrders: "/api/admin/purchase-orders",
    purchaseStockIns: "/api/admin/purchase-stock-ins",
    inventory: "/api/admin/inventory",
    inventoryFlows: "/api/admin/inventory/flows",
    orders: "/api/admin/orders",
    afterSales: "/api/admin/after-sales",
    invoices: "/api/admin/invoices",
    payments: "/api/admin/finance/payments",
    refunds: "/api/admin/finance/refunds",
    accounts: "/api/admin/accounts",
    roles: "/api/admin/roles",
    logs: "/api/admin/operation-logs",
    parameters: "/api/system/parameters"
  };

  function api(url, options = {}) {
    return fetch(url, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    }).then(async response => {
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new Error((data && data.message) || "接口请求失败");
      }
      return data;
    });
  }

  function load(key) {
    return api(endpoints[key]).then(data => {
      state[key] = data;
      return data;
    });
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, item => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[item]));
  }

  function money(value) {
    const num = Number(value || 0);
    return "¥" + num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function date(value) {
    return value ? String(value).replace("T", " ").slice(0, 16) : "-";
  }

  function statusText(value) {
    const map = {
      ON_SALE: "已上架", OFF_SALE: "已下架",
      ENABLED: "启用", DISABLED: "停用",
      WAIT_STOCK_IN: "待入库", PART_STOCK_IN: "部分入库", COMPLETED: "已完成", CANCELLED: "已取消",
      WAIT_PAY: "待支付", PAID: "已支付", WAIT_SHIP: "待发货", WAIT_RECEIVE: "待收货",
      WAIT_AUDIT: "待审核", WAIT_REFUND: "待退款", REJECTED: "已驳回", SUCCESS: "成功",
      WAIT_INVOICE: "待开票", INVOICED: "已开票",
      NORMAL: "正常", WARNING: "预警"
    };
    return map[value] || value || "-";
  }

  function tag(value) {
    const text = statusText(value);
    const red = ["已驳回", "缺货", "失败"].some(item => text.includes(item));
    const orange = ["待支付", "预警", "待退款"].some(item => text.includes(item));
    const blue = ["待", "部分"].some(item => text.includes(item));
    const gray = ["停用", "已取消", "已下架"].some(item => text.includes(item));
    const cls = red ? "tag-red" : orange ? "tag-orange" : blue ? "tag-blue" : gray ? "tag-gray" : "tag-green";
    return `<span class="tag ${cls}">${esc(text)}</span>`;
  }

  function cardTable(title, headers, rows) {
    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${esc(title)}</div>
          <div style="color:var(--text-help)">实时接口数据</div>
        </div>
        <table>
          <thead><tr>${headers.map(h => `<th ${h === "操作" ? 'style="width:220px"' : ""}>${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" style="text-align:center;color:var(--text-help);padding:28px">暂无数据</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function reloadCurrent() {
    const page = state.currentPage || "dashboard";
    return (pageLoaders[page] ? pageLoaders[page]() : Promise.resolve()).then(() => window.openPage(page));
  }

  function form(title, fields, onSubmit) {
    const id = "apiForm" + Date.now();
    const body = `
      <form id="${id}" class="form-grid" onsubmit="return false">
        ${fields.map(field => `
          <label class="label ${field.required ? "required" : ""}">${esc(field.label)}</label>
          ${field.type === "select"
            ? `<select class="select" name="${field.name}" ${field.required ? "required" : ""}>${field.options.map(option => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join("")}</select>`
            : field.type === "textarea"
              ? `<textarea class="textarea" name="${field.name}" placeholder="${esc(field.placeholder || "")}" ${field.required ? "required" : ""}>${esc(field.value || "")}</textarea>`
              : `<input class="input" name="${field.name}" type="${field.type || "text"}" value="${esc(field.value || "")}" placeholder="${esc(field.placeholder || "")}" ${field.required ? "required" : ""}>`}
        `).join("")}
      </form>`;
    window.openDrawer(title, body, `<button class="btn" onclick="closeDrawer()">取消</button><button class="btn btn-primary" id="${id}Submit">提交</button>`);
    document.getElementById(id + "Submit").onclick = async () => {
      const el = document.getElementById(id);
      if (!el.reportValidity()) return;
      const data = Object.fromEntries(new FormData(el).entries());
      for (const field of fields) {
        if (field.type === "number") data[field.name] = Number(data[field.name]);
      }
      try {
        await onSubmit(data);
        window.closeDrawer();
        window.showToast("操作成功，数据已同步");
        await reloadCurrent();
      } catch (error) {
        window.showToast(error.message);
      }
    };
  }

  function productOptions() {
    return state.products.map(item => ({ value: item.id, label: `${item.productName} / ${item.skuName}` }));
  }

  function supplierOptions() {
    return state.suppliers.map(item => ({ value: item.id, label: item.supplierName }));
  }

  const originalOpenPage = window.openPage;
  window.openPage = function (page) {
    state.currentPage = page;
    originalOpenPage(page);
    const loader = pageLoaders[page];
    if (!loader) return;
    const content = document.getElementById("content");
    if (content) content.insertAdjacentHTML("afterbegin", `<div class="notice" id="apiLoading"><span>API</span><div>正在加载真实接口数据...</div></div>`);
    loader().then(() => originalOpenPage(page)).catch(error => {
      const loading = document.getElementById("apiLoading");
      if (loading) loading.outerHTML = `<div class="notice"><span>API</span><div>接口加载失败：${esc(error.message)}</div></div>`;
    });
  };

  window.renderDashboard = function () {
    const summary = state.summary || {};
    const todos = summary.todoCards || [];
    return `
      <div class="summary-row">
        <div class="summary-card clickable" onclick="openPage('order')"><div class="summary-title">今日订单数</div><div class="summary-val">${esc(summary.todayOrders ?? 0)}</div></div>
        <div class="summary-card clickable" onclick="openPage('finance-payment')"><div class="summary-title">今日支付金额</div><div class="summary-val">${money(summary.todayPaymentAmount)}</div></div>
        <div class="summary-card clickable" onclick="openPage('product-list')"><div class="summary-title">在售SKU</div><div class="summary-val">${esc(summary.saleableSkus ?? 0)}</div></div>
        <div class="summary-card clickable" onclick="openPage('aftersale')"><div class="summary-title">待处理售后</div><div class="summary-val">${esc(summary.pendingAfterSale ?? 0)}</div></div>
      </div>
      <div class="notice"><span>API</span><div>首页统计、待办、库存预警均来自后端实时接口。</div></div>
      ${cardTable("待办事项", ["业务模块", "待办事项", "数量", "操作"], todos.map(item => [
        esc(item.module), esc(item.title), esc(item.count), `<button class="btn-text" onclick="openPage('${targetPage(item.target)}')">去处理</button>`
      ]))}
    `;
  };

  function targetPage(target) {
    return ({ purchase: "purchase-order", orders: "order", afterSales: "aftersale", invoices: "invoice" })[target] || "dashboard";
  }

  window.renderProductList = function () {
    return `${pageHeader("商品档案", "商品列表由 /api/admin/products 实时返回，支持真实上下架。", '<button class="btn btn-primary" onclick="apiCreateProduct()">新增商品</button>')}
      ${filters([{ label: "商品名称", placeholder: "请输入商品名称" }, { label: "商品编码", placeholder: "请输入商品编码" }, { label: "商品状态", type: "select", options: ["全部", "已上架", "已下架"] }])}
      ${cardTable("商品列表", ["商品编码", "商品名称", "SKU", "单位", "销售价", "库存", "起订量", "状态", "操作"], state.products.map(item => [
        esc(item.productCode), esc(item.productName), esc(item.skuCode || item.skuName), esc(item.unit), money(item.salePrice), esc(item.stockQuantity),
        esc(item.minOrderQuantity), tag(item.saleStatus),
        `<button class="btn-text" onclick="apiProductSale(${item.id}, '${item.saleStatus === "ON_SALE" ? "off" : "on"}')">${item.saleStatus === "ON_SALE" ? "下架" : "上架"}</button>`
      ]))}`;
  };

  window.apiCreateProduct = function () {
    form("新增商品", [
      { label: "商品名称", name: "productName", required: true },
      { label: "SKU名称", name: "skuName", required: true },
      { label: "单位", name: "unit", value: "件", required: true },
      { label: "销售价", name: "salePrice", type: "number", required: true },
      { label: "库存数量", name: "stockQuantity", type: "number", required: true },
      { label: "起订量", name: "minOrderQuantity", type: "number", value: 1, required: true }
    ], data => api("/api/admin/products", { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiProductSale = function (id, action) {
    api(`/api/admin/products/${id}/${action === "on" ? "on-sale" : "off-sale"}`, { method: "PUT" }).then(reloadCurrent).then(() => showToast("商品状态已更新")).catch(error => showToast(error.message));
  };

  window.renderSupplier = function () {
    return `${pageHeader("供应商管理", "供应商列表、启停用和新增都已接入真实 API。", '<button class="btn btn-primary" onclick="apiCreateSupplier()">新增供应商</button>')}
      ${cardTable("供应商列表", ["供应商编号", "供应商名称", "联系人", "联系电话", "采购单数", "采购金额", "状态", "操作"], state.suppliers.map(item => [
        esc(item.supplierNo), esc(item.supplierName), esc(item.contactName), esc(item.phone), esc(item.purchaseCount), money(item.purchaseAmount), tag(item.status),
        `<button class="btn-text" onclick="apiSupplierStatus(${item.id}, '${item.status === "ENABLED" ? "DISABLED" : "ENABLED"}')">${item.status === "ENABLED" ? "停用" : "启用"}</button>`
      ]))}`;
  };

  window.apiCreateSupplier = function () {
    form("新增供应商", [
      { label: "供应商名称", name: "supplierName", required: true },
      { label: "联系人", name: "contactName", required: true },
      { label: "联系电话", name: "contactPhone", required: true },
      { label: "地址", name: "address", type: "textarea" }
    ], data => api("/api/admin/suppliers", { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiSupplierStatus = function (id, status) {
    api(`/api/admin/suppliers/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }).then(reloadCurrent).then(() => showToast("供应商状态已更新")).catch(error => showToast(error.message));
  };

  window.renderPurchaseOrder = function () {
    return `${pageHeader("采购订单", "采购订单已接入真实创建、取消、入库接口。", '<button class="btn btn-primary" onclick="apiCreatePurchase()">新增采购单</button>')}
      ${cardTable("采购订单列表", ["采购单号", "供应商", "商品", "SKU", "采购数", "已入库", "金额", "预计到货", "状态", "操作"], state.purchaseOrders.map(item => [
        esc(item.purchaseNo), esc(item.supplierName), esc(item.productName), esc(item.skuCode), esc(item.purchaseQty), esc(item.stockedQty), money(item.amount), esc(item.expectedArrivalDate), tag(item.status),
        `${item.status !== "COMPLETED" && item.status !== "CANCELLED" ? `<button class="btn-text" onclick="apiStockIn(${item.id})">采购入库</button> <button class="btn-text-danger" onclick="apiCancelPurchase(${item.id})">取消</button>` : ""}`
      ]))}`;
  };

  window.apiCreatePurchase = function () {
    Promise.all([load("products"), load("suppliers")]).then(() => form("新增采购单", [
      { label: "供应商", name: "supplierId", type: "select", required: true, options: supplierOptions() },
      { label: "采购商品", name: "productId", type: "select", required: true, options: productOptions() },
      { label: "采购数量", name: "quantity", type: "number", value: 100, required: true },
      { label: "采购单价", name: "purchasePrice", type: "number", value: 20, required: true },
      { label: "预计到货日期", name: "expectedArrivalDate", type: "date", required: true },
      { label: "备注", name: "remark", type: "textarea" }
    ], data => api("/api/admin/purchase-orders", { method: "POST", body: JSON.stringify(data) })));
  };

  window.apiStockIn = function (id) {
    form("采购入库", [
      { label: "本次入库数量", name: "quantity", type: "number", value: 10, required: true },
      { label: "操作人", name: "operatorName", value: "仓库管理员", required: true }
    ], data => api(`/api/admin/purchase-orders/${id}/stock-in`, { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiCancelPurchase = function (id) {
    if (!confirm("确认取消该采购单？")) return;
    api(`/api/admin/purchase-orders/${id}/cancel`, { method: "POST" }).then(reloadCurrent).then(() => showToast("采购单已取消")).catch(error => showToast(error.message));
  };

  window.renderPurchaseInbound = function () {
    return `${pageHeader("采购入库记录", "每次真实入库会生成入库记录，并同步库存流水。")}
      ${cardTable("采购入库记录", ["入库单号", "采购单号", "供应商", "商品", "SKU", "入库数量", "入库金额", "入库人", "入库时间"], state.purchaseStockIns.map(item => [
        esc(item.stockInNo), esc(item.purchaseNo), esc(item.supplierName), esc(item.productName), esc(item.skuCode), esc(item.stockInQty), money(item.stockInAmount), esc(item.operatorName), date(item.createdAt)
      ]))}`;
  };

  window.renderStockOverview = function () {
    return `${pageHeader("库存总览", "库存数量来自商品库存表，预警阈值来自系统参数。", '<button class="btn btn-primary" onclick="apiInventoryAdjust()">库存调整</button>')}
      ${cardTable("库存总览", ["商品", "SKU编码", "实际库存", "冻结库存", "可售库存", "已售数量", "预警值", "状态", "操作"], state.inventory.map(item => [
        esc(item.productName), esc(item.skuCode), esc(item.actualStock), esc(item.occupiedStock), esc(item.saleableStock), esc(item.soldQty), esc(item.warningThreshold), tag(item.inventoryStatus),
        `<button class="btn-text" onclick="openPage('stock-flow')">流水</button> <button class="btn-text" onclick="apiInventoryAdjust(${item.productId})">调整</button>`
      ]))}`;
  };

  window.renderStockFlow = function () {
    return `${pageHeader("库存流水", "采购入库、订单扣减和手工调整都会写入库存流水。")}
      ${cardTable("库存流水", ["商品ID", "变动类型", "变动数量", "变动后库存", "来源单号", "备注", "时间"], state.inventoryFlows.map(item => [
        esc(item.productId), esc(item.movementType), esc(item.quantityChange), esc(item.stockAfter), esc(item.sourceNo), esc(item.remark), date(item.createdAt)
      ]))}`;
  };

  window.renderStockAdjust = function () {
    return `${pageHeader("库存调整", "提交调整会调用 /api/admin/inventory/adjustments 并写入库存流水。", '<button class="btn btn-primary" onclick="apiInventoryAdjust()">新增调整</button>')}
      ${window.renderStockOverview()}`;
  };

  window.apiInventoryAdjust = function (productId) {
    Promise.all([load("products")]).then(() => form("库存调整", [
      { label: "商品", name: "productId", type: "select", required: true, options: productOptions().map(option => ({ ...option, value: option.value })), value: productId || "" },
      { label: "调整数量", name: "quantity", type: "number", value: 1, required: true },
      { label: "调整原因", name: "reason", type: "textarea", required: true }
    ], data => api("/api/admin/inventory/adjustments", { method: "POST", body: JSON.stringify(data) })));
  };

  window.renderOrder = function () {
    return `${pageHeader("订单管理", "商城订单已接入真实下单、支付和状态数据。")}
      ${cardTable("订单列表", ["订单编号", "买家", "商品数", "订单金额", "支付状态", "订单状态", "下单时间", "操作"], state.orders.map(item => [
        esc(item.orderNo), esc(item.customerName), esc((item.items || []).length), money(item.totalAmount), tag(item.paymentStatus), tag(item.orderStatus), date(item.createdAt),
        `<button class="btn-text" onclick="openDetailByPage('订单管理')">详情</button>`
      ]))}`;
  };

  window.renderAftersale = function () {
    return `${pageHeader("售后申请", "售后审核、退款处理已接入真实接口。")}
      ${cardTable("售后申请列表", ["售后单号", "订单编号", "买家", "类型", "商品", "数量", "退款金额", "状态", "操作"], state.afterSales.map(item => [
        esc(item.afterSaleNo), esc(item.orderNo), esc(item.buyerName), esc(item.type), esc(item.productName), esc(item.quantity), money(item.refundAmount), tag(item.status),
        `${item.status === "WAIT_AUDIT" ? `<button class="btn-text" onclick="apiAuditAfterSale(${item.id}, true)">审核通过</button> <button class="btn-text-danger" onclick="apiAuditAfterSale(${item.id}, false)">驳回</button>` : ""}${item.status === "WAIT_REFUND" ? `<button class="btn-text" onclick="apiRefundAfterSale(${item.id})">退款</button>` : ""}`
      ]))}`;
  };

  window.apiAuditAfterSale = function (id, approved) {
    api(`/api/admin/after-sales/${id}/audit`, { method: "POST", body: JSON.stringify({ approved, remark: approved ? "后台审核通过" : "后台审核驳回" }) }).then(reloadCurrent).then(() => showToast("售后审核已处理")).catch(error => showToast(error.message));
  };

  window.apiRefundAfterSale = function (id) {
    api(`/api/admin/after-sales/${id}/refund`, { method: "POST" }).then(reloadCurrent).then(() => showToast("退款已处理")).catch(error => showToast(error.message));
  };

  window.renderInvoice = function () {
    return `${pageHeader("开票申请", "开票确认和驳回已接入真实接口。")}
      ${cardTable("开票申请列表", ["申请单号", "订单编号", "买家", "发票类型", "抬头类型", "发票抬头", "金额", "状态", "操作"], state.invoices.map(item => [
        esc(item.invoiceApplyNo), esc(item.orderNo), esc(item.buyerName), esc(item.invoiceType), esc(item.titleType), esc(item.title), money(item.amount), tag(item.status),
        `${item.status === "WAIT_INVOICE" ? `<button class="btn-text" onclick="apiConfirmInvoice(${item.id})">确认开票</button> <button class="btn-text-danger" onclick="apiRejectInvoice(${item.id})">驳回</button>` : esc(item.invoiceNo || "")}`
      ]))}`;
  };

  window.apiConfirmInvoice = function (id) {
    api(`/api/admin/invoices/${id}/confirm`, { method: "POST" }).then(reloadCurrent).then(() => showToast("开票已确认")).catch(error => showToast(error.message));
  };

  window.apiRejectInvoice = function (id) {
    const reason = prompt("请输入驳回原因", "开票资料不完整");
    if (!reason) return;
    api(`/api/admin/invoices/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }).then(reloadCurrent).then(() => showToast("开票申请已驳回")).catch(error => showToast(error.message));
  };

  window.renderPayment = function () {
    return `${pageHeader("支付记录", "支付记录来自订单支付状态。")}
      ${cardTable("支付记录", ["支付单号", "订单编号", "买家", "支付方式", "金额", "状态", "支付时间"], state.payments.map(item => [
        esc(item.paymentNo), esc(item.orderNo), esc(item.buyerName), esc(item.paymentMethod), money(item.amount), tag(item.paymentStatus), date(item.paidAt)
      ]))}`;
  };

  window.renderRefund = function () {
    return `${pageHeader("退款记录", "退款记录来自售后退款流程。")}
      ${cardTable("退款记录", ["退款单号", "售后单号", "订单编号", "买家", "退款方式", "金额", "状态", "退款时间"], state.refunds.map(item => [
        esc(item.refundNo), esc(item.afterSaleNo), esc(item.orderNo), esc(item.buyerName), esc(item.refundMethod), money(item.amount), tag(item.refundStatus), date(item.refundedAt)
      ]))}`;
  };

  window.renderBuyer = function () {
    const buyers = state.buyers || [];
    return `${pageHeader("买家列表", "买家数据读取客户接口。")}
      ${cardTable("买家列表", ["客户ID", "企业名称", "联系人", "联系电话", "创建时间"], buyers.map(item => [
        esc(item.id), esc(item.companyName), esc(item.contactName), esc(item.contactPhone), date(item.createdAt)
      ]))}`;
  };

  window.renderSystemUser = function () {
    return `${pageHeader("后台账号", "后台账号已接入新增和启停用接口。", '<button class="btn btn-primary" onclick="apiCreateAccount()">新增账号</button>')}
      ${cardTable("后台账号", ["账号", "姓名", "手机号", "角色", "状态", "创建时间", "操作"], state.accounts.map(item => [
        esc(item.accountName), esc(item.realName), esc(item.phone), esc(item.roleName), tag(item.status), date(item.createdAt),
        `<button class="btn-text" onclick="apiAccountStatus(${item.id}, '${item.status === "ENABLED" ? "DISABLED" : "ENABLED"}')">${item.status === "ENABLED" ? "停用" : "启用"}</button>`
      ]))}`;
  };

  window.apiCreateAccount = function () {
    form("新增后台账号", [
      { label: "账号", name: "accountName", required: true },
      { label: "姓名", name: "realName", required: true },
      { label: "手机号", name: "phone", required: true },
      { label: "角色", name: "roleName", value: "客服人员", required: true }
    ], data => api("/api/admin/accounts", { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiAccountStatus = function (id, status) {
    api(`/api/admin/accounts/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }).then(reloadCurrent).then(() => showToast("账号状态已更新")).catch(error => showToast(error.message));
  };

  window.renderSystemRole = function () {
    return `${pageHeader("角色权限", "角色数据已接入真实接口。", '<button class="btn btn-primary" onclick="apiCreateRole()">新增角色</button>')}
      ${cardTable("角色列表", ["角色名称", "说明", "账号数", "状态", "创建时间"], state.roles.map(item => [
        esc(item.roleName), esc(item.description), esc(item.accountCount), tag(item.status), date(item.createdAt)
      ]))}`;
  };

  window.apiCreateRole = function () {
    form("新增角色", [
      { label: "角色名称", name: "roleName", required: true },
      { label: "角色说明", name: "roleDesc", type: "textarea", required: true }
    ], data => api("/api/admin/roles", { method: "POST", body: JSON.stringify(data) }));
  };

  window.renderSystemLog = function () {
    return `${pageHeader("操作日志", "关键写操作会写入操作日志。")}
      ${cardTable("操作日志", ["日志编号", "操作人", "模块", "操作", "关联单号", "结果", "时间"], state.logs.map(item => [
        esc(item.logNo), esc(item.operatorName), esc(item.moduleName), esc(item.operationName), esc(item.relatedNo), tag(item.operationResult), date(item.createdAt)
      ]))}`;
  };

  window.renderSystemConfig = function () {
    const params = state.parameters || {};
    return `${pageHeader("基础配置", "基础配置读取 /api/system/parameters。")}
      <div class="config-grid">
        ${Object.entries(params).map(([key, value]) => `<div class="config-card"><div class="config-title">${esc(key)}</div><input class="input" value="${esc(value)}" readonly></div>`).join("")}
      </div>`;
  };

  setTimeout(() => window.openPage(state.currentPage || "dashboard"), 0);
})();
