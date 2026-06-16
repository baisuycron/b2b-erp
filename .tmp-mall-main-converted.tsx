// @ts-nocheck
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  App as AntApp,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  Descriptions,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Layout,
  List,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography
} from "antd";
import {
  HomeOutlined,
  ProfileOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  UserOutlined
} from "@ant-design/icons";
import "antd/dist/reset.css";
import "../shared/styles.css";
import { AnyRecord, dateText, money, parseDetailContent, parseRows, request, statusText } from "../shared/api";

const phonePattern = /^1[3-9]\d{9}$/;
const formValidateMessages = {
  required: "请输�?{label}",
  string: {
    min: "${label}不能少于${min}个字符",
    max: "${label}不能超过${max}个字符",
    range: "${label}长度必须为${min}-${max}个字符"
  },
  types: {
    email: "请输入正确的${label}",
    number: "${label}必须是数字"
  }
};

function phoneRules(label = "手机号") {
  return [
    { required: true, message: `请输�?{label}` },
    { pattern: phonePattern, message: `请输入正确的${label}` }
  ];
}

function passwordRules(label = "瀵嗙爜") {
  return [
    { required: true, message: `请输�?{label}` },
    { min: 6, max: 20, message: `${label}长度必须为6-20个字符` }
  ];
}

type Page = "home" | "list" | "detail" | "cart" | "confirm" | "pay" | "orders" | "orderDetail" | "addresses" | "invoiceTitles" | "profile" | "login" | "register";

function tag(value: any) {
  const text = statusText(value);
  const color = /已支付|已完成|启用|成功/.test(text) ? "green" : /取消|失败/.test(text) ? "red" : /待|未/.test(text) ? "orange" : "blue";
  return <Tag color={color}>{text}</Tag>;
}

