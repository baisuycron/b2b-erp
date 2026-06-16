// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as echarts from "echarts";
import {
  App as AntApp,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  Descriptions,
  Drawer,
  Form,
  Image,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tree,
  Tag,
  Tooltip,
  Typography,
  Upload
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  BarcodeOutlined,
  CaretDownOutlined,
  CaretUpOutlined,
  CopyOutlined,
  DashboardOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  FileTextOutlined,
  FullscreenOutlined,
  HolderOutlined,
  InboxOutlined,
  OrderedListOutlined,
  PictureOutlined,
  PlusOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  RedoOutlined,
  SafetyOutlined,
  SettingOutlined,
  ShoppingOutlined,
  TagsOutlined,
  TeamOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  UserOutlined,
  ZoomInOutlined
} from "@ant-design/icons";
import "antd/dist/reset.css";
import zhCN from "antd/locale/zh_CN";
import "../shared/styles.css";
import ProductSpecEditor from "./ProductSpecEditor";
import RichTextEditor from "./RichTextEditor";
import {
  AnyRecord,
  adminAccountKey,
  adminPermissionKey,
  adminSuperRoleKey,
  adminTokenKey,
  dateText,
  imageToCompressedDataUrl,
  money,
  parseDetailContent,
  parseRows,
  request,
  statusText
} from "../shared/api";

const { Header, Sider, Content } = Layout;

const phonePattern = /^1[3-9]\d{9}$/;
const formValidateMessages = {
  required: "请输入${label}",
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
    { required: true, message: `请输入${label}` },
    { pattern: phonePattern, message: `请输入正确的${label}` }
  ];
}

function passwordRules(label = "密码") {
  return [
    { required: true, message: `请输入${label}` },
    { min: 6, max: 20, message: `${label}长度必须为6-20个字符` }
  ];
}

type PageKey =
  | "dashboard"
  | "product-list"
  | "product-category"
  | "product-brand"
  | "supplier"
  | "purchase-order"
  | "purchase-inbound"
  | "stock-overview"
  | "stock-flow"
  | "stock-adjust"
  | "order"
  | "aftersale"
  | "invoice"
  | "buyer"
  | "finance-payment"
  | "finance-refund"
  | "system-user"
  | "system-role"
  | "system-log"
  | "system-config";

const pageStorageKey = "b2b-erp-admin-current-page";
const loginRememberKey = "b2b-erp-admin-remember-login";
const superAdminRoleName = "超级管理员";
const dashboardPermissionKey = "dashboard";

function normalizePageKey(page?: PageKey | null): PageKey {
  if (!page) return "dashboard";
  if (page === "stock-adjust") return "stock-overview";
  return page;
}

const pageTitles: Record<PageKey, [string, string]> = {
  dashboard: ["首页工作台", "汇总订单、支付、待办和关键业务数据。"],
  "product-list": ["商品档案", "管理商品主图、详情图文、SKU、报价方式、上下架和库存。"],
  "product-category": ["商品分类", "用于商品建档和商城分类导航。"],
  "product-brand": ["商品品牌", "用于商品建档和商城品牌筛选。"],
  supplier: ["供应商管理", "维护采购供应商基础资料。"],
  "purchase-order": ["采购订单", "发起采购单并跟踪入库状态。"],
  "purchase-inbound": ["采购入库记录", "查看采购入库明细和状态。"],
  "stock-overview": ["库存总览", "按 SKU 展示实际库存、冻结库存和可售库存。"],
  "stock-flow": ["库存流水", "查看库存变动记录。"],
  "stock-adjust": ["库存调整", "人工调增或调减 SKU 实际库存。"],
  order: ["订单管理", "查看订单、详情和发货履约。"],
  aftersale: ["售后管理", "处理售后审核、退货收货和退款。"],
  invoice: ["开票管理", "处理开票申请、上传发票和驳回。"],
  buyer: ["买家管理", "查看买家客户资料。"],
  "finance-payment": ["支付记录", "查看商城支付流水。"],
  "finance-refund": ["退款记录", "查看售后退款流水。"],
  "system-user": ["后台账号", "新增、编辑、启停用和重置后台账号。"],
  "system-role": ["角色权限", "维护角色和菜单权限。"],
  "system-log": ["操作日志", "查看后台操作记录。"],
  "system-config": ["基础配置", "维护支付超时、售后期、库存预警等参数。"]
};

const endpoints: Record<string, string> = {
  summary: "/api/admin/summary",
  products: "/api/admin/products",
  categories: "/api/admin/product-categories",
  brands: "/api/admin/product-brands",
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
  permissionTree: "/api/admin/permissions/tree",
  logs: "/api/admin/operation-logs",
  parameters: "/api/system/parameters",
  buyers: "/api/customers"
};

const pageLoads: Record<PageKey, string[]> = {
  dashboard: ["summary", "orders", "purchaseOrders", "inventory", "afterSales", "invoices", "payments"],
  "product-list": ["products", "categories", "brands"],
  "product-category": ["categories", "products"],
  "product-brand": ["brands"],
  supplier: ["suppliers"],
  "purchase-order": ["purchaseOrders", "products", "suppliers"],
  "purchase-inbound": ["purchaseStockIns"],
  "stock-overview": ["inventory"],
  "stock-flow": ["inventoryFlows"],
  "stock-adjust": ["inventory", "products"],
  order: ["orders"],
  aftersale: ["afterSales"],
  invoice: ["invoices"],
  buyer: ["buyers"],
  "finance-payment": ["payments"],
  "finance-refund": ["refunds"],
  "system-user": ["accounts", "roles"],
  "system-role": ["roles", "permissionTree"],
  "system-log": ["logs"],
  "system-config": ["parameters"]
};

const pagePermissionKeys: Record<PageKey, string[]> = {
  dashboard: [dashboardPermissionKey],
  "product-list": ["goods:product-list"],
  "product-category": ["goods:product-category"],
  "product-brand": ["goods:product-brand"],
  supplier: ["purchase:supplier"],
  "purchase-order": ["purchase:purchase-order"],
  "purchase-inbound": ["purchase:purchase-inbound"],
  "stock-overview": ["stock:stock-overview"],
  "stock-flow": ["stock:stock-flow"],
  "stock-adjust": ["stock:stock-overview"],
  order: ["order"],
  aftersale: ["aftersale"],
  invoice: ["invoice"],
  buyer: ["buyer"],
  "finance-payment": ["finance:finance-payment"],
  "finance-refund": ["finance:finance-refund"],
  "system-user": ["system:system-user"],
  "system-role": ["system:system-role"],
  "system-log": ["system:system-log"],
  "system-config": ["system:system-config"]
};

function tag(value: any) {
  const text = statusText(value);
  const color = /启用|上架|已支付|完成|成功/.test(text)
    ? "green"
    : /停用|下架|取消|驳回|失败/.test(text)
      ? "red"
      : /待|未/.test(text)
        ? "orange"
        : "blue";
  return <Tag color={color}>{text}</Tag>;
}

function compactText(value: any) {
  const text = String(value || "-");
  return text.length > 28 ? `${text.slice(0, 28)}...` : text;
}

function productThumbSrc(item: AnyRecord) {
  return String(item?.mainImageUrl || "").trim();
}

function renderProductNameCell(value: any, item: AnyRecord) {
  const src = productThumbSrc(item);
  return (
    <div className="product-name-cell">
      {src ? (
        <img className="product-name-thumb" src={src} alt="" />
      ) : (
        <span className="product-name-thumb is-empty">
          <PictureOutlined />
        </span>
      )}
      <span className="product-name-text">{compactText(value)}</span>
    </div>
  );
}

const tablePageSizeOptions = ["10", "20", "50", "100", "200"];
const managementListTableScrollY = "calc(100vh - 430px)";
const maxProductNameLength = 30;
const maxUnitLength = 10;
const maxSkuTextLength = 18;
const maxPrice = 99999.99;
const maxStock = 999999;
const maxMinOrderQuantity = 100;
const saleModeOptions = [
  { value: "NORMAL", label: "普通售卖" },
  { value: "BATCH", label: "批量售卖" }
];
const saleUnitOptions = ["箱", "包", "盒", "提", "袋", "桶", "扎", "板"].map(value => ({ value, label: value }));

function tablePagination() {
  return {
    position: ["bottomCenter"],
    showSizeChanger: true,
    pageSizeOptions: tablePageSizeOptions,
    defaultPageSize: 10,
    showTotal: (total: number) => `\u5171 ${total} \u6761`
  };
}

function fixedActionColumns(columns: ColumnsType<AnyRecord>): ColumnsType<AnyRecord> {
  return columns.map(column => {
    if (column.title !== "操作") return column;
    return {
      ...column,
      fixed: column.fixed || "right",
      width: column.width || 180
    };
  });
}

function tableProps(columns: ColumnsType<AnyRecord>, scroll?: any) {
  return {
    columns: fixedActionColumns(columns),
    pagination: tablePagination(),
    scroll: scroll || { x: "max-content" }
  };
}

function AdminTable({ columns = [], pagination, scroll, ...props }: any) {
  const finalPagination = pagination === false ? false : { ...tablePagination(), ...(pagination || {}) };
  return (
    <Table
      {...props}
      columns={fixedActionColumns(columns)}
      pagination={finalPagination}
      scroll={scroll || { x: "max-content" }}
    />
  );
}

function normalizePermissionTree(rows: AnyRecord[] = []) {
  return rows.map(item => ({
    ...item,
    key: item.key || item.permissionKey || item.moduleKey || item.module,
    title: item.title || item.label || item.module,
    children: (item.children || item.actions || []).map((child: AnyRecord | string) => {
      if (typeof child === "string") {
        return {
          key: `${item.key || item.permissionKey || item.module}:${child}`,
          title: child
        };
      }
      return {
        ...child,
        key: child.key || child.permissionKey || child.actionKey || child.label,
        title: child.title || child.label || child.actionName || child.permissionName
      };
    })
  }));
}

function collectPermissionKeys(rows: AnyRecord[] = []) {
  return normalizePermissionTree(rows)
    .flatMap(item => [item.key, ...(item.children || []).map((child: AnyRecord) => child.key)])
    .filter(Boolean);
}

function parseRolePermissionKeys(item?: AnyRecord, permissionTree: AnyRecord[] = []) {
  const direct = item?.permissionKeys || item?.permissions;
  if (Array.isArray(direct)) return direct;
  const raw = item?.permissionJson;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return item ? [] : collectPermissionKeys(permissionTree);
}

