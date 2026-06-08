(function () {
  let pendingOrderId = null;

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

  function priceText(value) {
    return "¥" + Number(value || 0).toFixed(2);
  }

  function statusKey(order) {
    if (order.orderStatus === "WAIT_PAY") return "pendingPayment";
    if (order.orderStatus === "WAIT_SHIP") return "pendingShipment";
    if (order.orderStatus === "WAIT_RECEIVE") return "pendingReceipt";
    if (order.orderStatus === "COMPLETED") return "completed";
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

  function productFromApi(item) {
    return {
      id: item.id,
      name: item.productName,
      brand: item.brandName || "B2B",
      category: item.categoryName || "企业采购",
      unit: item.unit || "件",
      code: item.productCode,
      quoteType: "规格独立报价",
      priceText: priceText(item.salePrice),
      tags: ["真实库存", "API商品", item.saleStatus === "ON_SALE" ? "已上架" : "已下架"],
      stock: Number(item.stockQuantity || 0),
      specs: [{
        name: item.skuName || item.productName,
        sku: item.skuCode || item.productCode,
        stock: Number(item.stockQuantity || 0),
        price: Number(item.salePrice || 0)
      }],
      tiers: [],
      desc: "该商品来自后端商品接口，库存、价格和上下架状态会实时同步。"
    };
  }

  function orderFromApi(order) {
    const key = statusKey(order);
    const paid = order.paymentStatus === "PAID";
    return {
      id: order.orderNo,
      apiId: order.id,
      goodsCount: (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      amount: priceText(order.totalAmount),
      payLabel: paid ? "已支付" : "未支付",
      payTag: paid ? "green" : "orange",
      shipLabel: statusLabel(order),
      shipTag: key === "completed" ? "green" : "blue",
      statusKey: key,
      key,
      statusLabel: statusLabel(order),
      statusTag: key === "completed" ? "green" : "blue",
      orderTime: String(order.createdAt || "").replace("T", " ").slice(0, 16),
      actions: key === "pendingPayment" ? ["详情", "去支付"] : key === "completed" ? ["详情", "申请开票"] : ["详情"]
    };
  }

  function titleFromApi(item) {
    return {
      id: String(item.id),
      type: item.titleType === "PERSONAL" ? "personal" : "company",
      title: item.title,
      taxNo: item.taxNo || "",
      registerAddress: item.registerAddress || "",
      registerPhone: item.registerPhone || "",
      bankName: item.bankName || "",
      bankAccount: item.bankAccount || "",
      email: item.receiveEmail || item.email || "",
      isDefault: Boolean(item.isDefault)
    };
  }

  async function hydrateProducts() {
    const rows = await api("/api/mall/products");
    const mapped = rows.map(productFromApi);
    try {
      products.splice(0, products.length, ...mapped);
      currentProduct = products[0];
      if (typeof initDetailSpecQtyMap === "function") initDetailSpecQtyMap(currentProduct);
      if (typeof initSpecQty === "function") initSpecQty(currentProduct);
    } catch (_) {}
  }

  async function hydrateOrders() {
    const rows = await api("/api/mall/orders");
    const mapped = rows.map(orderFromApi);
    try {
      ordersData.splice(0, ordersData.length, ...mapped);
    } catch (_) {}
    try {
      orders.splice(0, orders.length, ...mapped);
    } catch (_) {}
  }

  async function hydrateInvoiceTitles() {
    const rows = await api("/api/mall/invoice-titles");
    const mapped = rows.map(titleFromApi);
    try {
      invoiceTitleData.splice(0, invoiceTitleData.length, ...mapped);
    } catch (_) {}
    try {
      invoiceTitles.splice(0, invoiceTitles.length, ...mapped);
    } catch (_) {}
  }

  function checkedCart() {
    try {
      return cart.filter(item => item.checked !== false);
    } catch (_) {
      return [];
    }
  }

  function orderItems() {
    return checkedCart().map(item => ({
      productId: Number(item.productId),
      quantity: Number(item.qty || 1)
    }));
  }

  async function createAndPayOrder() {
    const items = orderItems();
    if (!items.length) {
      showToast("请先选择商品");
      return null;
    }
    const order = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId: 1,
        paymentMethod: "WECHAT",
        receiverName: "李经理",
        receiverPhone: "13888888888",
        receiverAddress: "浙江省杭州市西湖区文三路188号",
        items
      })
    });
    pendingOrderId = order.id;
    await api("/api/mall/payments", {
      method: "POST",
      body: JSON.stringify({ orderId: pendingOrderId, paymentMethod: "WECHAT" })
    });
    try {
      cart.splice(0, cart.length);
      if (typeof updateCartCount === "function") updateCartCount();
      if (typeof updateCartBadge === "function") updateCartBadge();
    } catch (_) {}
    await hydrateOrders();
    return order;
  }

  const originalAddCart = typeof addCart === "function" ? addCart : null;
  if (originalAddCart) {
    addCart = async function (jump) {
      originalAddCart(false);
      const latest = checkedCart().slice(-1)[0];
      if (latest) {
        try {
          await api("/api/mall/cart/items", {
            method: "POST",
            body: JSON.stringify({ productId: latest.productId, quantity: latest.qty })
          });
        } catch (error) {
          showToast(error.message);
        }
      }
      if (jump) go("cart");
    };
  }

  const originalAddToCart = typeof addToCart === "function" ? addToCart : null;
  if (originalAddToCart) {
    addToCart = async function (jump) {
      originalAddToCart(false);
      const latest = checkedCart().slice(-1)[0];
      if (latest) {
        try {
          await api("/api/mall/cart/items", {
            method: "POST",
            body: JSON.stringify({ productId: latest.productId, quantity: latest.qty })
          });
        } catch (error) {
          showToast(error.message);
        }
      }
      if (jump) go("cart");
    };
  }

  if (typeof paySuccess === "function") {
    paySuccess = async function () {
      try {
        await createAndPayOrder();
        showToast("支付成功，订单已写入数据库");
        go("orderDetail");
      } catch (error) {
        showToast(error.message);
      }
    };
  }

  if (typeof submitOrder === "function") {
    submitOrder = async function () {
      try {
        await createAndPayOrder();
        showToast("下单并支付成功");
        go("pay");
      } catch (error) {
        showToast(error.message);
      }
    };
  }

  if (typeof saveInvoiceTitle === "function") {
    saveInvoiceTitle = async function (id = "") {
      const type = document.getElementById("invoiceTitleType").value;
      const title = document.getElementById("invoiceTitleName").value.trim();
      const taxNo = document.getElementById("invoiceTitleTaxNo")?.value.trim() || "";
      const email = document.getElementById("invoiceTitleEmail").value.trim();
      if (!title) return showToast("请填写发票抬头");
      if (type === "company" && !taxNo) return showToast("企业抬头请填写纳税人识别号");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("请填写正确的邮箱");
      try {
        await api("/api/mall/invoice-titles", {
          method: "POST",
          body: JSON.stringify({
            titleType: type === "personal" ? "PERSONAL" : "COMPANY",
            title,
            taxNo,
            email
          })
        });
        await hydrateInvoiceTitles();
        closeModal();
        if (typeof pageEl !== "undefined") pageEl.innerHTML = renderInvoiceTitles();
        if (typeof render === "function") render();
        showToast("发票抬头已保存");
      } catch (error) {
        showToast(error.message);
      }
    };
  }

  window.submitInvoiceApplyApi = async function () {
    const titleSelect = document.getElementById("applyInvoiceTitleSelect");
    const email = document.getElementById("applyEmail")?.value.trim() || "";
    const titleRows = typeof invoiceTitleData !== "undefined" ? invoiceTitleData : invoiceTitles;
    const item = titleRows.find(row => String(row.id) === String(titleSelect?.value)) || titleRows[0];
    if (!item) return showToast("请先维护发票抬头");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || item.email || "")) return showToast("请填写正确的邮箱");
    try {
      await api("/api/mall/invoices", {
        method: "POST",
        body: JSON.stringify({
          orderNo: pendingOrderId ? "SO" + pendingOrderId : "SO-DEMO",
          titleType: item.type === "personal" ? "PERSONAL" : "COMPANY",
          invoiceTitle: item.title,
          invoiceType: "E_NORMAL",
          amount: 2860,
          email: email || item.email
        })
      });
      if (typeof closeModal === "function") closeModal();
      showToast("开票申请已提交到后台");
      go("orders");
    } catch (error) {
      showToast(error.message);
    }
  };

  const originalOpenInvoiceApply = typeof openInvoiceApply === "function" ? openInvoiceApply : null;
  if (originalOpenInvoiceApply) {
    openInvoiceApply = function () {
      originalOpenInvoiceApply();
      const footer = document.querySelector("#modalFooter, .modal-footer");
      const buttons = document.querySelectorAll("#modalMask .btn-primary, .modal-mask .btn-primary");
      const button = buttons[buttons.length - 1];
      if (button) button.setAttribute("onclick", "submitInvoiceApplyApi()");
    };
  }

  Promise.all([hydrateProducts(), hydrateOrders(), hydrateInvoiceTitles()])
    .then(() => {
      showToast("已连接真实接口");
      try {
        if (typeof go === "function") go("home");
        if (typeof render === "function") render();
      } catch (_) {}
    })
    .catch(error => showToast(error.message));
})();