function MallRoot() {
  const { message } = AntApp.useApp();
  const [page, setPage] = useState<Page>("home");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<AnyRecord[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [cart, setCart] = useState<AnyRecord[]>([]);
  const [orders, setOrders] = useState<AnyRecord[]>([]);
  const [addresses, setAddresses] = useState<AnyRecord[]>([]);
  const [invoiceTitles, setInvoiceTitles] = useState<AnyRecord[]>([]);
  const [profile, setProfile] = useState<AnyRecord>({});
  const [selectedProduct, setSelectedProduct] = useState<AnyRecord | null>(null);
  const [detailQty, setDetailQty] = useState<Record<number, number>>({});
  const [checkoutItems, setCheckoutItems] = useState<AnyRecord[] | null>(null);
  const [currentOrder, setCurrentOrder] = useState<AnyRecord | null>(null);
  const [payMethod, setPayMethod] = useState("wechat");
  const [filters, setFilters] = useState({ category: "全部分类", brand: "全部品牌" });

  const apiGuard = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const hydrateProducts = async () => {
    const [categoryRows, brandRows, productRows] = await Promise.all([
      request<AnyRecord[]>("/api/admin/product-categories").catch(() => []),
      request<AnyRecord[]>("/api/admin/product-brands").catch(() => []),
      request<AnyRecord[]>("/api/mall/products")
    ]);
    setCategories(categoryRows.filter(x => x.status === "ENABLED").map(x => x.categoryName));
    setBrands(brandRows.filter(x => x.status === "ENABLED").map(x => x.brandName));
    setProducts(productRows.map(productFromApi));
  };

  const hydrateCart = async () => {
    const data = await request<AnyRecord>("/api/mall/cart");
    setCart((data.items || []).map(cartFromApi));
  };

  const hydrateOrders = async () => {
    const rows = await request<AnyRecord[]>("/api/mall/orders");
    setOrders(rows.map(orderFromApi));
  };

  const hydrateAddresses = async () => {
    setAddresses((await request<AnyRecord[]>("/api/mall/addresses")).map(addressFromApi));
  };

  const hydrateInvoiceTitles = async () => {
    setInvoiceTitles((await request<AnyRecord[]>("/api/mall/invoice-titles")).map(invoiceTitleFromApi));
  };

  const hydrateProfile = async () => {
    setProfile(await request("/api/buyer/profile").catch(() => ({})));
  };

  const hydrateAll = () => apiGuard(async () => {
    await hydrateProducts();
    await Promise.all([hydrateCart(), hydrateOrders(), hydrateAddresses(), hydrateInvoiceTitles(), hydrateProfile()]);
  });

  useEffect(() => {
    hydrateAll();
  }, []);

  const go = async (next: Page, payload?: AnyRecord) => {
    if (next === "detail" && payload) {
      setSelectedProduct(payload);
      setDetailQty(Object.fromEntries((payload.specs || []).map((_: AnyRecord, idx: number) => [idx, 0])));
    }
    if (next === "orders") await apiGuard(hydrateOrders);
    if (next === "cart") await apiGuard(hydrateCart);
    if (next === "addresses") await apiGuard(hydrateAddresses);
    if (next === "invoiceTitles") await apiGuard(hydrateInvoiceTitles);
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cartCount = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const checkoutRows = checkoutItems || cart.filter(item => item.checked !== false);
  const checkoutTotal = checkoutRows.reduce((sum, item) => sum + cartItemPrice(products, item) * Number(item.qty || 0), 0);

  const ctx = {
    message,
    products,
    categories,
    brands,
    cart,
    orders,
    addresses,
    invoiceTitles,
    profile,
    selectedProduct,
    detailQty,
    setDetailQty,
    filters,
    setFilters,
    checkoutItems,
    setCheckoutItems,
    checkoutRows,
    checkoutTotal,
    currentOrder,
    setCurrentOrder,
    payMethod,
    setPayMethod,
    go,
    hydrateCart,
    hydrateOrders,
    hydrateAddresses,
    hydrateInvoiceTitles,
    hydrateProfile,
    apiGuard
  };

  return (
    <Layout className="mall-shell">
      <div className="mall-header">
        <div className="mall-logo" onClick={() => go("home")}><div className="admin-logo" style={{ width: 36, height: 36, fontSize: 16 }}>B</div>B2B 缃戦〉鍟嗗煄</div>
        <Space size={18}>
          <Button type={page === "home" ? "primary" : "text"} icon={<HomeOutlined />} onClick={() => go("home")}>棣栭〉</Button>
          <Button type={page === "list" ? "primary" : "text"} icon={<ShoppingOutlined />} onClick={() => go("list")}>全部商品</Button>
          <Badge count={cartCount}><Button icon={<ShoppingCartOutlined />} onClick={() => go("cart")}>购物�?</Button></Badge>
          <Button icon={<ProfileOutlined />} onClick={() => go("orders")}>订单</Button>
          <Button icon={<UserOutlined />} onClick={() => go("profile")}>账户</Button>
        </Space>
      </div>
      <main className="mall-main">
        {page === "home" && <HomePage ctx={ctx} loading={loading} />}
        {page === "list" && <ListPage ctx={ctx} loading={loading} />}
        {page === "detail" && <DetailPage ctx={ctx} />}
        {page === "cart" && <CartPage ctx={ctx} loading={loading} />}
        {page === "confirm" && <ConfirmPage ctx={ctx} />}
        {page === "pay" && <PayPage ctx={ctx} />}
        {page === "orders" && <OrdersPage ctx={ctx} loading={loading} />}
        {page === "orderDetail" && <OrderDetailPage ctx={ctx} />}
        {page === "addresses" && <AddressPage ctx={ctx} loading={loading} />}
        {page === "invoiceTitles" && <InvoiceTitlePage ctx={ctx} loading={loading} />}
        {page === "profile" && <ProfilePage ctx={ctx} />}
        {page === "login" && <AuthPage ctx={ctx} type="login" />}
        {page === "register" && <AuthPage ctx={ctx} type="register" />}
      </main>
    </Layout>
  );
}

function productFromApi(item: AnyRecord) {
  const saleMode = item.saleMode === "BATCH" ? "BATCH" : "NORMAL";
  const saleUnit = String(item.saleUnit || "").trim();
  const baseUnit = item.unit || "件";
  const displayUnit = saleMode === "BATCH" && saleUnit ? saleUnit : baseUnit;
  const skuRows = parseRows(item.skuListJson || item.skuList);
  const specs = skuRows.length ? skuRows.map((row, index) => ({
    code: row.skuCode || item.skuCode || `${item.id}-${index}`,
    name: row.skuName || item.skuName || "默认规格",
    image: row.skuImageUrl || row.imageUrl || item.mainImageUrl,
    price: Number(row.salePrice ?? item.salePrice ?? 0),
    stock: Number(row.stockQuantity ?? item.stockQuantity ?? 0),
    min: Number(row.minOrderQuantity ?? item.minOrderQuantity ?? 1),
    status: row.skuStatus || "ENABLED"
  })) : [{
    code: item.skuCode,
    name: item.skuName || "默认规格",
    price: Number(item.salePrice || 0),
    stock: Number(item.stockQuantity || 0),
    min: Number(item.minOrderQuantity || 1),
    status: item.skuStatus || "ENABLED"
  }];
  const detail = parseDetailContent(item.detailContent || "");
  return {
    id: Number(item.id),
    apiId: Number(item.id),
    name: item.productName,
    category: item.categoryName || "鍚庡彴鍟嗗搧",
    brand: item.brandName || "B2B",
    unit: displayUnit,
    baseUnit,
    saleMode,
    saleUnit,
    saleUnitRatio: Number(item.saleUnitRatio || 0) || null,
    quoteType: item.quoteType === "TIER_PRICE" ? "阶梯报价" : "规格独立报价",
    image: item.mainImageUrl,
    detailText: detail.text,
    detailImageUrl: detail.imageUrl,
    tierPrices: parseRows(item.tierPricesJson || item.tierPrices),
    specs,
    raw: item
  };
}

function cartFromApi(item: AnyRecord) {
  return {
    cartItemId: String(item.cartItemId || item.id),
    productId: Number(item.productId),
    specIndex: Number(item.specIndex || 0),
    qty: Number(item.quantity || item.qty || 1),
    checked: item.checked !== false
  };
}

function orderFromApi(order: AnyRecord) {
  const key = order.orderStatus === "WAIT_PAY" ? "pendingPayment" : order.orderStatus === "WAIT_SHIP" ? "pendingShipment" : order.orderStatus === "WAIT_RECEIVE" ? "pendingReceipt" : order.orderStatus === "COMPLETED" ? "completed" : order.orderStatus === "CANCELLED" ? "cancelled" : "all";
  return {
    id: order.orderNo,
    apiId: Number(order.id),
    key,
    goodsCount: (order.items || []).reduce((sum: number, x: AnyRecord) => sum + Number(x.quantity || 0), 0),
    amount: money(order.totalAmount),
    totalAmount: Number(order.totalAmount || 0),
    payLabel: order.paymentStatus === "PAID" ? "已支付" : order.paymentStatus === "NOT_REQUIRED_BEFORE_RECEIPT" ? "后付款" : "未支付",
    statusLabel: statusText(order.orderStatus),
    shipLabel: statusText(order.fulfillmentStatus || order.orderStatus),
    orderTime: dateText(order.createdAt),
    receiverName: order.receiverName,
    receiverPhone: order.receiverPhone,
    receiverAddress: order.receiverAddress,
    items: order.items || [],
    raw: order
  };
}

function addressFromApi(item: AnyRecord) {
  return { id: item.id, name: item.receiverName, phone: item.receiverPhone, address: item.receiverAddress, isDefault: Boolean(item.isDefault) };
}

function invoiceTitleFromApi(item: AnyRecord) {
  return { ...item, title: item.title || item.invoiceTitle, taxNo: item.taxNo || item.taxpayerNo };
}

function HomePage({ ctx, loading }: any) {
  const recommend = ctx.products.slice(0, 8);
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Space direction="vertical" size={12}>
          <Typography.Title level={2} style={{ margin: 0 }}>企业一站式采购商城</Typography.Title>
          <Typography.Text type="secondary">鍟嗗搧銆佷环鏍笺€佸簱瀛樸€佽鍗曞拰灞ョ害娴佺▼涓庡悗鍙板疄鏃跺悓姝ャ€?</Typography.Text>
          <Button type="primary" size="large" onClick={() => ctx.go("list")}>绔嬪嵆閲囪喘</Button>
        </Space>
      </Card>
      <Section title="推荐商品" extra={<Button type="link" onClick={() => ctx.go("list")}>查看全部</Button>}>
        <ProductGrid products={recommend} ctx={ctx} loading={loading} />
      </Section>
    </Space>
  );
}

function Section({ title, extra, children }: any) {
  return <Card title={title} extra={extra}>{children}</Card>;
}

function ProductGrid({ products, ctx, loading }: any) {
  if (loading) return <Typography.Text>鍔犺浇涓?..</Typography.Text>;
  if (!products.length) return <Empty description="暂无商品" />;
  return (
    <div className="product-grid">
      {products.map((p: AnyRecord) => (
        <Card key={p.id} hoverable onClick={() => ctx.go("detail", p)} cover={p.image?.startsWith("data:") ? <img className="product-card-img" src={p.image} /> : <div className="product-card-img" style={{ display: "grid", placeItems: "center", fontWeight: 800, color: "#4e7cff" }}>{p.brand?.[0] || "商"}</div>}>
          <Card.Meta title={p.name} description={<Space direction="vertical" size={4}><span>{p.category} / {p.brand}</span><b style={{ color: "#ff4d4f" }}>{money(firstPrice(p))}</b></Space>} />
        </Card>
      ))}
    </div>
  );
}

function ListPage({ ctx, loading }: any) {
  const categoryOptions = ["全部分类", ...ctx.categories];
  const brandOptions = ["全部品牌", ...ctx.brands];
  const rows = ctx.products.filter((p: AnyRecord) => (ctx.filters.category === "全部分类" || p.category === ctx.filters.category) && (ctx.filters.brand === "全部品牌" || p.brand === ctx.filters.brand));
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Space wrap>
          <Select value={ctx.filters.category} options={categoryOptions.map((x: string) => ({ value: x, label: x }))} onChange={(category: string) => ctx.setFilters((old: AnyRecord) => ({ ...old, category }))} style={{ width: 180 }} />
          <Select value={ctx.filters.brand} options={brandOptions.map((x: string) => ({ value: x, label: x }))} onChange={(brand: string) => ctx.setFilters((old: AnyRecord) => ({ ...old, brand }))} style={{ width: 180 }} />
        </Space>
      </Card>
      <ProductGrid products={rows} ctx={ctx} loading={loading} />
    </Space>
  );
}