function AdminRoot() {
  const { message } = AntApp.useApp();
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem(adminTokenKey)));
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState<PageKey>(normalizePageKey(localStorage.getItem(pageStorageKey) as PageKey));
  const [openPages, setOpenPages] = useState<PageKey[]>(() => {
    const savedPage = normalizePageKey(localStorage.getItem(pageStorageKey) as PageKey);
    return ["dashboard", savedPage]
      .filter(key => key !== "stock-adjust")
      .filter((key, index, arr) => arr.indexOf(key) === index);
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, any>>({});
  const [drawer, setDrawer] = useState<{ title: string; body: React.ReactNode; width?: number | string; className?: string } | null>(null);

  const loadKeys = async (keys: string[]) => {
    setLoading(true);
    try {
      const entries = await Promise.all(keys.map(async key => [key, await request(endpoints[key])] as const));
      setData(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const reload = () => loadKeys(pageLoads[page]);

  useEffect(() => {
    if (loggedIn) reload();
  }, [page, loggedIn]);

  const go = (key: PageKey) => {
    const nextKey = normalizePageKey(key);
    setPage(nextKey);
    setOpenPages(prev => prev.includes(nextKey) ? prev : [...prev, nextKey]);
    localStorage.setItem(pageStorageKey, nextKey);
  };

  const closePage = (targetKey: PageKey) => {
    setOpenPages(prev => {
      const next = prev.filter(key => key !== targetKey);
      if (!next.length) return ["dashboard"];
      if (targetKey === page) {
        const nextPage = next[next.length - 1];
        setPage(nextPage);
        localStorage.setItem(pageStorageKey, nextPage);
      }
      return next;
    });
  };

  if (!loggedIn) return <Login onSuccess={() => setLoggedIn(true)} />;

  const menuItems = [
    { key: "dashboard", icon: <DashboardOutlined />, label: "首页工作台" },
    {
      key: "product",
      icon: <ShoppingOutlined />,
      label: "商品管理",
      children: [
        { key: "product-list", label: "商品档案" },
        { key: "product-category", label: "商品分类" },
        { key: "product-brand", label: "商品品牌" }
      ]
    },
    {
      key: "purchase",
      icon: <InboxOutlined />,
      label: "采购管理",
      children: [
        { key: "supplier", label: "供应商管理" },
        { key: "purchase-order", label: "采购订单" },
        { key: "purchase-inbound", label: "采购入库记录" }
      ]
    },
    {
      key: "stock",
      icon: <BarcodeOutlined />,
      label: "库存管理",
      children: [
        { key: "stock-overview", label: "库存总览" },
        { key: "stock-flow", label: "库存流水" }
      ]
    },
    { key: "order", icon: <FileTextOutlined />, label: "订单管理" },
    { key: "aftersale", icon: <AuditOutlined />, label: "售后管理" },
    { key: "invoice", icon: <BankOutlined />, label: "开票管理" },
    { key: "buyer", icon: <TeamOutlined />, label: "买家管理" },
    {
      key: "finance",
      icon: <BankOutlined />,
      label: "财务管理",
      children: [
        { key: "finance-payment", label: "支付记录" },
        { key: "finance-refund", label: "退款记录" }
      ]
    },
    {
      key: "system",
      icon: <SafetyOutlined />,
      label: "系统管理",
      children: [
        { key: "system-user", label: "后台账号" },
        { key: "system-role", label: "角色权限" },
        { key: "system-log", label: "操作日志" },
        { key: "system-config", label: "基础配置" }
      ]
    }
  ];
  const storedPermissionKeys = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(adminPermissionKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const permissionSet = new Set(storedPermissionKeys);
  const isSuperAdmin = localStorage.getItem(adminSuperRoleKey) === "1";
  const canOpenPage = (key: PageKey) => {
    if (isSuperAdmin || !storedPermissionKeys.length) return true;
    if (key === "dashboard") return true;
    return (pagePermissionKeys[key] || []).some(permissionKey => permissionSet.has(permissionKey));
  };
  const visibleMenuItems = menuItems
    .map(item => {
      if (!item.children) return canOpenPage(item.key as PageKey) ? item : null;
      const children = item.children.filter(child => canOpenPage(child.key as PageKey));
      return children.length ? { ...item, children } : null;
    })
    .filter(Boolean);

  const ctx = {
    data,
    setDrawer,
    reload,
    message,
    loadKeys,
    setData,
    go
  };

  return (
    <Layout className="admin-shell">
      <Sider className="admin-sider" collapsible collapsed={collapsed} onCollapse={setCollapsed} width={224} theme="dark">
        <div style={{ height: 64, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", color: "#fff" }}>
          <div className="admin-logo" style={{ width: 38, height: 38, fontSize: 18 }}>B</div>
          {!collapsed && <b>B2B ERP</b>}
        </div>
        <Menu className="admin-menu" theme="dark" mode="inline" selectedKeys={[page]} items={visibleMenuItems} onClick={({ key }) => go(key as PageKey)} />
      </Sider>
      <Layout className="admin-main-layout">
        <Header className="admin-header">
          <div className="admin-tabs">
            <Tabs
              type="editable-card"
              hideAdd
              activeKey={page}
              onChange={key => go(key as PageKey)}
              onEdit={(targetKey, action) => action === "remove" ? closePage(targetKey as PageKey) : undefined}
              items={openPages.map(key => ({
                key,
                label: pageTitles[key][0],
                closable: key !== "dashboard"
              }))}
            />
          </div>
          <Space>
            <Typography.Text>{localStorage.getItem(adminAccountKey) || "管理员"}</Typography.Text>
            <Button
              icon={<PoweroffOutlined />}
              onClick={() => {
                localStorage.removeItem(adminTokenKey);
                localStorage.removeItem(adminAccountKey);
                localStorage.removeItem(adminPermissionKey);
                localStorage.removeItem(adminSuperRoleKey);
                setLoggedIn(false);
              }}
            >
              退出
            </Button>
          </Space>
        </Header>
        <Content className="admin-content">
          <div
            className={`page-wrap ${page === "product-list" || page === "supplier" ? "page-wrap-product-list" : ""} ${page === "product-category" || page === "product-brand" ? "page-wrap-management-board" : ""}`}
          >
            <PageRenderer page={page} ctx={ctx} loading={loading} />
          </div>
        </Content>
      </Layout>
      <Drawer
        open={Boolean(drawer)}
        title={drawer?.title}
        width={drawer?.width || 760}
        className={drawer?.className}
        onClose={() => setDrawer(null)}
        destroyOnClose
      >
        {drawer?.body}
      </Drawer>
    </Layout>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const rememberedLogin = (() => {
    try {
      return JSON.parse(localStorage.getItem(loginRememberKey) || "{}");
    } catch {
      return {};
    }
  })();
  const [loginType, setLoginType] = useState<"phone" | "account">(rememberedLogin.loginType === "account" ? "account" : "phone");
  const [rememberLogin, setRememberLogin] = useState(Boolean(rememberedLogin.remember));

  const submit = async (values: AnyRecord) => {
    setLoading(true);
    try {
      const loginValue = loginType === "phone" ? values.phone : values.username;
      const result = await request("/api/admin/login", {
        method: "POST",
        data: {
          phone: loginType === "phone" ? loginValue : undefined,
          username: loginType === "account" ? loginValue : undefined,
          password: values.password
        }
      });
      localStorage.setItem(adminTokenKey, result.token || "");
      localStorage.setItem(adminAccountKey, [result.username || loginValue, result.realName || result.accountName].filter(Boolean).join("/"));
      localStorage.setItem(adminPermissionKey, JSON.stringify(result.permissionKeys || []));
      localStorage.setItem(adminSuperRoleKey, result.isSuperAdmin ? "1" : "");
      if (rememberLogin) {
        localStorage.setItem(loginRememberKey, JSON.stringify({ remember: true, loginType, phone: values.phone, username: values.username, password: values.password }));
      } else {
        localStorage.removeItem(loginRememberKey);
      }
      message.success("登录成功");
      onSuccess();
    } catch (error: any) {
      message.error(error.message || "账号或密码错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <div className="admin-login-shell">
        <div className="admin-login-brand">
          <div className="admin-login-brand-inner">
            <div className="admin-logo">B</div>
            <div>
              <div className="admin-login-brand-title">B2B ERP</div>
              <div className="admin-login-brand-subtitle">后台管理系统</div>
            </div>
          </div>
        </div>
        <Card className="admin-login-card">
          <Space direction="vertical" size={22} style={{ width: "100%" }}>
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>后台登录</Typography.Title>
              <Typography.Text type="secondary">{loginType === "phone" ? "请输入手机号和密码登录" : "请输入账号和密码登录"}</Typography.Text>
            </div>
          <Form
            layout="vertical"
            onFinish={submit}
            initialValues={{
              phone: rememberedLogin.remember ? rememberedLogin.phone : "",
              username: rememberedLogin.remember ? rememberedLogin.username : "",
              password: rememberedLogin.remember ? rememberedLogin.password : ""
            }}
          >
            <Radio.Group
              className="admin-login-mode-tabs"
              value={loginType}
              onChange={event => setLoginType(event.target.value)}
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: "phone", label: "手机号登录" },
                { value: "account", label: "账号登录" }
              ]}
            />
            {loginType === "phone" ? (
              <Form.Item name="phone" label="手机号" rules={phoneRules()}>
                <Input size="large" maxLength={11} placeholder="请输入手机号" />
              </Form.Item>
            ) : (
              <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入账号" }]}>
                <Input size="large" maxLength={32} placeholder="请输入账号" />
              </Form.Item>
            )}
            <Form.Item name="password" label="密码" rules={passwordRules()}>
              <Input.Password size="large" placeholder="请输入密码" />
            </Form.Item>
            <div className="admin-login-options">
              <Checkbox checked={rememberLogin} onChange={event => setRememberLogin(event.target.checked)}>记住账号</Checkbox>
            </div>
            <Button block size="large" type="primary" htmlType="submit" loading={loading}>登录</Button>
          </Form>
          </Space>
        </Card>
      </div>
    </div>
  );
}

function PageHeader({ page }: { page: PageKey }) {
  return (
    <div className="page-toolbar">
      <div>
        <h1 className="page-title">{pageTitles[page][0]}</h1>
        <div className="page-desc">{pageTitles[page][1]}</div>
      </div>
    </div>
  );
}

type Ctx = {
  data: Record<string, any>;
  setDrawer: (drawer: { title: string; body: React.ReactNode; width?: number | string; className?: string } | null) => void;
  reload: () => void;
  message: any;
  loadKeys: (keys: string[]) => Promise<void>;
  setData?: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  go?: (page: PageKey) => void;
};

function PageRenderer({ page, ctx, loading }: { page: PageKey; ctx: Ctx; loading: boolean }) {
  if (page === "dashboard") return <Dashboard ctx={ctx} loading={loading} />;
  if (page === "product-list") return <ProductPage ctx={ctx} loading={loading} />;
  if (page === "product-category") return <CategoryPage ctx={ctx} loading={loading} />;
  if (page === "product-brand") return <BrandPage ctx={ctx} loading={loading} />;
  if (page === "supplier") return <SupplierPage ctx={ctx} loading={loading} />;
  if (page === "purchase-order") return <PurchaseOrderPage ctx={ctx} loading={loading} />;
  if (page === "purchase-inbound") return <SimpleTablePage loading={loading} rows={ctx.data.purchaseStockIns || []} columns={purchaseInboundColumns()} />;
  if (page === "stock-overview" || page === "stock-adjust") return <InventoryPage ctx={ctx} loading={loading} />;
  if (page === "stock-flow") return <SimpleTablePage loading={loading} rows={ctx.data.inventoryFlows || []} columns={stockFlowColumns()} />;
  if (page === "order") return <OrderPage ctx={ctx} loading={loading} />;
  if (page === "aftersale") return <AfterSalePage ctx={ctx} loading={loading} />;
  if (page === "invoice") return <InvoicePage ctx={ctx} loading={loading} />;
  if (page === "buyer") return <BuyerPage ctx={ctx} loading={loading} />;
  if (page === "finance-payment") return <SimpleTablePage loading={loading} rows={ctx.data.payments || []} columns={paymentColumns()} />;
  if (page === "finance-refund") return <SimpleTablePage loading={loading} rows={ctx.data.refunds || []} columns={refundColumns()} />;
  if (page === "system-user") return <AccountPage ctx={ctx} loading={loading} />;
  if (page === "system-role") return <RolePage ctx={ctx} loading={loading} />;
  if (page === "system-log") return <SimpleTablePage loading={loading} rows={ctx.data.logs || []} columns={logColumns()} />;
  if (page === "system-config") return <SystemConfigPage ctx={ctx} loading={loading} />;
  return null;
}

function Dashboard({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const [range, setRange] = useState("today");
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false);
  const [draftShortcutKeys, setDraftShortcutKeys] = useState<string[]>([]);
  const [shortcutKeys, setShortcutKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("b2b-erp-dashboard-shortcuts");
      if (!raw) return ["product-list", "purchase-order", "order", "stock-overview"];
      const saved = JSON.parse(raw);
      return Array.isArray(saved)
        ? saved.filter((key: string) => key !== "stock-adjust")
        : ["product-list", "purchase-order", "order", "stock-overview"];
    } catch {
      return ["product-list", "purchase-order", "order", "stock-overview"];
    }
  });
  const summary = ctx.data.summary || {};
  const orders = ctx.data.orders || [];
  const inventory = ctx.data.inventory || [];
  const purchaseOrders = ctx.data.purchaseOrders || [];
  const afterSales = ctx.data.afterSales || [];
  const invoices = ctx.data.invoices || [];
  const payments = ctx.data.payments || [];
  const orderCount = Number(summary.todayOrders ?? summary.todayOrderCount ?? orders.length);
  const paymentAmount = Number(summary.todayPaymentAmount ?? payments.reduce((sum: number, item: AnyRecord) => sum + Number(item.amount || 0), 0));
  const saleableSkus = Number(summary.saleableSkus ?? (ctx.data.products || []).filter((item: AnyRecord) => item.saleStatus === "ON_SALE").length);
  const stockWarning = Number(summary.stockWarning ?? inventory.filter((item: AnyRecord) => Number(item.availableQuantity ?? item.stockQuantity ?? 0) <= 0).length);
  const waitShip = orders.filter((x: AnyRecord) => x.orderStatus === "WAIT_SHIP").length;
  const waitPurchaseIn = purchaseOrders.filter((x: AnyRecord) => ["WAIT_IN", "WAIT_STOCK_IN", "PENDING", "CREATED"].includes(String(x.status))).length;
  const waitAfterSale = Number(summary.pendingAfterSale ?? afterSales.filter((x: AnyRecord) => x.status === "WAIT_AUDIT").length);
  const waitInvoice = Number(summary.pendingInvoice ?? invoices.filter((x: AnyRecord) => x.status === "WAIT_INVOICE").length);
  const todoCards = (summary.todoCards || []).length ? summary.todoCards : [
    { module: "订单管理", title: "待发货订单", count: waitShip, target: "orders" },
    { module: "采购管理", title: "待入库采购单", count: waitPurchaseIn, target: "purchase" },
    { module: "库存管理", title: "库存预警", count: stockWarning, target: "inventory" },
    { module: "售后管理", title: "待审核售后", count: waitAfterSale, target: "afterSales" },
    { module: "开票管理", title: "待开票申请", count: waitInvoice, target: "invoices" }
  ];
  const visibleTodoCards = todoCards
    .map((item: AnyRecord) => ({ ...item, count: Number(item.count || 0), page: targetPage(item.target) }))
    .filter((item: AnyRecord) => item.count > 0);
  const shortcutOptions = dashboardShortcutOptions();
  const activeShortcuts = shortcutOptions.filter(item => shortcutKeys.includes(item.key));
  const openShortcutModal = () => {
    setDraftShortcutKeys(shortcutKeys);
    setShortcutModalOpen(true);
  };
  const saveShortcuts = () => {
    const nextKeys = draftShortcutKeys.filter(key => key !== "stock-adjust");
    setShortcutKeys(nextKeys);
    localStorage.setItem("b2b-erp-dashboard-shortcuts", JSON.stringify(nextKeys));
    setShortcutModalOpen(false);
    ctx.message.success("快捷入口已保存");
  };
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div className="metric-grid">
        <MetricCard title="今日订单数" value={orderCount} onClick={() => ctx.go?.("order")} />
        <MetricCard title="今日支付金额" value={paymentAmount} prefix="¥" precision={2} onClick={() => ctx.go?.("finance-payment")} />
        <MetricCard title="在售SKU" value={saleableSkus} onClick={() => ctx.go?.("product-list")} />
        <MetricCard title="库存预警" value={stockWarning} onClick={() => ctx.go?.("stock-overview")} />
      </div>
      {stockWarning > 0 ? (
        <Card styles={{ body: { padding: 14 } }}>
          <Space>
            <Tag color="orange">库存预警</Tag>
            <Typography.Text>当前有 {stockWarning} 个 SKU 触发库存预警，请及时调整库存或补货。</Typography.Text>
            <Button type="link" onClick={() => ctx.go?.("stock-overview")}>去处理</Button>
          </Space>
        </Card>
      ) : null}
      <DashboardTrend orders={orders} payments={payments} range={range} onRangeChange={setRange} />
      <div className="dashboard-work-row">
        <Card title="待办事项" className="dashboard-work-card dashboard-todo-card">
          <AdminTable loading={loading} rowKey={(_, i) => String(i)} pagination={false} dataSource={visibleTodoCards} columns={[
            { title: "待办业务", dataIndex: "title" },
            { title: "数量", dataIndex: "count", width: 120 },
            { title: "操作", align: "left", width: 120, render: (_, item) => <Button type="link" style={{ paddingLeft: 0 }} onClick={() => ctx.go?.(item.page)}>去处理</Button> }
          ]} />
        </Card>
        <Card
          title="快捷功能"
          className="dashboard-work-card dashboard-shortcut-card"
          extra={<Button type="link" onClick={openShortcutModal}>配置快捷入口</Button>}
        >
          <Space wrap size={[12, 12]} className="dashboard-shortcut-list">
            {activeShortcuts.map(item => (
            <Button className="dashboard-shortcut-button" key={item.key} icon={item.icon} onClick={() => ctx.go?.(item.key as PageKey)}>
              {item.label}
            </Button>
          ))}
            {!activeShortcuts.length ? (
              <div className="dashboard-shortcut-empty">
                <Typography.Text type="secondary">暂无快捷入口，请点击配置快捷入口添加。</Typography.Text>
              </div>
            ) : null}
          </Space>
        </Card>
      </div>
      <Modal
        title="配置快捷入口"
        open={shortcutModalOpen}
        onCancel={() => setShortcutModalOpen(false)}
        onOk={saveShortcuts}
        okText="保存"
        cancelText="取消"
        width={640}
      >
        <Checkbox.Group
          value={draftShortcutKeys}
          onChange={keys => setDraftShortcutKeys(keys.map(String))}
          style={{ width: "100%" }}
        >
          <div className="dashboard-shortcut-picker">
            {shortcutOptions.map(item => (
              <Checkbox key={item.key} value={item.key}>{item.label}</Checkbox>
            ))}
          </div>
        </Checkbox.Group>
      </Modal>
    </Space>
  );
}

function dashboardShortcutOptions() {
  return [
    { key: "product-list", label: "商品档案", icon: <ShoppingOutlined /> },
    { key: "product-category", label: "商品分类", icon: <TagsOutlined /> },
    { key: "product-brand", label: "商品品牌", icon: <AppstoreOutlined /> },
    { key: "supplier", label: "供应商管理", icon: <TeamOutlined /> },
    { key: "purchase-order", label: "采购订单", icon: <InboxOutlined /> },
    { key: "purchase-inbound", label: "采购入库", icon: <InboxOutlined /> },
    { key: "stock-overview", label: "库存总览", icon: <BarcodeOutlined /> },
    { key: "order", label: "订单管理", icon: <FileTextOutlined /> },
    { key: "aftersale", label: "售后管理", icon: <AuditOutlined /> },
    { key: "invoice", label: "开票管理", icon: <BankOutlined /> },
    { key: "buyer", label: "买家管理", icon: <TeamOutlined /> },
    { key: "finance-payment", label: "支付记录", icon: <BankOutlined /> },
    { key: "system-user", label: "后台账号", icon: <UserOutlined /> },
    { key: "system-role", label: "角色权限", icon: <SafetyOutlined /> }
  ];
}

function MetricCard({ title, value, prefix, precision, onClick }: { title: string; value: number; prefix?: string; precision?: number; onClick?: () => void }) {
  return (
    <Card hoverable onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <Statistic title={title} value={value} prefix={prefix} precision={precision} />
    </Card>
  );
}

function targetPage(target: string): PageKey {
  const map: Record<string, PageKey> = {
    orders: "order",
    order: "order",
    purchase: "purchase-order",
    purchaseOrders: "purchase-order",
    inventory: "stock-overview",
    afterSales: "aftersale",
    invoices: "invoice",
    payments: "finance-payment",
    products: "product-list"
  };
  return map[target] || "dashboard";
}

function DashboardTrend({ orders, payments, range, onRangeChange }: { orders: AnyRecord[]; payments: AnyRecord[]; range: string; onRangeChange: (range: string) => void }) {
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const rows = dashboardTrendRows(orders, payments, range, nowTick);
  const chartRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    const labels = rows.map(row => row.label);
    const orderValues = rows.map(row => row.orders);
    const amountValues = rows.map(row => Number(row.amount || 0));
    chart.setOption({
      color: ["#4e7cff", "#22c55e"],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line" },
        formatter: (params: any[]) => {
          const index = params[0]?.dataIndex ?? 0;
          const row = rows[index] || {};
          const lines = params.map(item => `${item.marker}${item.seriesName}：${item.seriesName === "支付金额" ? money(item.value) : item.value}`);
          return `<div style="font-weight:700;margin-bottom:4px">${row.tipLabel || row.label || ""}</div>${lines.join("<br/>")}`;
        }
      },
      legend: {
        top: 0,
        right: 4,
        data: ["订单数", "支付金额"]
      },
      grid: {
        top: 34,
        left: 36,
        right: 28,
        bottom: 28,
        containLabel: true
      },
      visualMap: [
        {
          show: false,
          type: "continuous",
          seriesIndex: 0,
          min: 0,
          max: Math.max(1, ...orderValues)
        },
        {
          show: false,
          type: "continuous",
          seriesIndex: 1,
          dimension: 0,
          min: 0,
          max: Math.max(1, labels.length - 1)
        }
      ],
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#d9e2f2" } },
        axisLabel: { color: "#667085", interval: labels.length > 14 ? 2 : "auto" }
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#667085" },
        splitLine: { lineStyle: { color: "#edf0f5" } }
      },
      series: [
        {
          name: "订单数",
          type: "line",
          showSymbol: false,
          smooth: true,
          data: orderValues,
          lineStyle: { width: 3 },
          emphasis: { focus: "series" }
        },
        {
          name: "支付金额",
          type: "line",
          showSymbol: false,
          smooth: true,
          data: amountValues,
          lineStyle: { width: 3 },
          emphasis: { focus: "series" }
        }
      ]
    });
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    observer.observe(chartRef.current);
    return () => {
      window.removeEventListener("resize", resize);
      observer.disconnect();
      chart.dispose();
    };
  }, [rows]);
  const ranges = [
    ["today", "今日"],
    ["yesterday", "昨日"],
    ["thisWeek", "本周"],
    ["lastWeek", "上周"],
    ["thisMonth", "本月"],
    ["lastMonth", "上月"]
  ];
  return (
    <Card
      title="经营趋势"
      extra={<Space wrap>{ranges.map(([key, label]) => <Button key={key} type={range === key ? "primary" : "default"} size="small" onClick={() => onRangeChange(key)}>{label}</Button>)}</Space>}
    >
      <div className="dashboard-chart-responsive">
        <div ref={chartRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </Card>
  );
}

function dashboardTrendRows(orders: AnyRecord[], payments: AnyRecord[], range: string, nowTs = Date.now()) {
  const orderRows = orders
    .map(item => ({ createdAt: parseBeijingTimestamp(item.createdAt || item.updatedAt) }))
    .filter(item => Number.isFinite(item.createdAt)) as Array<{ createdAt: number }>;
  const paymentSource = payments.length ? payments : orders;
  const paymentRows = paymentSource
    .map(item => ({
      createdAt: parseBeijingTimestamp(item.paidAt || item.createdAt || item.updatedAt),
      amount: Number(item.amount ?? item.totalAmount ?? 0)
    }))
    .filter(item => Number.isFinite(item.createdAt)) as Array<{ createdAt: number; amount: number }>;
  const buckets = trendBuckets(range, nowTs);
  return buckets.map(bucket => {
    const orderBucketRows = orderRows.filter(item => item.createdAt >= bucket.start && item.createdAt < bucket.end);
    const paymentBucketRows = paymentRows.filter(item => item.createdAt >= bucket.start && item.createdAt < bucket.end);
    return {
      label: bucket.label,
      tipLabel: bucket.tipLabel,
      orders: orderBucketRows.length,
      amount: paymentBucketRows.reduce((sum, item) => sum + item.amount, 0)
    };
  });
}

const BEIJING_OFFSET_HOURS = 8;

function beijingParts(value: Date | number = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value || 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second")
  };
}

