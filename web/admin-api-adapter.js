(function () {
  const pageStorageKey = "b2b-erp-admin-current-page";

  function savedPage() {
    const page = localStorage.getItem(pageStorageKey);
    return page && Object.prototype.hasOwnProperty.call(pageLoaders, page) ? page : "dashboard";
  }

  const state = {
    summary: null,
    products: [],
    suppliers: [],
    categories: [],
    brands: [],
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
    permissionTree: [],
    logs: [],
    parameters: {},
    currentPage: "dashboard"
  };

  const pageLoaders = {
    "dashboard": () => load("summary"),
    "product-list": () => load("products"),
    "product-category": () => load("categories"),
    "product-brand": () => load("brands"),
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
    "system-role": () => Promise.all([load("roles"), load("permissionTree")]),
    "system-log": () => load("logs"),
    "system-config": () => load("parameters")
  };

  const endpoints = {
    summary: "/api/admin/summary",
    products: "/api/admin/products",
    suppliers: "/api/admin/suppliers",
    categories: "/api/admin/product-categories",
    brands: "/api/admin/product-brands",
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
    permissionTree: "/api/admin/permissions/tree",
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
      WAIT_AUDIT: "待审核", WAIT_RETURN_RECEIVE: "待卖家收货", WAIT_REFUND: "待退款", REJECTED: "已驳回", SUCCESS: "成功",
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
          <div></div>
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

  function detailTable(headers, rows) {
    return `
      <table>
        <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" style="text-align:center;color:var(--text-help);padding:20px">暂无数据</td></tr>`}
        </tbody>
      </table>
    `;
  }

  function detailGrid(items) {
    return `<div class="mini-card"><div class="detail-grid">${items.map(item => `
      <div><div class="detail-label">${esc(item[0])}</div><div class="detail-val">${item[1]}</div></div>
    `).join("")}</div></div>`;
  }

  function reloadCurrent() {
    const page = state.currentPage || "dashboard";
    return (pageLoaders[page] ? pageLoaders[page]() : Promise.resolve()).then(() => {
      originalOpenPage(page);
      window.showToast("当前页面数据已刷新");
    });
  }

  function openApiDrawer(title, body, footer, wide = false) {
    const mask = document.getElementById("drawerMask");
    const drawer = document.getElementById("drawer");
    const titleEl = document.getElementById("drawerTitle");
    const bodyEl = document.getElementById("drawerBody");
    const footerEl = document.getElementById("drawerFooter");
    if (!mask || !drawer || !titleEl || !bodyEl || !footerEl) {
      throw new Error("后台抽屉容器不存在");
    }
    drawer.classList.toggle("wide", wide);
    titleEl.textContent = title;
    bodyEl.innerHTML = body;
    footerEl.innerHTML = footer;
    mask.style.display = "flex";
  }

  function form(title, fields, onSubmit) {
    const id = "apiForm" + Date.now();
    const body = `
      <form id="${id}" class="form-grid" onsubmit="return false">
        ${fields.map(field => `
          <label class="label ${field.required ? "required" : ""}">${esc(field.label)}</label>
          ${field.type === "select"
            ? `<select class="select" name="${field.name}" ${field.required ? "required" : ""}>${field.options.map(option => `<option value="${esc(option.value)}" ${String(option.value) === String(field.value ?? "") ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select>`
            : field.type === "textarea"
              ? `<textarea class="textarea" name="${field.name}" placeholder="${esc(field.placeholder || "")}" ${field.required ? "required" : ""}>${esc(field.value || "")}</textarea>`
              : `<input class="input" name="${field.name}" type="${field.type || "text"}" value="${esc(field.value || "")}" placeholder="${esc(field.placeholder || "")}" ${field.required ? "required" : ""}>`}
        `).join("")}
      </form>`;
    openApiDrawer(title, body, `<button class="btn" onclick="closeDrawer()">取消</button><button class="btn btn-primary" id="${id}Submit">提交</button>`, fields.length > 4);
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
  state.currentPage = savedPage();

  window.apiRefreshCurrentPage = function () {
    reloadCurrent().catch(error => window.showToast(error.message));
  };

  window.openPage = function (page) {
    state.currentPage = page;
    localStorage.setItem(pageStorageKey, page);
    originalOpenPage(page);
    const loader = pageLoaders[page];
    if (!loader) return;
    loader().then(() => originalOpenPage(page)).catch(error => {
      const content = document.getElementById("content");
      if (content) content.insertAdjacentHTML("afterbegin", `<div class="notice"><span>!</span><div>数据加载失败：${esc(error.message)}</div></div>`);
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
      ${cardTable("待办事项", ["业务模块", "待办事项", "数量", "操作"], todos.map(item => [
        esc(item.module), esc(item.title), esc(item.count), `<button class="btn-text" onclick="openPage('${targetPage(item.target)}')">去处理</button>`
      ]))}
    `;
  };

  function targetPage(target) {
    return ({ purchase: "purchase-order", orders: "order", afterSales: "aftersale", invoices: "invoice" })[target] || "dashboard";
  }

  window.renderProductList = function () {
    return `${pageHeader("商品档案", "商品列表支持商品新增、编辑和上下架。", '<button class="btn btn-primary" onclick="apiCreateProduct()">新增商品</button>')}
      ${filters([{ label: "商品名称", placeholder: "请输入商品名称" }, { label: "商品编码", placeholder: "请输入商品编码" }, { label: "商品状态", type: "select", options: ["全部", "已上架", "已下架"] }])}
      ${cardTable("商品列表", ["商品编码", "商品名称", "SKU", "单位", "销售价", "库存", "起订量", "状态", "操作"], state.products.map(item => [
        esc(item.productCode), esc(item.productName), esc(item.skuCode || item.skuName), esc(item.unit), money(item.salePrice), esc(item.stockQuantity),
        esc(item.minOrderQuantity), tag(item.saleStatus),
        `<button class="btn-text" onclick="apiProductDetail(${item.id})">详情</button> <button class="btn-text" onclick="apiEditProduct(${item.id})">编辑</button> <button class="btn-text" onclick="apiProductSale(${item.id}, '${item.saleStatus === "ON_SALE" ? "off" : "on"}')">${item.saleStatus === "ON_SALE" ? "下架" : "上架"}</button>`
      ]))}`;
  };

  window.apiProductDetail = async function (id) {
    try {
      const item = await api(`/api/admin/products/${id}`);
      openApiDrawer(`商品详情 ${item.productCode || ""}`, `
        <div class="section-title">商品信息</div>
        ${detailGrid([
          ["商品编码", esc(item.productCode)],
          ["商品名称", esc(item.productName)],
          ["SKU编码", esc(item.skuCode)],
          ["SKU名称", esc(item.skuName)],
          ["单位", esc(item.unit)],
          ["销售价", money(item.salePrice)],
          ["库存", esc(item.stockQuantity)],
          ["起订量", esc(item.minOrderQuantity)],
          ["状态", tag(item.saleStatus)]
        ])}
      `, `<button class="btn btn-primary" onclick="closeDrawer()">关闭</button>`, true);
    } catch (error) {
      showToast(error.message);
    }
  };

  window.apiCreateProduct = function () {
    productForm("新增商品", null, data => api("/api/admin/products", { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiEditProduct = function (id) {
    const item = state.products.find(product => Number(product.id) === Number(id));
    if (!item) return showToast("商品数据不存在");
    productForm("编辑商品", item, data => api(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(data) }));
  };

  function productForm(title, item, onSubmit) {
    form(title, [
      { label: "商品名称", name: "productName", value: item?.productName || "", required: true },
      { label: "SKU名称", name: "skuName", value: item?.skuName || "", required: true },
      { label: "单位", name: "unit", value: item?.unit || "件", required: true },
      { label: "销售价", name: "salePrice", type: "number", value: item?.salePrice || "", required: true },
      { label: "库存数量", name: "stockQuantity", type: "number", value: item?.stockQuantity ?? 0, required: true },
      { label: "起订量", name: "minOrderQuantity", type: "number", value: item?.minOrderQuantity || 1, required: true }
    ], onSubmit);
  }

  window.apiProductSale = function (id, action) {
    api(`/api/admin/products/${id}/${action === "on" ? "on-sale" : "off-sale"}`, { method: "PUT" }).then(reloadCurrent).then(() => showToast("商品状态已更新")).catch(error => showToast(error.message));
  };

  window.renderCategory = function () {
    return `${pageHeader("商品分类", "商品分类支持新增、编辑和启停用。", '<button class="btn btn-primary" onclick="apiCreateCategory()">新增分类</button>')}
      ${cardTable("分类列表", ["分类名称", "上级分类", "排序", "状态", "操作"], state.categories.map(item => [
        esc(item.categoryName), esc(item.parentName || "-"), esc(item.sortNo), tag(item.status),
        `<button class="btn-text" onclick="apiEditCategory(${item.id})">编辑</button> <button class="btn-text" onclick="apiCategoryStatus(${item.id}, '${item.status === "ENABLED" ? "DISABLED" : "ENABLED"}')">${item.status === "ENABLED" ? "停用" : "启用"}</button> <button class="btn-text-danger" onclick="apiDeleteCategory(${item.id})">删除</button>`
      ]))}`;
  };

  window.apiCreateCategory = function () {
    categoryForm("新增分类", null, data => api("/api/admin/product-categories", { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiEditCategory = function (id) {
    const item = state.categories.find(category => Number(category.id) === Number(id));
    if (!item) return showToast("分类数据不存在");
    categoryForm("编辑分类", item, data => api(`/api/admin/product-categories/${id}`, { method: "PUT", body: JSON.stringify(data) }));
  };

  function categoryForm(title, item, onSubmit) {
    form(title, [
      { label: "分类名称", name: "categoryName", value: item?.categoryName || "", required: true },
      { label: "上级分类", name: "parentName", value: item?.parentName || "-" },
      { label: "排序", name: "sortNo", type: "number", value: item?.sortNo ?? 10, required: true }
    ], onSubmit);
  }

  window.apiCategoryStatus = function (id, status) {
    api(`/api/admin/product-categories/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }).then(reloadCurrent).then(() => showToast("分类状态已更新")).catch(error => showToast(error.message));
  };

  window.apiDeleteCategory = function (id) {
    if (!confirm("确认删除该分类？")) return;
    api(`/api/admin/product-categories/${id}`, { method: "DELETE" }).then(reloadCurrent).then(() => showToast("分类已删除")).catch(error => showToast(error.message));
  };

  window.renderBrand = function () {
    return `${pageHeader("商品品牌", "商品品牌支持新增、编辑和启停用。", '<button class="btn btn-primary" onclick="apiCreateBrand()">新增品牌</button>')}
      ${cardTable("品牌列表", ["品牌名称", "首字母", "排序", "状态", "操作"], state.brands.map(item => [
        esc(item.brandName), esc(item.firstLetter || "-"), esc(item.sortNo), tag(item.status),
        `<button class="btn-text" onclick="apiEditBrand(${item.id})">编辑</button> <button class="btn-text" onclick="apiBrandStatus(${item.id}, '${item.status === "ENABLED" ? "DISABLED" : "ENABLED"}')">${item.status === "ENABLED" ? "停用" : "启用"}</button> <button class="btn-text-danger" onclick="apiDeleteBrand(${item.id})">删除</button>`
      ]))}`;
  };

  window.apiCreateBrand = function () {
    brandForm("新增品牌", null, data => api("/api/admin/product-brands", { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiEditBrand = function (id) {
    const item = state.brands.find(brand => Number(brand.id) === Number(id));
    if (!item) return showToast("品牌数据不存在");
    brandForm("编辑品牌", item, data => api(`/api/admin/product-brands/${id}`, { method: "PUT", body: JSON.stringify(data) }));
  };

  function brandForm(title, item, onSubmit) {
    form(title, [
      { label: "品牌名称", name: "brandName", value: item?.brandName || "", required: true },
      { label: "首字母", name: "firstLetter", value: item?.firstLetter || "" },
      { label: "排序", name: "sortNo", type: "number", value: item?.sortNo ?? 10, required: true }
    ], onSubmit);
  }

  window.apiBrandStatus = function (id, status) {
    api(`/api/admin/product-brands/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }).then(reloadCurrent).then(() => showToast("品牌状态已更新")).catch(error => showToast(error.message));
  };

  window.apiDeleteBrand = function (id) {
    if (!confirm("确认删除该品牌？")) return;
    api(`/api/admin/product-brands/${id}`, { method: "DELETE" }).then(reloadCurrent).then(() => showToast("品牌已删除")).catch(error => showToast(error.message));
  };

  window.renderSupplier = function () {
    return `${pageHeader("供应商管理", "供应商列表支持新增、编辑和启停用。", '<button class="btn btn-primary" onclick="apiCreateSupplier()">新增供应商</button>')}
      ${cardTable("供应商列表", ["供应商编号", "供应商名称", "联系人", "联系电话", "采购单数", "采购金额", "状态", "操作"], state.suppliers.map(item => [
        esc(item.supplierNo), esc(item.supplierName), esc(item.contactName), esc(item.phone), esc(item.purchaseCount), money(item.purchaseAmount), tag(item.status),
        `<button class="btn-text" onclick="apiSupplierDetail(${item.id})">详情</button> <button class="btn-text" onclick="apiEditSupplier(${item.id})">编辑</button> <button class="btn-text" onclick="apiSupplierStatus(${item.id}, '${item.status === "ENABLED" ? "DISABLED" : "ENABLED"}')">${item.status === "ENABLED" ? "停用" : "启用"}</button> <button class="btn-text-danger" onclick="apiDeleteSupplier(${item.id})">删除</button>`
      ]))}`;
  };

  window.apiSupplierDetail = async function (id) {
    try {
      const item = await api(`/api/admin/suppliers/${id}`);
      openApiDrawer(`供应商详情 ${item.supplierNo || ""}`, `
        <div class="section-title">供应商信息</div>
        ${detailGrid([
          ["供应商编号", esc(item.supplierNo)],
          ["供应商名称", esc(item.supplierName)],
          ["联系人", esc(item.contactName)],
          ["联系电话", esc(item.contactPhone || item.phone)],
          ["地址", esc(item.address || "-")],
          ["采购单数", esc(item.purchaseCount)],
          ["采购金额", money(item.purchaseAmount)],
          ["状态", tag(item.supplierStatus || item.status)]
        ])}
      `, `<button class="btn btn-primary" onclick="closeDrawer()">关闭</button>`, true);
    } catch (error) {
      showToast(error.message);
    }
  };

  window.apiCreateSupplier = function () {
    supplierForm("新增供应商", null, data => api("/api/admin/suppliers", { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiEditSupplier = function (id) {
    const item = state.suppliers.find(supplier => Number(supplier.id) === Number(id));
    if (!item) return showToast("供应商数据不存在");
    supplierForm("编辑供应商", item, data => api(`/api/admin/suppliers/${id}`, { method: "PUT", body: JSON.stringify(data) }));
  };

  function supplierForm(title, item, onSubmit) {
    form(title, [
      { label: "供应商名称", name: "supplierName", value: item?.supplierName || "", required: true },
      { label: "联系人", name: "contactName", value: item?.contactName || "", required: true },
      { label: "联系电话", name: "contactPhone", value: item?.phone || "", required: true },
      { label: "地址", name: "address", type: "textarea", value: item?.address || "" }
    ], onSubmit);
  }

  window.apiSupplierStatus = function (id, status) {
    api(`/api/admin/suppliers/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }).then(reloadCurrent).then(() => showToast("供应商状态已更新")).catch(error => showToast(error.message));
  };

  window.apiDeleteSupplier = function (id) {
    if (!confirm("确认删除该供应商？已发生采购业务的供应商只能停用。")) return;
    api(`/api/admin/suppliers/${id}`, { method: "DELETE" }).then(reloadCurrent).then(() => showToast("供应商已删除")).catch(error => showToast(error.message));
  };

  window.renderPurchaseOrder = function () {
    return `${pageHeader("采购订单", "采购订单支持创建、取消和入库。", '<button class="btn btn-primary" onclick="apiCreatePurchase()">新增采购单</button>')}
      ${cardTable("采购订单列表", ["采购单号", "供应商", "商品", "SKU", "采购数", "已入库", "金额", "预计到货", "状态", "操作"], state.purchaseOrders.map(item => [
        esc(item.purchaseNo), esc(item.supplierName), esc(item.productName), esc(item.skuCode), esc(item.purchaseQty), esc(item.stockedQty), money(item.amount), esc(item.expectedArrivalDate), tag(item.status),
        `<button class="btn-text" onclick="apiPurchaseDetail(${item.id})">详情</button> ${item.status === "WAIT_STOCK_IN" ? `<button class="btn-text" onclick="apiEditPurchase(${item.id})">编辑</button> ` : ""}${item.status !== "COMPLETED" && item.status !== "CANCELLED" ? `<button class="btn-text" onclick="apiStockIn(${item.id})">采购入库</button> <button class="btn-text-danger" onclick="apiCancelPurchase(${item.id})">取消</button>` : ""}`
      ]))}`;
  };

  window.apiPurchaseDetail = async function (id) {
    try {
      const item = await api(`/api/admin/purchase-orders/${id}`);
      openApiDrawer(`采购单详情 ${item.purchaseNo || ""}`, `
        <div class="section-title">采购单信息</div>
        ${detailGrid([
          ["采购单号", esc(item.purchaseNo)],
          ["供应商", esc(item.supplierName)],
          ["商品", esc(item.productName)],
          ["SKU", esc(item.skuCode)],
          ["采购数量", esc(item.purchaseQty)],
          ["已入库", esc(item.stockedQty)],
          ["采购单价", money(item.purchasePrice)],
          ["采购金额", money(item.purchaseAmount)],
          ["预计到货", esc(item.expectedArrivalDate || "-")],
          ["状态", tag(item.purchaseStatus || item.status)],
          ["备注", esc(item.remark || "-")]
        ])}
      `, `<button class="btn btn-primary" onclick="closeDrawer()">关闭</button>`, true);
    } catch (error) {
      showToast(error.message);
    }
  };

  window.apiCreatePurchase = function () {
    Promise.all([load("products"), load("suppliers")]).then(() => purchaseForm("新增采购单", null, data => api("/api/admin/purchase-orders", { method: "POST", body: JSON.stringify(data) })));
  };

  window.apiEditPurchase = function (id) {
    Promise.all([load("products"), load("suppliers")]).then(() => {
      const item = state.purchaseOrders.find(order => Number(order.id) === Number(id));
      if (!item) return showToast("采购单数据不存在");
      purchaseForm("编辑采购单", item, data => api(`/api/admin/purchase-orders/${id}`, { method: "PUT", body: JSON.stringify(data) }));
    });
  };

  function purchaseForm(title, item, onSubmit) {
    form(title, [
      { label: "供应商", name: "supplierId", type: "select", value: item?.supplierId || "", required: true, options: supplierOptions() },
      { label: "采购商品", name: "productId", type: "select", value: item?.targetProductId || item?.productId || "", required: true, options: productOptions() },
      { label: "采购数量", name: "quantity", type: "number", value: item?.purchaseQty || 100, required: true },
      { label: "采购单价", name: "purchasePrice", type: "number", value: item?.purchasePrice || 20, required: true },
      { label: "预计到货日期", name: "expectedArrivalDate", type: "date", value: item?.expectedArrivalDate || "", required: true },
      { label: "备注", name: "remark", type: "textarea", value: item?.remark || "" }
    ], onSubmit);
  }

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
    return `${pageHeader("采购入库记录", "每次入库会生成入库记录，并同步库存流水。")}
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
    return `${pageHeader("库存调整", "提交调整后会写入库存流水。", '<button class="btn btn-primary" onclick="apiInventoryAdjust()">新增调整</button>')}
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
    return `${pageHeader("订单管理", "商城订单展示下单、支付和状态数据。")}
      ${cardTable("订单列表", ["订单编号", "买家", "商品数", "订单金额", "支付状态", "订单状态", "下单时间", "操作"], state.orders.map(item => [
        esc(item.orderNo), esc(item.customerName), esc((item.items || []).length), money(item.totalAmount), tag(item.paymentStatus), tag(item.orderStatus), date(item.createdAt),
        `<button class="btn-text" onclick="apiOrderDetail(${Number(item.id)})">详情</button>${item.orderStatus === "WAIT_SHIP" ? ` <button class="btn-text" onclick="apiShipOrder(${Number(item.id)})">发货</button>` : ""}`
      ]))}`;
  };

  window.apiShipOrder = function (id) {
    form("订单发货", [
      { label: "发货方式", name: "shipmentMethod", type: "select", required: true, options: [{ value: "EXPRESS", label: "快递发货" }, { value: "NO_LOGISTICS", label: "无需物流" }] },
      { label: "物流公司", name: "logisticsCompany", value: "顺丰速运", required: true },
      { label: "物流单号", name: "logisticsNo", value: "SF" + Date.now(), required: true },
      { label: "发货人", name: "operatorName", value: "仓库管理员", required: true },
      { label: "备注", name: "remark", type: "textarea" }
    ], data => api(`/api/admin/orders/${id}/ship`, { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiOrderDetail = async function (id) {
    try {
      const order = await api(`/api/orders/${id}`);
      const items = order.items || [];
      const body = `
        <div class="section-title">订单信息</div>
        <div class="mini-card">
          <div class="detail-grid">
            <div><div class="detail-label">订单编号</div><div class="detail-val">${esc(order.orderNo)}</div></div>
            <div><div class="detail-label">买家</div><div class="detail-val">${esc(order.customerName)}</div></div>
            <div><div class="detail-label">订单金额</div><div class="detail-val">${money(order.totalAmount)}</div></div>
            <div><div class="detail-label">支付方式</div><div class="detail-val">${esc(order.paymentMethod)}</div></div>
            <div><div class="detail-label">支付状态</div><div class="detail-val">${tag(order.paymentStatus)}</div></div>
            <div><div class="detail-label">履约状态</div><div class="detail-val">${tag(order.fulfillmentStatus)}</div></div>
            <div><div class="detail-label">订单状态</div><div class="detail-val">${tag(order.orderStatus)}</div></div>
            <div><div class="detail-label">下单时间</div><div class="detail-val">${date(order.createdAt)}</div></div>
          </div>
        </div>
        <div class="section-title">收货信息</div>
        <div class="mini-card">
          <div class="detail-grid">
            <div><div class="detail-label">收货人</div><div class="detail-val">${esc(order.receiverName)}</div></div>
            <div><div class="detail-label">手机号</div><div class="detail-val">${esc(order.receiverPhone)}</div></div>
            <div><div class="detail-label">收货地址</div><div class="detail-val">${esc(order.receiverAddress)}</div></div>
            <div><div class="detail-label">备注</div><div class="detail-val">${esc(order.remark || "-")}</div></div>
          </div>
        </div>
        <div class="section-title">商品明细</div>
        ${detailTable(["商品", "SKU", "单位", "购买数量", "已发货", "单价", "小计"], items.map(item => [
          esc(item.productName),
          esc(item.skuCode || item.skuName || "-"),
          esc(item.unit),
          esc(item.quantity),
          esc(item.shippedQuantity ?? 0),
          money(item.unitPrice),
          money(item.lineAmount)
        ]))}
        <div class="section-title">发货记录</div>
        <div id="orderShipmentRows">正在加载...</div>
      `;
      openApiDrawer(`订单详情 ${order.orderNo || ""}`, body, `<button class="btn btn-primary" onclick="closeDrawer()">关闭</button>`, true);
      api(`/api/admin/orders/${id}/shipments`).then(rows => {
        const el = document.getElementById("orderShipmentRows");
        if (el) el.innerHTML = detailTable(["发货单号", "方式", "物流公司", "物流单号", "发货人", "时间"], rows.map(row => [
          esc(row.shipmentNo), esc(row.shipmentMethod), esc(row.logisticsCompany), esc(row.logisticsNo), esc(row.operatorName), date(row.createdAt)
        ]));
      }).catch(() => {
        const el = document.getElementById("orderShipmentRows");
        if (el) el.innerHTML = detailTable(["发货记录"], []);
      });
    } catch (error) {
      window.showToast(error.message);
    }
  };

  window.renderAftersale = function () {
    return `${pageHeader("售后申请", "售后申请支持审核和退款处理。")}
      ${cardTable("售后申请列表", ["售后单号", "订单编号", "买家", "类型", "商品", "数量", "退款金额", "状态", "操作"], state.afterSales.map(item => [
        esc(item.afterSaleNo), esc(item.orderNo), esc(item.buyerName), esc(item.type), esc(item.productName), esc(item.quantity), money(item.refundAmount), tag(item.status),
        `<button class="btn-text" onclick="apiAfterSaleDetail(${item.id})">详情</button> ${item.status === "WAIT_AUDIT" ? `<button class="btn-text" onclick="apiAuditAfterSale(${item.id}, true)">审核通过</button> <button class="btn-text-danger" onclick="apiAuditAfterSale(${item.id}, false)">驳回</button>` : ""}${item.status === "WAIT_RETURN_RECEIVE" ? `<button class="btn-text" onclick="apiConfirmReturnReceived(${item.id})">确认收货</button>` : ""}${item.status === "WAIT_REFUND" ? `<button class="btn-text" onclick="apiRefundAfterSale(${item.id})">退款</button>` : ""}`
      ]))}`;
  };

  window.apiAfterSaleDetail = async function (id) {
    try {
      const item = await api(`/api/admin/after-sales/${id}`);
      openApiDrawer(`售后详情 ${item.afterSaleNo || ""}`, `
        <div class="section-title">售后信息</div>
        ${detailGrid([
          ["售后单号", esc(item.afterSaleNo)],
          ["订单编号", esc(item.orderNo)],
          ["买家", esc(item.buyerName)],
          ["类型", esc(item.afterSaleType || item.type)],
          ["商品", esc(item.productName)],
          ["数量", esc(item.quantity)],
          ["退款金额", money(item.refundAmount)],
          ["状态", tag(item.afterSaleStatus || item.status)],
          ["原因", esc(item.reason || "-")],
          ["审核说明", esc(item.auditRemark || "-")]
        ])}
        <div class="section-title">退货物流</div>
        ${detailTable(["物流公司", "物流单号", "备注", "提交时间"], (item.returnLogistics || []).map(row => [
          esc(row.logisticsCompany), esc(row.logisticsNo), esc(row.remark || "-"), date(row.createdAt)
        ]))}
      `, `<button class="btn btn-primary" onclick="closeDrawer()">关闭</button>`, true);
    } catch (error) {
      showToast(error.message);
    }
  };

  window.apiAuditAfterSale = function (id, approved) {
    api(`/api/admin/after-sales/${id}/audit`, { method: "POST", body: JSON.stringify({ approved, remark: approved ? "后台审核通过" : "后台审核驳回" }) }).then(reloadCurrent).then(() => showToast("售后审核已处理")).catch(error => showToast(error.message));
  };

  window.apiRefundAfterSale = function (id) {
    api(`/api/admin/after-sales/${id}/refund`, { method: "POST" }).then(reloadCurrent).then(() => showToast("退款已处理")).catch(error => showToast(error.message));
  };

  window.apiConfirmReturnReceived = function (id) {
    api(`/api/admin/after-sales/${id}/confirm-return-received`, { method: "POST" }).then(reloadCurrent).then(() => showToast("已确认退货收货并回补库存")).catch(error => showToast(error.message));
  };

  window.renderInvoice = function () {
    return `${pageHeader("开票申请", "开票申请支持确认和驳回。")}
      ${cardTable("开票申请列表", ["申请单号", "订单编号", "买家", "发票类型", "抬头类型", "发票抬头", "金额", "状态", "操作"], state.invoices.map(item => [
        esc(item.invoiceApplyNo), esc(item.orderNo), esc(item.buyerName), esc(item.invoiceType), esc(item.titleType), esc(item.title), money(item.amount), tag(item.status),
        `<button class="btn-text" onclick="apiInvoiceDetail(${item.id})">详情</button> ${item.status === "WAIT_INVOICE" ? `<button class="btn-text" onclick="apiUploadInvoiceFile(${item.id})">上传发票</button> <button class="btn-text" onclick="apiOcrInvoice(${item.id})">OCR</button> <button class="btn-text" onclick="apiConfirmInvoice(${item.id})">确认开票</button> <button class="btn-text-danger" onclick="apiRejectInvoice(${item.id})">驳回</button>` : esc(item.invoiceNo || "")}`
      ]))}`;
  };

  window.apiInvoiceDetail = async function (id) {
    try {
      const item = await api(`/api/admin/invoices/${id}`);
      openApiDrawer(`开票详情 ${item.invoiceApplyNo || ""}`, `
        <div class="section-title">开票申请</div>
        ${detailGrid([
          ["申请单号", esc(item.invoiceApplyNo)],
          ["订单编号", esc(item.orderNo)],
          ["买家", esc(item.buyerName)],
          ["发票类型", esc(item.invoiceType)],
          ["抬头类型", esc(item.titleType)],
          ["发票抬头", esc(item.title)],
          ["申请金额", money(item.amount)],
          ["接收邮箱", esc(item.receiveEmail)],
          ["状态", tag(item.status)],
          ["发票号码", esc(item.invoiceNo || "-")],
          ["驳回原因", esc(item.rejectReason || "-")]
        ])}
        <div class="section-title">发票文件</div>
        ${detailTable(["文件名", "发票号码", "类型", "金额", "OCR状态", "OCR结果"], (item.files || []).map(file => [
          esc(file.fileName), esc(file.invoiceNo || "-"), esc(file.invoiceType || "-"), money(file.invoiceAmount), tag(file.ocrStatus), esc(file.ocrResult || "-")
        ]))}
      `, `<button class="btn btn-primary" onclick="closeDrawer()">关闭</button>`, true);
    } catch (error) {
      showToast(error.message);
    }
  };

  window.apiUploadInvoiceFile = function (id) {
    const item = state.invoices.find(row => Number(row.id) === Number(id));
    form("上传发票文件", [
      { label: "文件名称", name: "fileName", value: `invoice-${Date.now()}.pdf`, required: true },
      { label: "发票号码", name: "invoiceNo", value: "FP" + Date.now(), required: true },
      { label: "发票类型", name: "invoiceType", type: "select", required: true, options: [{ value: "E_NORMAL", label: "电子普票" }, { value: "E_SPECIAL", label: "电子专票" }] },
      { label: "开票金额", name: "invoiceAmount", type: "number", value: item?.amount || 0, required: true }
    ], data => api(`/api/admin/invoices/${id}/files`, { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiOcrInvoice = function (id) {
    const item = state.invoices.find(row => Number(row.id) === Number(id));
    api(`/api/admin/invoices/${id}/ocr`, {
      method: "POST",
      body: JSON.stringify({ invoiceAmount: item?.amount || 0, ocrResult: "OCR识别成功，发票号码、金额、类型已回填" })
    }).then(reloadCurrent).then(() => showToast("OCR识别已回填")).catch(error => showToast(error.message));
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
    return `${pageHeader("买家列表", "买家列表展示客户资料。")}
      ${cardTable("买家列表", ["客户ID", "企业名称", "联系人", "联系电话", "创建时间"], buyers.map(item => [
        esc(item.id), esc(item.companyName), esc(item.contactName), esc(item.contactPhone), date(item.createdAt)
      ]))}`;
  };

  window.renderSystemUser = function () {
    return `${pageHeader("后台账号", "后台账号支持新增、编辑和启停用。", '<button class="btn btn-primary" onclick="apiCreateAccount()">新增账号</button>')}
      ${cardTable("后台账号", ["账号", "姓名", "手机号", "角色", "状态", "创建时间", "操作"], state.accounts.map(item => [
        esc(item.accountName), esc(item.realName), esc(item.phone), esc(item.roleName), tag(item.status), date(item.createdAt),
        `<button class="btn-text" onclick="apiEditAccount(${item.id})">编辑</button> <button class="btn-text" onclick="apiResetAccountPassword(${item.id})">重置密码</button> <button class="btn-text" onclick="apiAccountStatus(${item.id}, '${item.status === "ENABLED" ? "DISABLED" : "ENABLED"}')">${item.status === "ENABLED" ? "停用" : "启用"}</button>`
      ]))}`;
  };

  window.apiCreateAccount = function () {
    accountForm("新增后台账号", null, data => api("/api/admin/accounts", { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiEditAccount = function (id) {
    const item = state.accounts.find(account => Number(account.id) === Number(id));
    if (!item) return showToast("账号数据不存在");
    accountForm("编辑后台账号", item, data => api(`/api/admin/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }));
  };

  function accountForm(title, item, onSubmit) {
    const fields = [
      { label: "姓名", name: "realName", value: item?.realName || "", required: true },
      { label: "手机号", name: "phone", value: item?.phone || "", required: true },
      { label: "角色", name: "roleName", value: item?.roleName || "客服人员", required: true }
    ];
    if (!item) {
      fields.unshift({ label: "账号", name: "accountName", required: true });
    }
    form(title, fields, onSubmit);
  }

  window.apiAccountStatus = function (id, status) {
    api(`/api/admin/accounts/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }).then(reloadCurrent).then(() => showToast("账号状态已更新")).catch(error => showToast(error.message));
  };

  window.apiResetAccountPassword = function (id) {
    form("重置密码", [
      { label: "新密码", name: "password", value: "123456", required: true }
    ], data => api(`/api/admin/accounts/${id}/password/reset`, { method: "POST", body: JSON.stringify(data) }));
  };

  window.renderSystemRole = function () {
    return `${pageHeader("角色权限", "角色权限支持新增、编辑和菜单权限配置。", '<button class="btn btn-primary" onclick="apiCreateRole()">新增角色</button>')}
      ${cardTable("角色列表", ["角色名称", "说明", "账号数", "状态", "创建时间", "操作"], state.roles.map(item => [
        esc(item.roleName), esc(item.description), esc(item.accountCount), tag(item.status), date(item.createdAt),
        `<button class="btn-text" onclick="apiConfigureRole(${item.id})">配置权限</button> <button class="btn-text" onclick="apiEditRole(${item.id})">编辑</button>`
      ]))}`;
  };

  window.apiCreateRole = function () {
    roleForm("新增角色", null, data => api("/api/admin/roles", { method: "POST", body: JSON.stringify(data) }));
  };

  window.apiEditRole = function (id) {
    const item = state.roles.find(role => Number(role.id) === Number(id));
    if (!item) return showToast("角色数据不存在");
    roleForm("编辑角色", item, data => api(`/api/admin/roles/${id}`, { method: "PUT", body: JSON.stringify(data) }));
  };

  window.apiConfigureRole = function (id) {
    const item = state.roles.find(role => Number(role.id) === Number(id));
    if (!item) return showToast("角色数据不存在");
    roleForm("配置权限", item, data => api(`/api/admin/roles/${id}`, { method: "PUT", body: JSON.stringify(data) }));
  };

  function roleForm(title, item, onSubmit) {
    const formId = "roleForm" + Date.now();
    const treeId = formId + "PermissionTree";
    const body = `
      <form id="${formId}" class="form-grid" onsubmit="return false">
        <label class="label required">角色名称</label>
        <input class="input" name="roleName" value="${esc(item?.roleName || "")}" placeholder="请输入角色名称" required>
        <label class="label required">角色说明</label>
        <textarea class="textarea" name="roleDesc" placeholder="请输入角色说明" required>${esc(item?.description || "")}</textarea>
      </form>
      ${rolePermissionBlock(treeId, item)}`;
    openApiDrawer(title, body, `<button class="btn" onclick="closeDrawer()">取消</button><button class="btn btn-primary" id="${formId}Submit">提交</button>`, true);
    document.getElementById(formId + "Submit").onclick = async () => {
      const el = document.getElementById(formId);
      if (!el.reportValidity()) return;
      const data = Object.fromEntries(new FormData(el).entries());
      data.permissions = collectRolePermissions(treeId);
      try {
        await onSubmit(data);
        window.closeDrawer();
        window.showToast("角色权限已保存");
        await reloadCurrent();
      } catch (error) {
        window.showToast(error.message);
      }
    };
  }

  function rolePermissionBlock(treeId, item) {
    const tree = rolePermissionTree();
    const selected = selectedRolePermissionKeys(item);
    return `
      <div class="section-title">菜单权限配置</div>
      <div class="permission-tree" id="${treeId}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="color:var(--text-sub)">勾选该角色可访问的一级菜单和二级菜单/操作。</span>
          <span>
            <button type="button" class="btn" onclick="apiSetRolePermissions('${treeId}', true)">全选</button>
            <button type="button" class="btn" onclick="apiSetRolePermissions('${treeId}', false)">清空</button>
          </span>
        </div>
        ${tree.map(row => {
          const module = row.module || "";
          const actions = row.actions || [];
          const moduleChecked = selected.has(permissionKey(module)) || actions.some(action => selected.has(permissionKey(module, action)));
          return `<div class="perm-row">
            <div class="perm-menu"><label class="checkbox"><input type="checkbox" data-perm-module="${esc(module)}" ${moduleChecked ? "checked" : ""} onchange="apiTogglePermissionModule(this)"> ${esc(module)}</label></div>
            <div class="perm-actions">${actions.map(action => `<label class="checkbox"><input type="checkbox" data-perm-action="${esc(action)}" data-perm-parent="${esc(module)}" ${selected.has(permissionKey(module, action)) || selected.size === 0 ? "checked" : ""} onchange="apiSyncPermissionModule(this)"> ${esc(action)}</label>`).join("")}</div>
          </div>`;
        }).join("")}
      </div>`;
  }

  function rolePermissionTree() {
    return Array.isArray(state.permissionTree) && state.permissionTree.length ? state.permissionTree : [
      { module: "商品管理", actions: ["商品档案", "商品分类", "商品品牌"] },
      { module: "采购管理", actions: ["供应商管理", "采购订单", "采购入库记录"] },
      { module: "库存管理", actions: ["库存总览", "库存流水", "库存调整"] },
      { module: "订单管理", actions: ["订单列表", "订单详情", "订单发货"] },
      { module: "售后管理", actions: ["售后申请", "审核", "退款处理"] },
      { module: "开票管理", actions: ["开票申请", "上传发票", "确认开票"] },
      { module: "买家管理", actions: ["买家列表"] },
      { module: "财务管理", actions: ["支付记录", "退款记录"] },
      { module: "系统管理", actions: ["后台账号", "角色权限", "操作日志", "基础配置"] }
    ];
  }

  function selectedRolePermissionKeys(item) {
    const raw = item?.permissionJson || item?.permissionsJson || item?.permissions;
    if (!raw) return allPermissionKeys();
    let permissions = raw;
    if (typeof raw === "string") {
      try {
        permissions = JSON.parse(raw);
      } catch (_) {
        return allPermissionKeys();
      }
    }
    const keys = new Set();
    if (Array.isArray(permissions)) {
      permissions.forEach(row => {
        if (typeof row === "string") {
          keys.add(row);
          return;
        }
        const module = row.module || "";
        if (!module) return;
        keys.add(permissionKey(module));
        (row.actions || []).forEach(action => keys.add(permissionKey(module, action)));
      });
    }
    return keys.size ? keys : allPermissionKeys();
  }

  function allPermissionKeys() {
    const keys = new Set();
    rolePermissionTree().forEach(row => {
      keys.add(permissionKey(row.module));
      (row.actions || []).forEach(action => keys.add(permissionKey(row.module, action)));
    });
    return keys;
  }

  function permissionKey(module, action = "") {
    return action ? `${module}::${action}` : module;
  }

  function collectRolePermissions(treeId) {
    const root = document.getElementById(treeId);
    if (!root) return [];
    return Array.from(root.querySelectorAll(".perm-row")).map(row => {
      const moduleInput = row.querySelector("[data-perm-module]");
      const module = moduleInput ? moduleInput.getAttribute("data-perm-module") : "";
      const actions = Array.from(row.querySelectorAll("[data-perm-action]:checked")).map(input => input.getAttribute("data-perm-action"));
      return moduleInput && (moduleInput.checked || actions.length) ? { module, actions } : null;
    }).filter(Boolean);
  }

  window.apiSetRolePermissions = function (treeId, checked) {
    const root = document.getElementById(treeId);
    if (!root) return;
    root.querySelectorAll("input[type='checkbox']").forEach(input => input.checked = checked);
  };

  window.apiTogglePermissionModule = function (input) {
    const row = input.closest(".perm-row");
    if (!row) return;
    row.querySelectorAll("[data-perm-action]").forEach(action => action.checked = input.checked);
  };

  window.apiSyncPermissionModule = function (input) {
    const row = input.closest(".perm-row");
    if (!row) return;
    const moduleInput = row.querySelector("[data-perm-module]");
    if (moduleInput) moduleInput.checked = Array.from(row.querySelectorAll("[data-perm-action]")).some(action => action.checked);
  };

  window.renderSystemLog = function () {
    return `${pageHeader("操作日志", "关键写操作会写入操作日志。")}
      ${cardTable("操作日志", ["日志编号", "操作人", "模块", "操作", "关联单号", "结果", "时间"], state.logs.map(item => [
        esc(item.logNo), esc(item.operatorName), esc(item.moduleName), esc(item.operationName), esc(item.relatedNo), tag(item.operationResult), date(item.createdAt)
      ]))}`;
  };

  window.renderSystemConfig = function () {
    const params = state.parameters || {};
    return `${pageHeader("基础配置", "基础配置影响支付超时、自动收货、售后期和库存预警。")}
      <div class="config-grid">
        ${Object.entries(params).map(([key, value]) => `<div class="config-card"><div class="config-title">${esc(configLabel(key))}</div><input class="input" data-param="${esc(key)}" value="${esc(value)}"></div>`).join("")}
      </div>
      <div style="margin-top:16px"><button class="btn btn-primary" onclick="apiSaveSystemConfig()">保存配置</button></div>`;
  };

  function configLabel(key) {
    return ({ payTimeoutMinutes: "支付超时时长(分钟)", autoConfirmReceiptDays: "自动确认收货天数", afterSaleDays: "售后期天数", stockWarningThreshold: "库存预警阈值" })[key] || key;
  }

  window.apiSaveSystemConfig = function () {
    const data = {};
    document.querySelectorAll("[data-param]").forEach(input => {
      data[input.getAttribute("data-param")] = input.value;
    });
    api("/api/system/parameters", { method: "PUT", body: JSON.stringify(data) }).then(reloadCurrent).then(() => showToast("基础配置已保存")).catch(error => showToast(error.message));
  };

  setTimeout(() => window.openPage(savedPage()), 0);
})();