function DetailPage({ ctx }: any) {
  const p = ctx.selectedProduct;
  if (!p) return <Empty description="璇烽€夋嫨鍟嗗搧" />;
  const selected = Object.entries(ctx.detailQty).filter(([, qty]) => Number(qty) > 0);
  const totalQty = selected.reduce((sum, [, qty]) => sum + Number(qty), 0);
  const totalAmount = selected.reduce((sum, [idx, qty]) => sum + detailUnitPrice(p, Number(idx), totalQty) * Number(qty), 0);

  const submitCart = async (jump: boolean) => {
    const rows = selectedItems(ctx);
    if (!rows.length) return ctx.message.warning("璇峰厛濉啓閲囪喘鏁伴噺");
    await ctx.apiGuard(async () => {
      for (const row of rows) {
        await request("/api/mall/cart/items", { method: "POST", data: { productId: p.id, quantity: row.qty, specIndex: row.specIndex } });
      }
      await ctx.hydrateCart();
      ctx.message.success("已加入购物车");
      if (jump) ctx.go("cart");
    });
  };

  const buyNow = async () => {
    const rows = selectedItems(ctx).map((row: AnyRecord) => ({ productId: p.id, specIndex: row.specIndex, qty: row.qty, checked: true }));
    if (!rows.length) return ctx.message.warning("璇峰厛濉啓閲囪喘鏁伴噺");
    ctx.setCheckoutItems(rows);
    ctx.go("confirm");
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 28 }}>
          {p.image?.startsWith("data:") ? <Image src={p.image} style={{ width: 420, borderRadius: 8 }} /> : <div className="product-card-img" />}
          <Space direction="vertical" size={14}>
            <Typography.Title level={3}>{p.name}</Typography.Title>
            <Typography.Text type="secondary">{p.category} / {p.brand} / {p.unit}</Typography.Text>
            <Typography.Title level={4} style={{ color: "#ff4d4f" }}>{money(firstPrice(p))}</Typography.Title>
            <Table pagination={false} rowKey={(_, idx) => String(idx)} dataSource={p.specs} columns={[
              { title: "瑙勬牸", dataIndex: "name" },
              { title: "搴撳瓨", dataIndex: "stock" },
              { title: "鍗曚环", render: (_, s, idx) => money(detailUnitPrice(p, idx || 0, totalQty)) },
              { title: `閲囪喘鏁伴噺锛坾${purchaseUnitLabel(p)}锛?`, render: (_, s, idx) => <InputNumber min={0} max={s.stock} precision={0} step={1} value={ctx.detailQty[idx || 0] || 0} onChange={v => ctx.setDetailQty((old: AnyRecord) => ({ ...old, [idx || 0]: Number(v || 0) }))} /> }
            ]} />
            <Space>
              <Typography.Text>已�?{totalQty} {purchaseUnitLabel(p)}，合�? <b style={{ color: "#ff4d4f" }}>{money(totalAmount)}</b></Typography.Text>
              <Button onClick={() => submitCart(false)}>加入购物�?</Button>
              <Button type="primary" onClick={buyNow}>立即购买</Button>
            </Space>
          </Space>
        </div>
      </Card>
      <Card title="鍟嗗搧璇︽儏">
        <div className="product-detail-render" dangerouslySetInnerHTML={{ __html: p.detailText || "暂无详情" }} />
        {p.detailImageUrl ? <Image src={p.detailImageUrl} className="detail-image" /> : null}
      </Card>
    </Space>
  );
}

