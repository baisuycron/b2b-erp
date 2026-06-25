(function () {
  let pendingOrderId = null;
  let selectedOrderId = null;
  let mallAddresses = [];
  let buyerProfileData = null;
  let adapterPayMethod = "wechat";
  let adapterCategories = [];
  let adapterBrands = [];

  const isMini = typeof currentPage !== "undefined" && typeof render === "function";
  const allCategoryLabel = isMini ? "全部" : "全部分类";
  const allBrandLabel = "全部品牌";

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

  function toast(message) {
    if (typeof showToast === "function") showToast(message);
  }

  function money(value) {
    return "¥" + Number(value || 0).toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function numericMoney(text) {
    return Number(String(text || "0").replace(/[^\d.]/g, "")) || 0;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function jsArg(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  function spliceArray(targetName, values) {
    try {
      const target = eval(targetName);
      target.splice(0, target.length, ...values);
    } catch (_) {}
  }

  function categoryNames() {
    try {
      return mallCategories;
    } catch (_) {
      return adapterCategories;
    }
  }

  function brandNames() {
    try {
      return mallBrands;
    } catch (_) {
      return adapterBrands;
    }
  }

  function currentPayMethod() {
    try {
      return selectedPayMethod || adapterPayMethod;
    } catch (_) {
      return adapterPayMethod;
    }
  }

  function setPayMethod(method) {
    adapterPayMethod = method || "wechat";
    try {
      selectedPayMethod = adapterPayMethod;
    } catch (_) {}
  }

  function repaint(page) {
    if (isMini) {
      if (page) currentPage = page;
      render();
      return;
    }
    if (page && typeof go === "function") {
      go(page);
      return;
    }
    try {
      if (typeof pageEl !== "undefined") pageEl.innerHTML = renderHome();
    } catch (_) {}
  }

  function setCurrentProduct(product) {
    try {
      currentProduct = product || products[0] || null;
      if (currentProduct && typeof initDetailSpecQtyMap === "function") {
        initDetailSpecQtyMap(currentProduct);
        const min = Math.max(1, Number(currentProduct.minOrderQuantity || 1));
        if (typeof detailSpecQtyMap !== "undefined" && currentProduct.specs[0]) {
          detailSpecQtyMap[0] = Math.min(currentProduct.specs[0].stock, min);
        }
      }
      if (currentProduct && typeof initSpecQty === "function") {
        initSpecQty(currentProduct);
        const min = Math.max(1, Number(currentProduct.minOrderQuantity || 1));
        if (typeof specQtyMap !== "undefined" && currentProduct.specs[0]) {
          specQtyMap[0] = Math.min(currentProduct.specs[0].stock, min);
        }
      }
    } catch (_) {}
  }

  function enabledNames(rows, key) {
    return rows
      .filter(item => String(item.status || "").toUpperCase() === "ENABLED")
      .map(item => item[key])
      .filter(Boolean);
  }

  function productFromApi(item) {
    const price = Number(item.salePrice || 0);
    const stock = Number(item.stockQuantity || 0);
    const brand = item.brandName || item.brand || "B2B";
    const category = item.categoryName || item.category || "后台商品";
    const saleMode = item.saleMode === "BATCH" ? "BATCH" : "NORMAL";
    const saleUnit = String(item.saleUnit || "").trim();
    const baseUnit = item.unit || "件";
    const displayUnit = saleMode === "BATCH" && saleUnit ? saleUnit : baseUnit;
    return {
      id: String(item.id),
      apiId: Number(item.id),
      name: item.productName || item.name || "未命名商品",
      brand,
      category,
      unit: displayUnit,
      baseUnit,
      saleMode,
      saleUnit,
      saleUnitRatio: Number(item.saleUnitRatio || 0) || null,
      code: item.productCode || item.skuCode || "",
      quoteType: "规格独立报价",
      priceText: money(price),
      tags: ["后端商品", item.saleStatus === "ON_SALE" ? "已上架" : "已下架"],
      stock,
      minOrderQuantity: Number(item.minOrderQuantity || 1),
      specs: [{
        name: item.skuName || item.productName || "默认规格",
        sku: item.skuCode || item.productCode || "",
        stock,
        price,
        minOrderQuantity: Number(item.minOrderQuantity || 1)
      }],
      tiers: [],
      desc: "该商品来自后端商品档案，价格、库存和上下架状态实时同步。"
    };
  }

  function ensureProductFromCart(item) {
    const productId = String(item.productId);
    let product = products.find(row => String(row.id) === productId);
    if (!product) {
      product = productFromApi({
        id: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        skuName: item.skuName,
        skuCode: item.skuCode,
        salePrice: item.salePrice,
        stockQuantity: item.stockQuantity,
        saleStatus: item.saleStatus,
        unit: item.unit
      });
      products.push(product);
    }
    return product;
  }

  function cartFromApi(item) {
    ensureProductFromCart(item);
    return {
      cartItemId: String(item.cartItemId),
      productId: String(item.productId),
      specIndex: 0,
      qty: Number(item.quantity || 1),
      checked: item.checked !== false
    };
  }

  function statusKey(order) {
    if (order.orderStatus === "WAIT_PAY") return "pendingPayment";
    if (order.orderStatus === "WAIT_SHIP") return "pendingShipment";
    if (order.orderStatus === "WAIT_RECEIVE") return "pendingReceipt";
    if (order.orderStatus === "COMPLETED") return "completed";
    if (order.orderStatus === "CANCELLED") return "cancelled";
    return "all";
  }

  function statusLabel(order) {
    const map = {
      WAIT_PAY: "待支付",
      WAIT_SHIP: "待发货",
      WAIT_RECEIVE: "待收货",
      COMPLETED: "已完成",
      CANCELLED: "已取消"
    };
    return map[order.orderStatus] || order.orderStatus || "-";
  }

  function payLabel(order) {
    if (order.paymentStatus === "PAID") return "已支付";
    if (order.paymentStatus === "NOT_REQUIRED_BEFORE_RECEIPT") return "后付款";
    return "未支付";
  }

  function tagByKey(key) {
    if (key === "completed") return "green";
    if (key === "pendingPayment") return "orange";
    if (key === "cancelled") return "gray";
    return "blue";
  }

  function orderActions(key) {
    if (key === "pendingPayment") return ["详情", "去支付"];
    if (key === "pendingReceipt") return ["详情", "确认收货"];
    if (key === "completed") return ["详情", "申请开票"];
    if (key === "cancelled") return ["详情"];
    return ["详情"];
  }

  function pcOrderFromApi(order) {
    const key = statusKey(order);
    const paid = order.paymentStatus === "PAID";
    const items = order.items || [];
    return {
      id: order.orderNo,
      apiId: Number(order.id),
      goodsCount: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      amount: money(order.totalAmount),
      payLabel: payLabel(order),
      payTag: paid ? "green" : "orange",
      shipLabel: statusLabel(order),
      shipTag: tagByKey(key),
      statusKey: key,
      key,
      statusLabel: statusLabel(order),
      statusTag: tagByKey(key),
      orderTime: String(order.createdAt || "").replace("T", " ").slice(0, 16),
      actions: orderActions(key),
      receiverName: order.receiverName || "",
      receiverPhone: order.receiverPhone || "",
      receiverAddress: order.receiverAddress || "",
      paymentMethod: order.paymentMethod || "ONLINE_PAY",
      paymentMethodLabel: paid ? payMethodLabel(currentPayMethod()) : "-",
      paidAt: paid ? String(order.updatedAt || "").replace("T", " ").slice(0, 16) : "-",
      raw: order,
      items
    };
  }

  function miniOrderFromApi(order) {
    const pc = pcOrderFromApi(order);
    const first = pc.items[0] || {};
    return {
      ...pc,
      goods: first.productName ? `${first.productName}${pc.items.length > 1 ? ` 等${pc.items.length}件` : ""}` : "订单商品",
      status: pc.statusLabel,
      pay: pc.payLabel,
      ship: pc.shipLabel,
      time: pc.orderTime
    };
  }

  function titleFromApi(item) {
    return {
      id: String(item.id),
      type: item.titleType === "PERSONAL" ? "personal" : "company",
      title: item.title || item.invoiceTitle || "",
      taxNo: item.taxNo || "",
      registerAddress: item.registerAddress || item.address || "",
      registerPhone: item.registerPhone || item.phone || "",
      bankName: item.bankName || item.bank || "",
      bankAccount: item.bankAccount || item.account || "",
      address: item.registerAddress || item.address || "",
      phone: item.registerPhone || item.phone || "",
      bank: item.bankName || item.bank || "",
      account: item.bankAccount || item.account || "",
      email: item.receiveEmail || item.email || "",
      isDefault: Boolean(item.isDefault)
    };
  }

  function addressFromApi(item) {
    return {
      id: String(item.id),
      receiverName: item.receiverName || "",
      receiverPhone: item.receiverPhone || "",
      region: item.region || "",
      detailAddress: item.detailAddress || "",
      fullAddress: item.fullAddress || `${item.region || ""} ${item.detailAddress || ""}`.trim(),
      isDefault: Boolean(item.isDefault)
    };
  }

  async function hydrateTaxonomy() {
    const [categoryRows, brandRows] = await Promise.all([
      api("/api/admin/product-categories"),
      api("/api/admin/product-brands")
    ]);
    adapterCategories = enabledNames(categoryRows, "categoryName");
    adapterBrands = enabledNames(brandRows, "brandName");
    try {
      mallCategories.splice(0, mallCategories.length, ...adapterCategories);
      if (typeof currentCategory !== "undefined" && currentCategory !== allCategoryLabel && !mallCategories.includes(currentCategory)) {
        currentCategory = allCategoryLabel;
      }
    } catch (_) {}
    try {
      mallBrands.splice(0, mallBrands.length, ...adapterBrands);
      if (typeof currentBrand !== "undefined" && currentBrand !== allBrandLabel && !mallBrands.includes(currentBrand)) {
        currentBrand = allBrandLabel;
      }
    } catch (_) {}
  }

  async function hydrateProducts() {
    const rows = await api("/api/mall/products");
    const mapped = rows.map(productFromApi);
    products.splice(0, products.length, ...mapped);
    setCurrentProduct(products[0] || null);
  }

  async function hydrateCart() {
    const data = await api("/api/mall/cart");
    const mapped = (data.items || []).map(cartFromApi);
    cart.splice(0, cart.length, ...mapped);
    if (typeof updateCartCount === "function") updateCartCount();
    if (typeof updateCartBadge === "function") updateCartBadge();
  }

  async function hydrateOrders() {
    const rows = await api("/api/mall/orders");
    const pcRows = rows.map(pcOrderFromApi);
    spliceArray("ordersData", pcRows);
    spliceArray("orders", rows.map(miniOrderFromApi));
    if (pendingOrderId) {
      const found = pcRows.find(order => order.apiId === Number(pendingOrderId));
      if (found) currentOrder = found;
    }
  }

  async function hydrateInvoiceTitles() {
    const rows = await api("/api/mall/invoice-titles");
    const mapped = rows.map(titleFromApi);
    spliceArray("invoiceTitleData", mapped);
    spliceArray("invoiceTitles", mapped);
  }

  async function hydrateAddresses() {
    mallAddresses = (await api("/api/mall/addresses")).map(addressFromApi);
  }

  async function hydrateProfile() {
    buyerProfileData = await api("/api/buyer/profile");
  }

  function purchaseUnitLabel(product) {
    return product && product.saleMode === "BATCH" && product.saleUnit
      ? product.saleUnit
      : ((product && (product.unit || product.baseUnit)) || "件");
  }

  function selectedDetailItems() {
    const product = currentProduct;
    if (!product) return [];
    const map = typeof detailSpecQtyMap !== "undefined" ? detailSpecQtyMap : specQtyMap;
    return Object.entries(map || {})
      .map(([specIndex, qty]) => ({ productId: String(product.id), specIndex: Number(specIndex), qty: Number(qty || 0), checked: true }))
      .filter(item => item.qty > 0)
      .filter(item => {
        const spec = (product.specs || [])[item.specIndex] || {};
        const min = Math.max(1, Number(spec.minOrderQuantity || product.minOrderQuantity || 1));
        if (item.qty < min) {
          toast(`起订量不能低于 ${min}${purchaseUnitLabel(product)}`);
          return false;
        }
        return true;
      });
  }

  function checkedCartItems() {
    return cart.filter(item => item.checked !== false);
  }

  function checkoutRows() {
    try {
      return checkoutItems || checkedCartItems();
    } catch (_) {
      return [];
    }
  }

  function orderItemsFromCheckout() {
    return checkoutRows().map(item => ({
      productId: Number(item.productId),
      quantity: Number(item.qty || 1)
    }));
  }

  function defaultAddress() {
    return mallAddresses.find(item => item.isDefault) || mallAddresses[0] || {
      receiverName: "李经理",
      receiverPhone: "13888888888",
      fullAddress: "浙江省 杭州市 西湖区 文三路188号3号楼1201室"
    };
  }

  function selectedOrder() {
    const id = selectedOrderId || pendingOrderId;
    try {
      return (ordersData || []).find(order => String(order.apiId) === String(id) || String(order.id) === String(id)) || currentOrder || null;
    } catch (_) {
      try {
        return (orders || []).find(order => String(order.apiId) === String(id) || String(order.id) === String(id)) || null;
      } catch (__) {
        return null;
      }
    }
  }

  function payMethodCode() {
    return currentPayMethod() === "alipay" ? "ALIPAY" : "WECHAT";
  }

  function payMethodLabel(method = currentPayMethod()) {
    return method === "alipay" ? "支付宝支付" : "微信支付";
  }

  async function addSelectedToCart(jump) {
    const rows = selectedDetailItems();
    if (!rows.length) return toast("请先选择采购数量");
    try {
      for (const item of rows) {
        await api("/api/mall/cart/items", {
          method: "POST",
          body: JSON.stringify({ productId: Number(item.productId), quantity: item.qty })
        });
      }
      await hydrateCart();
      toast("已加入购物车");
      if (jump) repaint("cart");
    } catch (error) {
      toast(error.message);
    }
  }

  async function updateCartApi(idx, patch) {
    const item = cart[idx];
    if (!item || !item.cartItemId) return;
    await api(`/api/mall/cart/items/${item.cartItemId}`, {
      method: "PUT",
      body: JSON.stringify(patch)
    });
    await hydrateCart();
  }

  async function removeCartApi(idx) {
    const item = cart[idx];
    if (!item || !item.cartItemId) return;
    await api(`/api/mall/cart/items/${item.cartItemId}`, { method: "DELETE" });
    await hydrateCart();
  }

  async function removeSubmittedCartItems(rows) {
    for (const item of rows) {
      if (item.cartItemId) {
        await api(`/api/mall/cart/items/${item.cartItemId}`, { method: "DELETE" });
      }
    }
    await hydrateCart();
  }

  async function submitOrderApi() {
    const rows = checkoutRows();
    const items = orderItemsFromCheckout();
    if (!items.length) return toast("请先选择需要结算的商品");
    const address = defaultAddress();
    try {
      const order = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "ONLINE_PAY",
          receiverName: address.receiverName,
          receiverPhone: address.receiverPhone,
          receiverAddress: address.fullAddress,
          remark: "",
          items
        })
      });
      pendingOrderId = Number(order.id);
      selectedOrderId = pendingOrderId;
      currentOrder = pcOrderFromApi(order);
      checkoutItems = null;
      await removeSubmittedCartItems(rows);
      await hydrateOrders();
      toast("订单已提交，请继续支付");
      repaint("pay");
    } catch (error) {
      toast(error.message);
    }
  }

  async function paySuccessApi() {
    const order = selectedOrder();
    const orderId = order && order.apiId ? order.apiId : pendingOrderId;
    if (!orderId) return toast("未找到待支付订单");
    try {
      await api("/api/mall/payments", {
        method: "POST",
        body: JSON.stringify({ orderId: Number(orderId), paymentMethod: payMethodCode() })
      });
      pendingOrderId = Number(orderId);
      selectedOrderId = Number(orderId);
      await hydrateOrders();
      const latest = selectedOrder();
      if (latest) {
        latest.paymentMethodLabel = payMethodLabel();
        currentOrder = latest;
      }
      toast("支付成功");
      repaint("orderDetail");
    } catch (error) {
      toast(error.message);
    }
  }

  function goPayApi(orderNoOrId) {
    try {
      const all = typeof ordersData !== "undefined" ? ordersData : orders;
      const found = all.find(order => String(order.id) === String(orderNoOrId) || String(order.apiId) === String(orderNoOrId));
      if (found) {
        currentOrder = found;
        pendingOrderId = Number(found.apiId);
        selectedOrderId = Number(found.apiId);
      }
    } catch (_) {}
    if (!currentPayMethod()) setPayMethod("wechat");
    repaint("pay");
  }

  async function confirmReceiptApi(orderNoOrId) {
    const all = typeof ordersData !== "undefined" ? ordersData : orders;
    const found = (all || []).find(order => String(order.id) === String(orderNoOrId) || String(order.apiId) === String(orderNoOrId));
    const id = found && found.apiId;
    if (!id) return toast("未找到订单");
    try {
      await api(`/api/mall/orders/${id}/confirm-receipt`, { method: "POST" });
      await hydrateOrders();
      toast("已确认收货");
      repaint("orders");
    } catch (error) {
      toast(error.message);
    }
  }

  function paymentAmountTextApi() {
    const order = selectedOrder();
    if (order) return order.amount;
    return money((typeof checkoutTotal === "function" && checkoutRows().length) ? checkoutTotal() : 0);
  }

  function paymentOrderNoApi() {
    const order = selectedOrder();
    return order ? order.id : "-";
  }

  function renderPcPay() {
    return `
      <div class="order-steps">
        <div class="step active">1. 确认订单</div>
        <div class="step active">2. 在线支付</div>
        <div class="step">3. 卖家发货</div>
        <div class="step">4. 确认收货</div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">收银台</div></div>
        <div style="padding:24px">
          <div class="notice"><span>ℹ</span><div>订单已提交，请在 30 分钟内完成支付。超时后订单自动关闭并释放冻结库存。</div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0">
            <div class="address-card ${currentPayMethod() === "wechat" ? "active" : ""}" onclick="selectPayMethod('wechat')">
              <div class="address-name">微信支付</div>
              <div class="address-detail">使用微信扫码或跳转支付</div>
            </div>
            <div class="address-card ${currentPayMethod() === "alipay" ? "active" : ""}" onclick="selectPayMethod('alipay')">
              <div class="address-name">支付宝</div>
              <div class="address-detail">使用支付宝扫码或跳转支付</div>
            </div>
          </div>
          <div style="font-size:18px">支付金额：<span class="total">${paymentAmountTextApi()}</span></div>
        </div>
      </div>
      <div class="cart-footer">
        <div>订单编号：${paymentOrderNoApi()}</div>
        <div style="display:flex;gap:12px">
          <button class="btn" onclick="go('orders')">稍后支付</button>
          <button class="btn btn-primary" onclick="paySuccess()">模拟支付成功</button>
        </div>
      </div>
    `;
  }

  function renderMiniPay() {
    return `
      <div class="notice">订单已提交，请选择支付方式后完成支付。</div>
      <div class="panel">
        <div class="cell" onclick="selectPayMethod('wechat')">
          <div><b>微信支付</b><div class="cell-sub">使用微信扫码或跳转支付</div></div>
          <span class="tag tag-${currentPayMethod() === "wechat" ? "blue" : "gray"}">${currentPayMethod() === "wechat" ? "已选" : "选择"}</span>
        </div>
        <div class="cell" onclick="selectPayMethod('alipay')">
          <div><b>支付宝</b><div class="cell-sub">使用支付宝扫码或跳转支付</div></div>
          <span class="tag tag-${currentPayMethod() === "alipay" ? "blue" : "gray"}">${currentPayMethod() === "alipay" ? "已选" : "选择"}</span>
        </div>
      </div>
      <div class="panel">
        <div class="cell"><span>订单编号</span><span>${paymentOrderNoApi()}</span></div>
        <div class="cell"><span>支付金额</span><b class="total">${paymentAmountTextApi()}</b></div>
      </div>
      <div class="sticky-submit no-tab">
        <button class="btn" onclick="go('orders')">稍后支付</button>
        <button class="btn btn-primary" onclick="paySuccess()">模拟支付成功</button>
      </div>
    `;
  }

  function renderPcOrderDetail() {
    const order = selectedOrder() || (typeof ordersData !== "undefined" ? ordersData[0] : null);
    if (!order) return `<div class="card"><div class="empty">暂无订单详情</div></div>`;
    const paid = order.payLabel === "已支付";
    const steps = order.statusKey === "cancelled" ? `
        <div class="step active">1. 已下单</div>
        <div class="step active">2. 已取消</div>
        <div class="step">3. 待发货</div>
        <div class="step">4. 待收货</div>
      ` : `
        <div class="step active">1. 已下单</div>
        <div class="step ${paid || order.statusKey === "pendingPayment" ? "active" : ""}">2. ${paid ? "已支付" : "待支付"}</div>
        <div class="step ${["pendingShipment","pendingReceipt","completed"].includes(order.statusKey) ? "active" : ""}">3. ${["pendingReceipt","completed"].includes(order.statusKey) ? "已发货" : "待发货"}</div>
        <div class="step ${["pendingReceipt","completed"].includes(order.statusKey) ? "active" : ""}">4. ${order.statusKey === "completed" ? "已完成" : "待收货"}</div>
      `;
    return `
      <div class="order-steps">
        ${steps}
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">订单详情</div>
          <div style="display:flex;gap:10px">${renderPcOrderHeaderActions(order)}</div>
        </div>
        <div style="padding:16px">
          <div class="form-grid">
            <div class="label">订单编号</div><div>${esc(order.id)}</div>
            <div class="label">订单状态</div><div><span class="tag tag-${order.statusTag}">${esc(order.statusLabel)}</span></div>
            <div class="label">支付状态</div><div><span class="tag tag-${order.payTag}">${esc(order.payLabel)}</span></div>
            <div class="label">发货状态</div><div><span class="tag tag-${order.shipTag}">${esc(order.shipLabel)}</span></div>
            <div class="label">支付方式</div><div>${paid ? esc(order.paymentMethodLabel || payMethodLabel()) : "-"}</div>
            <div class="label">支付时间</div><div>${paid ? esc(order.paidAt || "-") : "-"}</div>
            <div class="label">收货地址</div><div>${esc(order.receiverName)} ${esc(order.receiverPhone)}，${esc(order.receiverAddress)}</div>
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">商品明细</div></div>
        <table>
          <thead><tr><th>商品/SKU</th><th>单价</th><th>数量</th><th>小计</th><th>售后状态</th></tr></thead>
          <tbody>
            ${(order.items || []).map(item => `
              <tr>
                <td>${esc(item.productName)} | ${esc(item.skuName || item.skuCode || "-")}</td>
                <td>${money(item.salePrice)}</td>
                <td>${item.quantity}</td>
                <td>${money(item.lineAmount)}</td>
                <td>-</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPcOrderHeaderActions(order) {
    if (order.statusKey === "cancelled") return "";
    if (order.statusKey === "pendingPayment") return `<button class="btn btn-primary" onclick="goPay('${order.id}')">去支付</button>`;
    if (order.statusKey === "pendingReceipt") {
      return `<button class="btn" onclick="openRefundApply()">申请售后</button><button class="btn btn-primary" onclick="confirmReceipt('${order.id}')">确认收货</button>`;
    }
    if (order.statusKey === "completed") return `<button class="btn btn-primary" onclick="openInvoiceApply()">申请开票</button>`;
    return `<button class="btn" onclick="openRefundApply()">申请售后</button>`;
  }

  function renderPcOrderActions(order) {
    return order.actions.map(action => {
      if (action === "详情") return `<button class="btn-text" onclick="go('orderDetail','${order.id}')">详情</button>`;
      if (action === "去支付") return `<button class="btn-text" onclick="goPay('${order.id}')">去支付</button>`;
      if (action === "确认收货") return `<button class="btn-text" onclick="confirmReceipt('${order.id}')">确认收货</button>`;
      if (action === "申请开票") return `<button class="btn-text" onclick="openInvoiceApply()">申请开票</button>`;
      return `<button class="btn-text">${esc(action)}</button>`;
    }).join("");
  }

  function renderMiniOrders() {
    const rows = orderTab === "all" ? orders : orders.filter(order => order.key === orderTab);
    return `
      <div class="order-tabs">
        ${getOrderTabs().map(tab => `
          <div class="order-tab ${orderTab === tab.key ? "active" : ""}" onclick="setOrderTab('${tab.key}')">
            ${tab.label}<span>${tab.count}</span>
          </div>
        `).join("")}
      </div>
      ${rows.length ? rows.map(order => `
        <div class="order-card">
          <div class="order-head"><span>${esc(order.id)}</span><span class="tag tag-${statusTag(order.status)}">${esc(order.status)}</span></div>
          <div class="order-body">
            <div class="order-goods">
              <div class="order-img">商</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;line-height:1.5">${esc(order.goods)}</div>
                <div style="color:var(--text-help);font-size:12px;margin-top:4px">${esc(order.time)}</div>
                <div style="display:flex;gap:8px;margin-top:7px">
                  <span class="tag tag-${statusTag(order.pay)}">${esc(order.pay)}</span>
                  <span class="tag tag-${statusTag(order.ship)}">${esc(order.ship)}</span>
                </div>
              </div>
            </div>
            <div style="text-align:right">实付 <b>${order.amount}</b></div>
          </div>
          <div class="order-actions">
            <button class="btn" onclick="goOrderDetail('${order.id}')">详情</button>
            ${order.key === "pendingPayment" ? `<button class="btn btn-primary" onclick="goPay('${order.id}')">去支付</button>` : ""}
            ${order.key === "pendingReceipt" ? `<button class="btn btn-primary" onclick="confirmReceipt('${order.id}')">确认收货</button>` : ""}
            ${order.key === "completed" ? `<button class="btn" onclick="go('invoiceApply')">申请开票</button>` : ""}
          </div>
        </div>
      `).join("") : '<div class="empty">当前状态下暂无订单</div>'}
    `;
  }

  function renderMiniOrderDetail() {
    const order = selectedOrder() || orders[0];
    if (!order) return '<div class="empty">暂无订单详情</div>';
    return `
      <div class="panel">
        <div class="panel-header"><span>订单信息</span><span class="tag tag-${order.statusTag || "blue"}">${esc(order.statusLabel || order.status)}</span></div>
        <div class="cell"><span>订单编号</span><span>${esc(order.id)}</span></div>
        <div class="cell"><span>订单金额</span><b>${order.amount}</b></div>
        <div class="cell"><span>支付状态</span><span>${esc(order.payLabel || order.pay)}</span></div>
        <div class="cell"><span>支付方式</span><span>${order.payLabel === "已支付" ? esc(order.paymentMethodLabel || payMethodLabel()) : "-"}</span></div>
        <div class="cell"><span>下单时间</span><span>${esc(order.orderTime || order.time || "-")}</span></div>
      </div>
      <div class="address-card">
        <div class="address-title">${esc(order.receiverName || "")} ${esc(order.receiverPhone || "")}</div>
        <div class="address-text">${esc(order.receiverAddress || "")}</div>
      </div>
      <div class="panel">
        <div class="panel-header">商品明细</div>
        ${(order.items || []).map(item => `
          <div class="cell">
            <div><div class="cell-title">${esc(item.productName)}</div><div class="cell-sub">${esc(item.skuName || item.skuCode || "-")} × ${item.quantity}</div></div>
            <b>${money(item.lineAmount)}</b>
          </div>
        `).join("")}
      </div>
      <div style="display:flex;gap:10px">
        ${order.key === "pendingPayment" ? `<button class="btn btn-primary" style="flex:1" onclick="goPay('${order.id}')">去支付</button>` : ""}
        ${order.key === "pendingReceipt" ? `<button class="btn btn-primary" style="flex:1" onclick="confirmReceipt('${order.id}')">确认收货</button>` : ""}
        ${order.key !== "cancelled" ? `<button class="btn" style="flex:1" onclick="go('aftersaleApply')">申请售后</button>` : ""}
        ${order.key === "completed" ? `<button class="btn btn-primary" style="flex:1" onclick="go('invoiceApply')">申请开票</button>` : ""}
      </div>
    `;
  }

  function renderAddressRows(cardClass = "address-card") {
    return mallAddresses.map(item => `
      <div class="${cardClass} ${item.isDefault ? "active" : ""}">
        <div class="${isMini ? "address-title" : "address-name"}">
          ${esc(item.receiverName)} ${esc(item.receiverPhone)}
          ${item.isDefault ? '<span class="tag tag-green">默认</span>' : ""}
        </div>
        <div class="${isMini ? "address-text" : "address-detail"}">${esc(item.fullAddress)}</div>
        <div style="margin-top:8px;display:flex;gap:8px;justify-content:${isMini ? "flex-end" : "flex-start"}">
          <button class="btn-text" onclick="openAddressModal('${item.id}')">编辑</button>
          ${item.isDefault ? "" : `<button class="btn-text" onclick="setDefaultAddressApi('${item.id}')">设为默认</button>`}
          ${item.isDefault ? "" : `<button class="btn-text-danger" onclick="deleteAddressApi('${item.id}')">删除</button>`}
        </div>
      </div>
    `).join("") || '<div class="empty">暂无收货地址</div>';
  }

  function renderPcAddresses() {
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">收货地址</div><button class="btn btn-primary" onclick="openAddressModal()">新增地址</button></div>
        <div style="padding:16px">${renderAddressRows()}</div>
      </div>
    `;
  }

  function renderMiniAddresses() {
    return `
      ${renderAddressRows()}
      <div class="sticky-submit no-tab">
        <button class="btn btn-primary" style="width:100%" onclick="openAddressModal()">新增收货地址</button>
      </div>
    `;
  }

  function openAddressModalApi(id = "") {
    const item = mallAddresses.find(row => String(row.id) === String(id)) || {};
    openModal(id ? "编辑收货地址" : "新增收货地址", `
      <div class="${isMini ? "form-row" : "form-grid"}">
        ${isMini ? '<label>收货人</label>' : '<div class="label">收货人</div>'}<input class="input" id="addrName" value="${esc(item.receiverName || "")}" placeholder="请输入收货人">
        ${isMini ? '<label>手机号</label>' : '<div class="label">手机号</div>'}<input class="input" id="addrPhone" value="${esc(item.receiverPhone || "")}" placeholder="请输入手机号">
        ${isMini ? '<label>所在地区</label>' : '<div class="label">所在地区</div>'}<input class="input" id="addrRegion" value="${esc(item.region || "")}" placeholder="省 市 区">
        ${isMini ? '<label>详细地址</label>' : '<div class="label">详细地址</div>'}<textarea class="textarea" id="addrDetail" placeholder="请输入详细地址">${esc(item.detailAddress || "")}</textarea>
        ${isMini ? '<label>默认地址</label>' : '<div class="label">默认地址</div>'}<select class="select" id="addrDefault"><option value="yes" ${item.isDefault ? "selected" : ""}>是</option><option value="no" ${!item.isDefault ? "selected" : ""}>否</option></select>
      </div>
    `, `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveAddressApi('${id || ""}')">保存</button>
    `);
  }

  async function saveAddressApi(id = "") {
    const payload = {
      receiverName: document.getElementById("addrName").value.trim(),
      receiverPhone: document.getElementById("addrPhone").value.trim(),
      region: document.getElementById("addrRegion").value.trim(),
      detailAddress: document.getElementById("addrDetail").value.trim(),
      isDefault: document.getElementById("addrDefault").value === "yes"
    };
    if (!payload.receiverName || !payload.receiverPhone || !payload.region || !payload.detailAddress) return toast("请完整填写收货地址");
    try {
      await api(id ? `/api/mall/addresses/${id}` : "/api/mall/addresses", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      await hydrateAddresses();
      closeModal();
      toast("地址已保存");
      repaint(isMini ? "address" : "addresses");
    } catch (error) {
      toast(error.message);
    }
  }

  async function deleteAddressApi(id) {
    try {
      await api(`/api/mall/addresses/${id}`, { method: "DELETE" });
      await hydrateAddresses();
      toast("地址已删除");
      repaint(isMini ? "address" : "addresses");
    } catch (error) {
      toast(error.message);
    }
  }

  async function setDefaultAddressApi(id) {
    try {
      await api(`/api/mall/addresses/${id}/default`, { method: "PUT" });
      await hydrateAddresses();
      toast("已设为默认地址");
      repaint(isMini ? "address" : "addresses");
    } catch (error) {
      toast(error.message);
    }
  }

  async function saveInvoiceTitleApi(id = "") {
    const typeEl = document.getElementById("invoiceTitleType") || document.getElementById("titleType");
    const titleEl = document.getElementById("invoiceTitleName") || document.getElementById("titleName");
    const taxNoEl = document.getElementById("invoiceTitleTaxNo") || document.getElementById("titleTaxNo");
    const emailEl = document.getElementById("invoiceTitleEmail") || document.getElementById("titleEmail");
    const defaultEl = document.getElementById("invoiceTitleDefault") || document.getElementById("titleDefault");
    const type = typeEl.value;
    const title = titleEl.value.trim();
    const taxNo = taxNoEl ? taxNoEl.value.trim() : "";
    const email = emailEl.value.trim();
    if (!title) return toast("请填写发票抬头");
    if (type === "company" && !taxNo) return toast("企业抬头请填写纳税人识别号");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("请填写正确的邮箱");
    try {
      const row = await api(id ? `/api/mall/invoice-titles/${id}` : "/api/mall/invoice-titles", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({
          titleType: type === "personal" ? "PERSONAL" : "COMPANY",
          title,
          taxNo,
          email
        })
      });
      if (defaultEl && defaultEl.value === "yes") {
        await api(`/api/mall/invoice-titles/${row.id}/default`, { method: "PUT" });
      }
      await hydrateInvoiceTitles();
      closeModal();
      toast("发票抬头已保存");
      repaint("invoiceTitles");
    } catch (error) {
      toast(error.message);
    }
  }

  async function setDefaultInvoiceTitleApi(id) {
    try {
      await api(`/api/mall/invoice-titles/${id}/default`, { method: "PUT" });
      await hydrateInvoiceTitles();
      toast("已设为默认抬头");
      repaint("invoiceTitles");
    } catch (error) {
      toast(error.message);
    }
  }

  async function deleteInvoiceTitleApi(id) {
    try {
      await api(`/api/mall/invoice-titles/${id}`, { method: "DELETE" });
      await hydrateInvoiceTitles();
      toast("发票抬头已删除");
      repaint("invoiceTitles");
    } catch (error) {
      toast(error.message);
    }
  }

  async function submitInvoiceApplyApi() {
    const select = document.getElementById("applyInvoiceTitleSelect") || document.getElementById("applyInvoiceTitle");
    const email = (document.getElementById("applyEmail")?.value || "").trim();
    const titles = typeof invoiceTitleData !== "undefined" ? invoiceTitleData : invoiceTitles;
    const title = titles.find(row => String(row.id) === String(select?.value)) || titles[0];
    const order = selectedOrder() || (typeof ordersData !== "undefined" ? ordersData.find(row => row.statusKey === "completed") : orders.find(row => row.key === "completed"));
    if (!title) return toast("请先维护发票抬头");
    if (!order) return toast("未找到可开票订单");
    try {
      await api("/api/mall/invoices", {
        method: "POST",
        body: JSON.stringify({
          orderNo: order.id,
          titleType: title.type === "personal" ? "PERSONAL" : "COMPANY",
          invoiceTitle: title.title,
          invoiceType: "E_NORMAL",
          amount: numericMoney(order.amount),
          email: email || title.email
        })
      });
      if (typeof closeModal === "function") closeModal();
      toast("开票申请已提交");
      repaint("orders");
    } catch (error) {
      toast(error.message);
    }
  }

  async function submitAfterSaleApi() {
    const order = selectedOrder() || (typeof ordersData !== "undefined" ? ordersData.find(row => row.statusKey !== "pendingPayment") : orders[0]);
    const item = order && order.items && order.items[0];
    if (!order || !item) return toast("未找到可申请售后的订单商品");
    try {
      await api("/api/mall/after-sales", {
        method: "POST",
        body: JSON.stringify({
          orderNo: order.id,
          productName: item.productName,
          quantity: 1,
          refundAmount: item.salePrice || item.lineAmount || 0,
          afterSaleType: "REFUND",
          reason: "买家申请售后"
        })
      });
      if (typeof closeModal === "function") closeModal();
      toast("售后申请已提交");
      repaint("orders");
    } catch (error) {
      toast(error.message);
    }
  }

  function renderMiniCategory() {
    const categories = [allCategoryLabel, ...categoryNames()];
    const list = currentCategory === allCategoryLabel ? products : products.filter(product => product.category === currentCategory);
    return `
      <div class="search-box">🔎 <input placeholder="搜索商品名称、品牌、SKU编码"></div>
      <div class="category-layout">
        <div class="category-left">
          ${categories.map(category => `<div class="category-tab ${currentCategory === category ? "active" : ""}" onclick="setCategory('${jsArg(category)}')">${esc(category)}</div>`).join("")}
        </div>
        <div>
          <div class="filter-chips"><div class="chip active">综合</div><div class="chip">销量</div><div class="chip">价格</div><div class="chip">库存充足</div></div>
          <div class="product-list">${list.length ? list.map(productCard).join("") : '<div class="empty">暂无可售商品</div>'}</div>
        </div>
      </div>
    `;
  }

  function renderProfileApi() {
    const data = buyerProfileData || {};
    if (isMini) {
      return `
        <div class="panel">
          <div class="cell"><span>登录手机号</span><span>${esc(data.phone || "-")}</span></div>
          <div class="cell"><span>买家名称</span><span>${esc(data.buyerName || "-")}</span></div>
          <div class="cell"><span>企业名称</span><span>${esc(data.companyName || "-")}</span></div>
          <div class="cell"><span>账号状态</span><span class="tag tag-green">${esc(data.accountStatus || "-")}</span></div>
          <div class="cell"><span>注册来源</span><span>小程序商城</span></div>
        </div>
        <button class="btn" style="width:100%" onclick="openPasswordModal()">修改密码</button>
      `;
    }
    return `
      <div class="card">
        <div class="card-header"><div class="card-title">个人中心</div></div>
        <div style="padding:20px">
          <div class="form-grid">
            <div class="label">登录手机号</div><div>${esc(data.phone || "-")}</div>
            <div class="label">买家名称</div><div>${esc(data.buyerName || "-")}</div>
            <div class="label">企业名称</div><div>${esc(data.companyName || "-")}</div>
            <div class="label">账号状态</div><div><span class="tag tag-green">${esc(data.accountStatus || "-")}</span></div>
            <div class="label">买家编号</div><div>${esc(data.buyerNo || "-")}</div>
          </div>
          <div style="margin-top:18px;display:flex;gap:10px">
            <button class="btn" onclick="openPasswordModal()">修改密码</button>
            <button class="btn" onclick="go('invoiceTitles')">管理发票抬头</button>
          </div>
        </div>
      </div>
    `;
  }

  async function loginApi(isRegister = false) {
    const phoneEl = document.getElementById(isMini ? (isRegister ? "miniRegPhone" : "miniLoginPhone") : (isRegister ? "regPhone" : "loginPhone"));
    const passwordEl = document.getElementById(isMini ? (isRegister ? "miniRegPassword" : "miniLoginPassword") : (isRegister ? "regPassword" : "loginPassword"));
    const phone = phoneEl?.value.trim();
    const password = passwordEl?.value || "";
    if (!phone || !password) return toast("请填写手机号和密码");
    try {
      if (isRegister) {
        await api("/api/buyer/register", { method: "POST", body: JSON.stringify({ phone, password }) });
      }
      await api("/api/buyer/login", { method: "POST", body: JSON.stringify({ phone, password }) });
      await hydrateProfile();
      toast(isRegister ? "注册成功" : "登录成功");
      repaint(isMini ? "mine" : "home");
    } catch (error) {
      toast(error.message);
    }
  }

  window.saveAddressApi = saveAddressApi;
  window.deleteAddressApi = deleteAddressApi;
  window.setDefaultAddressApi = setDefaultAddressApi;
  window.submitInvoiceApplyApi = submitInvoiceApplyApi;
  window.submitAfterSaleApi = submitAfterSaleApi;
  window.goOrderDetail = function (orderId) {
    selectedOrderId = orderId;
    try {
      const found = (typeof ordersData !== "undefined" ? ordersData : orders).find(order => String(order.id) === String(orderId));
      if (found) currentOrder = found;
    } catch (_) {}
    repaint("orderDetail");
  };

  if (typeof addCart === "function") addCart = addSelectedToCart;
  if (typeof addToCart === "function") addToCart = addSelectedToCart;
  if (typeof addProductToCartFromList === "function") {
    addProductToCartFromList = async function (productId) {
      const product = products.find(item => String(item.id) === String(productId));
      if (!product) return;
      try {
        await api("/api/mall/cart/items", { method: "POST", body: JSON.stringify({ productId: Number(product.id), quantity: 1 }) });
        await hydrateCart();
        toast("已加入购物车");
      } catch (error) {
        toast(error.message);
      }
    };
  }
  if (typeof submitOrder === "function") submitOrder = submitOrderApi;
  if (typeof paySuccess === "function") paySuccess = paySuccessApi;
  if (typeof goPay === "function") goPay = goPayApi;
  if (typeof selectPayMethod === "function") {
    selectPayMethod = function (method) {
      setPayMethod(method);
      repaint("pay");
    };
  }
  if (typeof paymentAmountText === "function") paymentAmountText = paymentAmountTextApi;
  if (typeof paymentOrderNo === "function") paymentOrderNo = paymentOrderNoApi;
  if (typeof renderPay === "function") renderPay = isMini ? renderMiniPay : renderPcPay;
  if (typeof renderOrderActions === "function") renderOrderActions = renderPcOrderActions;
  if (typeof renderOrderDetail === "function") renderOrderDetail = isMini ? renderMiniOrderDetail : renderPcOrderDetail;
  if (isMini && typeof renderOrders === "function") renderOrders = renderMiniOrders;
  if (isMini && typeof renderCategory === "function") renderCategory = renderMiniCategory;
  if (typeof renderAddresses === "function") renderAddresses = renderPcAddresses;
  if (typeof renderAddress === "function") renderAddress = renderMiniAddresses;
  if (typeof renderProfile === "function") renderProfile = renderProfileApi;
  if (typeof openAddressModal === "function") openAddressModal = openAddressModalApi;
  if (typeof saveInvoiceTitle === "function") saveInvoiceTitle = saveInvoiceTitleApi;
  if (typeof setDefaultInvoiceTitle === "function") setDefaultInvoiceTitle = setDefaultInvoiceTitleApi;
  if (typeof deleteInvoiceTitle === "function") deleteInvoiceTitle = deleteInvoiceTitleApi;
  if (typeof mockLogin === "function") mockLogin = () => loginApi(false);
  if (typeof mockMiniLogin === "function") mockMiniLogin = () => loginApi(false);
  if (typeof mockRegister === "function") mockRegister = () => loginApi(true);
  if (typeof mockMiniRegister === "function") mockMiniRegister = () => loginApi(true);
  window.confirmReceipt = confirmReceiptApi;

  if (typeof openInvoiceApply === "function") {
    const originalOpenInvoiceApply = openInvoiceApply;
    openInvoiceApply = function () {
      originalOpenInvoiceApply();
      const buttons = document.querySelectorAll("#modalMask .btn-primary, .modal-mask .btn-primary");
      const button = buttons[buttons.length - 1];
      if (button) button.setAttribute("onclick", "submitInvoiceApplyApi()");
    };
  }

  if (typeof openRefundApply === "function") {
    const originalOpenRefundApply = openRefundApply;
    openRefundApply = function () {
      originalOpenRefundApply();
      const buttons = document.querySelectorAll("#modalMask .btn-primary, .modal-mask .btn-primary");
      const button = buttons[buttons.length - 1];
      if (button) button.setAttribute("onclick", "submitAfterSaleApi()");
    };
  }

  if (isMini && typeof renderInvoiceApply === "function") {
    const originalRenderInvoiceApply = renderInvoiceApply;
    renderInvoiceApply = function () {
      return originalRenderInvoiceApply().replace(/showToast\('[^']*'\);go\('orders'\)/, "submitInvoiceApplyApi()");
    };
  }

  if (isMini && typeof renderAftersaleApply === "function") {
    const originalRenderAfterSaleApply = renderAftersaleApply;
    renderAftersaleApply = function () {
      return originalRenderAfterSaleApply().replace(/showToast\('[^']*'\);go\('orders'\)/, "submitAfterSaleApi()");
    };
  }

  if (typeof checkoutFromCart === "function") {
    checkoutFromCart = function () {
      checkoutItems = null;
      if (!checkedCartItems().length) return toast("请先选择需要结算的商品");
      repaint("confirm");
    };
  }

  async function toggleAllApi(checked) {
    try {
      await Promise.all(cart.map((_, idx) => updateCartApi(idx, { checked })));
      repaint("cart");
    } catch (error) {
      toast(error.message);
    }
  }

  if (typeof toggleAll === "function") toggleAll = toggleAllApi;
  if (typeof toggleAllCart === "function") toggleAllCart = toggleAllApi;

  async function toggleCartApi(idx, checked) {
    try {
      await updateCartApi(idx, { checked });
      repaint("cart");
    } catch (error) {
      toast(error.message);
    }
  }

  if (typeof toggleCartItem === "function") toggleCartItem = toggleCartApi;
  if (typeof toggleCart === "function") toggleCart = toggleCartApi;

  if (typeof changeCartQty === "function") {
    changeCartQty = async function (idx, delta) {
      try {
        const next = Math.max(1, Number(cart[idx].qty || 1) + Number(delta || 0));
        await updateCartApi(idx, { quantity: next });
        repaint("cart");
      } catch (error) {
        toast(error.message);
      }
    };
  }

  if (typeof setCartQty === "function") {
    setCartQty = async function (idx, value) {
      try {
        await updateCartApi(idx, { quantity: Math.max(1, Number(value || 1)) });
        repaint("cart");
      } catch (error) {
        toast(error.message);
      }
    };
  }

  if (typeof removeCart === "function") {
    removeCart = async function (idx) {
      try {
        await removeCartApi(idx);
        repaint("cart");
      } catch (error) {
        toast(error.message);
      }
    };
  }

  Promise.all([
    hydrateTaxonomy(),
    hydrateProducts(),
    hydrateCart(),
    hydrateOrders(),
    hydrateInvoiceTitles(),
    hydrateAddresses(),
    hydrateProfile()
  ]).then(() => {
    repaint(isMini ? currentPage : "home");
  }).catch(error => toast(error.message));
})();