function beijingTimestamp(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  return Date.UTC(year, month - 1, day, hour - BEIJING_OFFSET_HOURS, minute, second);
}

function parseBeijingTimestamp(value: any) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const text = String(value).trim();
  if (!text) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
    const parsed = Date.parse(text.replace(" ", "T"));
    return Number.isNaN(parsed) ? null : parsed;
  }
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?/);
  if (match) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
    return beijingTimestamp(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function addDaysTs(value: number, days: number) {
  return value + days * 24 * 60 * 60 * 1000;
}

function startOfBeijingDay(value: Date | number = Date.now()) {
  const parts = beijingParts(value);
  return beijingTimestamp(parts.year, parts.month, parts.day);
}

function startOfBeijingWeek(value: Date | number = Date.now()) {
  const parts = beijingParts(value);
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() || 7;
  return addDaysTs(beijingTimestamp(parts.year, parts.month, parts.day), 1 - day);
}

function addBeijingMonths(parts: { year: number; month: number }, offset: number) {
  const zeroBased = parts.year * 12 + (parts.month - 1) + offset;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12 + 12) % 12 + 1 };
}

function formatTip(start: number, end: number) {
  const format = (value: number) => {
    const parts = beijingParts(value);
    return `${parts.month}月${parts.day}日 ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  };
  return `${format(start)} - ${format(end)}`;
}

function trendBuckets(range: string, nowTs = Date.now()) {
  const dayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const baseDay = startOfBeijingDay(nowTs);
  if (range === "today" || range === "yesterday") {
    const start = range === "yesterday" ? addDaysTs(baseDay, -1) : baseDay;
    return Array.from({ length: 24 }, (_, hour) => {
      const bucketStart = start + hour * 60 * 60 * 1000;
      const bucketEnd = start + (hour + 1) * 60 * 60 * 1000;
      return { label: `${String(hour).padStart(2, "0")}:00`, tipLabel: formatTip(bucketStart, bucketEnd), start: bucketStart, end: bucketEnd };
    });
  }
  if (range === "thisWeek" || range === "lastWeek") {
    const weekStart = startOfBeijingWeek(nowTs);
    const start = range === "lastWeek" ? addDaysTs(weekStart, -7) : weekStart;
    return dayLabels.map((label, index) => {
      const bucketStart = addDaysTs(start, index);
      const bucketEnd = addDaysTs(bucketStart, 1);
      return { label, tipLabel: formatTip(bucketStart, bucketEnd), start: bucketStart, end: bucketEnd };
    });
  }
  const nowParts = beijingParts(nowTs);
  const monthParts = range === "lastMonth" ? addBeijingMonths(nowParts, -1) : { year: nowParts.year, month: nowParts.month };
  const days = new Date(Date.UTC(monthParts.year, monthParts.month, 0)).getUTCDate();
  const step = days > 18 ? 3 : 1;
  const buckets = [];
  for (let day = 1; day <= days; day += step) {
    const bucketStart = beijingTimestamp(monthParts.year, monthParts.month, day);
    const endDay = Math.min(days + 1, day + step);
    const bucketEnd = endDay > days
      ? beijingTimestamp(...Object.values(addBeijingMonths(monthParts, 1)), 1)
      : beijingTimestamp(monthParts.year, monthParts.month, endDay);
    buckets.push({ label: `${day}日`, tipLabel: formatTip(bucketStart, bucketEnd), start: bucketStart, end: bucketEnd });
  }
  return buckets;
}

function SimpleTablePage({ rows, columns, loading }: { rows: AnyRecord[]; columns: ColumnsType<AnyRecord>; loading: boolean }) {
  return <Card><AdminTable loading={loading} rowKey={row => String(row.id ?? row.orderNo ?? row.productCode ?? Math.random())} columns={columns} dataSource={rows} scroll={{ x: true }} /></Card>;
}

function buildCategoryTreeData(categories: AnyRecord[]) {
  const uniqueCategories = categories
    .filter(item => String(item?.categoryName || "").trim())
    .filter((item, index, list) => list.findIndex(current => String(current?.categoryName || "").trim() === String(item?.categoryName || "").trim()) === index)
    .map((item, index) => ({
      ...item,
      categoryName: String(item.categoryName).trim(),
      parentName: String(item.parentName || "").trim(),
      sortWeight: Number.isFinite(Number(item.sortNo)) ? Number(item.sortNo) : index + 1
    }));

  const sortNodes = (nodes: AnyRecord[]) =>
    nodes
      .sort((a, b) => Number(a.sortWeight || 0) - Number(b.sortWeight || 0) || String(a.title || "").localeCompare(String(b.title || ""), "zh-CN"))
      .map(node => ({ ...node, children: sortNodes(node.children || []) }));

  const nodeMap = new Map<string, AnyRecord>();
  uniqueCategories.forEach((item, index) => {
    nodeMap.set(item.categoryName, {
      key: `category:${item.categoryName}`,
      title: item.categoryName,
      raw: item,
      sortWeight: item.sortWeight ?? index + 1,
      children: []
    });
  });

  const roots: AnyRecord[] = [];
  uniqueCategories.forEach(item => {
    const currentNode = nodeMap.get(item.categoryName);
    if (!currentNode) return;
    const parentName = item.parentName && item.parentName !== "-" ? item.parentName : "";
    const parentNode = parentName ? nodeMap.get(parentName) : undefined;
    if (parentNode && parentNode !== currentNode) {
      parentNode.children.push(currentNode);
      return;
    }
    roots.push(currentNode);
  });

  return [{
    key: "category:__all__",
    title: "全部分类",
    isAll: true,
    children: sortNodes(roots)
  }];
}

function filterCategoryTreeData(treeData: AnyRecord[], keyword: string): AnyRecord[] {
  const search = keyword.trim().toLowerCase();
  if (!search) return treeData;

  const filterNodes = (nodes: AnyRecord[]): AnyRecord[] =>
    nodes
      .map(node => {
        const children = filterNodes(node.children || []);
        const title = String(node.title || "").trim().toLowerCase();
        if (title.includes(search) || children.length) {
          return { ...node, children };
        }
        return null;
      })
      .filter(Boolean) as AnyRecord[];

  return filterNodes(treeData);
}

function parseBatchQueryKeywords(text: string) {
  return Array.from(
    new Set(
      text
        .split(/[\s,，]+/)
        .map(item => item.trim())
        .filter(Boolean)
    )
  );
}

function getBatchQueryFields(item: AnyRecord) {
  return [
    item.productCode,
    item.skuCode,
    item.productName,
    item.productAlias,
    item.aliasName,
    item.alias,
    item.shortName
  ]
    .filter(Boolean)
    .map(value => String(value).trim().toLowerCase());
}

function getProductTagFields(item: AnyRecord) {
  const values = [item.productTag, item.tagName, item.tags, item.labels, item.productLabels];
  return values
    .flatMap(value => Array.isArray(value) ? value : String(value || "").split(/[\s,，]+/))
    .map(value => String(value || "").trim())
    .filter(Boolean);
}

function collectTreeKeys(nodes: AnyRecord[]) {
  const keys: React.Key[] = [];
  const walk = (items: AnyRecord[]) => {
    items.forEach(item => {
      keys.push(item.key);
      if (item.children?.length) walk(item.children);
    });
  };
  walk(nodes);
  return keys;
}

function collectCategoryNames(node?: AnyRecord) {
  const names = new Set<string>();
  const walk = (current?: AnyRecord) => {
    if (!current) return;
    const name = String(current.raw?.categoryName || "").trim();
    if (name) names.add(name);
    (current.children || []).forEach(walk);
  };
  walk(node);
  return Array.from(names);
}

const productColumnDefaults = [
  { key: "index", label: "序号", width: 72 },
  { key: "skuCode", label: "商品条码", width: 150 },
  { key: "productCode", label: "商品代码", width: 150 },
  { key: "productName", label: "商品名称", width: 260 },
  { key: "categoryName", label: "商品分类", width: 150 },
  { key: "saleStatus", label: "是否淘汰", width: 120 },
  { key: "skuName", label: "规格", width: 140 },
  { key: "unit", label: "基本单位", width: 120 },
  { key: "brandName", label: "商品品牌", width: 140 },
  { key: "quoteType", label: "报价方式", width: 140 },
  { key: "salePrice", label: "售价", width: 120 },
  { key: "stockQuantity", label: "库存", width: 100 }
];

const defaultProductColumnOrder = productColumnDefaults.map(column => column.key);
const productColumnSettingsStorageKey = "b2b-erp-product-column-settings";
const productColumnOrderStorageKey = "b2b-erp-product-column-order";

function createProductColumnSettings() {
  return Object.fromEntries(productColumnDefaults.map(column => [
    column.key,
    { visible: true, width: column.width, fixed: undefined }
  ]));
}

function loadProductColumnSettings() {
  const defaults = createProductColumnSettings();
  try {
    const raw = JSON.parse(localStorage.getItem(productColumnSettingsStorageKey) || "{}");
    return Object.fromEntries(productColumnDefaults.map(column => {
      const current = raw?.[column.key] || {};
      const width = Number(current.width);
      const fixed = current.fixed === "left" || current.fixed === "right" ? current.fixed : undefined;
      return [
        column.key,
        {
          visible: current.visible !== false,
          width: Number.isFinite(width) && width >= 70 ? width : column.width,
          fixed
        }
      ];
    }));
  } catch {
    return defaults;
  }
}

function loadProductColumnOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem(productColumnOrderStorageKey) || "[]");
    const valid = Array.isArray(raw)
      ? raw.filter((key, index) => defaultProductColumnOrder.includes(key) && raw.indexOf(key) === index)
      : [];
    return [...valid, ...defaultProductColumnOrder.filter(key => !valid.includes(key))];
  } catch {
    return defaultProductColumnOrder;
  }
}

function firstPresent<T>(...values: T[]) {
  return values.find(value => value !== undefined && value !== null);
}

function normalizeProductSaleMode(item?: AnyRecord) {
  const raw = firstPresent(
    item?.saleMode,
    item?.sale_mode,
    item?.sellingMode,
    item?.saleType
  );
  const text = String(raw || "").trim().toUpperCase();
  if (text === "BATCH" || text.includes("批量")) return "BATCH";
  if (text === "NORMAL" || text.includes("普通")) return "NORMAL";

  const saleUnit = String(firstPresent(item?.saleUnit, item?.sale_unit, item?.sellingUnit) || "").trim();
  const ratio = firstPresent(item?.saleUnitRatio, item?.sale_unit_ratio, item?.conversionRatio, item?.unitConvertRatio);
  return saleUnit || ratio !== undefined && ratio !== null ? "BATCH" : undefined;
}

function normalizeProductSaleUnitRatio(item?: AnyRecord) {
  const raw = firstPresent(item?.saleUnitRatio, item?.sale_unit_ratio, item?.conversionRatio, item?.unitConvertRatio);
  if (raw === undefined || raw === null || raw === "") return undefined;
  const ratio = Number(raw);
  return Number.isFinite(ratio) ? ratio : undefined;
}

function normalizeProductRecord(item?: AnyRecord) {
  if (!item || typeof item !== "object") return undefined;
  return {
    ...item,
    id: firstPresent(item.id, item.productId),
    productCode: firstPresent(item.productCode, item.product_code),
    skuCode: firstPresent(item.skuCode, item.sku_code),
    skuBarcode: firstPresent(item.skuBarcode, item.sku_barcode, item.barcode, item.barCode),
    productName: firstPresent(item.productName, item.product_name),
    categoryName: firstPresent(item.categoryName, item.category_name),
    brandName: firstPresent(item.brandName, item.brand_name),
    skuName: firstPresent(item.skuName, item.sku_name),
    skuStatus: firstPresent(item.skuStatus, item.sku_status),
    unit: firstPresent(item.unit, item.baseUnit, item.base_unit),
    quoteType: firstPresent(item.quoteType, item.quote_type),
    saleMode: normalizeProductSaleMode(item),
    saleUnit: firstPresent(item.saleUnit, item.sale_unit, item.sellingUnit),
    saleUnitRatio: normalizeProductSaleUnitRatio(item),
    mainImageUrl: firstPresent(item.mainImageUrl, item.main_image_url, item.imageUrl, item.image_url),
    detailContent: firstPresent(item.detailContent, item.detail_content),
    salePrice: firstPresent(item.salePrice, item.sale_price),
    stockQuantity: firstPresent(item.stockQuantity, item.stock_quantity),
    minOrderQuantity: firstPresent(item.minOrderQuantity, item.min_order_quantity),
    skuList: firstPresent(item.skuList, item.skuListJson, item.sku_list_json),
    skuListJson: firstPresent(item.skuListJson, item.skuList, item.sku_list_json),
    tierPrices: firstPresent(item.tierPrices, item.tierPricesJson, item.tier_prices_json),
    tierPricesJson: firstPresent(item.tierPricesJson, item.tierPrices, item.tier_prices_json),
    saleStatus: firstPresent(item.saleStatus, item.sale_status),
    updatedAt: firstPresent(item.updatedAt, item.updated_at),
    createdAt: firstPresent(item.createdAt, item.created_at)
  };
}

function unwrapProductResponse(payload: AnyRecord, productId?: React.Key) {
  const expectedId = productId === undefined || productId === null ? null : String(productId);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.value)
      ? payload.value
      : Array.isArray(payload?.rows)
        ? payload.rows
        : null;
  if (list) {
    const matched = expectedId
      ? list.find(row => String(row?.id ?? row?.productId ?? "") === expectedId)
      : list[0];
    return normalizeProductRecord(matched);
  }
  if (payload?.value && typeof payload.value === "object" && !Array.isArray(payload.value)) {
    return normalizeProductRecord(payload.value);
  }
  return normalizeProductRecord(payload);
}

async function requestProductDetail(item?: AnyRecord) {
  const normalizedItem = normalizeProductRecord(item);
  if (!normalizedItem?.id) return normalizedItem;

  const urls = [`/api/admin/products/${normalizedItem.id}`, `/api/products/${normalizedItem.id}`];
  for (const url of urls) {
    try {
      const response = await request(url);
      const detail = unwrapProductResponse(response, normalizedItem.id);
      if (detail) return { ...normalizedItem, ...detail };
    } catch {
      continue;
    }
  }
  return normalizedItem;
}

function upsertProductRecord(rows: AnyRecord[], nextItem?: AnyRecord, prepend = false) {
  const normalizedItem = normalizeProductRecord(nextItem);
  if (!normalizedItem?.id) return Array.isArray(rows) ? rows : [];

  const currentRows = Array.isArray(rows) ? rows : [];
  const nextRows = currentRows.map(row =>
    String(row?.id ?? "") === String(normalizedItem.id)
      ? { ...row, ...normalizedItem }
      : row
  );
  const exists = nextRows.some(row => String(row?.id ?? "") === String(normalizedItem.id));
  if (exists) return nextRows;
  return prepend ? [normalizedItem, ...nextRows] : [...nextRows, normalizedItem];
}

function buildProductUpdatePayload(item: AnyRecord, patch: AnyRecord = {}) {
  const normalizedItem = normalizeProductRecord(item) || item;
  const tierPrices = productTierRows(normalizedItem).map((row: AnyRecord) => ({
    minQty: Number(row.minQty || 1),
    price: Number(row.price || 0)
  }));
  const skuList = productSkuRows(normalizedItem).map((row: AnyRecord) => ({
    skuName: normalizeSkuName(row, normalizedItem?.skuName || ""),
    ...row,
    salePrice: Number(row.salePrice ?? normalizedItem?.salePrice ?? 0),
    stockQuantity: Number(row.stockQuantity ?? normalizedItem?.stockQuantity ?? 0),
    minOrderQuantity: Number(row.minOrderQuantity ?? normalizedItem?.minOrderQuantity ?? 1),
    tierPrices: parseRows(row.tierPrices)
  }));
  return {
    productName: normalizedItem?.productName || "",
    unit: normalizedItem?.unit || "件",
    salePrice: Number(normalizedItem?.salePrice || 0),
    stockQuantity: Number(normalizedItem?.stockQuantity ?? 0),
    minOrderQuantity: Number(normalizedItem?.minOrderQuantity || 1),
    skuCode: normalizedItem?.skuCode || "",
    skuBarcode: normalizedItem?.skuBarcode || "",
    categoryName: patch.categoryName ?? normalizedItem?.categoryName ?? "",
    brandName: patch.brandName ?? normalizedItem?.brandName ?? "",
    quoteType: normalizedItem?.quoteType || "INDEPENDENT_PRICE",
    saleMode: normalizedItem?.saleMode || "NORMAL",
    saleUnit: normalizedItem?.saleMode === "BATCH" ? normalizedItem?.saleUnit || null : null,
    saleUnitRatio: normalizedItem?.saleMode === "BATCH" ? Number(normalizedItem?.saleUnitRatio) || null : null,
    saleStatus: patch.saleStatus ?? normalizedItem?.saleStatus ?? "ON_SALE",
    mainImageUrl: normalizedItem?.mainImageUrl || "",
    detailContent: normalizedItem?.detailContent || "",
    skuStatus: normalizedItem?.skuStatus || "ENABLED",
    skuList,
    tierPrices
  };
}

function ProductPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const rows = ctx.data.products || [];
  const categories = ctx.data.categories || [];
  const brands = ctx.data.brands || [];
  const [batchEditForm] = Form.useForm();
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [categoryName, setCategoryName] = useState<string>();
  const [brandNameInput, setBrandNameInput] = useState<string>();
  const [brandName, setBrandName] = useState<string>();
  const [productTagInput, setProductTagInput] = useState<string>();
  const [productTag, setProductTag] = useState<string>();
  const [saleStatusInput, setSaleStatusInput] = useState<string>();
  const [saleStatus, setSaleStatus] = useState<string>();
  const [archiveStatusInput, setArchiveStatusInput] = useState<string>();
  const [archiveStatus, setArchiveStatus] = useState<string>();
  const [batchQueryOpen, setBatchQueryOpen] = useState(false);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditSubmitting, setBatchEditSubmitting] = useState(false);
  const [batchQueryText, setBatchQueryText] = useState("");
  const [batchKeywordsInput, setBatchKeywordsInput] = useState<string[]>([]);
  const [batchKeywords, setBatchKeywords] = useState<string[]>([]);
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<React.Key[]>(["category:__all__"]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [columnSettings, setColumnSettings] = useState(loadProductColumnSettings);
  const [columnOrder, setColumnOrder] = useState(loadProductColumnOrder);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string>();
  const [productSort, setProductSort] = useState<{ key?: string; order?: "ascend" | "descend" }>({});
  const categoryTreeData = useMemo(() => buildCategoryTreeData(categories), [categories]);
  const filteredCategoryTreeData = useMemo(() => filterCategoryTreeData(categoryTreeData, categoryKeyword), [categoryKeyword, categoryTreeData]);
  const visibleExpandedCategoryKeys = useMemo(
    () => (categoryKeyword ? collectTreeKeys(filteredCategoryTreeData) : expandedCategoryKeys),
    [categoryKeyword, expandedCategoryKeys, filteredCategoryTreeData]
  );
  const orderedProductColumnDefaults = useMemo(() => {
    const columnMap = new Map(productColumnDefaults.map(column => [column.key, column]));
    return columnOrder.map(key => columnMap.get(key)).filter(Boolean);
  }, [columnOrder]);
  const batchKeywordSet = useMemo(() => new Set(batchKeywords.map(item => item.toLowerCase())), [batchKeywords]);
  const selectedProducts = useMemo(() => {
    const selectedKeySet = new Set(selectedRowKeys.map(key => String(key)));
    return rows.filter((item: AnyRecord) => selectedKeySet.has(String(item.id)));
  }, [rows, selectedRowKeys]);
  const filteredRows = rows.filter((item: AnyRecord) => {
    const searchText = [
      item.productCode,
      item.skuCode,
      item.productName,
      item.productAlias,
      item.aliasName,
      item.categoryName,
      item.brandName
    ].filter(Boolean).join(" ").toLowerCase();
    const batchMatched = !batchKeywordSet.size || getBatchQueryFields(item).some(value => batchKeywordSet.has(value));
    const itemTags = getProductTagFields(item);
    return (!keyword || searchText.includes(keyword.trim().toLowerCase()))
      && (!categoryName || item.categoryName === categoryName)
      && (!brandName || item.brandName === brandName)
      && (!productTag || !itemTags.length || itemTags.includes(productTag))
      && (!saleStatus || item.saleStatus === saleStatus)
      && (!archiveStatus || item.saleStatus === (archiveStatus === "YES" ? "OFF_SALE" : "ON_SALE"))
      && batchMatched;
  });
  const brandOptions = Array.from(new Set(brands.map((x: AnyRecord) => x.brandName).filter(Boolean))).map(value => ({ value, label: value }));
  const tagOptions = [{ value: "重点商品", label: "重点商品" }, { value: "常规商品", label: "常规商品" }];
  const saleStatusOptions = [{ value: "ON_SALE", label: "已上架" }, { value: "OFF_SALE", label: "已下架" }];
  const archiveStatusOptions = [{ value: "YES", label: "是" }, { value: "NO", label: "否" }];
  const selectedCategoryKey = categoryName ? `category:${categoryName}` : "category:__all__";
  const productSortComparers: Record<string, (a: AnyRecord, b: AnyRecord) => number> = {
    skuCode: (a, b) => String(a.skuCode || "").localeCompare(String(b.skuCode || "")),
    productCode: (a, b) => String(a.productCode || "").localeCompare(String(b.productCode || "")),
    productName: (a, b) => String(a.productName || "").localeCompare(String(b.productName || "")),
    categoryName: (a, b) => String(a.categoryName || "").localeCompare(String(b.categoryName || "")),
    saleStatus: (a, b) => String(a.saleStatus || "").localeCompare(String(b.saleStatus || ""))
  };
  const sortedRows = productSort.key && productSort.order && productSortComparers[productSort.key]
    ? [...filteredRows].sort((a, b) => {
      const result = productSortComparers[productSort.key!](a, b);
      return productSort.order === "ascend" ? result : -result;
    })
    : filteredRows;
  const toolbarButton = (label: string, icon?: React.ReactNode, onClick?: () => void) => <Button type="primary" icon={icon} onClick={onClick}>{label}</Button>;
  const updateColumnSetting = (key: string, patch: AnyRecord) => {
    setColumnSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], ...patch }
    }));
  };
  const moveColumnSetting = (sourceKey?: string, targetKey?: string) => {
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;
    setColumnOrder(prev => {
      if (!prev.includes(sourceKey) || !prev.includes(targetKey)) return prev;
      const next = prev.filter(key => key !== sourceKey);
      const targetIndex = next.indexOf(targetKey);
      next.splice(targetIndex, 0, sourceKey);
      return next;
    });
  };
  const startColumnResize = (key: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const defaultWidth = productColumnDefaults.find(column => column.key === key)?.width || 120;
    const startWidth = columnSettings[key]?.width || defaultWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(70, Math.round(startWidth + moveEvent.clientX - startX));
      updateColumnSetting(key, { width: nextWidth });
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("product-column-resizing");
    };
    document.body.classList.add("product-column-resizing");
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };
  const toggleProductSort = (key: string) => {
    setProductSort(prev => {
      if (prev.key !== key) return { key, order: "ascend" };
      if (prev.order === "ascend") return { key, order: "descend" };
      return {};
    });
  };
  const renderResizableTitle = (key: string, label: React.ReactNode, sortable = false) => (
    <span className="product-column-title" onClick={event => event.stopPropagation()}>
      <span className="product-column-title-text">{label}</span>
      {sortable && (
        <button
          type="button"
          className={`product-column-sort-button ${productSort.key === key ? `is-${productSort.order}` : ""}`}
          aria-label={`${label}排序`}
          onMouseDown={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation();
            toggleProductSort(key);
          }}
        >
          <CaretUpOutlined className="product-column-sort-up" />
          <CaretDownOutlined className="product-column-sort-down" />
        </button>
      )}
      <span className="product-column-resize-handle" onMouseDown={event => startColumnResize(key, event)} />
    </span>
  );
  const applyFilters = () => {
    setKeyword(keywordInput.trim());
    setBrandName(brandNameInput);
    setProductTag(productTagInput);
    setSaleStatus(saleStatusInput);
    setArchiveStatus(archiveStatusInput);
    setBatchKeywords(batchKeywordsInput);
  };
  const resetFilters = () => {
    setKeywordInput("");
    setKeyword("");
    setBrandNameInput(undefined);
    setBrandName(undefined);
    setProductTagInput(undefined);
    setProductTag(undefined);
    setSaleStatusInput(undefined);
    setSaleStatus(undefined);
    setArchiveStatusInput(undefined);
    setArchiveStatus(undefined);
    setBatchQueryText("");
    setBatchKeywordsInput([]);
    setBatchKeywords([]);
    setCategoryKeyword("");
    setCategoryName(undefined);
    setExpandedCategoryKeys(["category:__all__"]);
    setSelectedRowKeys([]);
  };
  const openBatchQueryModal = () => {
    setBatchQueryText(batchKeywordsInput.join("\n"));
    setBatchQueryOpen(true);
  };
  const applyBatchQuery = () => {
    const nextKeywords = parseBatchQueryKeywords(batchQueryText);
    if (nextKeywords.length > 100) {
      ctx.message.warning("批量查询最多支持100个条件");
      return;
    }
    setBatchKeywordsInput(nextKeywords);
    setBatchQueryOpen(false);
  };
  const openBatchEditModal = () => {
    if (!selectedRowKeys.length) {
      ctx.message.error("请先选择需要修改的商品");
      return;
    }
    batchEditForm.resetFields();
    setBatchEditOpen(true);
  };
  const submitBatchEdit = async () => {
    const values = await batchEditForm.validateFields();
    const patch = Object.fromEntries(Object.entries({
      categoryName: values.categoryName,
      brandName: values.brandName,
      saleStatus: values.saleStatus
    }).filter(([, value]) => value !== undefined));
    if (!Object.keys(patch).length) {
      ctx.message.warning("请至少选择一项修改内容");
      return;
    }
    setBatchEditSubmitting(true);
    try {
      await Promise.all(selectedProducts.map((item: AnyRecord) => request(`/api/admin/products/${item.id}`, {
        method: "PUT",
        data: buildProductUpdatePayload(item, patch)
      })));
      ctx.message.success(`已批量修改 ${selectedProducts.length} 个商品`);
      setBatchEditOpen(false);
      batchEditForm.resetFields();
      setSelectedRowKeys([]);
      ctx.reload();
    } catch (error: any) {
      ctx.message.error(error.message);
    } finally {
      setBatchEditSubmitting(false);
    }
  };
  const baseColumns: ColumnsType<AnyRecord> = [
    { key: "index", title: "序号", width: 72, align: "center", className: "product-index-column", render: (_, __, index) => index + 1 },
    { key: "skuCode", title: "商品条码", dataIndex: "skuCode", width: 150, align: "left", className: "product-sku-column", render: (v, item) => <Button className="product-sku-link" type="link" onClick={() => productDetail(ctx, item)}>{v || item.productCode || "-"}</Button> },
    { key: "productCode", title: "商品代码", dataIndex: "productCode", width: 150, render: compactText },
    { key: "productName", title: "商品名称", dataIndex: "productName", width: 260, render: renderProductNameCell },
    { key: "categoryName", title: "商品分类", dataIndex: "categoryName", width: 150 },
    { key: "saleStatus", title: "是否淘汰", dataIndex: "saleStatus", width: 120, render: v => <span className={v === "OFF_SALE" ? "archive-danger-text" : ""}>{v === "OFF_SALE" ? "是" : "否"}</span> },
    { key: "skuName", title: "规格", dataIndex: "skuName", width: 140, render: v => v || "-" },
    { key: "unit", title: "基本单位", dataIndex: "unit", width: 120, render: v => v || "-" },
    { key: "brandName", title: "商品品牌", dataIndex: "brandName", width: 140, render: v => v || "-" },
    { key: "quoteType", title: "报价方式", dataIndex: "quoteType", width: 140, render: v => v === "TIER_PRICE" ? "阶梯报价" : "规格独立价" },
    { key: "salePrice", title: "售价", dataIndex: "salePrice", width: 120, render: money },
    { key: "stockQuantity", title: "库存", dataIndex: "stockQuantity", width: 100 },
    {
      key: "action",
      title: "",
      fixed: "right",
      width: 132,
      align: "center",
      className: "product-action-column",
      onHeaderCell: () => ({ className: "product-action-header", width: 132 }),
      onCell: () => ({ className: "product-action-column" }),
      render: (_, item) => (
        <Space size={7} className="product-action-links">
          <Button type="link" icon={<EditOutlined />} onClick={() => productForm(ctx, item)}>编辑</Button>
          <Button type="link" onClick={() => productSale(ctx, item)}>{item.saleStatus === "ON_SALE" ? "下架" : "上架"}</Button>
        </Space>
      )
    }
  ];
  const baseColumnMap = new Map(baseColumns.map(column => [String(column.key), column]));
  const orderedBaseColumns = [
    ...columnOrder.map(key => baseColumnMap.get(key)).filter(Boolean),
    baseColumnMap.get("action")
  ].filter(Boolean);
  const columns = orderedBaseColumns
    .filter(column => column.key === "action" || columnSettings[String(column.key)]?.visible !== false)
    .map(column => {
      if (column.key === "action") return column;
      const key = String(column.key);
      const setting = columnSettings[key] || {};
      const width = Number(setting.width || column.width || 120);
      const headerClassName = key === "index" ? "product-index-header" : undefined;
      return {
        ...column,
        width,
        fixed: setting.fixed || undefined,
        title: renderResizableTitle(key, column.title, Boolean(productSortComparers[key])),
        onHeaderCell: () => ({ width, className: headerClassName })
      };
    });
  const productTableScrollX = Math.max(960, columns.reduce((sum, column) => sum + Number(column.width || 120), 64));

  useEffect(() => {
    localStorage.setItem(productColumnSettingsStorageKey, JSON.stringify(columnSettings));
  }, [columnSettings]);

  useEffect(() => {
    localStorage.setItem(productColumnOrderStorageKey, JSON.stringify(columnOrder));
  }, [columnOrder]);

  return (
    <div className="product-archive-page">
      <aside className="product-archive-sidebar">
        <Input
          className="product-archive-sidebar-search"
          value={categoryKeyword}
          placeholder="请输入分类名称"
          allowClear
          onChange={event => setCategoryKeyword(event.target.value)}
        />
        <div className="product-category-tree">
          <Tree
            blockNode
            expandedKeys={visibleExpandedCategoryKeys}
            selectedKeys={[selectedCategoryKey]}
            switcherIcon={({ expanded }) => <DownOutlined rotate={expanded ? 0 : -90} />}
            treeData={filteredCategoryTreeData}
            onExpand={keys => setExpandedCategoryKeys(keys)}
            onSelect={(keys, info) => {
              const key = String(keys[0] || "");
              if (!key) return;
              if (key === "category:__all__") {
                setCategoryName(undefined);
                return;
              }
              setCategoryName(info.node.raw?.categoryName);
            }}
          />
        </div>
      </aside>
      <section className="product-archive-main">
        <div className="product-archive-filters">
          <div className="product-archive-filter-stack">
            <label className="product-archive-filter-keyword">
              <span>关键字</span>
              <div className="product-archive-keyword-search">
                <Input
                  className="product-archive-keyword-input"
                  value={keywordInput}
                  allowClear
                  placeholder="代码 | 条码 | 名称"
                  suffix={(
                    <span
                      className="product-archive-keyword-addon"
                      onMouseDown={event => event.preventDefault()}
                      onClick={openBatchQueryModal}
                    >
                      <PlusOutlined />
                    </span>
                  )}
                  onChange={event => setKeywordInput(event.target.value)}
                />
              </div>
            </label>
            <label>
              <span>商品状态</span>
              <Select allowClear placeholder="请选择商品状态" value={saleStatusInput} options={saleStatusOptions} onChange={setSaleStatusInput} />
            </label>
          </div>
          <label>
            <span>商品品牌</span>
            <Select allowClear showSearch placeholder="请选择商品品牌" value={brandNameInput} options={brandOptions} onChange={setBrandNameInput} />
          </label>
          <label>
            <span>商品标签</span>
            <Select allowClear placeholder="请选择商品标签" value={productTagInput} options={tagOptions} onChange={setProductTagInput} />
          </label>
          <div className="product-archive-filter-actions-stack">
            <label>
              <span>是否淘汰</span>
              <Select allowClear placeholder="请选择" value={archiveStatusInput} options={archiveStatusOptions} onChange={setArchiveStatusInput} />
            </label>
            <div className="product-archive-query-actions">
              <Button type="primary" onClick={applyFilters}>查询</Button>
              <Button onClick={resetFilters}>重置</Button>
            </div>
          </div>
        </div>
        <div className="product-archive-toolbar">
          {toolbarButton("新增", <PlusOutlined />, () => productForm(ctx))}
          {toolbarButton("导入")}
          {toolbarButton("导出")}
          {toolbarButton("批量修改", undefined, openBatchEditModal)}
          {toolbarButton("批量删除")}
        </div>
        <div className="product-archive-table">
          <AdminTable
            loading={loading}
            rowKey="id"
            columns={columns}
            dataSource={sortedRows}
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
            pagination={{ className: "product-archive-pagination" }}
            tableLayout="fixed"
            scroll={{ x: productTableScrollX, y: "max(300px, calc(100vh - 365px))" }}
          />
          <div className="product-action-header-overlay" aria-hidden={false}>
            <span>操作</span>
            <Tooltip title="列设置">
              <Button
                type="text"
                size="small"
                className="product-action-settings-button"
                icon={<SettingOutlined />}
                aria-label="列设置"
                onClick={() => setColumnSettingsOpen(true)}
              />
            </Tooltip>
          </div>
        </div>
      </section>
      <Modal
        open={batchEditOpen}
        title="批量修改"
        width={720}
        destroyOnClose
        confirmLoading={batchEditSubmitting}
        onCancel={() => {
          setBatchEditOpen(false);
          batchEditForm.resetFields();
        }}
        onOk={submitBatchEdit}
        okText="更新"
      >
        <Form form={batchEditForm} layout="vertical">
          <Typography.Text type="secondary">
            已选中 {selectedProducts.length} 个商品，可批量修改商品分类、商品品牌、商品状态。
          </Typography.Text>
          <Form.Item name="categoryName" label="商品分类" style={{ marginTop: 16 }}>
            <Select
              showSearch
              allowClear
              placeholder="不修改商品分类"
              options={categories.map((x: AnyRecord) => ({ value: x.categoryName, label: x.categoryName }))}
            />
          </Form.Item>
          <Form.Item name="brandName" label="商品品牌">
            <Select
              showSearch
              allowClear
              placeholder="不修改商品品牌"
              options={brands.map((x: AnyRecord) => ({ value: x.brandName, label: x.brandName }))}
            />
          </Form.Item>
          <Form.Item name="saleStatus" label="商品状态">
            <Select allowClear placeholder="不修改商品状态" options={saleStatusOptions} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={columnSettingsOpen}
        title="列设置"
        width={760}
        className="product-column-settings-modal"
        onCancel={() => setColumnSettingsOpen(false)}
        footer={(
          <div className="product-column-settings-footer">
            <Button onClick={() => {
              setColumnSettings(createProductColumnSettings());
              setColumnOrder(defaultProductColumnOrder);
            }}
            >
              恢复默认
            </Button>
            <Space>
              <Button onClick={() => setColumnSettingsOpen(false)}>取消</Button>
              <Button type="primary" onClick={() => setColumnSettingsOpen(false)}>确定</Button>
            </Space>
          </div>
        )}
      >
        <div className="product-column-settings">
          <div className="product-column-settings-list">
            {orderedProductColumnDefaults.map(column => (
              <div
                className={`product-column-setting-row ${draggingColumnKey === column.key ? "is-dragging" : ""}`}
                key={column.key}
                onDragOver={event => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={event => {
                  event.preventDefault();
                  const sourceKey = event.dataTransfer.getData("text/plain") || draggingColumnKey;
                  moveColumnSetting(sourceKey, column.key);
                  setDraggingColumnKey(undefined);
                }}
              >
                <span
                  className="product-column-drag-handle"
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label={`拖动${column.label}调整顺序`}
                  onDragStart={event => {
                    setDraggingColumnKey(column.key);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", column.key);
                  }}
                  onDragEnd={() => setDraggingColumnKey(undefined)}
                >
                  <HolderOutlined />
                </span>
                <Checkbox
                  checked={columnSettings[column.key]?.visible !== false}
                  onChange={event => updateColumnSetting(column.key, { visible: event.target.checked })}
                >
                  {column.label}
                </Checkbox>
                <Select
                  value={columnSettings[column.key]?.fixed || "none"}
                  options={[
                    { value: "none", label: "不冻结" },
                    { value: "left", label: "冻结左侧" },
                    { value: "right", label: "冻结右侧" }
                  ]}
                  onChange={value => updateColumnSetting(column.key, { fixed: value === "none" ? undefined : value })}
                />
              </div>
            ))}
          </div>
        </div>
      </Modal>
      <Modal
        open={batchQueryOpen}
        title={null}
        width={820}
        footer={null}
        onCancel={() => setBatchQueryOpen(false)}
      >
        <div className="product-batch-query-head">商品代码 | 条码 | 名称 | 商品别称</div>
        <Input.TextArea
          rows={10}
          value={batchQueryText}
          placeholder="请输入商品代码、条码、名称、商品别称"
          onChange={event => setBatchQueryText(event.target.value)}
        />
        <div className="product-batch-query-tips">
          <div className="product-batch-query-tips-title">提示：</div>
          <div>1、多个代码|条码|名称|商品别称 使用回车、空格或逗号分割</div>
          <div>2、商品数量最大支持上限100个</div>
          <div>3、多个商品查询时，仅支持精确匹配</div>
        </div>
        <div className="product-batch-query-actions">
          <Button onClick={() => setBatchQueryOpen(false)}>取消</Button>
          <Button type="primary" onClick={applyBatchQuery}>确定</Button>
        </div>
      </Modal>
    </div>
  );
}

function productSkuRows(item?: AnyRecord) {
  const product = normalizeProductRecord(item) || item;
  const rows = parseRows(product?.skuListJson || product?.skuList);
  if (rows.length) return rows.map((row, index) => ({
    skuCode: row.skuCode || (index === 0 ? product?.skuCode : ""),
    skuBarcode: row.skuBarcode || row.barcode || row.barCode || (index === 0 ? product?.skuBarcode : ""),
    skuName: normalizeSkuName(row, product?.skuName || ""),
    skuImageUrl: row.skuImageUrl || row.imageUrl || "",
    salePrice: row.salePrice ?? product?.salePrice ?? undefined,
    stockQuantity: row.stockQuantity ?? product?.stockQuantity ?? undefined,
    minOrderQuantity: Number(row.minOrderQuantity ?? product?.minOrderQuantity ?? 1),
    skuStatus: row.skuStatus || "ENABLED",
    specKey: row.specKey || "",
    specValues: Array.isArray(row.specValues) ? row.specValues : [],
    tierPrices: parseRows(row.tierPrices)
  }));
  return [{
    skuCode: product?.skuCode || "",
    skuBarcode: product?.skuBarcode || "",
    skuName: normalizeSkuName(product, product?.skuName || ""),
    skuImageUrl: "",
    salePrice: product ? Number(product?.salePrice || 0) : undefined,
    stockQuantity: product ? Number(product?.stockQuantity ?? 0) : undefined,
    minOrderQuantity: Number(product?.minOrderQuantity || 1),
    skuStatus: product?.skuStatus || "ENABLED",
    specKey: "",
    specValues: [],
    tierPrices: productTierRows(product)
  }];
}

function normalizeSkuName(row: AnyRecord, fallback = "") {
  const explicit = String(row?.skuName || "").trim();
  if (explicit) return explicit;

  const specValues = Array.isArray(row?.specValues)
    ? row.specValues.map((cell: AnyRecord) => String(cell?.value || "").trim()).filter(Boolean)
    : [];
  if (specValues.length) return specValues.join(" / ");

  const legacyValues = [row?.color, row?.size, row?.model]
    .map(value => String(value || "").trim())
    .filter(Boolean);
  if (legacyValues.length) return legacyValues.join(" / ");

  return String(fallback || "").trim();
}

function normalizeSkuBarcode(value: unknown) {
  const text = String(value || "").replace(/[^0-9a-zA-Z]/g, "").slice(0, 18);
  if (!/[A-Za-z]/.test(text) || !/\d/.test(text)) return text;
  return /^\d/.test(text) ? text.replace(/[A-Za-z]/g, "") : text.replace(/\d/g, "");
}

function productTierRows(item?: AnyRecord) {
  const product = normalizeProductRecord(item) || item;
  const rows = parseRows(product?.tierPricesJson || product?.tierPrices);
  return rows.length
    ? rows.slice(0, 3).map((row, index) => ({
      minQty: Number(row.minQty || (index === 0 ? 1 : "")),
      price: Number(row.price || 0) > 0 ? Number(row.price) : undefined
    }))
    : [{ minQty: 1, price: undefined }];
}

function stripRichText(html: unknown) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function productForm(ctx: Ctx, item?: AnyRecord) {
  ctx.setDrawer({
    title: item ? "编辑商品" : "新增商品",
    width: 1320,
    className: "product-form-drawer",
    body: <ProductForm ctx={ctx} item={item} />
  });
}

function ProductForm({ ctx, item }: { ctx: Ctx; item?: AnyRecord }) {
  const [form] = Form.useForm();
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [product, setProduct] = useState<AnyRecord | undefined>(() => normalizeProductRecord(item));
  const quoteType = Form.useWatch("quoteType", form) || "INDEPENDENT_PRICE";
  const saleMode = Form.useWatch("saleMode", form) || "NORMAL";
  const saleUnit = Form.useWatch("saleUnit", form) || "";
  const baseUnit = Form.useWatch("unit", form) || product?.unit || "件";
  const isTierPrice = quoteType === "TIER_PRICE";
  const isBatchSale = saleMode === "BATCH";
  const minOrderUnitLabel = isBatchSale && saleUnit ? saleUnit : baseUnit;
  const productId = product?.id;
  const detail = parseDetailContent(product?.detailContent || "");
  const categories = (ctx.data.categories || []).filter((x: AnyRecord) => x.status === "ENABLED" || x.categoryName === product?.categoryName);
  const brands = (ctx.data.brands || []).filter((x: AnyRecord) => x.status === "ENABLED" || x.brandName === product?.brandName);
  const initial = useMemo(() => ({
    productName: product?.productName || "",
    categoryName: product?.categoryName,
    brandName: product?.brandName,
    unit: product?.unit || "件",
    saleStatus: product?.saleStatus || "ON_SALE",
    quoteType: product?.quoteType || "INDEPENDENT_PRICE",
    saleMode: product?.saleMode || "NORMAL",
    saleUnit: product?.saleUnit || undefined,
    saleUnitRatio: product?.saleUnitRatio ?? undefined,
    mainImageUrl: product?.mainImageUrl || "",
    detailText: detail.imageUrl && !String(detail.text || "").includes("<img")
      ? `${detail.text || ""}<p><img src="${detail.imageUrl}" /></p>`
      : detail.text,
    detailImageUrl: detail.imageUrl,
    skuList: productSkuRows(product),
    tierPrices: productTierRows(product)
  }), [detail.imageUrl, detail.text, product]);

  useEffect(() => {
    setProduct(normalizeProductRecord(item));
  }, [item?.id, item?.updatedAt, item?.skuListJson, item?.tierPricesJson]);

  useEffect(() => {
    let cancelled = false;
    if (!item?.id) return () => {
      cancelled = true;
    };

    void requestProductDetail(item)
      .then(nextProduct => {
        if (cancelled || !nextProduct) return;
        setProduct(nextProduct);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  useEffect(() => {
    form.resetFields();
    form.setFieldsValue(initial);
  }, [form, initial]);
  const ImageUploadTile = ({ value, onChange, variant = "main" }: { value?: string; onChange: (url: string) => void; variant?: "main" | "sku" | "detail" }) => {
    const uploadProps = {
      beforeUpload: async (file: File) => {
        try {
          const dataUrl = await imageToCompressedDataUrl(file);
          onChange(dataUrl);
        } catch (error: any) {
          ctx.message.error(error.message);
        }
        return false;
      },
      showUploadList: false,
      accept: "image/*"
    };

    if (!value) {
      return (
        <Upload {...uploadProps}>
          <button type="button" className={`product-image-add-tile is-${variant}`}>
            <PlusOutlined className="product-image-add-icon" />
            <span className="product-image-add-label">添加图片</span>
          </button>
        </Upload>
      );
    }

    return (
      <div className={`product-image-preview-tile is-${variant}`}>
        <img src={value} alt="" />
        <div className="product-image-actions">
          <Tooltip title="删除">
            <Button type="text" icon={<DeleteOutlined />} onClick={() => onChange("")} />
          </Tooltip>
          <Tooltip title="预览">
            <Button type="text" icon={<ZoomInOutlined />} onClick={() => setPreviewImageUrl(value)} />
          </Tooltip>
          <Upload {...uploadProps}>
            <Tooltip title="更换">
              <Button type="text" icon={<EditOutlined />} />
            </Tooltip>
          </Upload>
        </div>
      </div>
    );
  };

  const ImageUpload = ({ field }: { field: string }) => (
    <Form.Item shouldUpdate noStyle>
      {() => {
        const value = form.getFieldValue(field);
        return (
          <Space direction="vertical" style={{ width: "100%" }}>
            <ImageUploadTile value={value} onChange={url => form.setFieldValue(field, url)} variant="main" />
            <Typography.Text type="secondary">建议尺寸 700*700，图片大小不得超过 1MB。</Typography.Text>
          </Space>
        );
      }}
    </Form.Item>
  );
  const DetailImageUpload = ({ field }: { field: string }) => (
    <Form.Item shouldUpdate noStyle>
      {() => {
        const value = form.getFieldValue(field);
        return <ImageUploadTile value={value} onChange={url => form.setFieldValue(field, url)} variant="detail" />;
      }}
    </Form.Item>
  );
  const SkuImageUpload = ({ namePath }: { namePath: (string | number)[] }) => (
    <Form.Item shouldUpdate noStyle>
      {() => {
        const value = form.getFieldValue(namePath);
        return (
          <div className="product-form-sku-image-upload">
            <ImageUploadTile value={value} onChange={url => form.setFieldValue(namePath, url)} variant="sku" />
          </div>
        );
      }}
    </Form.Item>
  );
  const skuTextRules = (label: string) => [
    {
      validator: (_: unknown, value: unknown) => {
        const text = String(value || "");
        if (!text) return Promise.resolve();
        if (text.length > maxSkuTextLength) return Promise.reject(new Error(`${label}不能超过 ${maxSkuTextLength} 位`));
        return /^[0-9A-Za-z]+$/.test(text)
          ? Promise.resolve()
          : Promise.reject(new Error(`${label}只能输入字母或数字`));
      }
    }
  ];
  const minOrderQuantityRules = [
    { required: true, message: "请输入最小起订量" },
    {
      validator: (_: unknown, value: unknown) => {
        const current = Number(value);
        if (!Number.isInteger(current) || current <= 0) return Promise.reject(new Error("最小起订量必须为正整数"));
        if (current > maxMinOrderQuantity) return Promise.reject(new Error("最小起订量不能超过100"));
        return Promise.resolve();
      }
    }
  ];
  const tierMinQtyRules = (index: number) => [
    { required: true, message: "请输入起订数量" },
    {
      validator: (_: unknown, value: unknown) => {
        const current = Number(value);
        if (!Number.isInteger(current) || current <= 0) return Promise.reject(new Error("起订数量必须为正整数"));
        if (current > maxMinOrderQuantity) return Promise.reject(new Error("起订数量不能超过100"));
        if (index > 0) {
          const prev = Number(form.getFieldValue(["tierPrices", index - 1, "minQty"]));
          if (Number.isFinite(prev) && current <= prev) return Promise.reject(new Error("起订数量须大于上一级"));
        }
        return Promise.resolve();
      }
    }
  ];
  const tierPriceRules = (index: number) => [
    { required: true, message: "请输入单价" },
    {
      validator: (_: unknown, value: unknown) => {
        const current = Number(value);
        if (!(current > 0)) return Promise.reject(new Error("单价必须大于0"));
        if (current > maxPrice) return Promise.reject(new Error("单价不能超过99999.99"));
        if (index > 0) {
          const prev = Number(form.getFieldValue(["tierPrices", index - 1, "price"]));
          if (prev > 0 && current >= prev) return Promise.reject(new Error("单价须小于上一级"));
        }
        return Promise.resolve();
      }
    }
  ];
  const saleUnitRules = [
    {
      validator: (_: unknown, value: unknown) => {
        if (saleMode !== "BATCH") return Promise.resolve();
        const text = String(value || "").trim();
        if (!text) return Promise.reject(new Error("请选择销售单位"));
        if (text === String(form.getFieldValue("unit") || "").trim()) return Promise.reject(new Error("销售单位不能与商品单位相同"));
        return Promise.resolve();
      }
    }
  ];
  const saleUnitRatioRules = [
    {
      validator: (_: unknown, value: unknown) => {
        if (saleMode !== "BATCH") return Promise.resolve();
        if (!saleUnit) return Promise.resolve();
        if (value === undefined || value === null || value === "") return Promise.reject(new Error("请输入换算关系"));
        const current = Number(value);
        if (!Number.isInteger(current) || current <= 0) return Promise.reject(new Error("换算倍数需为大于 0 的正整数"));
        return Promise.resolve();
      }
    }
  ];

  return (
    <Form className="product-form-layout" form={form} layout="vertical" initialValues={initial} onFinish={async values => {
        const skuRows = Array.isArray(values.skuList) ? values.skuList : [];
        const enabledRows = skuRows.filter((row: AnyRecord) => row.skuStatus !== "DISABLED");
        const enabledSku = enabledRows[0];
        const tierPrices = values.quoteType === "TIER_PRICE"
          ? parseRows(values.tierPrices)
            .slice(0, 3)
            .map((row: AnyRecord) => ({ minQty: Number(row.minQty), price: Number(row.price) }))
            .filter((row: AnyRecord) => Number.isInteger(row.minQty) && row.minQty > 0 && row.price > 0)
          : [];
        if (!enabledSku) return ctx.message.error("至少需要保留一个启用 SKU");
        if (values.quoteType === "INDEPENDENT_PRICE") {
          const missingPrice = enabledRows.some((row: AnyRecord) => !(Number(row.salePrice) > 0));
          if (missingPrice) return ctx.message.error("请为启用 SKU 填写单价");
        }
        if (values.quoteType === "TIER_PRICE") {
          if (!tierPrices.length) return ctx.message.error("请配置商品统一阶梯价");
        }
        const tierPrice = values.quoteType === "TIER_PRICE" ? Number(tierPrices[0]?.price || 0) : 0;
        const salePrice = values.quoteType === "TIER_PRICE" ? tierPrice : Number(enabledSku.salePrice);
        const skuList = skuRows.map((row: AnyRecord) => ({
          skuName: normalizeSkuName(row, enabledSku?.skuName || ""),
          ...row,
          salePrice: values.quoteType === "TIER_PRICE" ? salePrice : Number(row.salePrice),
          tierPrices: values.quoteType === "TIER_PRICE" ? tierPrices : [],
          minOrderQuantity: Number(row.minOrderQuantity || 1)
        }));
        const normalizedSaleMode = values.saleMode === "BATCH" ? "BATCH" : "NORMAL";
        const detailContent = JSON.stringify({
          html: values.detailText || "",
          plainText: stripRichText(values.detailText),
          imageUrl: values.detailImageUrl || detail.imageUrl || ""
        });
        const data = {
          ...values,
          saleMode: normalizedSaleMode,
          saleUnit: normalizedSaleMode === "BATCH" ? values.saleUnit || null : null,
          saleUnitRatio: normalizedSaleMode === "BATCH" ? Number(values.saleUnitRatio) : null,
          detailContent,
          skuCode: enabledSku.skuCode,
          skuBarcode: enabledSku.skuBarcode || "",
          salePrice,
          stockQuantity: Number(enabledSku.stockQuantity),
          minOrderQuantity: Number(enabledSku.minOrderQuantity || 1),
          skuStatus: enabledSku.skuStatus,
          skuList,
          tierPrices
        };
        if (!data.mainImageUrl) return ctx.message.error("请选择商品主图");
        if (JSON.stringify(data).length > 900 * 1024) return ctx.message.error("图片内容仍然过大，请更换更小的图片后提交");
        try {
          const saved = unwrapProductResponse(
            await request(productId ? `/api/admin/products/${productId}` : "/api/admin/products", {
              method: productId ? "PUT" : "POST",
              data
            }),
            productId
          ) || normalizeProductRecord({ ...product, ...data, id: productId });
          if (saved) {
            setProduct(saved);
            ctx.setData?.(prev => ({
              ...prev,
              products: upsertProductRecord(prev.products || [], saved, !productId)
            }));
          }
          ctx.message.success("商品已保存，商城端数据已同步");
          ctx.setDrawer(null);
        } catch (error: any) {
          ctx.message.error(error.message);
        }
    }}>
        {previewImageUrl ? (
          <Image
            src={previewImageUrl}
            style={{ display: "none" }}
            preview={{ visible: true, src: previewImageUrl, onVisibleChange: visible => !visible && setPreviewImageUrl("") }}
          />
        ) : null}
        <div className="product-form-body">
          <Tabs
            className="product-form-tabs product-form-tabbar"
            defaultActiveKey="basic"
            items={[
              {
                key: "basic",
                label: "基础资料",
                children: (
                  <div className="product-form-pane">
                    <section className="product-form-section">
                      <div className="product-form-section-title">基础信息</div>
                      <div className="product-form-basic-table">
                        <div className="product-form-basic-label is-required">商品名称</div>
                        <div className="product-form-basic-control">
                          <Form.Item
                            name="productName"
                            rules={[
                              { required: true, message: "请输入商品名称" },
                              { max: maxProductNameLength, message: `商品名称不能超过 ${maxProductNameLength} 个字符` }
                            ]}
                          >
                            <Input maxLength={maxProductNameLength} placeholder="请输入商品名称" />
                          </Form.Item>
                        </div>
                        <div className="product-form-basic-label is-required">商品分类</div>
                        <div className="product-form-basic-control">
                          <Form.Item name="categoryName" rules={[{ required: true, message: "请选择商品分类" }]}>
                            <Select placeholder="请选择商品分类" options={categories.map((x: AnyRecord) => ({ value: x.categoryName, label: x.categoryName }))} />
                          </Form.Item>
                        </div>
                        <div className="product-form-basic-label is-required">商品品牌</div>
                        <div className="product-form-basic-control">
                          <Form.Item name="brandName" rules={[{ required: true, message: "请选择商品品牌" }]}>
                            <Select placeholder="请选择商品品牌" options={brands.map((x: AnyRecord) => ({ value: x.brandName, label: x.brandName }))} />
                          </Form.Item>
                        </div>
                        <div className="product-form-basic-label is-required">库存单位</div>
                        <div className="product-form-basic-control">
                          <Form.Item
                            name="unit"
                            rules={[
                              { required: true, message: "请输入库存单位" },
                              { max: maxUnitLength, message: `库存单位不能超过 ${maxUnitLength} 个字符` }
                            ]}
                          >
                            <Input maxLength={maxUnitLength} placeholder="请输入库存单位" />
                          </Form.Item>
                        </div>
                        <div className="product-form-basic-label is-required">商品状态</div>
                        <div className="product-form-basic-control">
                          <Form.Item name="saleStatus" rules={[{ required: true, message: "请选择商品状态" }]}>
                            <Select options={[{ value: "ON_SALE", label: "已上架" }, { value: "OFF_SALE", label: "已下架" }]} />
                          </Form.Item>
                        </div>
                      <div className="product-form-basic-label is-required">报价方式</div>
                      <div className="product-form-basic-control">
                        <Form.Item name="quoteType" rules={[{ required: true, message: "请选择报价方式" }]}>
                          <Radio.Group
                            className="product-quote-radio"
                              options={[{ value: "INDEPENDENT_PRICE", label: "规格独立报价" }, { value: "TIER_PRICE", label: "阶梯报价" }]}
                          />
                        </Form.Item>
                      </div>
                    </div>
                    <div className="product-form-sale-mode-row">
                      <div className="product-form-basic-label is-required">售卖方式</div>
                      <div className="product-form-sale-mode-control">
                        <Form.Item name="saleMode" rules={[{ required: true, message: "请选择售卖方式" }]} noStyle>
                          <Radio.Group className="product-sale-mode-radio" options={saleModeOptions} />
                        </Form.Item>
                        {isBatchSale ? (
                          <div className="product-sale-mode-panel">
                            <div className="product-sale-mode-config">
                              <div className="product-sale-mode-config-row">
                                <span className="product-sale-mode-inline-label is-required">销售单位</span>
                                <Form.Item name="saleUnit" rules={saleUnitRules} noStyle>
                                  <Select
                                    className="product-sale-unit-select"
                                    placeholder="请选择销售单位"
                                    options={saleUnitOptions}
                                  />
                                </Form.Item>
                                {saleUnit ? (
                                  <>
                                    <span className="product-sale-mode-inline-label is-required">一{saleUnit}等于</span>
                                    <div className="product-sale-convert-group">
                                      <Form.Item name="saleUnitRatio" rules={saleUnitRatioRules} noStyle>
                                        <InputNumber
                                          className="product-sale-convert-input"
                                          min={1}
                                          max={999999}
                                          precision={0}
                                          placeholder="请输入换算关系"
                                        />
                                      </Form.Item>
                                      <span className="product-sale-convert-unit">{baseUnit}</span>
                                    </div>
                                  </>
                                ) : null}
                              </div>
                              <Form.Item noStyle shouldUpdate>
                                {() => {
                                  const errors = [
                                    ...form.getFieldError("saleUnit"),
                                    ...form.getFieldError("saleUnitRatio")
                                  ];
                                  if (!errors.length) return null;
                                  return <div className="product-sale-mode-errors">{errors[0]}</div>;
                                }}
                              </Form.Item>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="product-form-main-image-field">
                      <div className="product-form-basic-label is-required">商品主图</div>
                      <div className="product-form-main-image-control">
                          <Form.Item name="mainImageUrl" rules={[{ required: true, message: "请选择商品主图" }]} noStyle>
                            <Input type="hidden" />
                          </Form.Item>
                          <ImageUpload field="mainImageUrl" />
                        </div>
                      </div>
                      {isTierPrice ? (
                        <div className="product-form-main-image-field product-form-tier-field">
                          <div className="product-form-basic-label is-required">阶梯报价</div>
                          <div className="product-form-tier-control">
                            <Form.List name="tierPrices">
                              {(fields, { add, remove }) => (
                                <div className="product-form-tier">
                                  <div className="product-form-tier-table-wrap">
                                    <div className="product-form-tier-table">
                                      <div className="product-form-tier-head">起订数量</div>
                                      <div className="product-form-tier-head">单价</div>
                                      <div className="product-form-tier-head">操作</div>
                                      {fields.map((field, index) => (
                                        <React.Fragment key={field.key}>
                                          <div className="product-form-tier-cell">
                                            <Form.Item name={[field.name, "minQty"]} rules={tierMinQtyRules(index)}>
                                              <InputNumber min={1} max={maxMinOrderQuantity} precision={0} placeholder="起订数量" />
                                            </Form.Item>
                                          </div>
                                          <div className="product-form-tier-cell">
                                            <Form.Item name={[field.name, "price"]} rules={tierPriceRules(index)}>
                                              <InputNumber min={0.01} max={maxPrice} precision={2} step={0.01} placeholder="单价" />
                                            </Form.Item>
                                          </div>
                                          <div className="product-form-tier-cell product-form-tier-action">
                                            <Button
                                              danger
                                              icon={<DeleteOutlined />}
                                              onClick={() => remove(field.name)}
                                              disabled={fields.length <= 1}
                                            />
                                          </div>
                                        </React.Fragment>
                                      ))}
                                    </div>
                                  </div>
                                  <Button
                                    className="product-form-tier-add"
                                    onClick={() => add({ minQty: undefined, price: undefined })}
                                    disabled={fields.length >= 3}
                                  >
                                    <PlusOutlined /> 添加阶梯
                                  </Button>
                                </div>
                              )}
                            </Form.List>
                          </div>
                        </div>
                    ) : null}
                  </section>
                  <section className="product-form-section">
                      <ProductSpecEditor
                        form={form}
                        initialSkuList={initial.skuList}
                        message={ctx.message}
                        onPreviewImage={setPreviewImageUrl}
                        minOrderUnitLabel={minOrderUnitLabel}
                      />
                  </section>
                    <section className="product-form-section">
                      <div className="product-form-section-title">商品详情</div>
                      <div className="product-detail-editor-row is-full">
                        <Form.Item name="detailText" noStyle>
                          <RichTextEditor maxLength={5000} placeholder="请输入内容..." onError={ctx.message.error} />
                        </Form.Item>
                      </div>
                    </section>
                  </div>
                )
              },
              { key: "packing", label: "多包装", children: null },
              { key: "assist", label: "辅助信息", children: null },
              { key: "custom", label: "自定义属性", children: null },
            ]}
          />
        </div>
        <div className="product-form-submit-bar">
          <Space>
            <Button onClick={() => ctx.setDrawer(null)}>取消</Button>
            <Button type="primary" htmlType="submit">提交</Button>
          </Space>
        </div>
    </Form>
  );
}

async function productSale(ctx: Ctx, item: AnyRecord) {
  try {
    await request(`/api/admin/products/${item.id}/${item.saleStatus === "ON_SALE" ? "off-sale" : "on-sale"}`, { method: "PUT" });
    ctx.message.success("商品状态已更新");
    ctx.reload();
  } catch (error: any) {
    ctx.message.error(error.message);
  }
}

function productDetail(ctx: Ctx, item: AnyRecord) {
  const detail = parseDetailContent(item.detailContent);
  ctx.setDrawer({
    title: `商品详情 ${item.productName || ""}`,
    body: (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Descriptions bordered column={2} items={[
          { key: "code", label: "商品编码", children: item.productCode },
          { key: "sku", label: "SKU", children: item.skuCode },
          { key: "category", label: "分类", children: item.categoryName },
          { key: "brand", label: "品牌", children: item.brandName },
          { key: "price", label: "售价", children: money(item.salePrice) },
          { key: "stock", label: "库存", children: item.stockQuantity },
          { key: "status", label: "状态", children: tag(item.saleStatus) }
        ]} />
        {item.mainImageUrl?.startsWith("data:") ? <Image src={item.mainImageUrl} className="detail-image" /> : null}
        <Card title="图文详情"><div className="product-detail-render" dangerouslySetInnerHTML={{ __html: detail.text || "-" }} /></Card>
        {detail.imageUrl ? <Image src={detail.imageUrl} className="detail-image" /> : null}
      </Space>
    )
  });
}

function CategoryPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const rows = ctx.data.categories || [];
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<React.Key[]>(["category:__all__"]);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<React.Key>("category:__all__");
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>([]);
  const categoryTreeData = useMemo(() => buildCategoryTreeData(rows), [rows]);
  const filteredCategoryTreeData = useMemo(() => filterCategoryTreeData(categoryTreeData, categoryKeyword), [categoryKeyword, categoryTreeData]);
  const visibleExpandedCategoryKeys = useMemo(
    () => (categoryKeyword ? collectTreeKeys(filteredCategoryTreeData) : expandedCategoryKeys),
    [categoryKeyword, expandedCategoryKeys, filteredCategoryTreeData]
  );
  const searchKeyword = categoryKeyword.trim().toLowerCase();
  const filteredRows = useMemo(() => rows.filter((item: AnyRecord) => {
    const inTreeSelection = !selectedCategoryNames.length || selectedCategoryNames.includes(String(item.categoryName || "").trim());
    const inSearch = !searchKeyword || [item.categoryName, item.parentName]
      .filter(Boolean)
      .some(value => String(value).trim().toLowerCase().includes(searchKeyword));
    return inTreeSelection && inSearch;
  }), [rows, searchKeyword, selectedCategoryNames]);
  return (
    <div className="product-archive-page management-board-page category-management-page">
      <aside className="product-archive-sidebar management-board-sidebar">
        <Input
          className="product-archive-sidebar-search"
          value={categoryKeyword}
          allowClear
          placeholder="请输入分类名称"
          onChange={event => setCategoryKeyword(event.target.value)}
        />
        <div className="product-category-tree">
          <Tree
            blockNode
            expandedKeys={visibleExpandedCategoryKeys}
            selectedKeys={[selectedCategoryKey]}
            switcherIcon={({ expanded }) => <DownOutlined rotate={expanded ? 0 : -90} />}
            treeData={filteredCategoryTreeData}
            onExpand={keys => setExpandedCategoryKeys(keys)}
            onSelect={(keys, info) => {
              const key = String(keys[0] || "category:__all__");
              setSelectedCategoryKey(key);
              if (key === "category:__all__") {
                setSelectedCategoryNames([]);
                return;
              }
              setSelectedCategoryNames(collectCategoryNames(info.node));
            }}
          />
        </div>
      </aside>
      <section className="product-archive-main management-board-main category-list-panel">
        <div className="management-board-header">
          <div className="management-board-title">分类列表</div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => categoryForm(ctx)}>新增分类</Button>
        </div>
        <div className="management-board-table product-archive-table category-list-table">
          <AdminTable loading={loading} rowKey="id" dataSource={filteredRows} pagination={{ className: "product-archive-pagination", hideOnSinglePage: false }} scroll={{ x: "max-content", y: "var(--management-list-table-body-height)" }} columns={[
            { title: "分类名称", dataIndex: "categoryName" },
            { title: "上级分类", dataIndex: "parentName", render: v => v || "-" },
            { title: "排序", dataIndex: "sortNo" },
            { title: "状态", dataIndex: "status", render: tag },
            {
              title: "操作",
              render: (_, item) => (
                <CrudActions
                  onEdit={() => categoryForm(ctx, item)}
                  onStatus={() => updateStatus(ctx, `/api/admin/product-categories/${item.id}/status`, item.status)}
                  statusLabel={item.status === "ENABLED" ? "停用" : "启用"}
                  onDelete={() => deleteRow(ctx, `/api/admin/product-categories/${item.id}`)}
                />
              )
            }
          ]} />
        </div>
      </section>
    </div>
  );
}

function categoryForm(ctx: Ctx, item?: AnyRecord) {
  genericForm(ctx, item ? "编辑分类" : "新增分类", item, [
    { name: "categoryName", label: "分类名称", required: true },
    { name: "parentName", label: "上级分类" },
    { name: "sortNo", label: "排序值", type: "number" },
    { name: "status", label: "状态", type: "status" }
  ], item ? `/api/admin/product-categories/${item.id}` : "/api/admin/product-categories", item ? "PUT" : "POST");
}

function BrandPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const rows = ctx.data.brands || [];
  const [brandKeyword, setBrandKeyword] = useState("");
  const [selectedBrandKey, setSelectedBrandKey] = useState<React.Key>("brand:__all__");
  const searchKeyword = brandKeyword.trim().toLowerCase();
  const brandTreeData = useMemo(() => {
    const brandNodes = rows
      .filter((item: AnyRecord) => String(item?.brandName || "").trim())
      .filter((item: AnyRecord, index: number, list: AnyRecord[]) => list.findIndex(current => String(current?.brandName || "").trim() === String(item?.brandName || "").trim()) === index)
      .filter((item: AnyRecord) => !searchKeyword || String(item.brandName || "").trim().toLowerCase().includes(searchKeyword))
      .sort((a: AnyRecord, b: AnyRecord) => Number(a.sortNo || 0) - Number(b.sortNo || 0) || String(a.brandName || "").localeCompare(String(b.brandName || ""), "zh-CN"))
      .map((item: AnyRecord) => ({
        key: `brand:${item.brandName}`,
        title: item.brandName,
        brandName: item.brandName
      }));
    return [{ key: "brand:__all__", title: "全部品牌", children: brandNodes }];
  }, [rows, searchKeyword]);
  const filteredRows = useMemo(() => rows.filter((item: AnyRecord) => {
    const selectedBrandName = selectedBrandKey === "brand:__all__" ? "" : String(selectedBrandKey).replace(/^brand:/, "");
    const inSelection = !selectedBrandName || String(item.brandName || "").trim() === selectedBrandName;
    const inSearch = !searchKeyword || [item.brandName, item.firstLetter]
      .filter(Boolean)
      .some(value => String(value).trim().toLowerCase().includes(searchKeyword));
    return inSelection && inSearch;
  }), [rows, searchKeyword, selectedBrandKey]);
  return (
    <div className="product-archive-page management-board-page brand-management-page">
      <aside className="product-archive-sidebar management-board-sidebar">
        <Input
          className="product-archive-sidebar-search"
          value={brandKeyword}
          allowClear
          placeholder="请输入品牌名称"
          onChange={event => setBrandKeyword(event.target.value)}
        />
        <div className="product-category-tree">
          <Tree
            blockNode
            defaultExpandedKeys={["brand:__all__"]}
            selectedKeys={[selectedBrandKey]}
            switcherIcon={({ expanded }) => <DownOutlined rotate={expanded ? 0 : -90} />}
            treeData={brandTreeData}
            onSelect={keys => setSelectedBrandKey(keys[0] || "brand:__all__")}
          />
        </div>
      </aside>
      <section className="product-archive-main management-board-main brand-list-panel">
        <div className="management-board-header">
          <div className="management-board-title">品牌列表</div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => brandForm(ctx)}>新增品牌</Button>
        </div>
        <div className="management-board-table product-archive-table brand-list-table">
          <AdminTable loading={loading} rowKey="id" dataSource={filteredRows} pagination={{ className: "product-archive-pagination", hideOnSinglePage: false }} scroll={{ x: "max-content", y: "var(--management-list-table-body-height)" }} columns={[
            { title: "品牌名称", dataIndex: "brandName" },
            { title: "排序", dataIndex: "sortNo" },
            { title: "状态", dataIndex: "status", render: tag },
            {
              title: "操作",
              render: (_, item) => (
                <CrudActions
                  onEdit={() => brandForm(ctx, item)}
                  onStatus={() => updateStatus(ctx, `/api/admin/product-brands/${item.id}/status`, item.status)}
                  statusLabel={item.status === "ENABLED" ? "停用" : "启用"}
                  onDelete={() => deleteRow(ctx, `/api/admin/product-brands/${item.id}`)}
                />
              )
            }
          ]} />
        </div>
      </section>
    </div>
  );
}

function brandForm(ctx: Ctx, item?: AnyRecord) {
  genericForm(ctx, item ? "编辑品牌" : "新增品牌", item, [
    { name: "brandName", label: "品牌名称", required: true },
    { name: "brandLogo", label: "品牌 LOGO" },
    { name: "sortNo", label: "排序值", type: "number" },
    { name: "status", label: "状态", type: "status" }
  ], item ? `/api/admin/product-brands/${item.id}` : "/api/admin/product-brands", item ? "PUT" : "POST");
}

function SupplierPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const rows = ctx.data.suppliers || [];
  const [supplierNameInput, setSupplierNameInput] = useState("");
  const [contactNameInput, setContactNameInput] = useState("");
  const [contactPhoneInput, setContactPhoneInput] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const normalizeSearch = (value: any) => String(value || "").trim().toLowerCase();
  const matchesSearch = (value: any, search: string) => !search || normalizeSearch(value).includes(search);
  const filteredRows = useMemo(() => {
    const supplierNameSearch = normalizeSearch(supplierName);
    const contactNameSearch = normalizeSearch(contactName);
    const contactPhoneSearch = normalizeSearch(contactPhone);
    return rows.filter((item: AnyRecord) => (
      matchesSearch(item.supplierName, supplierNameSearch)
      && matchesSearch(item.contactName, contactNameSearch)
      && matchesSearch(item.contactPhone, contactPhoneSearch)
    ));
  }, [rows, supplierName, contactName, contactPhone]);
  const applyFilters = () => {
    setSupplierName(supplierNameInput.trim());
    setContactName(contactNameInput.trim());
    setContactPhone(contactPhoneInput.trim());
  };
  const resetFilters = () => {
    setSupplierNameInput("");
    setContactNameInput("");
    setContactPhoneInput("");
    setSupplierName("");
    setContactName("");
    setContactPhone("");
  };
  return (
    <div className="product-archive-page supplier-management-page">
      <section className="product-archive-main supplier-management-main">
        <div className="product-archive-filters supplier-management-filters">
          <label>
            <span>供应商名称</span>
            <Input allowClear placeholder="请输入供应商名称" value={supplierNameInput} onChange={event => setSupplierNameInput(event.target.value)} />
          </label>
          <label>
            <span>联系人</span>
            <Input allowClear placeholder="请输入联系人" value={contactNameInput} onChange={event => setContactNameInput(event.target.value)} />
          </label>
          <label>
            <span>电话</span>
            <Input allowClear placeholder="请输入电话" value={contactPhoneInput} onChange={event => setContactPhoneInput(event.target.value)} />
          </label>
          <div className="product-archive-query-actions supplier-management-query-actions">
            <Button type="primary" onClick={applyFilters}>查询</Button>
            <Button onClick={resetFilters}>重置</Button>
          </div>
        </div>
        <div className="product-archive-toolbar supplier-management-toolbar">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => supplierForm(ctx)}>新增供应商</Button>
        </div>
        <div className="product-archive-table supplier-list-table">
          <AdminTable
            loading={loading}
            rowKey="id"
            dataSource={filteredRows}
            pagination={{ className: "product-archive-pagination" }}
            scroll={{ x: "max-content", y: "max(300px, calc(100vh - 365px))" }}
            columns={[
              { title: "供应商名称", dataIndex: "supplierName", width: 220 },
              { title: "联系人", dataIndex: "contactName", width: 140 },
              { title: "电话", dataIndex: "contactPhone", width: 160 },
              { title: "地址", dataIndex: "address", width: 280, render: compactText },
              { title: "状态", dataIndex: "status", width: 120, render: tag },
              {
                title: "操作",
                width: 180,
                render: (_, item) => (
                  <CrudActions
                    onEdit={() => supplierForm(ctx, item)}
                    onStatus={() => updateStatus(ctx, `/api/admin/suppliers/${item.id}/status`, item.status)}
                    statusLabel={item.status === "ENABLED" ? "停用" : "启用"}
                    onDelete={() => deleteRow(ctx, `/api/admin/suppliers/${item.id}`)}
                  />
                )
              }
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function supplierForm(ctx: Ctx, item?: AnyRecord) {
  genericForm(ctx, item ? "编辑供应商" : "新增供应商", item, [
    { name: "supplierName", label: "供应商名称", required: true },
    { name: "contactName", label: "联系人", required: true },
    { name: "contactPhone", label: "联系电话", required: true },
    { name: "address", label: "地址" },
    { name: "status", label: "状态", type: "status" }
  ], item ? `/api/admin/suppliers/${item.id}` : "/api/admin/suppliers", item ? "PUT" : "POST");
}

function CrudActions({
  onEdit,
  onStatus,
  statusLabel,
  onDelete
}: {
  onEdit: () => void;
  onStatus?: () => void;
  statusLabel?: string;
  onDelete?: () => void;
}) {
  return (
    <Space>
      <Button type="link" icon={<EditOutlined />} onClick={onEdit}>编辑</Button>
      {onStatus ? <Button type="link" onClick={onStatus}>{statusLabel || "启停用"}</Button> : null}
      {onDelete ? <Popconfirm title="确认删除？" onConfirm={onDelete}><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm> : null}
    </Space>
  );
}

async function updateStatus(ctx: Ctx, url: string, current: string) {
  try {
    await request(url, { method: "PUT", data: { status: current === "ENABLED" ? "DISABLED" : "ENABLED" } });
    ctx.message.success("状态已更新");
    ctx.reload();
  } catch (error: any) {
    ctx.message.error(error.message);
  }
}

async function deleteRow(ctx: Ctx, url: string) {
  try {
    await request(url, { method: "DELETE" });
    ctx.message.success("删除成功");
    ctx.reload();
  } catch (error: any) {
    ctx.message.error(error.message);
  }
}

function genericForm(ctx: Ctx, title: string, item: AnyRecord | undefined, fields: AnyRecord[], url: string, method: "POST" | "PUT") {
  ctx.setDrawer({
    title,
    body: (
      <Form layout="vertical" initialValues={{ status: "ENABLED", ...item }} onFinish={async values => {
        try {
          await request(url, { method, data: values });
          ctx.message.success("保存成功");
          ctx.setDrawer(null);
          ctx.reload();
        } catch (error: any) {
          ctx.message.error(error.message);
        }
      }}>
        {fields.map(field => {
          const isPhone = /phone/i.test(field.name) || /手机|电话/.test(field.label);
          const isPassword = /password/i.test(field.name) || /密码/.test(field.label);
          const rules = isPhone ? phoneRules(field.label) : isPassword ? passwordRules(field.label) : field.required ? [{ required: true }] : [];
          return (
            <Form.Item key={field.name} name={field.name} label={field.label} rules={rules}>
              {field.type === "number" ? (
                <InputNumber style={{ width: "100%" }} />
              ) : field.type === "status" ? (
                <Select options={[{ value: "ENABLED", label: "启用" }, { value: "DISABLED", label: "停用" }]} />
              ) : field.type === "select" ? (
                <Select
                  mode={field.mode}
                  options={field.options || []}
                  placeholder={field.placeholder || "请选择"}
                  allowClear
                />
              ) : field.type === "textarea" ? (
                <Input.TextArea rows={3} maxLength={255} />
              ) : (
                <Input maxLength={isPhone ? 11 : undefined} />
              )}
            </Form.Item>
          );
        })}
        <Space><Button onClick={() => ctx.setDrawer(null)}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
      </Form>
    )
  });
}

function PurchaseOrderPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  return (
    <Card title="采购订单" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => purchaseOrderForm(ctx)}>新增采购单</Button>}>
      <AdminTable loading={loading} rowKey="id" dataSource={ctx.data.purchaseOrders || []} columns={[
        { title: "采购单号", dataIndex: "purchaseOrderNo" },
        { title: "供应商", dataIndex: "supplierName" },
        { title: "采购金额", dataIndex: "totalAmount", render: money },
        { title: "预计到货", dataIndex: "expectedArrivalDate", render: dateText },
        { title: "状态", dataIndex: "status", render: tag },
        { title: "操作", render: (_, item) => <Space><Button type="link" onClick={() => detailDrawer(ctx, "采购订单详情", item)}>详情</Button><Button type="link" onClick={() => request(`/api/admin/purchase-orders/${item.id}/stock-in`, { method: "POST" }).then(ctx.reload).then(() => ctx.message.success("采购入库成功")).catch((e: Error) => ctx.message.error(e.message))}>入库</Button></Space> }
      ]} />
    </Card>
  );
}

function purchaseOrderForm(ctx: Ctx) {
  const products = ctx.data.products || [];
  const suppliers = ctx.data.suppliers || [];
  ctx.setDrawer({
    title: "新增采购单",
    width: 860,
    body: (
      <Form layout="vertical" initialValues={{ items: [{ quantity: 1 }] }} onFinish={async values => {
        try {
          await request("/api/admin/purchase-orders", { method: "POST", data: values });
          ctx.message.success("采购单已新增");
          ctx.setDrawer(null);
          ctx.reload();
        } catch (error: any) {
          ctx.message.error(error.message);
        }
      }}>
        <Form.Item name="supplierId" label="供应商" rules={[{ required: true }]}><Select options={suppliers.map((s: AnyRecord) => ({ value: s.id, label: s.supplierName }))} /></Form.Item>
        <Form.Item name="expectedArrivalDate" label="预计到货日期"><Input placeholder="YYYY-MM-DD" /></Form.Item>
        <Form.List name="items">
          {(fields, { add, remove }) => (
            <Space direction="vertical" style={{ width: "100%" }}>
              {fields.map(field => (
                <Space key={field.key} align="baseline" wrap>
                  <Form.Item {...field} name={[field.name, "productId"]} rules={[{ required: true }]}><Select style={{ width: 260 }} placeholder="采购商品" options={products.map((p: AnyRecord) => ({ value: p.id, label: `${p.productName} / ${p.skuName}` }))} /></Form.Item>
                  <Form.Item {...field} name={[field.name, "quantity"]} rules={[{ required: true }]}><InputNumber min={1} precision={0} placeholder="数量" /></Form.Item>
                  <Form.Item {...field} name={[field.name, "purchasePrice"]} rules={[{ required: true }]}><InputNumber min={0.01} precision={2} placeholder="采购价" /></Form.Item>
                  <Button danger icon={<DeleteOutlined />} onClick={() => fields.length > 1 ? remove(field.name) : null} />
                </Space>
              ))}
              <Button onClick={() => add({ quantity: 1 })}>添加采购商品</Button>
            </Space>
          )}
        </Form.List>
        <Space style={{ marginTop: 20 }}><Button onClick={() => ctx.setDrawer(null)}>取消</Button><Button type="primary" htmlType="submit">提交</Button></Space>
      </Form>
    )
  });
}

function InventoryPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  return (
    <Card title="库存总览">
      <AdminTable loading={loading} rowKey={row => String(row.productId || row.id)} dataSource={ctx.data.inventory || []} columns={[
        { title: "商品", dataIndex: "productName" },
        { title: "SKU", dataIndex: "skuName" },
        { title: "实际库存", dataIndex: "stockQuantity" },
        { title: "冻结库存", dataIndex: "lockedQuantity" },
        { title: "可售库存", dataIndex: "availableQuantity" }
      ]} />
    </Card>
  );
}

function inventoryAdjustForm(ctx: Ctx, productId?: number) {
  ctx.setDrawer({
    title: "库存调整",
    body: (
      <Form layout="vertical" initialValues={{ productId, adjustmentType: "INCREASE", quantity: 1 }} onFinish={async values => {
        try {
          await request("/api/admin/inventory/adjustments", { method: "POST", data: values });
          ctx.message.success("库存调整成功");
          ctx.setDrawer(null);
          ctx.reload();
        } catch (error: any) {
          ctx.message.error(error.message);
        }
      }}>
        <Form.Item name="productId" label="商品" rules={[{ required: true }]}><Select options={(ctx.data.products || []).map((p: AnyRecord) => ({ value: p.id, label: `${p.productName} / ${p.skuName}` }))} /></Form.Item>
        <Form.Item name="adjustmentType" label="调整方式"><Select options={[{ value: "INCREASE", label: "调增" }, { value: "DECREASE", label: "调减" }]} /></Form.Item>
        <Form.Item name="quantity" label="调整数量" rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: "100%" }} /></Form.Item>
        <Form.Item name="reason" label="调整原因"><Input.TextArea /></Form.Item>
        <Space><Button onClick={() => ctx.setDrawer(null)}>取消</Button><Button type="primary" htmlType="submit">提交</Button></Space>
      </Form>
    )
  });
}

function OrderPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  return (
    <Card title="订单列表">
      <AdminTable loading={loading} rowKey="id" dataSource={ctx.data.orders || []} scroll={{ x: true }} columns={[
        { title: "订单编号", dataIndex: "orderNo" },
        { title: "买家", dataIndex: "customerName" },
        { title: "商品数", render: (_, item) => (item.items || []).length },
        { title: "订单金额", dataIndex: "totalAmount", render: money },
        { title: "支付状态", dataIndex: "paymentStatus", render: tag },
        { title: "订单状态", dataIndex: "orderStatus", render: tag },
        { title: "下单时间", dataIndex: "createdAt", render: dateText },
        { title: "操作", render: (_, item) => <Space><Button type="link" onClick={() => detailDrawer(ctx, `订单详情 ${item.orderNo}`, item)}>详情</Button>{item.orderStatus === "WAIT_SHIP" ? <Button type="link" onClick={() => shipOrder(ctx, item)}>发货</Button> : null}</Space> }
      ]} />
    </Card>
  );
}

function shipOrder(ctx: Ctx, item: AnyRecord) {
  genericForm(ctx, `订单发货 ${item.orderNo}`, undefined, [
    { name: "logisticsCompany", label: "快递公司", required: true },
    { name: "logisticsNo", label: "快递单号", required: true }
  ], `/api/admin/orders/${item.id}/ship`, "POST");
}

function AfterSalePage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  return <SimpleTablePage loading={loading} rows={ctx.data.afterSales || []} columns={[
    { title: "售后单号", dataIndex: "afterSaleNo" },
    { title: "订单编号", dataIndex: "orderNo" },
    { title: "买家", dataIndex: "buyerName" },
    { title: "类型", dataIndex: "type" },
    { title: "退款金额", dataIndex: "refundAmount", render: money },
    { title: "状态", dataIndex: "status", render: tag },
    { title: "操作", render: (_, item) => <Space><Button type="link" onClick={() => detailDrawer(ctx, "售后详情", item)}>详情</Button>{item.status === "WAIT_AUDIT" ? <Button type="link" onClick={() => postAndReload(ctx, `/api/admin/after-sales/${item.id}/audit`, { approved: true, remark: "后台审核通过" }, "售后审核已处理")}>审核通过</Button> : null}<Button type="link" onClick={() => postAndReload(ctx, `/api/admin/after-sales/${item.id}/refund`, undefined, "退款已处理")}>退款</Button></Space> }
  ]} />;
}

function InvoicePage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  return <SimpleTablePage loading={loading} rows={ctx.data.invoices || []} columns={[
    { title: "申请单号", dataIndex: "invoiceApplyNo" },
    { title: "订单编号", dataIndex: "orderNo" },
    { title: "买家", dataIndex: "buyerName" },
    { title: "发票抬头", dataIndex: "title" },
    { title: "金额", dataIndex: "amount", render: money },
    { title: "状态", dataIndex: "status", render: tag },
    { title: "操作", render: (_, item) => <Space><Button type="link" onClick={() => detailDrawer(ctx, "开票详情", item)}>详情</Button><Button type="link" onClick={() => invoiceFile(ctx, item)}>上传发票</Button><Button type="link" onClick={() => postAndReload(ctx, `/api/admin/invoices/${item.id}/confirm`, undefined, "开票已确认")}>确认开票</Button></Space> }
  ]} />;
}

function invoiceFile(ctx: Ctx, item: AnyRecord) {
  genericForm(ctx, "上传发票", undefined, [
    { name: "invoiceNo", label: "发票号码", required: true },
    { name: "invoiceFileUrl", label: "发票文件地址", required: true }
  ], `/api/admin/invoices/${item.id}/files`, "POST");
}

async function postAndReload(ctx: Ctx, url: string, data: any, success: string) {
  try {
    await request(url, { method: "POST", data });
    ctx.message.success(success);
    ctx.reload();
  } catch (error: any) {
    ctx.message.error(error.message);
  }
}

function AccountPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const rows = (ctx.data.accounts || []).map((item: AnyRecord) => ({
    ...item,
    username: item.username || item.accountName || "",
    realName: item.realName || item.accountName || ""
  }));
  return (
    <Card title="后台账号" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => accountForm(ctx)}>新增账号</Button>}>
      <AdminTable loading={loading} rowKey="id" dataSource={rows} columns={[
        { title: "账号", dataIndex: "username" },
        { title: "姓名", dataIndex: "realName" },
        { title: "手机", dataIndex: "phone" },
        { title: "角色", dataIndex: "roleNames", render: (_, item) => item.roleNames?.join?.("、") || item.roleName || "-" },
        { title: "状态", dataIndex: "status", render: tag },
        { title: "操作", render: (_, item) => <Space><Button type="link" onClick={() => accountForm(ctx, item)}>编辑</Button><Button type="link" onClick={() => updateStatus(ctx, `/api/admin/accounts/${item.id}/status`, item.status)}>{item.status === "ENABLED" ? "停用" : "启用"}</Button><Button type="link" onClick={() => resetPassword(ctx, item)}>重置密码</Button></Space> }
      ]} />
    </Card>
  );
}

function accountForm(ctx: Ctx, item?: AnyRecord) {
  const roleOptions = (ctx.data.roles || [])
    .filter((role: AnyRecord) => role.status === "ENABLED")
    .map((role: AnyRecord) => ({ value: role.roleName, label: role.roleName }));
  const initial = item ? {
    ...item,
    username: item.username || item.accountName || "",
    realName: item.realName || item.accountName || "",
    roleNames: Array.isArray(item.roleNames) ? item.roleNames : String(item.roleName || "").split(/[,\u3001]/).map(value => value.trim()).filter(Boolean)
  } : undefined;
  genericForm(ctx, item ? "编辑账号" : "新增账号", initial, [
    { name: "username", label: "账号", required: true },
    { name: "realName", label: "姓名", required: true },
    { name: "phone", label: "手机号", required: true },
    ...(item ? [] : [{ name: "password", label: "初始密码", required: true }]),
    { name: "roleNames", label: "角色", required: true, type: "select", mode: "multiple", options: roleOptions, placeholder: "请选择角色" },
    { name: "status", label: "状态", type: "status" }
  ], item ? `/api/admin/accounts/${item.id}` : "/api/admin/accounts", item ? "PUT" : "POST");
}

function resetPassword(ctx: Ctx, item: AnyRecord) {
  genericForm(ctx, "重置密码", undefined, [{ name: "password", label: "新密码", required: true }], `/api/admin/accounts/${item.id}/password/reset`, "POST");
}

function RolePage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  return (
    <Card title="角色权限" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => roleForm(ctx)}>新增角色</Button>}>
      <AdminTable loading={loading} rowKey="id" dataSource={ctx.data.roles || []} columns={[
        { title: "角色名称", dataIndex: "roleName" },
        { title: "说明", dataIndex: "description" },
        { title: "状态", dataIndex: "status", render: tag },
        {
          title: "操作",
          render: (_, item) => (
            <Space>
              <Button type="link" onClick={() => roleForm(ctx, item)}>编辑 / 配置权限</Button>
              <Popconfirm
                title="确认删除该角色？"
                disabled={item.roleName === superAdminRoleName}
                onConfirm={() => deleteRow(ctx, `/api/admin/roles/${item.id}`)}
              >
                <Button type="link" danger disabled={item.roleName === superAdminRoleName}>删除</Button>
              </Popconfirm>
            </Space>
          )
        }
      ]} />
    </Card>
  );
}

function roleForm(ctx: Ctx, item?: AnyRecord) {
  ctx.setDrawer({
    title: item ? "编辑角色" : "新增角色",
    body: <RoleForm ctx={ctx} item={item} />
  });
}

function RoleForm({ ctx, item }: { ctx: Ctx; item?: AnyRecord }) {
  const [form] = Form.useForm();
  const treeData = normalizePermissionTree(ctx.data.permissionTree || []);
  const allKeys = collectPermissionKeys(ctx.data.permissionTree || []);
  const selectableKeys = allKeys.filter(key => key !== dashboardPermissionKey);
  const checkedKeys = Form.useWatch("permissionKeys", form) || [];
  const checkedSet = new Set(checkedKeys);
  const allChecked = selectableKeys.length > 0 && selectableKeys.every(key => checkedSet.has(key));
  const indeterminate = !allChecked && selectableKeys.some(key => checkedSet.has(key));
  const initialPermissionKeys = Array.from(new Set([dashboardPermissionKey, ...parseRolePermissionKeys(item, ctx.data.permissionTree || [])]));

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        status: "ENABLED",
        ...item,
        roleDesc: item?.roleDesc || item?.description || "",
        permissionKeys: initialPermissionKeys
      }}
      onFinish={async values => {
        try {
          const permissionKeys = Array.from(new Set([dashboardPermissionKey, ...(values.permissionKeys || [])]));
          await request(item ? `/api/admin/roles/${item.id}` : "/api/admin/roles", {
            method: item ? "PUT" : "POST",
            data: { ...values, permissionKeys, permissions: permissionKeys }
          });
          ctx.message.success("角色权限已保存");
          ctx.setDrawer(null);
          ctx.reload();
        } catch (error: any) {
          ctx.message.error(error.message);
        }
      }}
    >
      <Form.Item name="roleName" label="角色名称" rules={[{ required: true }]}><Input /></Form.Item>
      <Form.Item name="roleDesc" label="角色说明"><Input.TextArea rows={3} maxLength={255} /></Form.Item>
      <Form.Item name="status" label="状态"><Select options={[{ value: "ENABLED", label: "启用" }, { value: "DISABLED", label: "停用" }]} /></Form.Item>
      <Form.Item label="权限" required>
        <Checkbox
          checked={allChecked}
          indeterminate={indeterminate}
          onChange={event => {
            form.setFieldValue("permissionKeys", event.target.checked ? [dashboardPermissionKey, ...selectableKeys] : [dashboardPermissionKey]);
          }}
        >
          全选
        </Checkbox>
        <Form.Item name="permissionKeys" noStyle rules={[{ required: true, message: "请选择权限" }]}>
          <Tree
            checkable
            defaultExpandAll
            treeData={treeData.map(item => item.key === dashboardPermissionKey ? { ...item, disabled: true } : item)}
            checkedKeys={checkedKeys}
            onCheck={keys => {
              const nextKeys = Array.isArray(keys) ? keys : keys.checked;
              form.setFieldValue("permissionKeys", Array.from(new Set([dashboardPermissionKey, ...nextKeys])));
            }}
          />
        </Form.Item>
      </Form.Item>
      <Space><Button onClick={() => ctx.setDrawer(null)}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
    </Form>
  );
}

function SystemConfigPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const rows = Object.entries(ctx.data.parameters || {}).map(([key, value]) => ({ key, value }));
  return (
    <Card loading={loading} title="基础配置">
      <Form layout="vertical" initialValues={ctx.data.parameters || {}} onFinish={async values => {
        try {
          await request("/api/system/parameters", { method: "PUT", data: values });
          ctx.message.success("基础配置已保存");
          ctx.reload();
        } catch (error: any) {
          ctx.message.error(error.message);
        }
      }}>
        {rows.map(row => <Form.Item key={row.key} name={row.key} label={configLabel(row.key)}><Input /></Form.Item>)}
        <Button type="primary" htmlType="submit">保存配置</Button>
      </Form>
    </Card>
  );
}

function configLabel(key: string) {
  return ({ payTimeoutMinutes: "支付超时时长(分钟)", autoConfirmReceiptDays: "自动确认收货天数", afterSaleDays: "售后期天数", stockWarningThreshold: "库存预警阈值" } as AnyRecord)[key] || key;
}

function detailDrawer(ctx: Ctx, title: string, item: AnyRecord) {
  ctx.setDrawer({
    title,
    body: <Descriptions bordered column={1} items={Object.entries(item).filter(([, v]) => typeof v !== "object").map(([key, value]) => ({ key, label: key, children: String(value ?? "-") }))} />
  });
}

const purchaseInboundColumns = (): ColumnsType<AnyRecord> => [
  { title: "入库单号", dataIndex: "stockInNo" },
  { title: "采购单号", dataIndex: "purchaseOrderNo" },
  { title: "供应商", dataIndex: "supplierName" },
  { title: "状态", dataIndex: "status", render: tag },
  { title: "入库时间", dataIndex: "createdAt", render: dateText }
];

const stockFlowColumns = (): ColumnsType<AnyRecord> => [
  { title: "商品", dataIndex: "productName" },
  { title: "SKU", dataIndex: "skuName" },
  { title: "变动类型", dataIndex: "movementType" },
  { title: "变动数量", dataIndex: "quantity" },
  { title: "原因", dataIndex: "remark" },
  { title: "时间", dataIndex: "createdAt", render: dateText }
];

function customerStatus(item: AnyRecord) {
  const raw = String(item.status || item.auditStatus || "APPROVED").toUpperCase();
  return raw === "DISABLED" ? "DISABLED" : "ENABLED";
}

function BuyerPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  return <SimpleTablePage loading={loading} rows={ctx.data.buyers || []} columns={buyerColumns(ctx)} />;
}

const buyerColumns = (ctx: Ctx): ColumnsType<AnyRecord> => [
  { title: "客户名称", render: (_, item) => item.companyName || item.customerName || item.buyerName || "-" },
  { title: "联系人", dataIndex: "contactName" },
  { title: "电话", dataIndex: "contactPhone" },
  { title: "地址", dataIndex: "address", render: compactText },
  { title: "状态", render: (_, item) => tag(customerStatus(item)) },
  {
    title: "操作",
    render: (_, item) => {
      const status = customerStatus(item);
      return (
        <CrudActions
          onEdit={() => buyerForm(ctx, item)}
          onStatus={() => updateStatus(ctx, `/api/customers/${item.id}/status`, status)}
          statusLabel={status === "ENABLED" ? "停用" : "启用"}
        />
      );
    }
  }
];

function buyerForm(ctx: Ctx, item: AnyRecord) {
  genericForm(ctx, "编辑买家", item, [
    { name: "companyName", label: "客户名称", required: true },
    { name: "contactName", label: "联系人", required: true },
    { name: "contactPhone", label: "电话", required: true },
    { name: "address", label: "地址", type: "textarea" }
  ], `/api/customers/${item.id}`, "PUT");
}

const paymentColumns = (): ColumnsType<AnyRecord> => [
  { title: "支付单号", dataIndex: "paymentNo" },
  { title: "订单编号", dataIndex: "orderNo" },
  { title: "买家", dataIndex: "buyerName" },
  { title: "支付方式", dataIndex: "paymentMethod" },
  { title: "金额", dataIndex: "amount", render: money },
  { title: "状态", dataIndex: "paymentStatus", render: tag },
  { title: "支付时间", dataIndex: "paidAt", render: dateText }
];

const refundColumns = (): ColumnsType<AnyRecord> => [
  { title: "退款单号", dataIndex: "refundNo" },
  { title: "售后单号", dataIndex: "afterSaleNo" },
  { title: "订单编号", dataIndex: "orderNo" },
  { title: "买家", dataIndex: "buyerName" },
  { title: "金额", dataIndex: "amount", render: money },
  { title: "状态", dataIndex: "refundStatus", render: tag },
  { title: "退款时间", dataIndex: "refundedAt", render: dateText }
];

const logColumns = (): ColumnsType<AnyRecord> => [
  { title: "操作人", dataIndex: "operatorName" },
  { title: "模块", dataIndex: "moduleName" },
  { title: "动作", dataIndex: "actionName" },
  { title: "内容", dataIndex: "operationContent", render: compactText },
  { title: "时间", dataIndex: "createdAt", render: dateText }
];

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} form={{ validateMessages: formValidateMessages }}>
      <AntApp>
        <AdminRoot />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);