function purchaseUnitLabel(product: AnyRecord) {
  return product?.saleMode === "BATCH" && product?.saleUnit ? product.saleUnit : (product?.unit || product?.baseUnit || "件");
}

function selectedItems(ctx: AnyRecord) {
  const p = ctx.selectedProduct;
  const rows = Object.entries(ctx.detailQty)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([idx, qty]) => ({ specIndex: Number(idx), qty: Number(qty), spec: p.specs[Number(idx)] }));
  const invalid = rows.find(row => row.qty < Number(row.spec?.min || 1));
  if (invalid) {
    ctx.message.warning(`起订量不能低于 ${invalid.spec?.min || 1}${purchaseUnitLabel(p)}`);
    return [];
  }
  return rows;
}

function CartPage({ ctx, loading }: any) {
  const total = ctx.cart.filter((x: AnyRecord) => x.checked !== false).reduce((sum: number, item: AnyRecord) => sum + cartItemPrice(ctx.products, item) * item.qty, 0);
  const updateCart = (item: AnyRecord, patch: AnyRecord) => ctx.apiGuard(async () => {
    await request(`/api/mall/cart/items/${item.cartItemId}`, { method: "PUT", data: patch });
    await ctx.hydrateCart();
  });
  const remove = (item: AnyRecord) => ctx.apiGuard(async () => {
    await request(`/api/mall/cart/items/${item.cartItemId}`, { method: "DELETE" });
    await ctx.hydrateCart();
  });
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card title="购物车">
        <Table loading={loading} rowKey="cartItemId" dataSource={ctx.cart} columns={[
          { title: "閫夋嫨", render: (_, item) => <Checkbox checked={item.checked !== false} onChange={e => updateCart(item, { checked: e.target.checked })} /> },
          { title: "鍟嗗搧", render: (_, item) => cartProduct(ctx.products, item)?.name || "-" },
          { title: "瑙勬牸", render: (_, item) => cartSpec(ctx.products, item)?.name || "-" },
          { title: "鍗曚环", render: (_, item) => money(cartItemPrice(ctx.products, item)) },
          { title: "鏁伴噺", render: (_, item) => <InputNumber min={Number(cartSpec(ctx.products, item)?.min || 1)} precision={0} step={1} value={item.qty} onChange={v => updateCart(item, { quantity: Number(v || cartSpec(ctx.products, item)?.min || 1) })} /> },
          { title: "灏忚", render: (_, item) => money(cartItemPrice(ctx.products, item) * item.qty) },
          { title: "鎿嶄綔", render: (_, item) => <Button type="link" danger onClick={() => remove(item)}>鍒犻櫎</Button> }
        ]} />
      </Card>
      <div className="cart-summary">
        <Typography.Text>宸查€?{ctx.cart.filter((x: AnyRecord) => x.checked !== false).length} 绉嶅晢鍝?</Typography.Text>
        <Space><b>合计：{money(total)}</b><Button type="primary" onClick={() => { ctx.setCheckoutItems(null); ctx.go("confirm"); }}>去结算</Button></Space>
      </div>
    </Space>
  );
}

function ConfirmPage({ ctx }: any) {
  const rows = ctx.checkoutRows;
  const address = ctx.addresses.find((x: AnyRecord) => x.isDefault) || ctx.addresses[0];
  const submit = () => ctx.apiGuard(async () => {
    if (!rows.length) return ctx.message.warning("璇峰厛閫夋嫨鍟嗗搧");
    if (!address) return ctx.message.warning("请先维护收货地址");
    const order = await request("/api/orders", {
      method: "POST",
      data: {
        customerId: 1,
        paymentMethod: "ONLINE_PAY",
        receiverName: address.name,
        receiverPhone: address.phone,
        receiverAddress: address.address,
        remark: "缃戦〉鍟嗗煄涓嬪崟",
        items: rows.map((item: AnyRecord) => ({ productId: item.productId, quantity: item.qty, specIndex: item.specIndex || 0 }))
      }
    });
    if (!ctx.checkoutItems) {
      for (const item of rows) {
        if (item.cartItemId) await request(`/api/mall/cart/items/${item.cartItemId}`, { method: "DELETE" });
      }
      await ctx.hydrateCart();
    }
    const mapped = orderFromApi(order);
    ctx.setCurrentOrder(mapped);
    ctx.setCheckoutItems(null);
    ctx.message.success("订单已提交");
    ctx.go("pay");
  });
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card title="确认订单" extra={<Button onClick={() => ctx.go("addresses")}>管理地址</Button>}>
        {address ? <Descriptions bordered column={1} items={[{ key: "name", label: "收货人", children: `${address.name} ${address.phone}` }, { key: "address", label: "收货地址", children: address.address }]} /> : <Empty description="暂无收货地址" />}
      </Card>
      <Card title="鍟嗗搧鏄庣粏">
        <Table pagination={false} rowKey={(_, idx) => String(idx)} dataSource={rows} columns={[
          { title: "鍟嗗搧", render: (_, item) => cartProduct(ctx.products, item)?.name || "-" },
          { title: "瑙勬牸", render: (_, item) => cartSpec(ctx.products, item)?.name || "-" },
          { title: "鍗曚环", render: (_, item) => money(cartItemPrice(ctx.products, item)) },
          { title: "鏁伴噺", dataIndex: "qty" },
          { title: "灏忚", render: (_, item) => money(cartItemPrice(ctx.products, item) * item.qty) }
        ]} />
      </Card>
      <div className="cart-summary"><Button onClick={() => ctx.go("cart")}>返回购物车</Button><Space><b>应付金额：{money(ctx.checkoutTotal)}</b><Button type="primary" onClick={submit}>提交订单</Button></Space></div>
    </Space>
  );
}

function PayPage({ ctx }: any) {
  const order = ctx.currentOrder;
  const pay = () => ctx.apiGuard(async () => {
    if (!order?.apiId) return ctx.message.warning("未找到待支付订单");
    await request("/api/mall/payments", { method: "POST", data: { orderId: Number(order.apiId), paymentMethod: ctx.payMethod === "alipay" ? "ALIPAY" : "WECHAT" } });
    await ctx.hydrateOrders();
    ctx.message.success("支付成功");
    ctx.setCurrentOrder({ ...order, payLabel: "已支付" });
    ctx.go("orderDetail");
  });
  return (
    <Card title="订单支付">
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Descriptions bordered column={1} items={[
          { key: "order", label: "订单编号", children: order?.id || "-" },
          { key: "amount", label: "支付金额", children: order?.amount || money(ctx.checkoutTotal) }
        ]} />
        <Radio.Group value={ctx.payMethod} onChange={e => ctx.setPayMethod(e.target.value)}>
          <Radio.Button value="wechat">微信支付</Radio.Button>
          <Radio.Button value="alipay">支付宝支�?</Radio.Button>
        </Radio.Group>
        <Space><Button onClick={() => ctx.go("orders")}>稍后支付</Button><Button type="primary" onClick={pay}>模拟支付成功</Button></Space>
      </Space>
    </Card>
  );
}

function OrdersPage({ ctx, loading }: any) {
  const [tab, setTab] = useState("all");
  const rows = tab === "all" ? ctx.orders : ctx.orders.filter((x: AnyRecord) => x.key === tab);
  const tabs = [
    { key: "all", label: `全部(${ctx.orders.length})` },
    { key: "pendingPayment", label: "待支付" },
    { key: "pendingShipment", label: "待发货" },
    { key: "pendingReceipt", label: "待收货" },
    { key: "completed", label: "已完成" }
  ];
  return (
    <Card title="我的订单">
      <Tabs activeKey={tab} onChange={setTab} items={tabs.map(t => ({ key: t.key, label: t.label }))} />
      <Table loading={loading} rowKey="id" dataSource={rows} columns={[
        { title: "订单编号", dataIndex: "id" },
        { title: "商品数", dataIndex: "goodsCount" },
        { title: "閲戦", dataIndex: "amount" },
        { title: "支付", dataIndex: "payLabel", render: tag },
        { title: "状态", dataIndex: "statusLabel", render: tag },
        { title: "涓嬪崟鏃堕棿", dataIndex: "orderTime" },
        { title: "操作", render: (_, item) => <Space><Button type="link" onClick={() => { ctx.setCurrentOrder(item); ctx.go("orderDetail"); }}>详情</Button>{item.key === "pendingPayment" ? <Button type="link" onClick={() => { ctx.setCurrentOrder(item); ctx.go("pay"); }}>去支�?</Button> : null}{item.key === "pendingReceipt" ? <Button type="link" onClick={() => confirmReceipt(ctx, item)}>确认收货</Button> : null}</Space> }
      ]} />
    </Card>
  );
}

function OrderDetailPage({ ctx }: any) {
  const order = ctx.currentOrder || ctx.orders[0];
  if (!order) return <Empty description="暂无订单详情" />;
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card title={`订单详情 ${order.id}`} extra={<Space>{order.key === "pendingPayment" ? <Button type="primary" onClick={() => ctx.go("pay")}>去支�?</Button> : null}{order.key === "pendingReceipt" ? <Button type="primary" onClick={() => confirmReceipt(ctx, order)}>确认收货</Button> : null}<Button onClick={() => afterSaleModal(ctx, order)}>申请售后</Button>{order.key === "completed" ? <Button onClick={() => invoiceApplyModal(ctx, order)}>申请开�?</Button> : null}</Space>}>
        <Descriptions bordered column={2} items={[
          { key: "status", label: "订单状态", children: tag(order.statusLabel) },
          { key: "pay", label: "支付状态", children: tag(order.payLabel) },
          { key: "amount", label: "订单金额", children: order.amount },
          { key: "time", label: "涓嬪崟鏃堕棿", children: order.orderTime },
          { key: "address", label: "收货地址", span: 2, children: `${order.receiverName || ""} ${order.receiverPhone || ""}�?{order.receiverAddress || ""}` }
        ]} />
      </Card>
      <Card title="鍟嗗搧鏄庣粏">
        <List dataSource={order.items || []} renderItem={(item: AnyRecord) => <List.Item><List.Item.Meta title={item.productName || item.skuName} description={`鏁伴噺 ${item.quantity} / 鍗曚环 ${money(item.salePrice || item.price)}`} /></List.Item>} />
      </Card>
    </Space>
  );
}

function confirmReceipt(ctx: any, order: AnyRecord) {
  ctx.apiGuard(async () => {
    await request(`/api/mall/orders/${order.apiId}/confirm-receipt`, { method: "POST" });
    await ctx.hydrateOrders();
    ctx.message.success("已确认收货");
    ctx.go("orders");
  });
}

function AddressPage({ ctx, loading }: any) {
  return (
    <Card title="收货地址" extra={<Button type="primary" onClick={() => addressModal(ctx)}>新增地址</Button>}>
      <Table loading={loading} rowKey="id" dataSource={ctx.addresses} columns={[
        { title: "收货人", dataIndex: "name" },
        { title: "鐢佃瘽", dataIndex: "phone" },
        { title: "鍦板潃", dataIndex: "address" },
        { title: "默认", dataIndex: "isDefault", render: (v) => v ? <Tag color="green">默认</Tag> : "-" },
        { title: "操作", render: (_, item) => <Space><Button type="link" onClick={() => addressModal(ctx, item)}>编辑</Button>{!item.isDefault ? <Button type="link" onClick={() => setDefaultAddress(ctx, item)}>设为默认</Button> : null}{!item.isDefault ? <Button type="link" danger onClick={() => deleteAddress(ctx, item)}>删除</Button> : null}</Space> }
      ]} />
    </Card>
  );
}

function addressModal(ctx: any, item?: AnyRecord) {
  Modal.confirm({
    title: item ? "缂栬緫鍦板潃" : "鏂板鍦板潃",
    icon: null,
    width: 560,
    content: <AddressForm ctx={ctx} item={item} />,
    footer: null
  });
}

function AddressForm({ ctx, item }: any) {
  return (
    <Form layout="vertical" initialValues={item} onFinish={async values => {
      await ctx.apiGuard(async () => {
        await request(item ? `/api/mall/addresses/${item.id}` : "/api/mall/addresses", {
          method: item ? "PUT" : "POST",
          data: { receiverName: values.name, receiverPhone: values.phone, receiverAddress: values.address, isDefault: values.isDefault }
        });
        await ctx.hydrateAddresses();
        Modal.destroyAll();
        ctx.message.success("地址已保存");
      });
    }}>
      <Form.Item name="name" label="收货人" rules={[{ required: true }]}><Input /></Form.Item>
      <Form.Item name="phone" label="手机号" rules={phoneRules()}><Input maxLength={11} /></Form.Item>
      <Form.Item name="address" label="璇︾粏鍦板潃" rules={[{ required: true }]}><Input.TextArea /></Form.Item>
      <Form.Item name="isDefault" valuePropName="checked"><Checkbox>设为默认</Checkbox></Form.Item>
      <Space><Button onClick={() => Modal.destroyAll()}>鍙栨秷</Button><Button type="primary" htmlType="submit">淇濆瓨</Button></Space>
    </Form>
  );
}

function setDefaultAddress(ctx: any, item: AnyRecord) {
  ctx.apiGuard(async () => {
    await request(`/api/mall/addresses/${item.id}/default`, { method: "PUT" });
    await ctx.hydrateAddresses();
    ctx.message.success("已设为默认地址");
  });
}

function deleteAddress(ctx: any, item: AnyRecord) {
  ctx.apiGuard(async () => {
    await request(`/api/mall/addresses/${item.id}`, { method: "DELETE" });
    await ctx.hydrateAddresses();
    ctx.message.success("地址已删除");
  });
}

function InvoiceTitlePage({ ctx, loading }: any) {
  return (
    <Card title="鍙戠エ鎶ご" extra={<Button type="primary" onClick={() => invoiceTitleModal(ctx)}>鏂板鎶ご</Button>}>
      <Table loading={loading} rowKey="id" dataSource={ctx.invoiceTitles} columns={[
        { title: "鎶ご", dataIndex: "title" },
        { title: "绫诲瀷", dataIndex: "type" },
        { title: "绋庡彿", dataIndex: "taxNo" },
        { title: "閭", dataIndex: "email" },
        { title: "默认", dataIndex: "isDefault", render: v => v ? <Tag color="green">默认</Tag> : "-" },
        { title: "操作", render: (_, item) => <Space><Button type="link" onClick={() => invoiceTitleModal(ctx, item)}>编辑</Button>{!item.isDefault ? <Button type="link" onClick={() => setDefaultTitle(ctx, item)}>设为默认</Button> : null}{!item.isDefault ? <Button type="link" danger onClick={() => deleteTitle(ctx, item)}>删除</Button> : null}</Space> }
      ]} />
    </Card>
  );
}

function invoiceTitleModal(ctx: any, item?: AnyRecord) {
  Modal.confirm({ title: item ? "缂栬緫鍙戠エ鎶ご" : "鏂板鍙戠エ鎶ご", icon: null, width: 620, content: <InvoiceTitleForm ctx={ctx} item={item} />, footer: null });
}

function InvoiceTitleForm({ ctx, item }: any) {
  return (
    <Form layout="vertical" initialValues={{ type: "company", ...item }} onFinish={async values => {
      await ctx.apiGuard(async () => {
        const row = await request(item ? `/api/mall/invoice-titles/${item.id}` : "/api/mall/invoice-titles", { method: item ? "PUT" : "POST", data: values });
        if (values.isDefault) await request(`/api/mall/invoice-titles/${row.id || item.id}/default`, { method: "PUT" });
        await ctx.hydrateInvoiceTitles();
        Modal.destroyAll();
        ctx.message.success("发票抬头已保存");
      });
    }}>
      <Form.Item name="type" label="抬头类型"><Select options={[{ value: "company", label: "企业" }, { value: "personal", label: "个人" }]} /></Form.Item>
      <Form.Item name="title" label="鍙戠エ鎶ご" rules={[{ required: true }]}><Input /></Form.Item>
      <Form.Item name="taxNo" label="绾崇◣浜鸿瘑鍒彿"><Input /></Form.Item>
      <Form.Item name="email" label="鎺ユ敹閭" rules={[{ required: true }]}><Input /></Form.Item>
      <Form.Item name="isDefault" valuePropName="checked"><Checkbox>设为默认</Checkbox></Form.Item>
      <Space><Button onClick={() => Modal.destroyAll()}>鍙栨秷</Button><Button type="primary" htmlType="submit">淇濆瓨</Button></Space>
    </Form>
  );
}

function setDefaultTitle(ctx: any, item: AnyRecord) {
  ctx.apiGuard(async () => {
    await request(`/api/mall/invoice-titles/${item.id}/default`, { method: "PUT" });
    await ctx.hydrateInvoiceTitles();
    ctx.message.success("已设为默认抬头");
  });
}

function deleteTitle(ctx: any, item: AnyRecord) {
  ctx.apiGuard(async () => {
    await request(`/api/mall/invoice-titles/${item.id}`, { method: "DELETE" });
    await ctx.hydrateInvoiceTitles();
    ctx.message.success("发票抬头已删除");
  });
}

function ProfilePage({ ctx }: any) {
  return (
    <Card title="账户信息" extra={<Space><Button onClick={() => ctx.go("login")}>登录</Button><Button onClick={() => ctx.go("register")}>注册</Button><Button onClick={() => ctx.go("invoiceTitles")}>管理发票抬头</Button></Space>}>
      <Descriptions bordered column={2} items={[
        { key: "buyerName", label: "涔板鍚嶇О", children: ctx.profile.buyerName || "-" },
        { key: "companyName", label: "企业名称", children: ctx.profile.companyName || "-" },
        { key: "phone", label: "手机号", children: ctx.profile.phone || "-" },
        { key: "level", label: "客户等级", children: ctx.profile.levelName || "-" }
      ]} />
    </Card>
  );
}

function AuthPage({ ctx, type }: any) {
  return (
    <Card title={type === "login" ? "涔板鐧诲綍" : "涔板娉ㄥ唽"} style={{ maxWidth: 520, margin: "0 auto" }}>
      <Form layout="vertical" onFinish={async values => {
        await ctx.apiGuard(async () => {
          if (type === "register") await request("/api/buyer/register", { method: "POST", data: values });
          await request("/api/buyer/login", { method: "POST", data: values });
          await ctx.hydrateProfile();
          ctx.message.success(type === "login" ? "鐧诲綍鎴愬姛" : "娉ㄥ唽鎴愬姛");
          ctx.go("profile");
        });
      }}>
        <Form.Item name="phone" label="手机号" rules={phoneRules()}><Input maxLength={11} /></Form.Item>
        <Form.Item name="password" label="瀵嗙爜" rules={passwordRules()}><Input.Password /></Form.Item>
        {type === "register" ? <>
          <Form.Item name="buyerName" label="涔板鍚嶇О" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="companyName" label="企业名称" rules={[{ required: true }]}><Input /></Form.Item>
        </> : null}
        <Button type="primary" block htmlType="submit">{type === "login" ? "鐧诲綍" : "娉ㄥ唽"}</Button>
      </Form>
    </Card>
  );
}

function invoiceApplyModal(ctx: any, order: AnyRecord) {
  Modal.confirm({
    title: "申请开票",
    icon: null,
    width: 560,
    content: (
      <Form id="invoiceApplyForm" layout="vertical" onFinish={async values => {
        await ctx.apiGuard(async () => {
          const title = ctx.invoiceTitles.find((x: AnyRecord) => x.id === values.invoiceTitleId) || ctx.invoiceTitles[0];
          await request("/api/mall/invoices", { method: "POST", data: { orderNo: order.id, invoiceTitleId: values.invoiceTitleId, title: title?.title, amount: order.totalAmount, email: values.email } });
          Modal.destroyAll();
          ctx.message.success("寮€绁ㄧ敵璇峰凡鎻愪氦");
        });
      }}>
        <Form.Item name="invoiceTitleId" label="鍙戠エ鎶ご" rules={[{ required: true }]}><Select options={ctx.invoiceTitles.map((x: AnyRecord) => ({ value: x.id, label: x.title }))} /></Form.Item>
        <Form.Item name="email" label="鎺ユ敹閭" rules={[{ required: true }]}><Input /></Form.Item>
        <Button type="primary" htmlType="submit">鎻愪氦鐢宠</Button>
      </Form>
    ),
    footer: null
  });
}

function afterSaleModal(ctx: any, order: AnyRecord) {
  Modal.confirm({
    title: "鐢宠鍞悗",
    icon: null,
    content: (
      <Form layout="vertical" onFinish={async values => {
        await ctx.apiGuard(async () => {
          const item = order.items?.[0];
          await request("/api/mall/after-sales", { method: "POST", data: { orderNo: order.id, orderItemId: item?.id, type: values.type, quantity: Number(values.quantity || 1), reason: values.reason } });
          Modal.destroyAll();
          ctx.message.success("售后申请已提交");
        });
      }}>
          <Form.Item name="type" label="售后类型" initialValue="REFUND"><Select options={[{ value: "REFUND", label: "退款" }, { value: "RETURN_REFUND", label: "退货退款" }]} /></Form.Item>
        <Form.Item name="quantity" label="鐢宠鏁伴噺" initialValue={1}><InputNumber min={1} /></Form.Item>
        <Form.Item name="reason" label="鍘熷洜"><Input.TextArea /></Form.Item>
        <Button type="primary" htmlType="submit">鎻愪氦鐢宠</Button>
      </Form>
    ),
    footer: null
  });
}

function firstPrice(p: AnyRecord) {
  return p.specs?.[0]?.price || 0;
}

function detailUnitPrice(product: AnyRecord, specIndex: number, totalQty: number) {
  const spec = product.specs?.[specIndex] || {};
  if (product.quoteType !== "闃舵鎶ヤ环") return Number(spec.price || 0);
  const tiers = product.tierPrices || [];
  const hit = [...tiers]
    .sort((a: AnyRecord, b: AnyRecord) => Number(b.minQty || 1) - Number(a.minQty || 1))
    .find((row: AnyRecord) => totalQty >= Number(row.minQty || 1) && (!row.maxQty || totalQty <= Number(row.maxQty)));
  return Number(hit?.price || spec.price || 0);
}

function cartProduct(products: AnyRecord[], item: AnyRecord) {
  return products.find(p => Number(p.id) === Number(item.productId));
}

function cartSpec(products: AnyRecord[], item: AnyRecord) {
  const p = cartProduct(products, item);
  return p?.specs?.[Number(item.specIndex || 0)];
}

function cartItemPrice(products: AnyRecord[], item: AnyRecord) {
  const p = cartProduct(products, item);
  if (!p) return 0;
  return detailUnitPrice(p, Number(item.specIndex || 0), Number(item.qty || 1));
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider form={{ validateMessages: formValidateMessages }}>
      <AntApp>
        <MallRoot />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);



