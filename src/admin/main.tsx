// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  App as AntApp,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  DatePicker,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
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
  CheckOutlined,
  CloseOutlined,
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
import GlobalLoadingMask from "../shared/GlobalLoadingMask";
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
const { RangePicker } = DatePicker;

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
  | "product-attribute-template"
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
  if (page === "purchase-inbound") return "purchase-order";
  return page;
}

const pageTitles: Record<PageKey, [string, string]> = {
  dashboard: ["首页工作台", "汇总订单、支付、待办和关键业务数据。"],
  "product-list": ["商品档案", "管理商品图片、详情图文、SKU、报价方式、上下架和库存。"],
  "product-category": ["商品分类", "用于商品建档和商城分类导航。"],
  "product-brand": ["商品品牌", "用于商品建档和商城品牌筛选。"],
  "product-attribute-template": ["商品属性模板", "维护商品档案可关联的自定义属性字段。"],
  supplier: ["供应商管理", "维护采购供应商基础资料。"],
  "purchase-order": ["采购入库单", "录入供应商到货明细，审核后直接增加库存。"],
  "purchase-inbound": ["采购入库单", "录入供应商到货明细，审核后直接增加库存。"],
  "stock-overview": ["库存总览", "按 SKU 展示实际库存、冻结库存和可售库存。"],
  "stock-flow": ["库存盘点", "功能正在建设中。"],
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
  attributeTemplates: "/api/admin/product-attribute-templates",
  suppliers: "/api/admin/suppliers",
  purchaseOrders: "/api/admin/purchase-inbounds",
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
  dashboard: ["summary", "orders", "purchaseOrders", "inventory", "afterSales", "invoices", "payments", "refunds", "buyers"],
  "product-list": ["products", "categories", "brands"],
  "product-category": ["categories"],
  "product-brand": ["brands"],
  "product-attribute-template": ["attributeTemplates"],
  supplier: ["suppliers"],
  "purchase-order": ["purchaseOrders", "products", "suppliers"],
  "purchase-inbound": ["purchaseStockIns"],
  "stock-overview": ["inventory", "categories", "brands"],
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

const adminPageCacheTtl = 30_000;
const productModulePrefetchKeys = Array.from(new Set([
  ...pageLoads["product-list"],
  ...pageLoads["product-category"],
  "attributeTemplates"
]));

const pagePermissionKeys: Record<PageKey, string[]> = {
  dashboard: [dashboardPermissionKey],
  "product-list": ["goods:product-list"],
  "product-category": ["goods:product-category"],
  "product-brand": ["goods:product-brand"],
  "product-attribute-template": ["goods:product-attribute-template"],
  supplier: ["purchase:supplier"],
  "purchase-order": ["purchase:purchase-inbound", "purchase:purchase-order"],
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
  const src = String(item?.mainImageThumbnailUrl || item?.thumbnailUrl || item?.mainImageUrl || "").trim();
  if (!src || src.toLowerCase().startsWith("data:image")) return "";
  return src;
}

function ProductNameThumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <span className="product-name-thumb is-empty">
        <PictureOutlined />
      </span>
    );
  }

  return (
    <img
      className="product-name-thumb"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function renderProductNameCell(value: any, item: AnyRecord) {
  const src = productThumbSrc(item);
  return (
    <div className="product-name-cell">
      <ProductNameThumbnail src={src} />
      <span className="product-name-text">{compactText(value)}</span>
    </div>
  );
}

const tablePageSizeOptions = ["20", "50", "100", "200"];
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
const defaultSaleUnitValues = ["箱", "包", "盒", "提", "袋", "桶", "扎", "板"];
const saleUnitStorageKey = "b2b_custom_sale_unit_options";

function readCustomSaleUnitValues() {
  try {
    const parsed = JSON.parse(localStorage.getItem(saleUnitStorageKey) || "[]");
    return Array.isArray(parsed)
      ? parsed.map(value => String(value || "").trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function saveCustomSaleUnitValues(values: string[]) {
  const next = Array.from(new Set(values.map(value => String(value || "").trim()).filter(Boolean)));
  localStorage.setItem(saleUnitStorageKey, JSON.stringify(next));
  return next;
}

function tablePagination() {
  return {
    position: ["bottomCenter"],
    showSizeChanger: { showSearch: false },
    pageSizeOptions: tablePageSizeOptions,
    defaultPageSize: 20,
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
  const dataRef = useRef<Record<string, any>>({});
  const loadedAtRef = useRef<Map<string, number>>(new Map());
  const inflightRequestsRef = useRef<Map<string, Promise<any>>>(new Map());
  const [drawer, setDrawer] = useState<{ title: React.ReactNode; body: React.ReactNode; width?: number | string; className?: string; onClose?: () => void } | null>(null);

  const updateData: React.Dispatch<React.SetStateAction<Record<string, any>>> = updater => {
    setData(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      dataRef.current = next;
      return next;
    });
  };

  const fetchDataKey = (key: string, force: boolean) => {
    const currentRequest = inflightRequestsRef.current.get(key);
    if (currentRequest && !force) return currentRequest;
    const nextRequest = request(endpoints[key]).finally(() => {
      if (inflightRequestsRef.current.get(key) === nextRequest) {
        inflightRequestsRef.current.delete(key);
      }
    });
    inflightRequestsRef.current.set(key, nextRequest);
    return nextRequest;
  };

  const fetchDataKeys = async (
    keys: string[],
    { force = false, showLoading }: { force?: boolean; showLoading?: boolean } = {}
  ) => {
    const now = Date.now();
    const uniqueKeys = Array.from(new Set(keys));
    const keysToLoad = force
      ? uniqueKeys
      : uniqueKeys.filter(key => {
        const hasCachedValue = Object.prototype.hasOwnProperty.call(dataRef.current, key);
        const loadedAt = loadedAtRef.current.get(key) || 0;
        return !hasCachedValue || now - loadedAt >= adminPageCacheTtl;
      });
    if (!keysToLoad.length) return;
    const hasCachedPage = keysToLoad.every(key => Object.prototype.hasOwnProperty.call(dataRef.current, key));
    const shouldShowLoading = showLoading ?? !hasCachedPage;
    if (shouldShowLoading) setLoading(true);
    try {
      const entries = await Promise.all(keysToLoad.map(async key => [key, await fetchDataKey(key, force)] as const));
      const loadedAt = Date.now();
      entries.forEach(([key]) => loadedAtRef.current.set(key, loadedAt));
      updateData(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    } catch (error: any) {
      message.error(error.message);
    } finally {
      if (shouldShowLoading) setLoading(false);
    }
  };

  const loadKeys = (keys: string[]) => fetchDataKeys(keys, { force: true, showLoading: true });
  const reload = () => fetchDataKeys(pageLoads[page], { force: true, showLoading: true });

  useEffect(() => {
    if (loggedIn) void fetchDataKeys(pageLoads[page]);
  }, [page, loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    const timer = window.setTimeout(() => {
      void fetchDataKeys(productModulePrefetchKeys, { showLoading: false });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [loggedIn]);

  const go = (key: PageKey) => {
    if (key === "stock-flow") {
      message.info("功能正在建设中");
      return;
    }
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
        { key: "product-brand", label: "商品品牌" },
        { key: "product-attribute-template", label: "商品属性模板" }
      ]
    },
    {
      key: "purchase",
      icon: <InboxOutlined />,
      label: "采购管理",
      children: [
        { key: "supplier", label: "供应商管理" },
        { key: "purchase-order", label: "采购入库单" }
      ]
    },
    {
      key: "stock",
      icon: <BarcodeOutlined />,
      label: "库存管理",
      children: [
        { key: "stock-overview", label: "库存总览" },
        { key: "stock-flow", label: "库存盘点" }
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
    setData: updateData,
    go
  };

  return (
    <Layout className="admin-shell">
      <Sider className="admin-sider" collapsible collapsed={collapsed} onCollapse={setCollapsed} width={224} theme="dark">
        <div style={{ height: 64, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", color: "#fff" }}>
          <div className="admin-logo" style={{ width: 38, height: 38, fontSize: 18 }}>B</div>
          {!collapsed && <b style={{ whiteSpace: "nowrap" }}>夏至 · 商城管理系统</b>}
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
                dataRef.current = {};
                loadedAtRef.current.clear();
                inflightRequestsRef.current.clear();
                updateData({});
                setLoggedIn(false);
              }}
            >
              退出
            </Button>
          </Space>
        </Header>
        <Content className="admin-content">
          <div
            className={`page-wrap ${page === "product-list" || page === "stock-overview" || page === "supplier" ? "page-wrap-product-list" : ""} ${page === "order" || page === "aftersale" || page === "purchase-order" || page === "purchase-inbound" ? "page-wrap-order" : ""} ${page === "product-category" || page === "product-brand" || page === "product-attribute-template" ? "page-wrap-management-board" : ""}`}
          >
            <PageRenderer page={page} ctx={ctx} loading={false} />
          </div>
        </Content>
      </Layout>
      <GlobalLoadingMask visible={loading} />
      <Drawer
        open={Boolean(drawer)}
        title={drawer?.title}
        width={drawer?.width || 760}
        className={drawer?.className}
        onClose={() => drawer?.onClose ? drawer.onClose() : setDrawer(null)}
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
              <div className="admin-login-brand-title">夏至</div>
              <div className="admin-login-brand-subtitle">商城管理系统</div>
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
  setDrawer: (drawer: { title: React.ReactNode; body: React.ReactNode; width?: number | string; className?: string; onClose?: () => void } | null) => void;
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
  if (page === "product-attribute-template") return <AttributeTemplatePage ctx={ctx} loading={loading} />;
  if (page === "supplier") return <SupplierPage ctx={ctx} loading={loading} />;
  if (page === "purchase-order" || page === "purchase-inbound") return <PurchaseOrderPage ctx={ctx} loading={loading} />;
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
  const orders = Array.isArray(ctx.data.orders) ? ctx.data.orders : (ctx.data.orders?.list || []);
  const inventory = ctx.data.inventory || [];
  const purchaseOrders = Array.isArray(ctx.data.purchaseOrders) ? ctx.data.purchaseOrders : (ctx.data.purchaseOrders?.list || []);
  const afterSales = Array.isArray(ctx.data.afterSales) ? ctx.data.afterSales : (ctx.data.afterSales?.list || []);
  const invoices = Array.isArray(ctx.data.invoices) ? ctx.data.invoices : (ctx.data.invoices?.list || []);
  const payments = ctx.data.payments || [];
  const refunds = ctx.data.refunds || [];
  const buyers = ctx.data.buyers || [];
  const todayText = new Date().toLocaleDateString("sv-SE");
  const orderCount = Number(summary.todayOrders ?? summary.todayOrderCount ?? orders
    .filter((item: AnyRecord) => String(item.createdAt || "").startsWith(todayText))
    .length);
  const paymentAmount = Number(summary.todayPaymentAmount ?? payments
    .filter((item: AnyRecord) => String(item.paidAt || item.updatedAt || "").startsWith(todayText))
    .reduce((sum: number, item: AnyRecord) => sum + Number(item.amount || 0), 0));
  const refundAmount = Number(summary.todayRefundAmount ?? refunds
    .filter((item: AnyRecord) => String(item.refundedAt || item.updatedAt || "").startsWith(todayText))
    .reduce((sum: number, item: AnyRecord) => sum + Number(item.amount || item.refundAmount || 0), 0));
  const newBuyerCount = Number(summary.todayNewBuyers ?? buyers
    .filter((item: AnyRecord) => String(item.createdAt || "").startsWith(todayText))
    .length);
  const stockWarning = Number(summary.stockWarning ?? inventory.filter((item: AnyRecord) => Number(item.availableQuantity ?? item.stockQuantity ?? 0) <= 0).length);
  const waitShip = orders.filter((x: AnyRecord) => x.orderStatus === "WAIT_SHIP").length;
  const waitPurchaseIn = purchaseOrders.filter((x: AnyRecord) => ["PENDING_REVIEW", "WAIT_IN", "WAIT_STOCK_IN", "PENDING", "CREATED"].includes(String(x.status))).length;
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
        <MetricCard title="今日退款金额" value={refundAmount} prefix="¥" precision={2} onClick={() => ctx.go?.("finance-refund")} />
        <MetricCard title="今日新增买家数" value={newBuyerCount} onClick={() => ctx.go?.("buyer")} />
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
    { key: "product-attribute-template", label: "商品属性模板", icon: <TagsOutlined /> },
    { key: "supplier", label: "供应商管理", icon: <TeamOutlined /> },
    { key: "purchase-order", label: "采购入库单", icon: <InboxOutlined /> },
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
    let disposed = false;
    let chart: any;
    let observer: ResizeObserver | undefined;
    const resize = () => chart?.resize();
    const labels = rows.map(row => row.label);
    const orderValues = rows.map(row => row.orders);
    const amountValues = rows.map(row => Number(row.amount || 0));
    void import("echarts").then(echarts => {
      if (disposed || !chartRef.current) return;
      chart = echarts.init(chartRef.current);
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
      window.addEventListener("resize", resize);
      observer = new ResizeObserver(resize);
      observer.observe(chartRef.current);
    });
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      observer?.disconnect();
      chart?.dispose();
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

const productSaleStatusOptions = [{ value: "ON_SALE", label: "已上架" }, { value: "OFF_SALE", label: "已下架" }];
const productBusinessStatusOptions = [
  { value: "NEW", label: "新品" },
  { value: "NORMAL", label: "正常" },
  { value: "ARCHIVED", label: "淘汰" },
  { value: "DISABLED", label: "停用" }
];

function normalizeProductBusinessStatus(value: any) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "新品") return "NEW";
  if (text === "正常") return "NORMAL";
  if (text === "淘汰") return "ARCHIVED";
  if (text === "停用") return "DISABLED";
  return ["NEW", "NORMAL", "ARCHIVED", "DISABLED"].includes(text) ? text : "NORMAL";
}

function productBusinessStatusText(value: any) {
  const status = normalizeProductBusinessStatus(value);
  return productBusinessStatusOptions.find(item => item.value === status)?.label || status || "-";
}

function productSaleStatusText(value: any) {
  return String(value || "").toUpperCase() === "OFF_SALE" ? "已下架" : "已上架";
}

const productColumnDefaults = [
  { key: "index", label: "序号", width: 72 },
  { key: "productCode", label: "商品编码", width: 150 },
  { key: "productName", label: "商品名称", width: 260 },
  { key: "categoryName", label: "商品分类", width: 150 },
  { key: "saleStatus", label: "上架状态", width: 120 },
  { key: "productStatus", label: "商品状态", width: 120 },
  { key: "skuName", label: "规格", width: 190 },
  { key: "unit", label: "库存单位", width: 120 },
  { key: "brandName", label: "商品品牌", width: 140 },
  { key: "quoteType", label: "报价方式", width: 140 },
  { key: "salePrice", label: "单价", width: 120 },
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
      const minWidth = column.key === "skuName" ? 180 : 70;
      const fixed = current.fixed === "left" || current.fixed === "right" ? current.fixed : undefined;
      return [
        column.key,
        {
          visible: current.visible !== false,
          width: Number.isFinite(width) && width >= minWidth ? width : column.width,
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

function productStringArray(...values: any[]) {
  const result: string[] = [];
  values.forEach(value => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach(item => {
        const text = typeof item === "string"
          ? item.trim()
          : String(item?.url || item?.src || item?.imageUrl || item?.image || "").trim();
        if (text) result.push(text);
      });
      return;
    }
    const parsedRows = parseRows(value);
    if (parsedRows.length) {
      parsedRows.forEach(item => {
        const text = typeof item === "string"
          ? item.trim()
          : String(item?.url || item?.src || item?.imageUrl || item?.image || "").trim();
        if (text) result.push(text);
      });
      return;
    }
    const text = String(value || "").trim();
    if (text) result.push(text);
  });
  return result;
}

function uniqueProductImageUrls(...values: any[]) {
  return Array.from(new Set(productStringArray(...values)));
}

function appendMissingDetailImages(html: string, images: string[]) {
  const current = String(html || "");
  const additions = uniqueProductImageUrls(images)
    .filter(url => !current.includes(url))
    .map(url => `<p><img src="${url}" /></p>`);
  return [current, ...additions].filter(Boolean).join("");
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
    skuBarcode: firstPresent(item.skuBarcode, item.sku_barcode, item.barcode, item.barCode),
    productName: firstPresent(item.productName, item.product_name),
    categoryName: firstPresent(item.categoryName, item.category_name),
    brandName: firstPresent(item.brandName, item.brand_name),
    attributeTemplateId: firstPresent(item.attributeTemplateId, item.attribute_template_id),
    customAttributes: firstPresent(item.customAttributes, item.customAttributesJson, item.custom_attributes_json),
    customAttributesJson: firstPresent(item.customAttributesJson, item.customAttributes, item.custom_attributes_json),
    skuName: firstPresent(item.skuName, item.sku_name),
    skuStatus: firstPresent(item.skuStatus, item.sku_status),
    unit: firstPresent(item.unit, item.baseUnit, item.base_unit),
    quoteType: firstPresent(item.quoteType, item.quote_type),
    saleMode: normalizeProductSaleMode(item),
    saleUnit: firstPresent(item.saleUnit, item.sale_unit, item.sellingUnit),
    saleUnitRatio: normalizeProductSaleUnitRatio(item),
    mainImageUrl: firstPresent(item.mainImageUrl, item.main_image_url, item.imageUrl, item.image_url),
    mainImageCardUrl: firstPresent(item.mainImageCardUrl, item.main_image_card_url, item.cardUrl),
    mainImageThumbnailUrl: firstPresent(item.mainImageThumbnailUrl, item.main_image_thumbnail_url, item.mainImageThumbUrl, item.main_image_thumb_url, item.thumbnailUrl),
    detailContent: firstPresent(item.detailContent, item.detail_content),
    carouselImages: firstPresent(item.carouselImages, item.carousel_images),
    detailImages: firstPresent(item.detailImages, item.detail_images),
    specImages: firstPresent(item.specImages, item.spec_images),
    salePrice: firstPresent(item.salePrice, item.sale_price),
    stockQuantity: firstPresent(item.stockQuantity, item.stock_quantity),
    minOrderQuantity: firstPresent(item.minOrderQuantity, item.min_order_quantity),
    skuList: firstPresent(item.skuList, item.skuListJson, item.sku_list_json),
    skuListJson: firstPresent(item.skuListJson, item.skuList, item.sku_list_json),
    tierPrices: firstPresent(item.tierPrices, item.tierPricesJson, item.tier_prices_json),
    tierPricesJson: firstPresent(item.tierPricesJson, item.tierPrices, item.tier_prices_json),
    productStatus: firstPresent(item.productStatus, item.product_status),
    saleStatus: firstPresent(item.saleStatus, item.sale_status),
    updatedAt: firstPresent(item.updatedAt, item.updated_at),
    createdAt: firstPresent(item.createdAt, item.created_at)
  };
}

function productAttributeRows(templateId: React.Key | undefined, value: any, templates: AnyRecord[]) {
  const savedRows = parseRows(value);
  const template = templates.find((item: AnyRecord) => String(item.id) === String(templateId ?? ""));
  if (!template) return savedRows;

  const savedByFieldId = new Map(savedRows
    .filter((item: AnyRecord) => item?.fieldId !== undefined && item?.fieldId !== null)
    .map((item: AnyRecord) => [String(item.fieldId), item]));
  const savedByName = new Map(savedRows
    .filter((item: AnyRecord) => String(item?.name || "").trim())
    .map((item: AnyRecord) => [String(item.name).trim(), item]));

  return (template.fields || []).slice(0, 10).map((field: AnyRecord) => {
    const saved = savedByFieldId.get(String(field.id)) || savedByName.get(String(field.name || "").trim());
    return {
      fieldId: field.id,
      name: field.name,
      value: saved?.value ?? ""
    };
  });
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

const productDetailRequests = new Map<string, Promise<AnyRecord>>();

async function requestProductDetail(item?: AnyRecord) {
  const normalizedItem = normalizeProductRecord(item);
  if (!normalizedItem?.id) return normalizedItem;
  const requestKey = String(normalizedItem.id);
  const existing = productDetailRequests.get(requestKey);
  if (existing) return existing;

  const detailRequest = (async () => {
    const urls = [`/api/admin/products/${normalizedItem.id}`, `/api/products/${normalizedItem.id}`];
    let lastError: unknown;
    for (const url of urls) {
      try {
        const response = await request(url);
        const detail = unwrapProductResponse(response, normalizedItem.id);
        if (detail) return { ...normalizedItem, ...detail };
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    throw lastError || new Error("商品详情加载失败");
  })().finally(() => {
    productDetailRequests.delete(requestKey);
  });
  productDetailRequests.set(requestKey, detailRequest);
  return detailRequest;
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
    attributeTemplateId: patch.attributeTemplateId ?? normalizedItem?.attributeTemplateId ?? null,
    customAttributes: patch.customAttributes ?? parseRows(normalizedItem?.customAttributesJson || normalizedItem?.customAttributes),
    quoteType: normalizedItem?.quoteType || "INDEPENDENT_PRICE",
    saleMode: normalizedItem?.saleMode || "NORMAL",
    saleUnit: normalizedItem?.saleMode === "BATCH" ? normalizedItem?.saleUnit || null : null,
    saleUnitRatio: normalizedItem?.saleMode === "BATCH" ? Number(normalizedItem?.saleUnitRatio) || null : null,
    productStatus: patch.productStatus ?? normalizedItem?.productStatus ?? "NEW",
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
  const [productStatusInput, setProductStatusInput] = useState<string>();
  const [productStatus, setProductStatus] = useState<string>();
  const [batchQueryOpen, setBatchQueryOpen] = useState(false);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditType, setBatchEditType] = useState<string>();
  const [batchEditSubmitting, setBatchEditSubmitting] = useState(false);
  const [batchAttributeTemplates, setBatchAttributeTemplates] = useState<AnyRecord[]>([]);
  const [batchDeleteChecking, setBatchDeleteChecking] = useState(false);
  const [batchDeleteBlockedOpen, setBatchDeleteBlockedOpen] = useState(false);
  const [batchDeleteBlockedRows, setBatchDeleteBlockedRows] = useState<AnyRecord[]>([]);
  const [specDetailProduct, setSpecDetailProduct] = useState<AnyRecord>();
  const [specDetailLoading, setSpecDetailLoading] = useState(false);
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
  const openProductForm = async (item?: AnyRecord) => {
    try {
      if (!Object.prototype.hasOwnProperty.call(ctx.data, "attributeTemplates")) {
        await ctx.loadKeys(["attributeTemplates"]);
      }
      const detailItem = item?.id ? await requestProductDetail(item) : item;
      productForm(ctx, detailItem);
    } catch (error: any) {
      ctx.message.error(error.message || "商品详情加载失败");
    }
  };
  const openSpecDetail = async (item: AnyRecord) => {
    setSpecDetailProduct(normalizeProductRecord(item) || item);
    setSpecDetailLoading(true);
    try {
      const detailItem = item?.id ? await requestProductDetail(item) : item;
      setSpecDetailProduct(detailItem);
    } catch (error: any) {
      ctx.message.error(error.message || "商品规格加载失败");
    } finally {
      setSpecDetailLoading(false);
    }
  };
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
  const specDetailRows = useMemo(() => specDetailProduct
    ? productSkuRows(specDetailProduct).map((item: AnyRecord, index: number) => ({
      ...item,
      key: item.skuCode || item.specKey || `spec-${index}`,
      index: index + 1
    }))
    : [], [specDetailProduct]);
  const specDetailGroupNames = useMemo(() => Array.from(new Set(specDetailRows.flatMap((item: AnyRecord) =>
    (item.specValues || []).map((spec: AnyRecord) => String(spec.groupName || "").trim()).filter(Boolean)
  ))), [specDetailRows]);
  const specDetailColumns = useMemo(() => [
    { title: "序号", dataIndex: "index", width: 64, align: "center" },
    ...(specDetailGroupNames.length
      ? specDetailGroupNames.map(groupName => ({
        title: groupName,
        key: `spec-${groupName}`,
        width: 110,
        render: (_: any, item: AnyRecord) => item.specValues?.find((spec: AnyRecord) => spec.groupName === groupName)?.value || "-"
      }))
      : [{ title: "规格", dataIndex: "skuName", width: 160, render: (value: any) => value || "-" }]),
    { title: "SKU编码", dataIndex: "skuCode", width: 150, render: compactText },
    { title: "SKU条码", dataIndex: "skuBarcode", width: 150, render: compactText },
    { title: "单价", dataIndex: "salePrice", width: 110, render: money },
    { title: "库存", dataIndex: "stockQuantity", width: 90 },
    { title: "状态", dataIndex: "skuStatus", width: 90, render: (value: any) => value === "DISABLED" ? <Tag>停用</Tag> : <Tag color="green">启用</Tag> }
  ], [specDetailGroupNames]);
  const filteredRows = rows.filter((item: AnyRecord) => {
    const searchText = [
      item.productCode,
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
      && (!productStatus || normalizeProductBusinessStatus(item.productStatus) === productStatus)
      && batchMatched;
  });
  const brandOptions = Array.from(new Set(brands.map((x: AnyRecord) => x.brandName).filter(Boolean))).map(value => ({ value, label: value }));
  const attributeTemplates = batchAttributeTemplates.length ? batchAttributeTemplates : (ctx.data.attributeTemplates || []);
  const tagOptions = [{ value: "重点商品", label: "重点商品" }, { value: "常规商品", label: "常规商品" }];
  const saleStatusOptions = productSaleStatusOptions;
  const productStatusOptions = productBusinessStatusOptions;
  const batchEditTitles: AnyRecord = {
    category: "批量修改商品分类",
    brand: "批量修改商品品牌",
    status: "批量修改上架状态",
    productStatus: "批量修改商品状态",
    attributes: "批量修改商品属性"
  };
  const selectedCategoryKey = categoryName ? `category:${categoryName}` : "category:__all__";
  const productSortComparers: Record<string, (a: AnyRecord, b: AnyRecord) => number> = {
    skuCode: (a, b) => String(a.skuCode || "").localeCompare(String(b.skuCode || "")),
    productCode: (a, b) => String(a.productCode || "").localeCompare(String(b.productCode || "")),
    productName: (a, b) => String(a.productName || "").localeCompare(String(b.productName || "")),
    categoryName: (a, b) => String(a.categoryName || "").localeCompare(String(b.categoryName || "")),
    saleStatus: (a, b) => String(a.saleStatus || "").localeCompare(String(b.saleStatus || "")),
    productStatus: (a, b) => String(a.productStatus || "").localeCompare(String(b.productStatus || ""))
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
    setProductStatus(productStatusInput);
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
    setProductStatusInput(undefined);
    setProductStatus(undefined);
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
  const openBatchEditModal = async (type: string) => {
    if (!selectedRowKeys.length) {
      ctx.message.error("请先选择需要修改的商品");
      return;
    }
    if (type === "attributes") {
      const templates = Object.prototype.hasOwnProperty.call(ctx.data, "attributeTemplates")
        ? (ctx.data.attributeTemplates || [])
        : await request<AnyRecord[]>("/api/admin/product-attribute-templates").catch(() => []);
      setBatchAttributeTemplates(templates);
    }
    batchEditForm.resetFields();
    setBatchEditType(type);
    setBatchEditOpen(true);
  };
  const submitBatchEdit = async () => {
    const values = await batchEditForm.validateFields();
    const patch = batchEditType === "category"
      ? { categoryName: values.categoryName }
        : batchEditType === "brand"
          ? { brandName: values.brandName }
        : batchEditType === "status"
          ? { saleStatus: values.saleStatus }
          : batchEditType === "productStatus"
            ? { productStatus: values.productStatus }
          : batchEditType === "attributes"
            ? { attributeTemplateId: values.attributeTemplateId, customAttributes: values.customAttributes || [] }
            : {};
    if (!Object.keys(patch).length) {
      ctx.message.warning("请至少选择一项修改内容");
      return;
    }
    setBatchEditSubmitting(true);
    try {
      await request("/api/admin/products/batch-update", {
        method: "PUT",
        data: {
          productIds: selectedRowKeys,
          type: batchEditType,
          ...patch
        }
      });
      ctx.message.success(`已批量修改 ${selectedProducts.length} 个商品`);
      setBatchEditOpen(false);
      setBatchEditType(undefined);
      batchEditForm.resetFields();
      setSelectedRowKeys([]);
      ctx.reload();
    } catch (error: any) {
      ctx.message.error(error.message);
    } finally {
      setBatchEditSubmitting(false);
    }
  };
  const showBatchDeleteBlocked = (blocked: AnyRecord[]) => {
    setBatchDeleteBlockedRows(blocked);
    setBatchDeleteBlockedOpen(true);
  };
  const submitBatchDelete = async () => {
    try {
      const result = await request<AnyRecord>("/api/admin/products/batch-delete", {
        method: "POST",
        data: { productIds: selectedProducts.map((item: AnyRecord) => item.id) }
      });
      const blocked = Array.isArray(result?.blocked) ? result.blocked : [];
      if (blocked.length) {
        showBatchDeleteBlocked(blocked);
        return;
      }
      ctx.message.success(`已删除 ${Number(result?.deletedCount || selectedProducts.length)} 个商品`);
      setSelectedRowKeys([]);
      ctx.reload();
    } catch (error: any) {
      ctx.message.error(error.message);
      throw error;
    }
  };
  const openBatchDelete = async () => {
    if (!selectedProducts.length) {
      ctx.message.error("请先选择需要删除的商品");
      return;
    }
    setBatchDeleteChecking(true);
    try {
      const result = await request<AnyRecord>("/api/admin/products/batch-delete/check", {
        method: "POST",
        data: { productIds: selectedProducts.map((item: AnyRecord) => item.id) }
      });
      const blocked = Array.isArray(result?.blocked) ? result.blocked : [];
      if (blocked.length) {
        showBatchDeleteBlocked(blocked);
        return;
      }
      Modal.confirm({
        title: "确认批量删除商品？",
        content: `已选中 ${selectedProducts.length} 个商品，删除后网页商城和 H5 商城将不再展示，且无法恢复。`,
        okText: "确认删除",
        cancelText: "取消",
        okButtonProps: { danger: true },
        onOk: submitBatchDelete
      });
    } catch (error: any) {
      ctx.message.error(error.message);
    } finally {
      setBatchDeleteChecking(false);
    }
  };
  const baseColumns: ColumnsType<AnyRecord> = [
    { key: "index", title: "序号", width: 72, align: "center", className: "product-index-column", render: (_, __, index) => index + 1 },
    { key: "productCode", title: "商品编码", dataIndex: "productCode", width: 150, align: "left", className: "product-code-column", render: (v, item) => <Button className="product-code-link" type="link" onClick={() => void productDetail(ctx, item)}>{v || "-"}</Button> },
    { key: "productName", title: "商品名称", dataIndex: "productName", width: 260, render: renderProductNameCell },
    { key: "categoryName", title: "商品分类", dataIndex: "categoryName", width: 150 },
    { key: "saleStatus", title: "上架状态", dataIndex: "saleStatus", width: 120, render: v => <Tag color={v === "ON_SALE" ? "green" : "default"}>{productSaleStatusText(v)}</Tag> },
    { key: "productStatus", title: "商品状态", dataIndex: "productStatus", width: 120, render: v => <Tag color={normalizeProductBusinessStatus(v) === "DISABLED" ? "red" : normalizeProductBusinessStatus(v) === "ARCHIVED" ? "orange" : normalizeProductBusinessStatus(v) === "NEW" ? "blue" : "green"}>{productBusinessStatusText(v)}</Tag> },
    {
      key: "skuName",
      title: "规格",
      dataIndex: "skuName",
      width: 140,
      render: (value, item) => {
        const skuRows = productSkuRows(item);
        const hasSpecType = skuRows.some((sku: AnyRecord) => (sku.specValues || []).some((spec: AnyRecord) => String(firstPresent(spec.groupName, spec.groupId) || "").trim()));
        return (
          <div className="product-spec-summary-cell">
            <span title={String(value || "")}>{value || "-"}</span>
            {hasSpecType ? <Button type="link" onClick={() => void openSpecDetail(item)}>查看更多</Button> : null}
          </div>
        );
      }
    },
    { key: "unit", title: "库存单位", dataIndex: "unit", width: 120, render: v => v || "-" },
    { key: "brandName", title: "商品品牌", dataIndex: "brandName", width: 140, render: v => v || "-" },
    { key: "quoteType", title: "报价方式", dataIndex: "quoteType", width: 140, render: v => v === "TIER_PRICE" ? "阶梯报价" : "规格独立价" },
    { key: "salePrice", title: "单价", dataIndex: "salePrice", width: 120, render: money },
    { key: "stockQuantity", title: "库存", dataIndex: "stockQuantity", width: 100 },
    {
      key: "action",
      title: (
        <div className="product-action-header-content">
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
      ),
      fixed: "right",
      width: 150,
      align: "center",
      className: "product-action-column",
      onHeaderCell: () => ({ className: "product-action-header", width: 150 }),
      onCell: () => ({ className: "product-action-column" }),
      render: (_, item) => (
        <Space size={7} className="product-action-links">
          <Button type="link" icon={<EditOutlined />} onClick={() => void openProductForm(item)}>编辑</Button>
          <Button type="link" disabled={normalizeProductBusinessStatus(item.productStatus) === "DISABLED"} onClick={() => productSale(ctx, item)}>{item.saleStatus === "ON_SALE" ? "下架" : "上架"}</Button>
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
  const isInitialProductLoading = loading && sortedRows.length === 0;

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
                  placeholder="编码 | 名称"
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
              <span>上架状态</span>
              <Select allowClear placeholder="请选择上架状态" value={saleStatusInput} options={saleStatusOptions} onChange={setSaleStatusInput} />
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
              <span>商品状态</span>
              <Select allowClear placeholder="请选择商品状态" value={productStatusInput} options={productStatusOptions} onChange={setProductStatusInput} />
            </label>
            <div className="product-archive-query-actions">
              <Button type="primary" onClick={applyFilters}>查询</Button>
              <Button onClick={resetFilters}>重置</Button>
            </div>
          </div>
        </div>
        <div className="product-archive-toolbar">
          {toolbarButton("新增", <PlusOutlined />, () => void openProductForm())}
          {toolbarButton("导入")}
          {toolbarButton("导出")}
          <Dropdown
            trigger={["click"]}
            placement="bottomLeft"
            menu={{
              items: [
                { key: "category", label: "批量修改商品分类" },
                { key: "brand", label: "批量修改商品品牌" },
                { key: "status", label: "批量修改上架状态" },
                { key: "productStatus", label: "批量修改商品状态" },
                { key: "attributes", label: "批量修改商品属性" }
              ],
              onClick: ({ key }) => void openBatchEditModal(String(key))
            }}
          >
            <Button type="primary">批量修改</Button>
          </Dropdown>
          <Button type="primary" loading={batchDeleteChecking} onClick={openBatchDelete}>批量删除</Button>
        </div>
        <div className={`product-archive-table product-catalog-table anchored-pagination-table ${isInitialProductLoading ? "is-initial-loading" : ""}`}>
          <AdminTable
            loading={loading}
            rowKey="id"
            columns={columns}
            dataSource={sortedRows}
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
            pagination={{ className: "product-archive-pagination" }}
            tableLayout="fixed"
            scroll={{ x: productTableScrollX, y: "100%" }}
          />
        </div>
      </section>
      <Modal
        open={batchEditOpen}
        title={batchEditTitles[batchEditType || ""] || "批量修改"}
        width={720}
        destroyOnClose
        confirmLoading={batchEditSubmitting}
        onCancel={() => {
          setBatchEditOpen(false);
          setBatchEditType(undefined);
          batchEditForm.resetFields();
        }}
        onOk={submitBatchEdit}
        okText="更新"
      >
        <Form form={batchEditForm} layout="vertical">
          <Typography.Text type="secondary">
            已选中 {selectedProducts.length} 个商品，本次只修改当前选择的功能。
          </Typography.Text>
          {batchEditType === "category" ? (
            <Form.Item name="categoryName" label="商品分类" rules={[{ required: true, message: "请选择商品分类" }]} style={{ marginTop: 16 }}>
              <Select
                showSearch
                placeholder="请选择商品分类"
                options={categories.map((x: AnyRecord) => ({ value: x.categoryName, label: x.categoryName }))}
              />
            </Form.Item>
          ) : null}
          {batchEditType === "brand" ? (
            <Form.Item name="brandName" label="商品品牌" rules={[{ required: true, message: "请选择商品品牌" }]} style={{ marginTop: 16 }}>
              <Select
                showSearch
                placeholder="请选择商品品牌"
                options={brands.map((x: AnyRecord) => ({ value: x.brandName, label: x.brandName }))}
              />
            </Form.Item>
          ) : null}
          {batchEditType === "status" ? (
            <Form.Item name="saleStatus" label="上架状态" rules={[{ required: true, message: "请选择上架状态" }]} style={{ marginTop: 16 }}>
              <Select placeholder="请选择上架状态" options={saleStatusOptions} />
            </Form.Item>
          ) : null}
          {batchEditType === "productStatus" ? (
            <Form.Item name="productStatus" label="商品状态" rules={[{ required: true, message: "请选择商品状态" }]} style={{ marginTop: 16 }}>
              <Select placeholder="请选择商品状态" options={productStatusOptions} />
            </Form.Item>
          ) : null}
          {batchEditType === "attributes" ? (
            <div className="product-custom-attribute-panel product-batch-attribute-panel">
              <div className="product-custom-template-row">
                <div className="product-custom-template-label">属性模板</div>
                <Form.Item name="attributeTemplateId" rules={[{ required: true, message: "请选择属性模板" }]} style={{ marginBottom: 0 }}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="请选择属性模板"
                    options={attributeTemplates.map((template: AnyRecord) => ({ value: template.id, label: template.templateName }))}
                    filterOption={(input, option) => String(option?.label || "").toLocaleLowerCase().includes(input.trim().toLocaleLowerCase())}
                    onChange={(templateId) => {
                      batchEditForm.setFieldValue("customAttributes", productAttributeRows(templateId, [], attributeTemplates));
                    }}
                  />
                </Form.Item>
              </div>
              <Form.List name="customAttributes">
                {(fields, { remove }) => fields.length ? (
                  <div className="product-custom-attribute-list">
                    {fields.map(field => (
                      <div className="product-custom-attribute-row" key={field.key}>
                        <Form.Item name={[field.name, "fieldId"]} hidden><Input /></Form.Item>
                        <Form.Item name={[field.name, "name"]} hidden><Input /></Form.Item>
                        <div className="product-custom-attribute-name">{batchEditForm.getFieldValue(["customAttributes", field.name, "name"]) || "属性名称"}</div>
                        <Form.Item name={[field.name, "value"]} noStyle>
                          <Input maxLength={100} placeholder="请输入属性值" />
                        </Form.Item>
                        <Button type="text" danger icon={<DeleteOutlined />} aria-label="删除该商品属性" onClick={() => remove(field.name)} />
                      </div>
                    ))}
                  </div>
                ) : <div className="product-form-empty-section">选择属性模板后展示属性字段</div>}
              </Form.List>
            </div>
          ) : null}
        </Form>
      </Modal>
      <Modal
        open={batchDeleteBlockedOpen}
        title="商品已有业务往来记录，无法删除"
        width={820}
        className="product-batch-delete-blocked-modal"
        onCancel={() => setBatchDeleteBlockedOpen(false)}
        footer={<Button type="primary" onClick={() => setBatchDeleteBlockedOpen(false)}>我知道了</Button>}
      >
        <Typography.Paragraph type="secondary">
          以下商品存在入库或销售记录，本次选择的商品均未删除。请取消勾选这些商品后重试。
        </Typography.Paragraph>
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={batchDeleteBlockedRows}
          scroll={{ y: 360 }}
          columns={[
            { title: "商品编码", dataIndex: "productCode", width: 150, render: compactText },
            { title: "商品名称", dataIndex: "productName", ellipsis: true },
            { title: "入库记录", dataIndex: "hasInboundRecord", width: 100, align: "center", render: value => value ? <Tag color="red">已有</Tag> : "无" },
            { title: "销售记录", dataIndex: "hasSalesRecord", width: 100, align: "center", render: value => value ? <Tag color="red">已有</Tag> : "无" },
            { title: "校验结果", dataIndex: "reason", width: 190, render: () => <Typography.Text type="danger">存在业务往来，无法删除</Typography.Text> }
          ]}
        />
      </Modal>
      <Modal
        open={Boolean(specDetailProduct)}
        title={`商品规格明细${specDetailProduct?.productName ? ` - ${specDetailProduct.productName}` : ""}`}
        width={980}
        className="product-spec-detail-modal"
        onCancel={() => setSpecDetailProduct(undefined)}
        footer={<Button type="primary" onClick={() => setSpecDetailProduct(undefined)}>关闭</Button>}
      >
        <Typography.Paragraph type="secondary">
          共 {specDetailRows.length} 个 SKU，可横向滚动查看全部规格和库存信息。
        </Typography.Paragraph>
        <Table
          size="small"
          rowKey="key"
          pagination={false}
          loading={specDetailLoading}
          dataSource={specDetailRows}
          columns={specDetailColumns}
          scroll={{ x: "max-content", y: 420 }}
        />
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
        <div className="product-batch-query-head">商品编码 | 名称 | 商品别称</div>
        <Input.TextArea
          rows={10}
          value={batchQueryText}
          placeholder="请输入商品编码、名称、商品别称"
          onChange={event => setBatchQueryText(event.target.value)}
        />
        <div className="product-batch-query-tips">
          <div className="product-batch-query-tips-title">提示：</div>
          <div>1、多个编码|名称|商品别称使用回车、空格或逗号分割</div>
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
    ...(Object.prototype.hasOwnProperty.call(row, "specImageGroupId")
      ? { specImageGroupId: row.specImageGroupId || "" }
      : {}),
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

function getSpecImageGroupId(rows: AnyRecord[]) {
  const explicitRow = rows.find(row => Object.prototype.hasOwnProperty.call(row, "specImageGroupId"));
  const explicitGroupId = String(explicitRow?.specImageGroupId || "");
  if (explicitGroupId) return explicitGroupId;
  for (const row of rows) {
    const specValues = Array.isArray(row?.specValues) ? row.specValues : [];
    const imageCell = specValues.find((cell: AnyRecord) => cell?.image && cell?.groupId);
    if (imageCell?.groupId) return String(imageCell.groupId);
  }
  const legacySkuImageRow = rows.find(row => row?.skuImageUrl && Array.isArray(row?.specValues) && row.specValues[0]?.groupId);
  if (legacySkuImageRow?.specValues?.[0]?.groupId) return String(legacySkuImageRow.specValues[0].groupId);
  return "";
}

function specValueImageKey(cell: AnyRecord) {
  return `${String(cell?.groupId || "")}:${String(cell?.valueId || cell?.value || "")}`;
}

function compactSkuListImages(rows: AnyRecord[]) {
  const source = Array.isArray(rows) ? rows : [];
  const imageGroupId = getSpecImageGroupId(source);
  const emitted = new Set<string>();
  return source.map(row => ({
    ...row,
    skuImageUrl: "",
    specImageGroupId: imageGroupId,
    specValues: Array.isArray(row?.specValues)
      ? row.specValues.map((cell: AnyRecord) => {
        const isImageCell = imageGroupId && String(cell?.groupId || "") === imageGroupId;
        const image = String(cell?.image || (isImageCell ? row?.skuImageUrl : "") || "");
        if (!isImageCell || !image) {
          return { ...cell, image: "" };
        }
        const key = specValueImageKey(cell);
        if (emitted.has(key)) return { ...cell, image: "" };
        emitted.add(key);
        return cell;
      })
      : []
  }));
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

function productForm(ctx: Ctx, item?: AnyRecord, draftValues?: AnyRecord, options: { readOnly?: boolean } = {}) {
  const readOnly = Boolean(options.readOnly);
  ctx.setDrawer({
    title: readOnly ? "商品详情" : item ? "编辑商品" : "新增商品",
    width: 1320,
    className: `product-form-drawer${readOnly ? " product-form-readonly-drawer" : ""}`,
    body: <ProductForm ctx={ctx} item={item} draftValues={draftValues} readOnly={readOnly} />
  });
}

function ProductForm({ ctx, item, draftValues, readOnly = false }: { ctx: Ctx; item?: AnyRecord; draftValues?: AnyRecord; readOnly?: boolean }) {
  const [form] = Form.useForm();
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [product, setProduct] = useState<AnyRecord | undefined>(() => normalizeProductRecord(item));
  const [customSaleUnits, setCustomSaleUnits] = useState<string[]>(() => readCustomSaleUnitValues());
  const [creatingSaleUnit, setCreatingSaleUnit] = useState(false);
  const [saleUnitInput, setSaleUnitInput] = useState("");
  const [saleUnitInputError, setSaleUnitInputError] = useState("");
  const [activeProductSection, setActiveProductSection] = useState("basic");
  const [pendingProductSection, setPendingProductSection] = useState<string | null>(null);
  const productFormBodyRef = useRef<HTMLDivElement | null>(null);
  const quoteType = Form.useWatch("quoteType", form) || "INDEPENDENT_PRICE";
  const saleMode = Form.useWatch("saleMode", form) || "NORMAL";
  const saleUnit = Form.useWatch("saleUnit", form) || "";
  const formProductStatus = Form.useWatch("productStatus", form) || "NEW";
  const baseUnit = Form.useWatch("unit", form) || product?.unit || "件";
  const isTierPrice = quoteType === "TIER_PRICE";
  const isBatchSale = saleMode === "BATCH";
  const minOrderUnitLabel = isBatchSale && saleUnit ? saleUnit : baseUnit;
  const productId = product?.id;
  const detail = useMemo(
    () => parseDetailContent(product?.detailContent || ""),
    [product?.detailContent]
  );
  const categories = (ctx.data.categories || []).filter((x: AnyRecord) => x.status === "ENABLED" || x.categoryName === product?.categoryName);
  const brands = (ctx.data.brands || []).filter((x: AnyRecord) => x.status === "ENABLED" || x.brandName === product?.brandName);
  const attributeTemplates = ctx.data.attributeTemplates || [];
  const saleUnitOptions = useMemo(() => Array.from(new Set([
    ...defaultSaleUnitValues,
    ...customSaleUnits,
    saleUnit
  ].map(value => String(value || "").trim()).filter(Boolean))).map(value => ({ value, label: value })), [customSaleUnits, saleUnit]);
  const initial = useMemo(() => {
    const productImages = Array.from(new Set([
      product?.mainImageUrl,
      ...(uniqueProductImageUrls(product?.carouselImages)),
      ...(detail.carouselImages || [])
    ].map(url => String(url || "").trim()).filter(Boolean))).slice(0, 5);
    const detailImageUrls = uniqueProductImageUrls(product?.detailImages, detail.imageUrl);
    const detailText = appendMissingDetailImages(detail.text || "", detailImageUrls);
    const savedCustomAttributes = parseRows(product?.customAttributesJson);
    const base = {
      productName: product?.productName || "",
      categoryName: product?.categoryName,
      brandName: product?.brandName,
      attributeTemplateId: product?.attributeTemplateId,
      customAttributes: productAttributeRows(
        product?.attributeTemplateId,
        savedCustomAttributes.length ? savedCustomAttributes : product?.customAttributes,
        attributeTemplates
      ),
      unit: product?.unit || "件",
      productStatus: product?.productStatus || "NEW",
      saleStatus: product?.saleStatus || "ON_SALE",
      quoteType: product?.quoteType || "INDEPENDENT_PRICE",
      saleMode: product?.saleMode || "NORMAL",
      saleUnit: product?.saleUnit || undefined,
      saleUnitRatio: product?.saleUnitRatio ?? undefined,
      mainImageUrl: productImages[0] || "",
      detailText,
      detailImageUrl: detailImageUrls[0] || "",
      carouselImages: productImages,
      skuList: productSkuRows(product),
      tierPrices: productTierRows(product)
    };
    if (!draftValues) return base;
    return {
      ...base,
      ...draftValues,
      carouselImages: parseRows(draftValues.carouselImages).length ? draftValues.carouselImages : base.carouselImages,
      skuList: Array.isArray(draftValues.skuList) ? draftValues.skuList : base.skuList,
      tierPrices: Array.isArray(draftValues.tierPrices) ? draftValues.tierPrices : base.tierPrices
    };
  }, [attributeTemplates, detail.carouselImages, detail.imageUrl, detail.text, product, draftValues]);

  useEffect(() => {
    setProduct(normalizeProductRecord(item));
  }, [item?.id, item?.updatedAt, item?.skuListJson, item?.tierPricesJson]);

  useEffect(() => {
    form.resetFields();
    form.setFieldsValue(initial);
  }, [form, initial]);

  useEffect(() => {
    if (formProductStatus === "DISABLED" && form.getFieldValue("saleStatus") !== "OFF_SALE") {
      form.setFieldValue("saleStatus", "OFF_SALE");
    }
  }, [form, formProductStatus]);

  const applyAttributeTemplate = (templateId?: React.Key) => {
    const template = attributeTemplates.find((item: AnyRecord) => String(item.id) === String(templateId));
    form.setFieldsValue({
      attributeTemplateId: templateId,
      customAttributes: template
        ? (template.fields || []).slice(0, 10).map((field: AnyRecord) => ({ fieldId: field.id, name: field.name, value: "" }))
        : []
    });
  };
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
        <img src={value} alt="" loading="lazy" decoding="async" />
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

  const ProductImagesUpload = () => (
    <Form.Item shouldUpdate noStyle>
      {() => {
        const currentImages = () => Array.from(new Set([
          form.getFieldValue("mainImageUrl"),
          ...parseRows(form.getFieldValue("carouselImages"))
        ].map((url: any) => String(url || "").trim()).filter(Boolean))).slice(0, 5);
        const value = currentImages();
        const setImages = (nextImages: string[]) => {
          const next = Array.from(new Set(nextImages.map(url => String(url || "").trim()).filter(Boolean))).slice(0, 5);
          form.setFieldValue("mainImageUrl", next[0] || "");
          form.setFieldValue("carouselImages", next);
        };
        const uploadProps = {
          beforeUpload: async (file: File) => {
            if (currentImages().length >= 5) {
              ctx.message.warning("商品图片最多上传5张");
              return false;
            }
            try {
              const dataUrl = await imageToCompressedDataUrl(file, {
                maxInputBytes: 5 * 1024 * 1024,
                maxOutputBytes: 110 * 1024
              });
              setImages([...currentImages(), dataUrl]);
            } catch (error: any) {
              ctx.message.error(error.message);
            }
            return false;
          },
          showUploadList: false,
          accept: "image/*",
          multiple: true
        };
        const updateAt = (index: number, url: string) => {
          const next = [...value];
          next[index] = url;
          setImages(next);
        };
        const removeAt = (index: number) => {
          setImages(value.filter((_: string, idx: number) => idx !== index));
        };
        const moveAt = (fromIndex: number, toIndex: number) => {
          if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
          const next = [...value];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          setImages(next);
        };
        return (
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            <div className="product-carousel-upload-list">
              {value.map((url: string, index: number) => (
                <div
                  className={`product-image-preview-tile is-carousel ${index === 0 ? "is-primary" : ""}`}
                  key={`${url}-${index}`}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    moveAt(Number(event.dataTransfer.getData("text/plain")), index);
                  }}
                >
                  <img src={url} alt="" loading="lazy" decoding="async" />
                  {index === 0 ? <span className="product-image-primary-badge">主图</span> : null}
                  <div className="product-image-drag-handle"><HolderOutlined /></div>
                  <div className="product-image-actions">
                    <Tooltip title="删除">
                      <Button type="text" icon={<DeleteOutlined />} onClick={() => removeAt(index)} />
                    </Tooltip>
                    <Tooltip title="预览">
                      <Button type="text" icon={<ZoomInOutlined />} onClick={() => setPreviewImageUrl(url)} />
                    </Tooltip>
                    <Upload {...{
                      ...uploadProps,
                      beforeUpload: async (file: File) => {
                        try {
                          const dataUrl = await imageToCompressedDataUrl(file, {
                            maxInputBytes: 5 * 1024 * 1024,
                            maxOutputBytes: 110 * 1024
                          });
                          updateAt(index, dataUrl);
                        } catch (error: any) {
                          ctx.message.error(error.message);
                        }
                        return false;
                      },
                      multiple: false
                    }}>
                      <Tooltip title="更换">
                        <Button type="text" icon={<EditOutlined />} />
                      </Tooltip>
                    </Upload>
                  </div>
                </div>
              ))}
              {value.length < 5 ? (
                <Upload {...uploadProps}>
                  <button type="button" className="product-image-add-tile is-carousel">
                    <PlusOutlined className="product-image-add-icon" />
                    <span className="product-image-add-label">添加图片</span>
                  </button>
                </Upload>
              ) : null}
            </div>
            <Typography.Text type="secondary">最多上传5张，建议尺寸700*700，单张图片大小不得超过5MB。</Typography.Text>
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
        if (value === undefined || value === null || value === "") return Promise.resolve();
        const current = Number(value);
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
        if (value === undefined || value === null || value === "") return Promise.resolve();
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

  const confirmCreateSaleUnit = () => {
    const text = saleUnitInput.trim();
    if (!text) {
      setSaleUnitInputError("请输入内容");
      return;
    }
    if (saleUnitOptions.some(option => option.value === text)) {
      setSaleUnitInputError("该销售单位已存在");
      return;
    }
    const next = saveCustomSaleUnitValues([...customSaleUnits, text]);
    setCustomSaleUnits(next);
    form.setFieldValue("saleUnit", text);
    setSaleUnitInput("");
    setSaleUnitInputError("");
    setCreatingSaleUnit(false);
    ctx.message.success("销售单位已保存");
  };

  const cancelCreateSaleUnit = () => {
    setCreatingSaleUnit(false);
    setSaleUnitInput("");
    setSaleUnitInputError("");
  };

  const renderSaleUnitDropdown = (menu: React.ReactNode) => (
    <div className="product-sale-unit-dropdown">
      {menu}
      {creatingSaleUnit ? (
        <div className="product-sale-unit-create" onMouseDown={event => event.stopPropagation()}>
          <div className="product-sale-unit-create-row">
            <Input
              autoFocus
              value={saleUnitInput}
              status={saleUnitInputError ? "error" : undefined}
              placeholder="请输入内容"
              maxLength={maxUnitLength}
              onChange={event => {
                setSaleUnitInput(event.target.value);
                if (saleUnitInputError) setSaleUnitInputError("");
              }}
              onPressEnter={confirmCreateSaleUnit}
              onMouseDown={event => event.stopPropagation()}
              onClick={event => event.stopPropagation()}
              onKeyDown={event => event.stopPropagation()}
            />
            <button
              type="button"
              className="product-sale-unit-create-action is-confirm"
              aria-label="确认创建销售单位"
              title="确认"
              onMouseDown={event => event.preventDefault()}
              onClick={confirmCreateSaleUnit}
            >
              <CheckOutlined />
            </button>
            <button
              type="button"
              className="product-sale-unit-create-action is-cancel"
              aria-label="取消创建销售单位"
              title="取消"
              onMouseDown={event => event.preventDefault()}
              onClick={cancelCreateSaleUnit}
            >
              <CloseOutlined />
            </button>
          </div>
          {saleUnitInputError ? <div className="product-sale-unit-create-error">{saleUnitInputError}</div> : null}
        </div>
      ) : (
        <div className="product-sale-unit-create-entry" onMouseDown={event => event.preventDefault()}>
          <span>没有合适的？</span>
          <button
            type="button"
            onClick={() => {
              setCreatingSaleUnit(true);
              setSaleUnitInput("");
              setSaleUnitInputError("");
            }}
          >
            创建
          </button>
        </div>
      )}
    </div>
  );

  const openProductPreview = () => {
    const draft = {
      ...initial,
      ...form.getFieldsValue(true)
    };
    const exitPreview = () => productForm(ctx, item, draft);
    ctx.setDrawer({
      title: "退出预览",
      width: 1320,
      className: "product-form-drawer product-preview-drawer",
      onClose: exitPreview,
      body: <ProductEditPreview values={draft} sourceProduct={product} onExit={exitPreview} />
    });
  };

  const openProductSection = (key: string) => {
    setActiveProductSection(key);
    setPendingProductSection(key);
  };
  useEffect(() => {
    if (!pendingProductSection) return;
    const frame = window.requestAnimationFrame(() => {
      const body = productFormBodyRef.current;
      const target = body?.querySelector<HTMLElement>(`[data-product-section="${pendingProductSection}"]`);
      if (!body || !target) return;
      const top = body.scrollTop + target.getBoundingClientRect().top - body.getBoundingClientRect().top - 64;
      body.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      setPendingProductSection(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingProductSection]);
  const productFormAnchors = [
    { key: "basic", label: "基础信息" },
    { key: "spec", label: "商品规格" },
    { key: "custom", label: "商品属性" },
    { key: "detail", label: "商品详情" }
  ];

  return (
    <Form className={`product-form-layout${readOnly ? " is-readonly" : ""}`} form={form} layout="vertical" disabled={readOnly} initialValues={initial} onFinish={async values => {
        values = {
          ...initial,
          ...form.getFieldsValue(true),
          ...values
        };
        const skuRows = compactSkuListImages(Array.isArray(values.skuList) ? values.skuList : []);
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
        const productImages = Array.from(new Set([
          form.getFieldValue("mainImageUrl"),
          ...parseRows(form.getFieldValue("carouselImages"))
        ].map((url: any) => String(url || "").trim()).filter(Boolean))).slice(0, 5);
        const detailContent = JSON.stringify({
          html: values.detailText || "",
          plainText: stripRichText(values.detailText),
          imageUrl: values.detailImageUrl || detail.imageUrl || "",
          carouselImages: productImages.slice(1)
        });
        const { carouselImages: _carouselImages, detailImageUrl: _detailImageUrl, detailText: _detailText, ...submitValues } = values;
        const data = {
          ...submitValues,
          saleMode: normalizedSaleMode,
          saleUnit: normalizedSaleMode === "BATCH" ? values.saleUnit || null : null,
          saleUnitRatio: normalizedSaleMode === "BATCH" ? Number(values.saleUnitRatio) : null,
          mainImageUrl: productImages[0] || "",
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
        if (!data.mainImageUrl) return ctx.message.error("请选择商品图片");
        if (JSON.stringify(data).length > 1200 * 1024) return ctx.message.error("图片内容仍然过大，请更换更小的图片后提交");
        try {
          const savedFromResponse = unwrapProductResponse(
            await request(productId ? `/api/admin/products/${productId}` : "/api/admin/products", {
              method: productId ? "PUT" : "POST",
              data
            }),
            productId
          );
          const saved = normalizeProductRecord({
            ...product,
            ...data,
            ...savedFromResponse,
            mainImageUrl: productImages[0] || savedFromResponse?.mainImageUrl || data.mainImageUrl,
            detailContent: savedFromResponse?.detailContent || detailContent,
            id: savedFromResponse?.id || productId
          });
          if (saved) {
            setProduct(saved);
          }
          ctx.message.success("商品已保存，商城端数据已同步");
          ctx.setDrawer(null);
          ctx.reload();
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
        <div className="product-form-body" ref={productFormBodyRef}>
          <div className="product-form-tabs product-form-tabbar product-form-anchorbar" role="navigation" aria-label="商品编辑区域导航">
            {productFormAnchors.map(anchor => (
              <button
                key={anchor.key}
                type="button"
                className={`product-form-anchor ${activeProductSection === anchor.key ? "is-active" : ""}`}
                onClick={() => openProductSection(anchor.key)}
              >
                {anchor.label}
              </button>
            ))}
          </div>
          <div className="product-form-pane">
                    <section className="product-form-section" data-product-section="basic">
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
                            <Select
                              showSearch
                              optionFilterProp="label"
                              placeholder="请选择商品分类"
                              filterOption={(input, option) => String(option?.label || "")
                                .toLocaleLowerCase()
                                .includes(input.trim().toLocaleLowerCase())}
                              options={categories.map((x: AnyRecord) => ({ value: x.categoryName, label: x.categoryName }))}
                            />
                          </Form.Item>
                        </div>
                        <div className="product-form-basic-label is-required">商品品牌</div>
                        <div className="product-form-basic-control">
                          <Form.Item name="brandName" rules={[{ required: true, message: "请选择商品品牌" }]}>
                            <Select
                              showSearch
                              optionFilterProp="label"
                              placeholder="请选择商品品牌"
                              filterOption={(input, option) => String(option?.label || "")
                                .toLocaleLowerCase()
                                .includes(input.trim().toLocaleLowerCase())}
                              options={brands.map((x: AnyRecord) => ({ value: x.brandName, label: x.brandName }))}
                            />
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
                          <Form.Item name="productStatus" rules={[{ required: true, message: "请选择商品状态" }]}>
                            <Select options={productBusinessStatusOptions} />
                          </Form.Item>
                        </div>
                        <div className="product-form-basic-label is-required">上架状态</div>
                        <div className="product-form-basic-control">
                          <Form.Item name="saleStatus" rules={[{ required: true, message: "请选择上架状态" }]}>
                            <Select options={productSaleStatusOptions.map(option => ({ ...option, disabled: option.value === "ON_SALE" && formProductStatus === "DISABLED" }))} />
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
                                    showSearch
                                    optionFilterProp="label"
                                    filterOption={(input, option) => String(option?.label || "")
                                      .toLocaleLowerCase()
                                      .includes(input.trim().toLocaleLowerCase())}
                                    options={saleUnitOptions}
                                    popupRender={renderSaleUnitDropdown}
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
                      <div className="product-form-basic-label is-required">商品图片</div>
                      <div className="product-form-main-image-control">
                          <Form.Item name="mainImageUrl" rules={[{ required: true, message: "请选择商品图片" }]} noStyle>
                            <Input type="hidden" />
                          </Form.Item>
                          <ProductImagesUpload />
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
                                              <InputNumber
                                                min={1}
                                                max={maxMinOrderQuantity}
                                                precision={0}
                                                placeholder="起订数量"
                                                parser={value => {
                                                  const digits = String(value || "").replace(/\D/g, "");
                                                  if (!digits) return "";
                                                  return Math.min(maxMinOrderQuantity, Math.max(1, Number(digits)));
                                                }}
                                                onKeyDown={event => {
                                                  if (["e", "E", "+", "-", "."].includes(event.key)) event.preventDefault();
                                                }}
                                              />
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
                  <section className="product-form-section" data-product-section="spec">
                      <ProductSpecEditor
                        form={form}
                        initialSkuList={initial.skuList}
                        message={ctx.message}
                        onPreviewImage={setPreviewImageUrl}
                        minOrderUnitLabel={minOrderUnitLabel}
                        showAutoSkuCodePlaceholder={!product?.id}
                      />
                  </section>
                    <section className="product-form-section" data-product-section="custom">
                      <div className="product-form-section-title">商品属性</div>
                      <div className="product-custom-attribute-panel">
                        <div className="product-custom-template-row">
                          <div className="product-custom-template-label">属性模板</div>
                          <Form.Item name="attributeTemplateId" noStyle>
                            <Select
                              allowClear
                              showSearch
                              optionFilterProp="label"
                              placeholder="请选择属性模板"
                              options={attributeTemplates.map((template: AnyRecord) => ({ value: template.id, label: template.templateName }))}
                              filterOption={(input, option) => String(option?.label || "").toLocaleLowerCase().includes(input.trim().toLocaleLowerCase())}
                              onChange={applyAttributeTemplate}
                            />
                          </Form.Item>
                        </div>
                        <Form.List name="customAttributes">
                          {(fields, { remove }) => fields.length ? (
                            <div className="product-custom-attribute-list">
                              {fields.map(field => (
                                <div className="product-custom-attribute-row" key={field.key}>
                                  <Form.Item name={[field.name, "fieldId"]} hidden><Input /></Form.Item>
                                  <Form.Item name={[field.name, "name"]} hidden><Input /></Form.Item>
                                  <div className="product-custom-attribute-name">{form.getFieldValue(["customAttributes", field.name, "name"]) || "属性名称"}</div>
                                  <Form.Item name={[field.name, "value"]} noStyle>
                                    <Input maxLength={100} placeholder="请输入属性值" />
                                  </Form.Item>
                                  <Button type="text" danger icon={<DeleteOutlined />} aria-label="删除该商品属性" onClick={() => remove(field.name)} />
                                </div>
                              ))}
                            </div>
                          ) : <div className="product-form-empty-section">选择属性模板后展示属性字段</div>}
                        </Form.List>
                      </div>
                    </section>
                    <section className="product-form-section" data-product-section="detail">
                      <div className="product-form-section-title">商品详情</div>
                      <div className="product-detail-editor-row is-full">
                        <Form.Item name="detailText" noStyle>
                          <RichTextEditor maxLength={5000} placeholder="请输入内容..." onError={ctx.message.error} />
                        </Form.Item>
                      </div>
                    </section>
                  </div>
        </div>
        <div className="product-form-submit-bar">
          {readOnly ? (
            <Button type="primary" onClick={() => ctx.setDrawer(null)}>关闭</Button>
          ) : (
            <>
              <Space>
                <Button onClick={() => ctx.setDrawer(null)}>取消</Button>
                <Button type="primary" htmlType="submit">保存</Button>
              </Space>
              <Space>
                <Button onClick={openProductPreview}>预览</Button>
              </Space>
            </>
          )}
        </div>
    </Form>
  );
}

function productPreviewModel(values: AnyRecord, sourceProduct?: AnyRecord) {
  const source = normalizeProductRecord(sourceProduct) || {};
  const productImages = Array.from(new Set([
    values?.mainImageUrl,
    ...parseRows(values?.carouselImages)
  ].map((url: any) => String(url || "").trim()).filter(Boolean))).slice(0, 5);
  const skuRows = compactSkuListImages(Array.isArray(values?.skuList) ? values.skuList : [])
    .filter((row: AnyRecord) => row?.skuStatus !== "DISABLED");
  const tierPrices = parseRows(values?.tierPrices)
    .map((row: AnyRecord) => ({ minQty: Number(row.minQty || 0), price: Number(row.price || 0) }))
    .filter((row: AnyRecord) => row.minQty > 0 && row.price > 0);
  const firstSku = skuRows[0] || {};
  const salePrice = values?.quoteType === "TIER_PRICE"
    ? Number(tierPrices[0]?.price || source.salePrice || 0)
    : Number(firstSku.salePrice || source.salePrice || 0);
  const specGroupsMap = new Map<string, AnyRecord>();
  skuRows.forEach((row: AnyRecord) => {
    (Array.isArray(row.specValues) ? row.specValues : []).forEach((cell: AnyRecord) => {
      const key = String(cell.groupId || cell.groupName || "");
      if (!key) return;
      if (!specGroupsMap.has(key)) {
        specGroupsMap.set(key, { key, name: cell.groupName || "规格", values: [] });
      }
      const group = specGroupsMap.get(key);
      const valueKey = String(cell.valueId || cell.value || "");
      if (!valueKey || group.values.some((item: AnyRecord) => item.key === valueKey)) return;
      group.values.push({ key: valueKey, value: cell.value || "", image: cell.image || "" });
    });
  });
  const specGroups = Array.from(specGroupsMap.values());
  return {
    productName: values?.productName || source.productName || "未命名商品",
    categoryName: values?.categoryName || source.categoryName || "",
    brandName: values?.brandName || source.brandName || "",
    unit: values?.unit || source.unit || "件",
    quoteType: values?.quoteType || source.quoteType || "INDEPENDENT_PRICE",
    saleMode: values?.saleMode || source.saleMode || "NORMAL",
    saleUnit: values?.saleUnit || source.saleUnit || "",
    images: productImages,
    detailText: values?.detailText || "",
    salePrice,
    skuRows,
    specGroups,
    tierPrices
  };
}

function ProductEditPreview({ values, sourceProduct, onExit }: { values: AnyRecord; sourceProduct?: AnyRecord; onExit: () => void }) {
  const preview = useMemo(() => productPreviewModel(values, sourceProduct), [values, sourceProduct]);
  const [activeImage, setActiveImage] = useState(preview.images[0] || "");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const selectionGroups = preview.specGroups.length > 1 ? preview.specGroups.slice(0, -1) : [];
  const lastGroup = preview.specGroups.length ? preview.specGroups[preview.specGroups.length - 1] : null;
  const [selectedSpecValues, setSelectedSpecValues] = useState<AnyRecord>(() =>
    Object.fromEntries(selectionGroups.map((group: AnyRecord) => [group.key, group.values[0]?.key]).filter(([, value]) => value))
  );

  useEffect(() => {
    setActiveImage(preview.images[0] || "");
  }, [preview.images[0]]);

  useEffect(() => {
    setSelectedSpecValues(Object.fromEntries(
      selectionGroups.map((group: AnyRecord) => [group.key, group.values[0]?.key]).filter(([, value]) => value)
    ));
  }, [preview.productName, preview.skuRows.length]);

  const changeQuantity = (index: number, delta: number, minOrderQuantity: number) => {
    setQuantities(prev => {
      const current = Number(prev[index] || 0);
      const next = Math.max(0, current + delta);
      if (next > 0 && next < minOrderQuantity) return { ...prev, [index]: minOrderQuantity };
      return { ...prev, [index]: next };
    });
  };
  const visibleRows = preview.skuRows
    .map((row: AnyRecord, index: number) => ({ ...row, originalIndex: index }))
    .filter((row: AnyRecord) => selectionGroups.every((group: AnyRecord) => {
      const expected = selectedSpecValues[group.key];
      if (!expected) return true;
      return (Array.isArray(row.specValues) ? row.specValues : []).some((cell: AnyRecord) =>
        String(cell.groupId || cell.groupName || "") === String(group.key)
        && String(cell.valueId || cell.value || "") === String(expected)
      );
    }));
  const selected = Object.entries(quantities).filter(([, qty]) => Number(qty) > 0);
  const totalQty = selected.reduce((sum, [, qty]) => sum + Number(qty), 0);
  const totalAmount = selected.reduce((sum, [idx, qty]) => {
    const row = preview.skuRows[Number(idx)] || {};
    const price = preview.quoteType === "TIER_PRICE" ? preview.salePrice : Number(row.salePrice || 0);
    return sum + price * Number(qty);
  }, 0);

  return (
    <div className="product-edit-preview">
      <div className="product-edit-preview-toolbar">
        <Typography.Text type="secondary">当前为商城端商品详情预览，数量可调整，下单与加入购物车已禁用。</Typography.Text>
      </div>
      <Card className="mall-detail-card">
        <div className="mall-detail-layout">
          <div className="mall-detail-gallery">
            {activeImage ? <img src={activeImage} className="mall-detail-main-image" alt="" loading="lazy" decoding="async" /> : <div className="mall-detail-image-placeholder">暂无图片</div>}
            {preview.images.length ? (
              <div className="mall-detail-thumbs">
                {preview.images.map((url: string, index: number) => (
                  <button key={`${url}-${index}`} type="button" className={`mall-detail-thumb ${activeImage === url ? "is-active" : ""}`} onClick={() => setActiveImage(url)}>
                    <img src={url} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mall-detail-buy">
            <Typography.Title level={2} className="mall-detail-title">{preview.productName}</Typography.Title>
            <div className="mall-detail-meta">
              {preview.categoryName ? <span>{preview.categoryName}</span> : null}
              {preview.brandName ? <span>{preview.brandName}</span> : null}
            </div>
            <div className="mall-detail-price-panel">
              {preview.tierPrices.length ? preview.tierPrices.map((tier: AnyRecord, index: number) => (
                <div className="mall-detail-price-tier" key={`${tier.minQty}-${index}`}>
                  <div className="mall-detail-price">{money(tier.price)}</div>
                  <div className="mall-detail-threshold">{Number(tier.minQty || 1) <= 1 ? `${Number(tier.minQty || 1)}${preview.unit}起批` : `≥${Number(tier.minQty)}${preview.unit}`}</div>
                </div>
              )) : (
                <div className="mall-detail-price-tier">
                  <div className="mall-detail-price">{money(preview.salePrice)}</div>
                  <div className="mall-detail-threshold">{Math.max(1, Number(preview.skuRows[0]?.minOrderQuantity || 1))}{preview.unit}起批</div>
                </div>
              )}
            </div>

            <div className="mall-detail-spec-area">
              {selectionGroups.map((group: AnyRecord, groupIndex: number) => (
                <div className="mall-detail-spec-row" key={group.key}>
                  <div className="mall-detail-spec-label">{group.name}</div>
                  <div className="mall-detail-spec-options">
                    {group.values.map((value: AnyRecord) => {
                      const active = selectedSpecValues[group.key] === value.key;
                      return (
                        <button
                          key={value.key}
                          type="button"
                          className={`mall-detail-spec-option ${active ? "is-active" : ""}`}
                          onClick={() => setSelectedSpecValues((old: AnyRecord) => ({ ...old, [group.key]: value.key }))}
                        >
                          {groupIndex === 0 && value.image ? <img src={value.image} alt="" loading="lazy" decoding="async" /> : null}
                          <span>{value.value}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="mall-detail-sku-box is-plain">
                <div className="mall-detail-sku-top">
                  <div className="mall-detail-sku-group-name">{lastGroup?.name || "规格"}</div>
                </div>
                <div className="mall-detail-sku-list">
                  {visibleRows.length ? visibleRows.map((row: AnyRecord) => {
                    const index = Number(row.originalIndex);
                    const qty = Number(quantities[index] || 0);
                    const stock = Number(row.stockQuantity || 0);
                    const soldOut = row.skuStatus === "DISABLED" || stock <= 0;
                    const minOrderQuantity = Number(row.minOrderQuantity || 1);
                    const price = preview.quoteType === "TIER_PRICE" ? preview.salePrice : Number(row.salePrice || 0);
                    return (
                      <div className={`mall-detail-sku-row ${soldOut ? "is-sold-out" : ""}`} key={`${row.skuCode || index}-${index}`}>
                        <div className="mall-detail-sku-name">
                          <span>{normalizeSkuName(row, row.skuName || "默认规格") || "默认规格"}</span>
                          <em>规格ID:{row.skuCode || "保存后生成"}</em>
                        </div>
                        <div className="mall-detail-sku-price">{money(price)}</div>
                        <div className="mall-detail-sku-stock">{stock} {preview.unit}</div>
                        <div className="mall-detail-stepper">
                          <Button disabled={qty <= 0} onClick={() => changeQuantity(index, -1, minOrderQuantity)}>-</Button>
                          <InputNumber min={0} max={stock} step={1} controls={false} precision={0} value={qty} disabled={soldOut} onChange={value => setQuantities(old => ({ ...old, [index]: Number(value || 0) }))} />
                          <Button disabled={soldOut || qty + 1 > stock} onClick={() => changeQuantity(index, 1, minOrderQuantity)}>+</Button>
                        </div>
                      </div>
                    );
                  }) : <div className="product-edit-preview-empty">当前规格暂无可购 SKU</div>}
                </div>
              </div>
            </div>

            <div className="mall-detail-summary">
              <span>已选 <b>{selected.length}</b> 款 <b>{totalQty}</b> {preview.unit}</span>
              <span>商品金额：<b>{money(totalAmount)}</b></span>
              <span>运费：待确认</span>
            </div>

            <div className="mall-detail-actions">
              <Button className="mall-detail-primary-action" size="large" disabled>立即下单</Button>
              <Button className="mall-detail-secondary-action" size="large" disabled>加入购物车</Button>
            </div>
          </div>
        </div>
      </Card>
      <Card title="商品详情">
        {String(preview.detailText || "").trim()
          ? <div className="product-detail-render" dangerouslySetInnerHTML={{ __html: preview.detailText }} />
          : <div className="product-edit-preview-empty">暂无详情</div>}
      </Card>
    </div>
  );
}

async function productSale(ctx: Ctx, item: AnyRecord) {
  if (normalizeProductBusinessStatus(item.productStatus) === "DISABLED" && item.saleStatus !== "ON_SALE") {
    ctx.message.warning("停用商品不能再次上架");
    return;
  }
  try {
    await request(`/api/admin/products/${item.id}/${item.saleStatus === "ON_SALE" ? "off-sale" : "on-sale"}`, { method: "PUT" });
    ctx.message.success("上架状态已更新");
    ctx.reload();
  } catch (error: any) {
    ctx.message.error(error.message);
  }
}

async function productDetail(ctx: Ctx, item: AnyRecord) {
  try {
    const fullItem = await requestProductDetail(item);
    if (!fullItem) throw new Error("商品详情加载失败");
    productForm(ctx, fullItem, undefined, { readOnly: true });
  } catch (error: any) {
    ctx.message.error(error.message || "商品详情加载失败");
  }
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
    <div className="product-archive-page management-board-page management-tree-page category-management-page">
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
        <div className="management-board-table product-archive-table anchored-pagination-table category-list-table">
          <AdminTable loading={loading} rowKey="id" dataSource={filteredRows} pagination={{ className: "product-archive-pagination" }} scroll={{ x: "max-content", y: "100%" }} columns={[
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
    <div className="product-archive-page management-board-page management-tree-page brand-management-page">
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
        <div className="management-board-table product-archive-table anchored-pagination-table brand-list-table">
          <AdminTable loading={loading} rowKey="id" dataSource={filteredRows} pagination={{ className: "product-archive-pagination" }} scroll={{ x: "max-content", y: "100%" }} columns={[
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

function AttributeTemplatePage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const [form] = Form.useForm();
  const rows = ctx.data.attributeTemplates || [];
  const [keyword, setKeyword] = useState("");
  const [selectedKey, setSelectedKey] = useState<React.Key>("template:__all__");
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const searchKeyword = keyword.trim().toLocaleLowerCase();
  const treeData = useMemo(() => [{
    key: "template:__all__",
    title: "全部模板",
    children: rows
      .filter((item: AnyRecord) => !searchKeyword || String(item.templateName || "").toLocaleLowerCase().includes(searchKeyword))
      .map((item: AnyRecord) => ({ key: `template:${item.id}`, title: item.templateName }))
  }], [rows, searchKeyword]);
  const filteredRows = useMemo(() => rows.filter((item: AnyRecord) => {
    const inSelection = selectedKey === "template:__all__" || String(selectedKey) === `template:${item.id}`;
    return inSelection && (!searchKeyword || String(item.templateName || "").toLocaleLowerCase().includes(searchKeyword));
  }), [rows, searchKeyword, selectedKey]);
  const openForm = (item?: AnyRecord) => {
    setEditing(item || null);
    setModalOpen(true);
    form.setFieldsValue({
      templateName: item?.templateName || "",
      fields: item?.fields?.length ? item.fields : [{ id: "", name: "" }]
    });
  };
  const closeForm = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };
  const saveTemplate = async () => {
    try {
      const values = await form.validateFields();
      await request(editing ? `/api/admin/product-attribute-templates/${editing.id}` : "/api/admin/product-attribute-templates", {
        method: editing ? "PUT" : "POST",
        data: values
      });
      ctx.message.success("保存成功");
      closeForm();
      await ctx.loadKeys(["attributeTemplates"]);
    } catch (error: any) {
      if (error?.errorFields) return;
      ctx.message.error(error.message);
    }
  };
  return (
    <div className="product-archive-page management-board-page management-tree-page attribute-template-page">
      <aside className="product-archive-sidebar management-board-sidebar">
        <Input className="product-archive-sidebar-search" value={keyword} allowClear placeholder="请输入模板名称" onChange={event => setKeyword(event.target.value)} />
        <div className="product-category-tree">
          <Tree
            blockNode
            defaultExpandedKeys={["template:__all__"]}
            selectedKeys={[selectedKey]}
            switcherIcon={({ expanded }) => <DownOutlined rotate={expanded ? 0 : -90} />}
            treeData={treeData}
            onSelect={keys => setSelectedKey(keys[0] || "template:__all__")}
          />
        </div>
      </aside>
      <section className="product-archive-main management-board-main attribute-template-list-panel">
        <div className="management-board-header">
          <div className="management-board-title">属性模板列表</div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()}>新增模板</Button>
        </div>
        <div className="management-board-table product-archive-table anchored-pagination-table attribute-template-list-table">
          <AdminTable loading={loading} rowKey="id" dataSource={filteredRows} pagination={{ className: "product-archive-pagination" }} scroll={{ x: "max-content", y: "100%" }} columns={[
            { title: "模板名称", dataIndex: "templateName", width: 220 },
            { title: "关联商品数", dataIndex: "productCount", width: 160, render: value => Number(value || 0) },
            { title: "属性", dataIndex: "fields", render: fields => (fields || []).length ? <Space size={[6, 6]} wrap>{fields.map((field: AnyRecord) => <Tag key={field.id}>{field.name}</Tag>)}</Space> : "-" },
            {
              title: "操作",
              width: 180,
              render: (_, item) => (
                <Space>
                  <Button type="link" icon={<EditOutlined />} onClick={() => openForm(item)}>编辑</Button>
                  <Popconfirm title="确认删除该属性模板？" description={Number(item.productCount || 0) ? "已关联商品的模板不能删除" : undefined} onConfirm={() => deleteRow(ctx, `/api/admin/product-attribute-templates/${item.id}`)}>
                    <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]} />
        </div>
      </section>
      <Modal title={editing ? "编辑属性模板" : "新增属性模板"} open={modalOpen} width={620} onCancel={closeForm} onOk={saveTemplate} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ fields: [{ id: "", name: "" }] }}>
          <Form.Item name="templateName" label="模板名称" rules={[{ required: true, message: "请输入模板名称" }, { max: 60, message: "模板名称不能超过60个字符" }]}>
            <Input placeholder="请输入模板名称" maxLength={60} />
          </Form.Item>
          <Form.Item label="模板字段" required className="attribute-template-fields-form-item">
            <Form.List name="fields">
              {(fields, { add, remove }) => (
                <div className="attribute-template-field-list">
                  {fields.map(field => (
                    <div className="attribute-template-field-row" key={field.key}>
                      <HolderOutlined className="attribute-template-field-drag" />
                      <Form.Item name={[field.name, "id"]} hidden><Input /></Form.Item>
                      <Form.Item name={[field.name, "name"]} rules={[{ required: true, message: "请输入属性名称" }, { max: 30, message: "属性名称不能超过30个字符" }]}>
                        <Input placeholder="请输入属性名称" maxLength={30} />
                      </Form.Item>
                      <Button type="text" danger icon={<DeleteOutlined />} disabled={fields.length <= 1} aria-label="删除属性字段" onClick={() => remove(field.name)} />
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} disabled={fields.length >= 10} onClick={() => add({ id: "", name: "" })}>
                    新增字段{fields.length ? `（${fields.length}/10）` : ""}
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function SupplierPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const rows = ctx.data.suppliers || [];
  const [supplierInfoInput, setSupplierInfoInput] = useState("");
  const [contactNameInput, setContactNameInput] = useState("");
  const [contactPhoneInput, setContactPhoneInput] = useState("");
  const [supplierInfo, setSupplierInfo] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const normalizeSearch = (value: any) => String(value || "").trim().toLowerCase();
  const matchesSearch = (value: any, search: string) => !search || normalizeSearch(value).includes(search);
  const filteredRows = useMemo(() => {
    const supplierInfoSearch = normalizeSearch(supplierInfo);
    const contactNameSearch = normalizeSearch(contactName);
    const contactPhoneSearch = normalizeSearch(contactPhone);
    return rows.filter((item: AnyRecord) => (
      (matchesSearch(item.supplierNo, supplierInfoSearch) || matchesSearch(item.supplierName, supplierInfoSearch))
      && matchesSearch(item.contactName, contactNameSearch)
      && matchesSearch(item.contactPhone, contactPhoneSearch)
    ));
  }, [rows, supplierInfo, contactName, contactPhone]);
  const applyFilters = () => {
    setSupplierInfo(supplierInfoInput.trim());
    setContactName(contactNameInput.trim());
    setContactPhone(contactPhoneInput.trim());
  };
  const resetFilters = () => {
    setSupplierInfoInput("");
    setContactNameInput("");
    setContactPhoneInput("");
    setSupplierInfo("");
    setContactName("");
    setContactPhone("");
  };
  return (
    <div className="product-archive-page supplier-management-page">
      <section className="product-archive-main supplier-management-main">
        <div className="product-archive-filters supplier-management-filters">
          <label>
            <span>供应商信息</span>
            <Input allowClear placeholder="请输入供应商编码、名称" value={supplierInfoInput} onChange={event => setSupplierInfoInput(event.target.value)} />
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
        <div className="management-board-table product-archive-table anchored-pagination-table supplier-list-table">
          <AdminTable
            loading={loading}
            rowKey="id"
            dataSource={filteredRows}
            pagination={{ className: "product-archive-pagination" }}
            scroll={{ x: "max-content", y: "100%" }}
            columns={[
              { title: "供应商编码", dataIndex: "supplierNo", width: 140 },
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
    {
      name: "supplierNo",
      label: "供应商编码",
      disabled: true,
      placeholder: item ? undefined : "保存后由系统自动生成"
    },
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
                <Input
                  disabled={field.disabled}
                  placeholder={field.placeholder}
                  maxLength={isPhone ? 11 : undefined}
                />
              )}
            </Form.Item>
          );
        })}
        <Space><Button onClick={() => ctx.setDrawer(null)}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
      </Form>
    )
  });
}

const purchaseInboundStatusOptions = [
  { value: "ALL", label: "全部" },
  { value: "PENDING_REVIEW", label: "待审核" },
  { value: "IN_STOCK", label: "已入库" },
  { value: "REJECTED", label: "已驳回" }
];

const purchaseInboundStatusMeta: AnyRecord = {
  PENDING_REVIEW: { text: "待审核", color: "blue" },
  IN_STOCK: { text: "已入库", color: "green" },
  REJECTED: { text: "已驳回", color: "red" }
};

function purchaseInboundStatusTag(value: any) {
  const meta = purchaseInboundStatusMeta[value] || { text: value || "-", color: "default" };
  return <Tag color={meta.color}>{meta.text}</Tag>;
}

function PurchaseOrderPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("ALL");
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<AnyRecord>({});
  const [listLoading, setListLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = () => setRefreshTick(value => value + 1);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (activeTab !== "ALL") params.set("tab", activeTab);
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        params.set(key, String(value).trim());
      }
    });
    setListLoading(true);
    request(`/api/admin/purchase-inbounds?${params.toString()}`)
      .then(result => {
        if (!alive) return;
        setRows(Array.isArray(result?.list) ? result.list : []);
        setTotal(Number(result?.total || 0));
      })
      .catch((error: Error) => alive && ctx.message.error(error.message))
      .finally(() => alive && setListLoading(false));
    return () => {
      alive = false;
    };
  }, [activeTab, page, pageSize, JSON.stringify(filters), refreshTick]);

  const applyFilters = (values: AnyRecord) => {
    const createdRange = values.createdDateRange || [];
    const inboundRange = values.inboundDateRange || [];
    const status = values.status && values.status !== "ALL" ? values.status : undefined;
    setFilters({
      keyword: values.keyword,
      status,
      supplierId: values.supplierId,
      createdStartDate: createdRange[0]?.format?.("YYYY-MM-DD"),
      createdEndDate: createdRange[1]?.format?.("YYYY-MM-DD"),
      inboundStartDate: inboundRange[0]?.format?.("YYYY-MM-DD"),
      inboundEndDate: inboundRange[1]?.format?.("YYYY-MM-DD")
    });
    if (status) setActiveTab(status);
    setPage(1);
  };

  const resetFilters = () => {
    form.resetFields();
    setFilters({});
    setActiveTab("ALL");
    setPage(1);
  };

  const suppliers = ctx.data.suppliers || [];
  const tabItems = purchaseInboundStatusOptions.map(item => ({
    key: item.value,
    label: item.value === activeTab ? `${item.label} ${total}` : item.label
  }));

  return (
    <div className="admin-order-workbench purchase-inbound-workbench">
      <Card className="admin-order-card admin-order-filter-card purchase-inbound-filter-card" bodyStyle={{ paddingBottom: 0 }}>
        <div className="purchase-inbound-toolbar">
          <Tabs
            className="admin-order-status-tabs purchase-inbound-status-tabs"
            activeKey={activeTab}
            onChange={key => {
              setActiveTab(key);
              setPage(1);
              form.setFieldValue("status", "ALL");
              setFilters(current => ({ ...current, status: undefined }));
            }}
            items={tabItems}
          />
          <Space className="purchase-inbound-actions">
            <Button onClick={() => ctx.message.info("导出功能待接入")}>导出</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openPurchaseInboundForm(ctx, undefined, refresh)}>新增采购入库单</Button>
          </Space>
        </div>
        <Form form={form} className="admin-order-filters product-archive-filters purchase-inbound-filters" initialValues={{ status: "ALL" }} onFinish={applyFilters}>
          <div className="product-archive-filter-stack">
            <label className="product-archive-filter-keyword">
              <span>关键词</span>
              <Form.Item name="keyword" noStyle>
                <Input className="product-archive-keyword-search" allowClear placeholder="入库单号 / 供应商名称 / 商品名称 / SKU编码" />
              </Form.Item>
            </label>
            <label>
              <span>单据状态</span>
              <Form.Item name="status" noStyle>
                <Select options={purchaseInboundStatusOptions} />
              </Form.Item>
            </label>
          </div>
          <div className="product-archive-filter-stack">
            <label>
              <span>供应商</span>
              <Form.Item name="supplierId" noStyle>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="全部供应商"
                  options={suppliers.map((s: AnyRecord) => ({ value: s.id, label: s.supplierName }))}
                  notFoundContent="暂无可用供应商，请先维护供应商"
                />
              </Form.Item>
            </label>
            <label>
              <span>入库日期</span>
              <Form.Item name="inboundDateRange" noStyle>
                <RangePicker placeholder={["入库开始", "入库结束"]} />
              </Form.Item>
            </label>
          </div>
          <div className="product-archive-filter-stack">
            <label>
              <span>创建时间</span>
              <Form.Item name="createdDateRange" noStyle>
                <RangePicker placeholder={["创建开始", "创建结束"]} />
              </Form.Item>
            </label>
            <div className="product-archive-query-actions admin-order-filter-actions purchase-inbound-filter-actions">
              <Button type="primary" htmlType="submit">查询</Button>
              <Button onClick={resetFilters}>重置</Button>
              <Button onClick={() => ctx.message.info("导出功能待接入")}>导出</Button>
            </div>
          </div>
        </Form>
      </Card>

      <Card className="admin-order-card admin-order-table-card">
        <div className="admin-order-list-table product-archive-table anchored-pagination-table purchase-inbound-list-table">
          <AdminTable
            loading={loading || listLoading}
            rowKey="id"
            dataSource={rows}
            scroll={{ x: "max-content", y: "100%" }}
            locale={{ emptyText: <Empty description="暂无采购入库单" /> }}
            pagination={{
              className: "product-archive-pagination",
              current: page,
              pageSize,
              total,
              pageSizeOptions: ["10", "20", "50"],
              showSizeChanger: true,
              showTotal: (value: number) => `共 ${value} 条`,
              onChange: (nextPage: number, nextPageSize: number) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }
            }}
            columns={[
              {
                title: "入库单信息",
                width: 190,
                render: (_, item) => (
                  <div className="admin-order-primary">
                    <Button type="link" className="admin-order-no" onClick={() => openPurchaseInboundDetail(ctx, item.id, refresh)}>{emptyText(item.inboundNo)}</Button>
                    <span>创建 {dateText(item.createdAt)}</span>
                  </div>
                )
              },
              {
                title: "供应商",
                width: 220,
                render: (_, item) => (
                  <div className="admin-order-buyer-cell">
                    <strong>{emptyText(item.supplierName)}</strong>
                    <span>创建人 {emptyText(item.createdBy)}</span>
                  </div>
                )
              },
              {
                title: "入库概况",
                width: 250,
                render: (_, item) => (
                  <div className="purchase-inbound-summary-cell">
                    <strong>{dateText(item.inboundDate)}</strong>
                    <span>商品 {numberText(item.itemCount)} 种 / 数量 {numberText(item.totalQuantity)}</span>
                    <small>{formatOrderMoney(item.totalAmount)}</small>
                  </div>
                )
              },
              { title: "状态", dataIndex: "status", width: 110, align: "center", render: purchaseInboundStatusTag },
              {
                title: "审核信息",
                width: 200,
                render: (_, item) => (
                  <div className="purchase-inbound-summary-cell">
                    <span>审核人 {emptyText(item.reviewedBy)}</span>
                    <span>{dateText(item.reviewedAt)}</span>
                    {item.rejectReason ? <small>{compactText(item.rejectReason)}</small> : null}
                  </div>
                )
              },
              {
                title: "备注",
                dataIndex: "remark",
                width: 180,
                render: compactText
              },
              {
                title: "操作",
                width: 180,
                align: "center",
                className: "admin-order-action-shadow",
                onHeaderCell: () => ({ className: "admin-order-action-shadow", width: 180 }),
                render: (_, item) => (
                  <Space className="admin-order-action-links">
                    <Button type="link" onClick={() => openPurchaseInboundDetail(ctx, item.id, refresh)}>详情</Button>
                    {item.status === "PENDING_REVIEW" && <Button type="link" onClick={() => openPurchaseInboundForm(ctx, item.id, refresh)}>编辑</Button>}
                    {item.status === "PENDING_REVIEW" && <Button type="link" onClick={() => openPurchaseInboundReview(ctx, item, refresh)}>审核</Button>}
                  </Space>
                )
              }
            ]}
          />
        </div>
      </Card>
    </div>
  );
}

function emptyText(value: any) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function numberText(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function openPurchaseInboundForm(ctx: Ctx, inboundId?: number, onSaved?: () => void) {
  ctx.setDrawer({
    title: inboundId ? "编辑采购入库单" : "新增采购入库单",
    width: "86vw",
    body: <PurchaseInboundForm ctx={ctx} inboundId={inboundId} onSaved={onSaved} />
  });
}

function PurchaseInboundForm({ ctx, inboundId, onSaved }: { ctx: Ctx; inboundId?: number; onSaved?: () => void }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<AnyRecord[]>([]);
  const [productOptions, setProductOptions] = useState<AnyRecord[]>([]);
  const [skuCache, setSkuCache] = useState<Record<string, AnyRecord[]>>({});
  const watchedItems = Form.useWatch("items", form) || [];

  const loadSkus = async (productId: any) => {
    if (!productId) return [];
    const key = String(productId);
    if (skuCache[key]) return skuCache[key];
    const rows = await request(`/api/admin/products/${productId}/skus`);
    const list = Array.isArray(rows) ? rows : [];
    setSkuCache(prev => ({ ...prev, [key]: list }));
    return list;
  };

  const fillSku = (index: number, sku: AnyRecord) => {
    form.setFieldValue(["items", index, "skuId"], sku.skuId);
    form.setFieldValue(["items", index, "skuCode"], sku.skuCode);
    form.setFieldValue(["items", index, "skuName"], sku.skuName);
    form.setFieldValue(["items", index, "unit"], sku.unit);
    form.setFieldValue(["items", index, "currentStock"], sku.currentStock);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      request("/api/admin/suppliers/options"),
      request("/api/admin/products/options")
    ])
      .then(async ([suppliers, products]) => {
        setSupplierOptions(Array.isArray(suppliers) ? suppliers : []);
        setProductOptions(Array.isArray(products) ? products : []);
        if (inboundId) {
          const detail = await request(`/api/admin/purchase-inbounds/${inboundId}`);
          form.setFieldsValue({
            supplierId: detail.supplierId,
            inboundDate: String(detail.inboundDate || "").slice(0, 10),
            handlerName: detail.handlerName || currentAdminOperatorName(),
            remark: detail.remark,
            items: (detail.items || []).map((item: AnyRecord) => ({
              productId: item.productId,
              productName: item.productName,
              skuId: item.skuId,
              skuCode: item.skuCode,
              skuName: item.skuName,
              unit: item.unit,
              currentStock: item.beforeStock,
              quantity: item.quantity,
              purchasePrice: item.purchasePrice,
              itemRemark: item.itemRemark
            }))
          });
          await Promise.all((detail.items || []).map((item: AnyRecord) => loadSkus(item.productId)));
        } else {
          form.setFieldsValue({
            inboundDate: new Date().toLocaleDateString("sv-SE"),
            handlerName: currentAdminOperatorName(),
            items: [{ quantity: 1, purchasePrice: 0 }]
          });
        }
      })
      .catch((error: any) => ctx.message.error(error.message))
      .finally(() => setLoading(false));
  }, [inboundId]);

  const submit = async () => {
    try {
      const values = await form.validateFields();
      const rows = values.items || [];
      const seen = new Set<string>();
      for (const item of rows) {
        const key = `${item.productId}|${item.skuCode}`;
        if (seen.has(key)) {
          ctx.message.error("存在重复商品规格，请合并后再提交。");
          return;
        }
        seen.add(key);
      }
      setSubmitting(true);
      await request(inboundId ? `/api/admin/purchase-inbounds/${inboundId}` : "/api/admin/purchase-inbounds", {
        method: inboundId ? "PUT" : "POST",
        data: values
      });
      ctx.message.success(inboundId ? "采购入库单已保存" : "采购入库单已提交审核");
      ctx.setDrawer(null);
      onSaved?.();
    } catch (error: any) {
      if (error?.errorFields) return;
      ctx.message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form form={form} layout="vertical" disabled={loading}>
      <Space direction="vertical" size={18} style={{ width: "100%", paddingBottom: 76 }}>
        <Card size="small" title="基础信息">
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 16 }}>
            <Form.Item name="supplierId" label="供应商" rules={[{ required: true, message: "请选择供应商" }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={supplierOptions.length ? "请选择供应商" : "暂无可用供应商，请先维护供应商"}
                options={supplierOptions.map(item => ({ value: item.id, label: item.supplierName }))}
                notFoundContent="暂无可用供应商，请先维护供应商"
              />
            </Form.Item>
            <Form.Item name="inboundDate" label="入库日期" rules={[{ required: true, message: "请输入入库日期" }]}>
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="handlerName" label="经办人" rules={[{ required: true, message: "缺少经办人，请重新登录" }]}>
              <Input readOnly />
            </Form.Item>
          </div>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Card>
        <Card size="small" title="商品明细" extra={<Button icon={<PlusOutlined />} onClick={() => form.setFieldValue("items", [...(form.getFieldValue("items") || []), { quantity: 1, purchasePrice: 0 }])}>添加商品</Button>}>
          <Form.List name="items" rules={[{ validator: async (_, value) => Array.isArray(value) && value.length ? undefined : Promise.reject(new Error("商品明细不能为空")) }]}>
            {(fields, { remove }) => (
              <div style={{ overflowX: "auto" }}>
                <table className="purchase-inbound-items-table" style={{ width: "100%", minWidth: 1120, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["序号", "商品", "SKU规格", "SKU编码", "规格名称", "单位", "当前库存", "入库数量", "采购单价", "入库金额", "备注", "操作"].map(title => <th key={title} style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{title}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const item = watchedItems[field.name] || {};
                      const skus = skuCache[String(item.productId)] || [];
                      const lineAmount = Number(item.quantity || 0) * Number(item.purchasePrice || 0);
                      return (
                        <tr key={field.key}>
                          <td style={{ padding: 6 }}>{index + 1}</td>
                          <td style={{ padding: 6 }}>
                            <Form.Item name={[field.name, "productId"]} rules={[{ required: true, message: "请选择商品" }]} style={{ margin: 0 }}>
                              <Select
                                showSearch
                                optionFilterProp="label"
                                style={{ width: 220 }}
                                placeholder="搜索商品"
                                options={productOptions.map(product => ({ value: product.productId, label: `${product.productName} / ${product.productCode}` }))}
                                onChange={async value => {
                                  const product = productOptions.find(item => item.productId === value);
                                  form.setFieldValue(["items", field.name, "productName"], product?.productName);
                                  form.setFieldValue(["items", field.name, "skuCode"], undefined);
                                  form.setFieldValue(["items", field.name, "skuName"], undefined);
                                  form.setFieldValue(["items", field.name, "unit"], undefined);
                                  form.setFieldValue(["items", field.name, "currentStock"], undefined);
                                  const nextSkus = await loadSkus(value);
                                  if (nextSkus.length === 1) fillSku(field.name, nextSkus[0]);
                                }}
                              />
                            </Form.Item>
                          </td>
                          <td style={{ padding: 6 }}>
                            <Form.Item name={[field.name, "skuCode"]} rules={[{ required: true, message: "请选择SKU" }]} style={{ margin: 0 }}>
                              <Select
                                style={{ width: 180 }}
                                placeholder="选择SKU"
                                options={skus.map(sku => ({ value: sku.skuCode, label: `${sku.skuName || sku.skuCode}` }))}
                                onChange={value => fillSku(field.name, skus.find(sku => sku.skuCode === value) || {})}
                              />
                            </Form.Item>
                          </td>
                          <td style={{ padding: 6 }}><Input readOnly value={item.skuCode || ""} style={{ width: 120 }} /></td>
                          <td style={{ padding: 6 }}><Input readOnly value={item.skuName || ""} style={{ width: 120 }} /></td>
                          <td style={{ padding: 6 }}><Input readOnly value={item.unit || ""} style={{ width: 70 }} /></td>
                          <td style={{ padding: 6 }}><InputNumber readOnly value={item.currentStock ?? 0} style={{ width: 90 }} /></td>
                          <td style={{ padding: 6 }}><Form.Item name={[field.name, "quantity"]} rules={[{ required: true, message: "请输入入库数量" }]} style={{ margin: 0 }}><InputNumber min={1} precision={0} style={{ width: 100 }} /></Form.Item></td>
                          <td style={{ padding: 6 }}><Form.Item name={[field.name, "purchasePrice"]} rules={[{ type: "number", min: 0, message: "采购单价不能小于0" }]} style={{ margin: 0 }}><InputNumber min={0} precision={2} style={{ width: 110 }} /></Form.Item></td>
                          <td style={{ padding: 6 }}>{money(lineAmount)}</td>
                          <td style={{ padding: 6 }}><Form.Item name={[field.name, "itemRemark"]} style={{ margin: 0 }}><Input style={{ width: 140 }} /></Form.Item></td>
                          <td style={{ padding: 6 }}><Button danger icon={<DeleteOutlined />} disabled={fields.length <= 1} onClick={() => remove(field.name)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Form.List>
        </Card>
      </Space>
      <div style={{ position: "sticky", bottom: 0, margin: "0 -24px -24px", padding: "12px 24px", background: "#fff", borderTop: "1px solid #f0f0f0", textAlign: "right" }}>
        <Space>
          <Button onClick={() => ctx.setDrawer(null)}>取消</Button>
          <Button type="primary" loading={submitting} onClick={submit}>提交审核</Button>
        </Space>
      </div>
    </Form>
  );
}

function openPurchaseInboundDetail(ctx: Ctx, inboundId: number, onChanged?: () => void) {
  ctx.setDrawer({
    title: "采购入库单详情",
    width: "82vw",
    body: <PurchaseInboundDetail ctx={ctx} inboundId={inboundId} onChanged={onChanged} />
  });
}

function PurchaseInboundDetail({ ctx, inboundId, onChanged }: { ctx: Ctx; inboundId: number; onChanged?: () => void }) {
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    request(`/api/admin/purchase-inbounds/${inboundId}`)
      .then(setDetail)
      .catch((error: any) => ctx.message.error(error.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => reload(), [inboundId]);
  if (loading || !detail) return <GlobalLoadingMask visible />;
  const items = detail.items || [];
  const logs = detail.logs || [];
  const impacts = detail.inventoryImpacts || [];
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space>
        {detail.status === "PENDING_REVIEW" && <Button onClick={() => openPurchaseInboundForm(ctx, inboundId, () => { onChanged?.(); reload(); })}>编辑</Button>}
        {detail.status === "PENDING_REVIEW" && <Button type="primary" onClick={() => openPurchaseInboundReview(ctx, detail, () => { onChanged?.(); reload(); })}>审核</Button>}
        <Button onClick={() => ctx.setDrawer(null)}>返回</Button>
      </Space>
      <Descriptions bordered column={3} size="small" title="基础信息">
        <Descriptions.Item label="入库单号">{emptyText(detail.inboundNo)}</Descriptions.Item>
        <Descriptions.Item label="供应商">{emptyText(detail.supplierName)}</Descriptions.Item>
        <Descriptions.Item label="入库日期">{dateText(detail.inboundDate)}</Descriptions.Item>
        <Descriptions.Item label="经办人">{emptyText(detail.handlerName)}</Descriptions.Item>
        <Descriptions.Item label="状态">{purchaseInboundStatusTag(detail.status)}</Descriptions.Item>
        <Descriptions.Item label="创建人">{emptyText(detail.createdBy)}</Descriptions.Item>
        <Descriptions.Item label="创建时间">{dateText(detail.createdAt)}</Descriptions.Item>
        <Descriptions.Item label="备注" span={2}>{emptyText(detail.remark)}</Descriptions.Item>
      </Descriptions>
      <AdminTable pagination={false} rowKey="id" dataSource={items} locale={{ emptyText: "暂无商品明细" }} columns={[
        { title: "商品名称", dataIndex: "productName" },
        { title: "SKU编码", dataIndex: "skuCode" },
        { title: "SKU规格", dataIndex: "skuName" },
        { title: "单位", dataIndex: "unit" },
        { title: "入库数量", dataIndex: "quantity", align: "right", render: numberText },
        { title: "采购单价", dataIndex: "purchasePrice", align: "right", render: money },
        { title: "入库金额", dataIndex: "lineAmount", align: "right", render: money },
        { title: "审核前库存", dataIndex: "beforeStock", align: "right", render: numberText },
        { title: "审核后库存", dataIndex: "afterStock", align: "right", render: numberText },
        { title: "备注", dataIndex: "itemRemark", render: emptyText }
      ]} />
      <Descriptions bordered column={2} size="small" title="审核信息">
        {detail.status === "PENDING_REVIEW" ? (
          <Descriptions.Item span={2} label="审核结果">暂无审核信息</Descriptions.Item>
        ) : (
          <>
            <Descriptions.Item label="审核结果">{purchaseInboundStatusTag(detail.status)}</Descriptions.Item>
            <Descriptions.Item label="审核人">{emptyText(detail.reviewedBy)}</Descriptions.Item>
            <Descriptions.Item label="审核时间">{dateText(detail.reviewedAt)}</Descriptions.Item>
            <Descriptions.Item label="驳回原因">{emptyText(detail.rejectReason)}</Descriptions.Item>
            <Descriptions.Item span={2} label="审核备注">{emptyText(detail.reviewRemark)}</Descriptions.Item>
          </>
        )}
      </Descriptions>
      <Card size="small" title="库存影响">
        {detail.status === "IN_STOCK" ? (
          <AdminTable pagination={false} rowKey={(row: AnyRecord) => `${row.productName}-${row.skuCode}`} dataSource={impacts} columns={[
            { title: "入库商品规格", render: (_, row) => `${row.productName} / ${row.skuName}` },
            { title: "入库数量", dataIndex: "quantity", align: "right", render: numberText },
            { title: "库存变动前数量", dataIndex: "beforeStock", align: "right", render: numberText },
            { title: "库存变动后数量", dataIndex: "afterStock", align: "right", render: numberText },
            { title: "关联库存流水", dataIndex: "relatedFlow", render: emptyText }
          ]} />
        ) : "审核通过后将增加对应商品规格库存"}
      </Card>
      <AdminTable pagination={false} rowKey="id" dataSource={logs} locale={{ emptyText: "暂无操作日志" }} columns={[
        { title: "时间", dataIndex: "createdAt", render: dateText },
        { title: "操作人", dataIndex: "operatorName", render: emptyText },
        { title: "操作类型", dataIndex: "actionType", render: emptyText },
        { title: "操作内容", dataIndex: "actionContent", render: emptyText }
      ]} />
    </Space>
  );
}

function openPurchaseInboundReview(ctx: Ctx, item: AnyRecord, onDone?: () => void) {
  let action = "APPROVE";
  let rejectReason = "";
  let remark = "";
  Modal.confirm({
    title: "审核采购入库单",
    width: 520,
    content: (
      <Space direction="vertical" style={{ width: "100%" }}>
        <Radio.Group defaultValue="APPROVE" onChange={event => { action = event.target.value; }}>
          <Radio value="APPROVE">通过</Radio>
          <Radio value="REJECT">驳回</Radio>
        </Radio.Group>
        <Input.TextArea rows={3} placeholder="驳回时必填驳回原因" onChange={event => { rejectReason = event.target.value; }} />
        <Input.TextArea rows={2} placeholder="审核备注" onChange={event => { remark = event.target.value; }} />
      </Space>
    ),
    okText: "确认审核",
    cancelText: "取消",
    onOk: async () => {
      if (action === "REJECT" && !rejectReason.trim()) {
        ctx.message.error("请填写驳回原因");
        return Promise.reject();
      }
      const operatorName = currentAdminOperatorName();
      if (!operatorName) {
        ctx.message.error("缺少当前后台账号，请重新登录");
        return Promise.reject();
      }
      try {
        await request(`/api/admin/purchase-inbounds/${item.id}/review`, {
          method: "POST",
          data: { action, rejectReason, remark, operatorName }
        });
        ctx.message.success(action === "APPROVE" ? "审核入库成功" : "审核驳回成功");
        onDone?.();
      } catch (error: any) {
        ctx.message.error(error.message);
        return Promise.reject();
      }
    }
  });
}

const inventoryStatusMeta: AnyRecord = {
  NORMAL: { text: "正常", color: "green" },
  WARNING: { text: "预警", color: "orange" },
  OUT_OF_STOCK: { text: "缺货", color: "red" },
  NEGATIVE: { text: "负库存", color: "red" },
  FROZEN: { text: "冻结中", color: "blue" },
  FROZEN_ABNORMAL: { text: "冻结异常", color: "red" },
  WARNING_NOT_SET: { text: "未设置预警", color: "default" }
};

const inventoryMovementTypeOptions = [
  { value: "INBOUND", label: "入库" },
  { value: "OUTBOUND", label: "出库" },
  { value: "ORDER_RESERVE", label: "订单占用" },
  { value: "ORDER_RELEASE", label: "订单释放" },
  { value: "ORDER_DEDUCT", label: "订单扣减" },
  { value: "MANUAL_ADJUST", label: "手工调整" },
  { value: "RETURN_INBOUND", label: "退货入库" },
  { value: "PURCHASE_INBOUND", label: "采购入库" },
  { value: "PURCHASE_STOCK_IN", label: "采购入库" },
  { value: "ORDER_CANCEL_RELEASE", label: "订单取消释放" },
  { value: "RETURN_STOCK_IN", label: "退货回补" }
];

function inventoryStatus(row: AnyRecord) {
  const actualStock = Number(row.actualStock ?? row.stockQuantity ?? 0);
  const frozenStock = Number(row.frozenStock ?? row.lockedQuantity ?? 0);
  const availableStock = Number(row.availableStock ?? row.availableQuantity ?? actualStock - frozenStock);
  const warningStock = row.warningStock ?? row.warningThreshold;
  if (actualStock < 0 || (availableStock < 0 && frozenStock <= actualStock)) return "NEGATIVE";
  if (frozenStock > actualStock) return "FROZEN_ABNORMAL";
  if (availableStock === 0) return "OUT_OF_STOCK";
  if (warningStock === null || warningStock === undefined || String(warningStock) === "") return "WARNING_NOT_SET";
  if (availableStock > 0 && availableStock <= Number(warningStock)) return "WARNING";
  if (frozenStock > 0) return "FROZEN";
  return "NORMAL";
}

function inventoryStatusTag(rowOrStatus: AnyRecord | string) {
  const status = typeof rowOrStatus === "string" ? rowOrStatus : (rowOrStatus.stockStatus || inventoryStatus(rowOrStatus));
  const meta = inventoryStatusMeta[status] || { text: status || "-", color: "default" };
  return <Tag color={meta.color}>{meta.text}</Tag>;
}

function inventoryStatusText(value: any) {
  return inventoryStatusMeta[value]?.text || value || "-";
}

function inventoryProductStatusText(value: any) {
  return productBusinessStatusText(value);
}

function formatStockNumber(value: any) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function changeQuantityText(value: any) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number);
}

function adminOperatorName() {
  return currentAdminOperatorName();
}

function InventoryProductImage({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  const imageSrc = String(src || "").trim();
  if (!imageSrc || failed || imageSrc.toLowerCase().startsWith("data:image")) {
    return <div className="inventory-product-image is-empty">无图</div>;
  }
  return <img className="inventory-product-image" src={imageSrc} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

function cleanParams(values: AnyRecord = {}) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function InventoryPage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const [form] = Form.useForm();
  const [logForm] = Form.useForm();
  const [adjustForm] = Form.useForm();
  const [warningForm] = Form.useForm();
  const [batchWarningForm] = Form.useForm();
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<React.Key[]>(["category:__all__"]);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<React.Key>("category:__all__");
  const [stats, setStats] = useState<AnyRecord>({});
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [listLoading, setListLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [activeRow, setActiveRow] = useState<AnyRecord | null>(null);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [reservationRows, setReservationRows] = useState<AnyRecord[]>([]);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logRows, setLogRows] = useState<AnyRecord[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [logLoading, setLogLoading] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningSubmitting, setWarningSubmitting] = useState(false);
  const [batchWarningOpen, setBatchWarningOpen] = useState(false);
  const [batchWarningSubmitting, setBatchWarningSubmitting] = useState(false);
  const categoryTreeData = useMemo(() => buildCategoryTreeData(ctx.data.categories || []), [ctx.data.categories]);
  const filteredCategoryTreeData = useMemo(() => filterCategoryTreeData(categoryTreeData, categoryKeyword), [categoryKeyword, categoryTreeData]);
  const visibleExpandedCategoryKeys = useMemo(
    () => (categoryKeyword ? collectTreeKeys(filteredCategoryTreeData) : expandedCategoryKeys),
    [categoryKeyword, expandedCategoryKeys, filteredCategoryTreeData]
  );

  const fetchList = async (nextPage = page, nextPageSize = pageSize, extraFilters: AnyRecord = {}) => {
    setListLoading(true);
    try {
      const values = { ...form.getFieldsValue(), ...extraFilters };
      const data = await request("/api/admin/inventory/overview", {
        params: cleanParams({
          ...values,
          page: nextPage,
          pageSize: nextPageSize
        })
      });
      setRows(data?.list || []);
      setTotal(Number(data?.total || 0));
      setPage(Number(data?.page || nextPage));
      setPageSize(Number(data?.pageSize || nextPageSize));
    } catch (error: any) {
      ctx.message.error(error.message);
    } finally {
      setListLoading(false);
    }
  };

  const reloadInventory = async (nextPage = page, nextPageSize = pageSize, extraFilters: AnyRecord = {}) => {
    await fetchList(nextPage, nextPageSize, extraFilters);
  };

  useEffect(() => {
    void reloadInventory(1, 10);
  }, []);

  const applyCardFilter = (values: AnyRecord) => {
    form.setFieldsValue(values);
    setPage(1);
    void fetchList(1, pageSize, values);
  };

  const resetFilters = () => {
    form.resetFields();
    setCategoryKeyword("");
    setExpandedCategoryKeys(["category:__all__"]);
    setSelectedCategoryKey("category:__all__");
    setPage(1);
    void fetchList(1, pageSize, {});
  };

  const openReservations = async (row: AnyRecord) => {
    setActiveRow(row);
    setReservationOpen(true);
    setReservationLoading(true);
    try {
      const data = await request(`/api/admin/inventory/${row.skuId}/reservations`);
      setReservationRows(data?.list || []);
    } catch (error: any) {
      ctx.message.error(error.message);
      setReservationRows([]);
    } finally {
      setReservationLoading(false);
    }
  };

  const fetchLogs = async (row = activeRow, nextPage = logPage, nextPageSize = logPageSize) => {
    if (!row) return;
    setLogLoading(true);
    try {
      const values = logForm.getFieldsValue();
      const range = values.range || [];
      const data = await request(`/api/admin/inventory/${row.skuId}/logs`, {
        params: cleanParams({
          page: nextPage,
          pageSize: nextPageSize,
          changeType: values.changeType,
          startDate: range[0]?.format?.("YYYY-MM-DD"),
          endDate: range[1]?.format?.("YYYY-MM-DD")
        })
      });
      setLogRows(data?.list || []);
      setLogTotal(Number(data?.total || 0));
      setLogPage(Number(data?.page || nextPage));
      setLogPageSize(Number(data?.pageSize || nextPageSize));
    } catch (error: any) {
      ctx.message.error(error.message);
    } finally {
      setLogLoading(false);
    }
  };

  const openLogs = (row: AnyRecord) => {
    setActiveRow(row);
    setLogOpen(true);
    logForm.resetFields();
    setLogPage(1);
    setLogPageSize(10);
    void fetchLogs(row, 1, 10);
  };

  const openAdjust = (row: AnyRecord) => {
    setActiveRow(row);
    adjustForm.setFieldsValue({ adjustType: "INCREASE", quantity: 1, reason: "盘点修正", remark: "" });
    setAdjustOpen(true);
  };

  const submitAdjust = async () => {
    if (!activeRow) return;
    const operatorName = adminOperatorName();
    if (!operatorName) return ctx.message.error("无法获取当前操作人，请重新登录");
    try {
      const values = await adjustForm.validateFields();
      setAdjustSubmitting(true);
      await request(`/api/admin/inventory/${activeRow.skuId}/adjust`, { method: "POST", data: { ...values, operatorName } });
      ctx.message.success("库存调整成功");
      setAdjustOpen(false);
      await reloadInventory(page, pageSize);
    } catch (error: any) {
      if (error?.errorFields) return;
      ctx.message.error(error.message);
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const openWarning = (row: AnyRecord) => {
    setActiveRow(row);
    warningForm.setFieldsValue({ warningStock: row.warningStock ?? 0 });
    setWarningOpen(true);
  };

  const submitWarning = async () => {
    if (!activeRow) return;
    const operatorName = adminOperatorName();
    if (!operatorName) return ctx.message.error("无法获取当前操作人，请重新登录");
    try {
      const values = await warningForm.validateFields();
      setWarningSubmitting(true);
      await request(`/api/admin/inventory/${activeRow.skuId}/warning`, { method: "POST", data: { ...values, operatorName } });
      ctx.message.success("预警值已更新");
      setWarningOpen(false);
      await reloadInventory(page, pageSize);
    } catch (error: any) {
      if (error?.errorFields) return;
      ctx.message.error(error.message);
    } finally {
      setWarningSubmitting(false);
    }
  };

  const submitBatchWarning = async () => {
    const operatorName = adminOperatorName();
    if (!operatorName) return ctx.message.error("无法获取当前操作人，请重新登录");
    try {
      const values = await batchWarningForm.validateFields();
      setBatchWarningSubmitting(true);
      await request("/api/admin/inventory/warning/batch", { method: "POST", data: { ...values, skuIds: selectedRowKeys, operatorName } });
      ctx.message.success("批量预警值已更新");
      setBatchWarningOpen(false);
      setSelectedRowKeys([]);
      await reloadInventory(page, pageSize);
    } catch (error: any) {
      if (error?.errorFields) return;
      ctx.message.error(error.message);
    } finally {
      setBatchWarningSubmitting(false);
    }
  };

  const columns: ColumnsType<AnyRecord> = [
    {
      title: "商品信息",
      width: 260,
      fixed: "left",
      render: (_, item) => (
        <div className="inventory-product-cell">
          <InventoryProductImage src={item.productImage} />
          <div className="inventory-product-main">
            <Typography.Text strong ellipsis>{item.productName || "-"}</Typography.Text>
            <span>商品ID：{item.productId || "-"}</span>
            <Tag>{inventoryProductStatusText(item.productStatus)}</Tag>
          </div>
        </div>
      )
    },
    {
      title: "SKU信息",
      width: 220,
      render: (_, item) => (
        <div className="inventory-lines">
          <Typography.Text code>{item.skuCode || "-"}</Typography.Text>
          <span>{item.skuName || "默认规格"}</span>
          <span>{item.unit || "-"}</span>
        </div>
      )
    },
    { title: "分类品牌", width: 160, render: (_, item) => <div className="inventory-lines"><span>{item.categoryName || "-"}</span><span>{item.brandName || "-"}</span></div> },
    { title: "实际库存", dataIndex: "actualStock", width: 110, align: "right", render: formatStockNumber },
    {
      title: "冻结库存",
      dataIndex: "frozenStock",
      width: 110,
      align: "right",
      render: (value, item) => Number(value || 0) > 0 ? <Button type="link" onClick={() => openReservations(item)}>{formatStockNumber(value)}</Button> : formatStockNumber(value)
    },
    { title: "可售库存", dataIndex: "availableStock", width: 110, align: "right", render: value => <span className={Number(value || 0) < 0 ? "inventory-danger-number" : ""}>{formatStockNumber(value)}</span> },
    { title: "预警值", dataIndex: "warningStock", width: 120, align: "right", render: (value, item) => <Button type="link" onClick={() => openWarning(item)}>{value === null || value === undefined ? "未设置" : formatStockNumber(value)}</Button> },
    { title: "库存状态", dataIndex: "stockStatus", width: 120, render: (_, item) => inventoryStatusTag(item) },
    { title: "近7天销量", dataIndex: "sales7d", width: 110, align: "right", render: value => formatStockNumber(value ?? 0) },
    { title: "近30天销量", dataIndex: "sales30d", width: 120, align: "right", render: value => formatStockNumber(value ?? 0) },
    { title: "预计可售天数", dataIndex: "estimatedSaleDays", width: 130, align: "right", render: value => value === null || value === undefined ? "-" : formatStockNumber(value) },
    { title: "最近入库时间", dataIndex: "lastInboundTime", width: 170, render: dateText },
    { title: "最近出库时间", dataIndex: "lastOutboundTime", width: 170, render: dateText },
    {
      title: "操作",
      width: 260,
      fixed: "right",
      render: (_, item) => (
        <Space className="inventory-action-links" size={4}>
          <Button type="link" onClick={() => openLogs(item)}>查看流水</Button>
          <Button type="link" onClick={() => openAdjust(item)}>库存调整</Button>
          <Button type="link" onClick={() => openWarning(item)}>设置预警</Button>
        </Space>
      )
    }
  ];
  const inventoryTableScrollX = columns.reduce((sum, column) => sum + Number(column.width || 120), 64);

  return (
    <div className="product-archive-page inventory-overview-page">
      <aside className="product-archive-sidebar inventory-archive-sidebar">
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
              const key = String(keys[0] || "category:__all__");
              setSelectedCategoryKey(key);
              form.setFieldValue("categoryId", key === "category:__all__" ? undefined : info.node.raw?.id);
              setPage(1);
              void fetchList(1, pageSize, { categoryId: key === "category:__all__" ? undefined : info.node.raw?.id });
            }}
          />
        </div>
      </aside>
      <section className="product-archive-main inventory-archive-main">
        <Form form={form} layout="vertical" onValuesChange={() => setPage(1)}>
          <Form.Item name="categoryId" hidden><Input /></Form.Item>
          <div className="product-archive-filters inventory-archive-filters">
            <Form.Item name="keyword" label="关键词"><Input allowClear placeholder="商品名 / 商品ID / SKU编码" /></Form.Item>
            <Form.Item name="brandId" label="商品品牌"><Select allowClear placeholder="全部" options={(ctx.data.brands || []).map((item: AnyRecord) => ({ value: item.id, label: item.brandName }))} /></Form.Item>
            <Form.Item name="productStatus" label="商品状态"><Select allowClear placeholder="全部" options={productBusinessStatusOptions} /></Form.Item>
            <Form.Item name="stockStatus" label="库存状态"><Select allowClear placeholder="全部" options={Object.entries(inventoryStatusMeta).map(([value, meta]: any) => ({ value, label: meta.text }))} /></Form.Item>
            <div className="product-archive-query-actions inventory-archive-query-actions">
              <Button type="primary" onClick={() => fetchList(1, pageSize)}>查询</Button>
              <Button onClick={resetFilters}>重置</Button>
            </div>
          </div>
        </Form>
        <div className="product-archive-toolbar inventory-archive-toolbar">
          <Button type="primary" onClick={() => selectedRowKeys.length ? setBatchWarningOpen(true) : ctx.message.warning("请先选择需要设置预警的SKU")}>批量设置预警</Button>
          <Typography.Text type="secondary">已选择 {selectedRowKeys.length} 个 SKU</Typography.Text>
        </div>
        <div className="product-archive-table inventory-table-card anchored-pagination-table inventory-catalog-table">
          <AdminTable
            loading={loading || listLoading}
            rowKey={row => String(row.skuId)}
            dataSource={rows}
            columns={columns}
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
            locale={{ emptyText: <Empty description="暂无库存数据" /> }}
            tableLayout="fixed"
            scroll={{ x: Math.max(1760, inventoryTableScrollX), y: "100%" }}
            pagination={{
              className: "product-archive-pagination",
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              showTotal: value => `共 ${value} 条`,
              onChange: (nextPage, nextSize) => fetchList(nextPage, nextSize)
            }}
          />
        </div>
      </section>

      <Modal title={`冻结库存明细 - ${activeRow?.productName || "-"} / ${activeRow?.skuCode || "-"}`} open={reservationOpen} onCancel={() => setReservationOpen(false)} footer={null} width={960}>
        <AdminTable
          loading={reservationLoading}
          rowKey={row => String(row.orderId || row.orderNo)}
          dataSource={reservationRows}
          locale={{ emptyText: <Empty description="暂无冻结占用订单" /> }}
          columns={[
            { title: "订单编号", dataIndex: "orderNo" },
            { title: "买家名称", dataIndex: "customerName" },
            { title: "占用数量", dataIndex: "reservedQuantity", align: "right" },
            { title: "占用时间", dataIndex: "reservedTime", render: dateText },
            { title: "支付状态", dataIndex: "paymentStatus", render: statusText },
            { title: "订单状态", dataIndex: "orderStatus", render: statusText },
            { title: "是否超时", dataIndex: "expired", render: value => value ? <Tag color="red">是</Tag> : <Tag>否</Tag> },
            { title: "操作", render: () => <Button type="link" onClick={() => ctx.message.info("订单详情跳转待接入")}>查看订单</Button> }
          ]}
          pagination={false}
        />
      </Modal>

      <Modal title={`库存流水 - ${activeRow?.productName || "-"} / ${activeRow?.skuCode || "-"}`} open={logOpen} onCancel={() => setLogOpen(false)} footer={null} width={1180}>
        {activeRow ? (
          <Descriptions size="small" column={4} bordered items={[
            { key: "actualStock", label: "当前实际库存", children: formatStockNumber(activeRow.actualStock) },
            { key: "frozenStock", label: "冻结库存", children: formatStockNumber(activeRow.frozenStock) },
            { key: "availableStock", label: "可售库存", children: formatStockNumber(activeRow.availableStock) },
            { key: "status", label: "库存状态", children: inventoryStatusTag(activeRow) }
          ]} />
        ) : null}
        <Form form={logForm} layout="inline" className="inventory-log-filter">
          <Form.Item name="changeType" label="变动类型"><Select allowClear style={{ width: 180 }} placeholder="全部" options={inventoryMovementTypeOptions} /></Form.Item>
          <Form.Item name="range" label="时间范围"><RangePicker /></Form.Item>
          <Button type="primary" onClick={() => fetchLogs(activeRow, 1, logPageSize)}>查询</Button>
        </Form>
        <AdminTable
          loading={logLoading}
          rowKey={row => String(row.id)}
          dataSource={logRows}
          locale={{ emptyText: <Empty description="暂无库存流水" /> }}
          columns={[
            { title: "发生时间", dataIndex: "changeTime", render: dateText },
            { title: "变动类型", dataIndex: "changeType", render: value => inventoryMovementTypeOptions.find(item => item.value === value)?.label || value || "-" },
            { title: "变动数量", dataIndex: "changeQuantity", align: "right", render: value => <span className={Number(value || 0) < 0 ? "inventory-danger-number" : "inventory-success-number"}>{changeQuantityText(value)}</span> },
            { title: "变动前库存", dataIndex: "beforeStock", align: "right", render: formatStockNumber },
            { title: "变动后库存", dataIndex: "afterStock", align: "right", render: formatStockNumber },
            { title: "关联单据类型", dataIndex: "relatedBizType" },
            { title: "关联单据号", dataIndex: "relatedBizNo", render: value => value || "-" },
            { title: "操作人", dataIndex: "operatorName" },
            { title: "备注", dataIndex: "remark", render: compactText }
          ]}
          pagination={{
            current: logPage,
            pageSize: logPageSize,
            total: logTotal,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            onChange: (nextPage, nextSize) => fetchLogs(activeRow, nextPage, nextSize)
          }}
        />
      </Modal>

      <Modal title="库存调整" open={adjustOpen} onCancel={() => setAdjustOpen(false)} onOk={submitAdjust} confirmLoading={adjustSubmitting}>
        {activeRow ? (
          <Descriptions size="small" column={1} bordered items={[
            { key: "productName", label: "商品名称", children: activeRow.productName || "-" },
            { key: "skuCode", label: "SKU编码", children: activeRow.skuCode || "-" },
            { key: "skuName", label: "SKU规格", children: activeRow.skuName || "默认规格" },
            { key: "actualStock", label: "当前实际库存", children: formatStockNumber(activeRow.actualStock) },
            { key: "frozenStock", label: "当前冻结库存", children: formatStockNumber(activeRow.frozenStock) },
            { key: "availableStock", label: "当前可售库存", children: formatStockNumber(activeRow.availableStock) }
          ]} />
        ) : null}
        <Form form={adjustForm} layout="vertical" className="inventory-modal-form">
          <Form.Item name="adjustType" label="调整类型" rules={[{ required: true }]}>
            <Select options={[{ value: "INCREASE", label: "增加库存" }, { value: "DECREASE", label: "减少库存" }]} />
          </Form.Item>
          <Form.Item name="quantity" label="调整数量" rules={[{ required: true }, { type: "number", min: 1, message: "调整数量必须大于0" }]}>
            <InputNumber min={1} precision={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => {
              const type = adjustForm.getFieldValue("adjustType");
              const quantity = Number(adjustForm.getFieldValue("quantity") || 0);
              const next = Number(activeRow?.actualStock || 0) + (type === "DECREASE" ? -quantity : quantity);
              return <Form.Item label="调整后实际库存"><Input value={Number.isFinite(next) ? formatStockNumber(next) : "-"} disabled /></Form.Item>;
            }}
          </Form.Item>
          <Form.Item name="reason" label="调整原因" rules={[{ required: true, message: "请选择调整原因" }]}>
            <Select options={["盘点修正", "损耗", "录入错误", "其它"].map(value => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={3} maxLength={300} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="设置预警" open={warningOpen} onCancel={() => setWarningOpen(false)} onOk={submitWarning} confirmLoading={warningSubmitting}>
        {activeRow ? (
          <Descriptions size="small" column={1} bordered items={[
            { key: "productName", label: "商品名称", children: activeRow.productName || "-" },
            { key: "skuCode", label: "SKU编码", children: activeRow.skuCode || "-" },
            { key: "availableStock", label: "当前可售库存", children: formatStockNumber(activeRow.availableStock) },
            { key: "warningStock", label: "当前预警值", children: activeRow.warningStock === null || activeRow.warningStock === undefined ? "未设置" : formatStockNumber(activeRow.warningStock) }
          ]} />
        ) : null}
        <Form form={warningForm} layout="vertical" className="inventory-modal-form">
          <Form.Item name="warningStock" label="新预警值" rules={[{ required: true, message: "请输入新预警值" }, { type: "number", min: 0, message: "预警值必须为大于等于0的整数" }]}>
            <InputNumber min={0} precision={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="批量设置预警" open={batchWarningOpen} onCancel={() => setBatchWarningOpen(false)} onOk={submitBatchWarning} confirmLoading={batchWarningSubmitting}>
        <Typography.Paragraph type="secondary">将为已选择的 {selectedRowKeys.length} 个 SKU 设置统一预警值。</Typography.Paragraph>
        <Form form={batchWarningForm} layout="vertical">
          <Form.Item name="warningStock" label="统一预警值" rules={[{ required: true, message: "请输入预警值" }, { type: "number", min: 0, message: "预警值必须为大于等于0的整数" }]}>
            <InputNumber min={0} precision={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

const orderTabOptions = [
  { key: "ALL", label: "全部", stat: "total" },
  { key: "UNPAID", label: "待付款", stat: "unpaid" },
  { key: "PENDING_SHIPMENT", label: "待发货", stat: "pendingShipment" },
  { key: "PART_SHIPPED", label: "部分发货", stat: "partShipped" },
  { key: "PENDING_RECEIVE", label: "待收货", stat: "pendingReceive" },
  { key: "COMPLETED", label: "已完成", stat: "completed" },
  { key: "CANCELLED", label: "已取消" },
  { key: "AFTER_SALE", label: "售后中", stat: "afterSale" }
];

const orderStatCards = [
  { key: "ALL", title: "全部订单", stat: "total" },
  { key: "UNPAID", title: "待付款", stat: "unpaid" },
  { key: "PENDING_SHIPMENT", title: "待发货", stat: "pendingShipment" },
  { key: "PART_SHIPPED", title: "部分发货", stat: "partShipped" },
  { key: "PENDING_RECEIVE", title: "待收货", stat: "pendingReceive" },
  { key: "COMPLETED", title: "已完成", stat: "completed" },
  { key: "AFTER_SALE", title: "售后中", stat: "afterSale" }
];

const orderStatusOptions = [
  { value: "WAIT_PAY", label: "待付款" },
  { value: "WAIT_SHIP", label: "待发货" },
  { value: "WAIT_RECEIVE", label: "待收货" },
  { value: "COMPLETED", label: "已完成" },
  { value: "CANCELLED", label: "已取消" }
];

function OrderPage({ ctx }: { ctx: Ctx; loading: boolean }) {
  const [form] = Form.useForm();
  const [stats, setStats] = useState<AnyRecord>({});
  const [orders, setOrders] = useState<AnyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState("ALL");
  const [filters, setFilters] = useState<AnyRecord>({});
  const [listLoading, setListLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshOrders = () => setRefreshTick(value => value + 1);

  useEffect(() => {
    let alive = true;
    setStatsLoading(true);
    request("/api/admin/orders/stats")
      .then(result => alive && setStats(result || {}))
      .catch((error: Error) => ctx.message.error(error.message))
      .finally(() => alive && setStatsLoading(false));
    return () => {
      alive = false;
    };
  }, [refreshTick]);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (activeTab !== "ALL") params.set("tab", activeTab);
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        params.set(key, String(value).trim());
      }
    });
    setListLoading(true);
    request(`/api/admin/orders?${params.toString()}`)
      .then(result => {
        if (!alive) return;
        setOrders(Array.isArray(result?.list) ? result.list : []);
        setTotal(Number(result?.total || 0));
      })
      .catch((error: Error) => {
        if (alive) ctx.message.error(error.message);
      })
      .finally(() => alive && setListLoading(false));
    return () => {
      alive = false;
    };
  }, [activeTab, page, pageSize, JSON.stringify(filters), refreshTick]);

  const applyFilters = (values: AnyRecord) => {
    const range = values.orderDateRange || [];
    setFilters({
      keyword: values.keyword,
      orderStatus: values.orderStatus,
      startDate: range[0]?.format?.("YYYY-MM-DD"),
      endDate: range[1]?.format?.("YYYY-MM-DD")
    });
    setPage(1);
  };

  const resetFilters = () => {
    form.resetFields();
    setFilters({});
    setActiveTab("ALL");
    setPage(1);
  };

  const columns: ColumnsType<AnyRecord> = [
    {
      title: "订单信息",
      width: 190,
      render: (_, item) => (
        <div className="admin-order-primary">
          <Button type="link" className="admin-order-no" onClick={() => openAdminOrderDetail(ctx, item.id, refreshOrders, item)}>{item.orderNo || "-"}</Button>
          <span>{dateText(item.createdAt)}</span>
        </div>
      )
    },
    {
      title: "买家信息",
      width: 220,
      render: (_, item) => (
        <div className="admin-order-buyer-cell">
          <strong>{emptyText(item.customerName)}</strong>
          <span>{emptyText(item.receiverName)} / {emptyText(item.receiverPhone)}</span>
        </div>
      )
    },
    {
      title: "商品信息",
      width: 300,
      render: (_, item) => <OrderProductSummary item={item} />
    },
    { title: "金额", dataIndex: "totalAmount", width: 120, align: "right", render: formatOrderMoney },
    { title: "订单状态", width: 130, align: "center", render: (_, item) => <OrderStatusTag type="order" value={resolveOrderWorkflowKey(item)} /> },
    { title: "售后状态", dataIndex: "afterSaleStatus", width: 120, align: "center", render: value => <OrderStatusTag type="afterSale" value={value || "NONE"} /> },
    {
      title: "操作",
      width: 150,
      align: "center",
      className: "admin-order-action-shadow",
      onHeaderCell: () => ({ className: "admin-order-action-shadow", width: 150 }),
      render: (_, item) => (
        <OrderActionButtons
          ctx={ctx}
          item={item}
          onRefresh={refreshOrders}
          onDetail={() => openAdminOrderDetail(ctx, item.id, refreshOrders, item)}
        />
      )
    }
  ];

  return (
    <div className="admin-order-workbench">
      <div className="admin-order-stats">
        {orderStatCards.map(card => (
          <button
            type="button"
            key={card.key}
            className={activeTab === card.key ? "is-active" : ""}
            onClick={() => {
              setActiveTab(card.key);
              setPage(1);
            }}
          >
            <span>{card.title}</span>
            <strong>{statsLoading ? "-" : Number(stats[card.stat] || 0)}</strong>
          </button>
        ))}
      </div>

      <Card className="admin-order-card admin-order-filter-card" bodyStyle={{ paddingBottom: 0 }}>
        <Tabs
          className="admin-order-status-tabs"
          activeKey={activeTab}
          onChange={key => {
            setActiveTab(key);
            setPage(1);
          }}
          items={orderTabOptions.map(item => ({
            key: item.key,
            label: item.stat ? `${item.label} ${Number(stats[item.stat] || 0)}` : item.label
          }))}
        />

        <Form form={form} className="admin-order-filters product-archive-filters" onFinish={applyFilters}>
          <div className="product-archive-filter-stack">
            <label className="product-archive-filter-keyword">
              <span>关键词</span>
              <Form.Item name="keyword" noStyle>
                <Input className="product-archive-keyword-search" allowClear placeholder="订单编号 / 买家名称 / 收货人 / 手机号" />
              </Form.Item>
            </label>
          </div>
          <label>
            <span>订单状态</span>
            <Form.Item name="orderStatus" noStyle>
              <Select allowClear placeholder="全部" options={orderStatusOptions} />
            </Form.Item>
          </label>
          <div className="product-archive-filter-actions-stack">
            <label>
              <span>下单时间</span>
              <Form.Item name="orderDateRange" noStyle>
                <RangePicker />
              </Form.Item>
            </label>
            <div className="product-archive-query-actions admin-order-filter-actions">
              <Button type="primary" htmlType="submit">查询</Button>
              <Button onClick={resetFilters}>重置</Button>
            </div>
          </div>
        </Form>
      </Card>

      <Card className="admin-order-card admin-order-table-card">
        <div className="admin-order-list-table product-archive-table anchored-pagination-table">
          <AdminTable
            loading={listLoading}
            rowKey="id"
            dataSource={orders}
            columns={columns}
            scroll={{ x: "max-content", y: "100%" }}
            locale={{ emptyText: <Empty description="暂无订单" /> }}
            pagination={{
              className: "product-archive-pagination",
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (value: number) => `共 ${value} 条`,
              onChange: (nextPage: number, nextPageSize: number) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }
            }}
          />
        </div>
      </Card>
    </div>
  );
}

function OrderProductSummary({ item }: { item: AnyRecord }) {
  const items = Array.isArray(item.items) ? item.items : [];
  const first = items[0] || {};
  const distinctProducts = distinctOrderProducts(items);
  const hasMultipleSpus = distinctProducts.length > 1;
  const image = orderImageSrc(first);
  return (
    <div className="admin-order-product-cell">
      {hasMultipleSpus ? <OrderImageStack items={distinctProducts.slice(0, 3)} /> : <OrderImage src={image} />}
      <div>
        <strong>{emptyText(first.productName)}</strong>
        {hasMultipleSpus ? (
          <span>共 {distinctProducts.length} 种商品</span>
        ) : (
          <>
            <span>SKU：{emptyText(first.skuCode)}</span>
            <small>{items.length > 1 ? `共 ${items.length} 件商品` : `数量 ${numberText(first.quantity)}`}</small>
          </>
        )}
      </div>
    </div>
  );
}

function OrderActionButtons({ ctx, item, onRefresh, onDetail }: { ctx: Ctx; item: AnyRecord; onRefresh: () => void; onDetail: () => void }) {
  const workflow = resolveOrderWorkflowKey(item);
  const afterSaleStatus = String(item.afterSaleStatus || "NONE").toUpperCase();
  const hasAfterSale = afterSaleStatus !== "NONE";
  const buttons = [<Button key="detail" type="link" onClick={onDetail}>详情</Button>];
  if (workflow === "WAIT_PAY") {
    buttons.push(<Button key="cancel" type="link" danger onClick={() => cancelAdminOrder(ctx, item, onRefresh)}>取消订单</Button>);
    buttons.push(<Button key="pay" type="link" onClick={() => confirmAdminPayment(ctx, item, onRefresh)}>确认收款</Button>);
  } else if (workflow === "WAIT_SHIP") {
    buttons.push(<Button key="ship" type="link" onClick={() => shipOrder(ctx, item, onRefresh)}>发货</Button>);
  } else if (workflow === "PART_SHIPPED") {
    buttons.push(<Button key="ship-more" type="link" onClick={() => shipOrder(ctx, item, onRefresh)}>继续发货</Button>);
    buttons.push(<Button key="shipments" type="link" onClick={() => openShipmentRecords(ctx, item)}>发货记录</Button>);
  } else if (workflow === "WAIT_RECEIVE") {
    buttons.push(<Button key="shipments" type="link" onClick={() => openShipmentRecords(ctx, item)}>发货记录</Button>);
  } else if (workflow === "COMPLETED" && hasAfterSale) {
    buttons.push(<Button key="after-sale" type="link" onClick={() => viewRelatedAfterSale(ctx, item)}>查看售后</Button>);
  }
  return <Space className="admin-order-action-links" size={4}>{buttons}</Space>;
}

function shipOrder(ctx: Ctx, item: AnyRecord, onSuccess?: () => void) {
  ctx.setDrawer({
    title: `${resolveOrderWorkflowKey(item) === "PART_SHIPPED" ? "继续发货" : "订单发货"} ${item.orderNo || ""}`,
    width: 560,
    body: <ShipOrderForm ctx={ctx} item={item} onSuccess={onSuccess} />
  });
}

function ShipOrderForm({ ctx, item, onSuccess }: { ctx: Ctx; item: AnyRecord; onSuccess?: () => void }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const shipmentMethod = Form.useWatch("shipmentMethod", form) || "EXPRESS";
  const operatorName = currentAdminOperatorName();
  const submit = async (values: AnyRecord) => {
    if (!operatorName) {
      ctx.message.error("无法获取当前操作人，请重新登录");
      return;
    }
    if (values.shipmentMethod === "EXPRESS" && (!String(values.logisticsCompany || "").trim() || !String(values.logisticsNo || "").trim())) {
      ctx.message.error("快递发货时请填写快递公司和快递单号");
      return;
    }
    setSubmitting(true);
    try {
      await request(`/api/admin/orders/${item.id}/ship`, {
        method: "POST",
        data: {
          shipmentMethod: values.shipmentMethod,
          logisticsCompany: values.shipmentMethod === "EXPRESS" ? values.logisticsCompany : "",
          logisticsNo: values.shipmentMethod === "EXPRESS" ? values.logisticsNo : "",
          remark: values.remark || "",
          operatorName
        }
      });
      ctx.message.success("发货成功");
      ctx.setDrawer(null);
      onSuccess?.();
    } catch (error: any) {
      ctx.message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Form form={form} layout="vertical" initialValues={{ shipmentMethod: "EXPRESS" }} onFinish={submit}>
      <Form.Item name="shipmentMethod" label="发货方式" rules={[{ required: true }]}>
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          options={[
            { value: "EXPRESS", label: "快递发货" },
            { value: "NO_LOGISTICS", label: "无需物流" }
          ]}
        />
      </Form.Item>
      {shipmentMethod === "EXPRESS" ? (
        <>
          <Form.Item name="logisticsCompany" label="快递公司" rules={[{ required: true, message: "请输入快递公司" }]}>
            <Input maxLength={80} placeholder="请输入快递公司" />
          </Form.Item>
          <Form.Item name="logisticsNo" label="快递单号" rules={[{ required: true, message: "请输入快递单号" }]}>
            <Input maxLength={80} placeholder="请输入快递单号" />
          </Form.Item>
        </>
      ) : null}
      <Form.Item name="remark" label="发货备注">
        <Input.TextArea rows={3} maxLength={500} placeholder="选填" />
      </Form.Item>
      <div className="admin-order-operator-line">操作人：{operatorName || "-"}</div>
      <Space style={{ marginTop: 20 }}>
        <Button onClick={() => ctx.setDrawer(null)}>取消</Button>
        <Button type="primary" htmlType="submit" loading={submitting}>提交发货</Button>
      </Space>
    </Form>
  );
}

function openAdminOrderDetail(ctx: Ctx, orderId: any, onRefresh?: () => void, initialSummary?: AnyRecord) {
  ctx.setDrawer({
    title: "订单详情",
    width: "94vw",
    className: "admin-order-detail-drawer",
    body: <AdminOrderDetail ctx={ctx} orderId={orderId} onRefresh={onRefresh} initialSummary={initialSummary} />
  });
}

function AdminOrderDetail({ ctx, orderId, onRefresh, initialSummary }: { ctx: Ctx; orderId: any; onRefresh?: () => void; initialSummary?: AnyRecord }) {
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [detailError, setDetailError] = useState("");
  const [loading, setLoading] = useState(false);
  const loadDetail = async () => {
    setLoading(true);
    setDetailError("");
    try {
      setDetail(await request(`/api/admin/orders/${orderId}`));
    } catch (error: any) {
      if (initialSummary) {
        setDetail(normalizeOrderDetailFallback(initialSummary));
        setDetailError("订单详情接口暂时不可用，当前展示列表摘要信息。");
      } else {
        ctx.message.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadDetail();
  }, [orderId]);
  const refreshAll = () => {
    void loadDetail();
    onRefresh?.();
  };
  if (loading && !detail) {
    return <Card loading />;
  }
  if (!detail) {
    return <Empty description="暂无订单详情" />;
  }
  const items = Array.isArray(detail.items) ? detail.items : [];
  const shipments = Array.isArray(detail.shipments) ? detail.shipments : [];
  const afterSales = Array.isArray(detail.afterSales) ? detail.afterSales : [];
  const invoice = detail.invoice || null;
  const logs = Array.isArray(detail.logs) ? detail.logs : [];
  const goodsAmount = items.reduce((sum: number, row: AnyRecord) => sum + Number(row.lineAmount ?? Number(row.unitPrice || 0) * Number(row.quantity || 0)), 0);
  const totalAmount = Number(detail.totalAmount || 0);
  const refundAmount = Number(detail.refundAmount || 0);
  const invoicedAmount = invoice?.status === "INVOICED" ? Number(invoice.amount || 0) : 0;
  const trackingActions = (
    <OrderDetailActions
      ctx={ctx}
      detail={detail}
      onRefresh={refreshAll}
      onShipSuccess={() => {
        onRefresh?.();
        openAdminOrderDetail(ctx, orderId, onRefresh);
      }}
    />
  );
  return (
    <div className="admin-order-detail">
      {detailError ? <div className="admin-order-detail-warning">{detailError}</div> : null}
      <Card title="订单跟踪" extra={trackingActions} className="admin-order-detail-card">
        <OrderProgress detail={detail} />
      </Card>

      <div className="admin-order-detail-grid">
        <Card title="订单概况" className="admin-order-detail-card">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="订单编号">{emptyText(detail.orderNo)}</Descriptions.Item>
            <Descriptions.Item label="订单状态"><OrderStatusTag type="order" value={resolveOrderWorkflowKey(detail)} /></Descriptions.Item>
            <Descriptions.Item label="支付状态"><OrderStatusTag type="payment" value={detail.paymentStatus} /></Descriptions.Item>
            <Descriptions.Item label="发货状态"><OrderStatusTag type="fulfillment" value={detail.fulfillmentStatus} /></Descriptions.Item>
            <Descriptions.Item label="售后状态"><OrderStatusTag type="afterSale" value={detail.afterSaleStatus || "NONE"} /></Descriptions.Item>
            <Descriptions.Item label="下单时间">{dateText(detail.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="支付方式">{paymentMethodText(detail.paymentMethod)}</Descriptions.Item>
            <Descriptions.Item label="买家留言" span={2}>{emptyText(detail.remark)}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="买家信息" className="admin-order-detail-card">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="买家名称">{emptyText(detail.customerName)}</Descriptions.Item>
            <Descriptions.Item label="买家账号">{emptyText(detail.buyerAccount || detail.customerCode || detail.customerId)}</Descriptions.Item>
            <Descriptions.Item label="联系人">{emptyText(detail.contactName || detail.receiverName)}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{emptyText(detail.contactPhone || detail.receiverPhone)}</Descriptions.Item>
          </Descriptions>
        </Card>
      </div>

      <Card
        title="收货信息"
        className="admin-order-detail-card"
        extra={<Button icon={<CopyOutlined />} onClick={() => copyReceiverInfo(ctx, detail)}>复制收货信息</Button>}
      >
        <Descriptions column={3} size="small">
          <Descriptions.Item label="收货人">{emptyText(detail.receiverName)}</Descriptions.Item>
          <Descriptions.Item label="手机号">{emptyText(detail.receiverPhone)}</Descriptions.Item>
          <Descriptions.Item label="收货地址">{emptyText(detail.receiverAddress)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="商品清单" className="admin-order-detail-card">
        <AdminTable
          rowKey={(row: AnyRecord, index?: number) => `${row.id || row.skuCode || index}`}
          dataSource={items}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无商品明细" /> }}
          columns={[
            { title: "商品", width: 260, render: (_, row) => <OrderProductLine item={row} /> },
            { title: "SKU编码", dataIndex: "skuCode", width: 140, render: emptyText },
            { title: "规格", dataIndex: "skuName", width: 160, render: emptyText },
            { title: "单位", dataIndex: "unit", width: 80, render: emptyText },
            { title: "单价", dataIndex: "unitPrice", width: 110, align: "right", render: formatOrderMoney },
            { title: "购买数量", dataIndex: "quantity", width: 100, align: "right", render: numberText },
            { title: "已发数量", dataIndex: "shippedQuantity", width: 100, align: "right", render: numberText },
            { title: "未发数量", width: 100, align: "right", render: (_, row) => Math.max(0, Number(row.quantity || 0) - Number(row.shippedQuantity || 0)) },
            { title: "小计", dataIndex: "lineAmount", width: 120, align: "right", render: formatOrderMoney },
            { title: "售后数量", dataIndex: "afterSaleQuantity", width: 100, align: "right", render: numberText }
          ]}
        />
      </Card>

      <div className="admin-order-detail-grid">
        <Card title="金额信息" className="admin-order-detail-card">
          <div className="admin-order-money-lines">
            <span>商品总额<strong>{formatOrderMoney(goodsAmount)}</strong></span>
            <span>运费<strong>{formatOrderMoney(0)}</strong></span>
            <span>优惠金额<strong>{formatOrderMoney(0)}</strong></span>
            <span>退款金额<strong>{formatOrderMoney(refundAmount)}</strong></span>
            <span>订单实付<strong className="is-emphasis">{formatOrderMoney(totalAmount)}</strong></span>
          </div>
        </Card>

        <Card title="支付信息" className="admin-order-detail-card">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="支付方式">{paymentMethodText(detail.paymentMethod)}</Descriptions.Item>
            <Descriptions.Item label="支付状态"><OrderStatusTag type="payment" value={detail.paymentStatus} /></Descriptions.Item>
            <Descriptions.Item label="支付时间">{dateText(detail.paymentTime)}</Descriptions.Item>
            <Descriptions.Item label="支付流水号">{emptyText(detail.paymentNo)}</Descriptions.Item>
          </Descriptions>
        </Card>
      </div>

      <Card title="发货信息" className="admin-order-detail-card">
        <ShipmentTable rows={shipments} />
      </Card>

      <Card title="售后信息" className="admin-order-detail-card">
        {afterSales.length ? (
          <AdminTable
            rowKey="id"
            dataSource={afterSales}
            pagination={false}
            columns={[
              { title: "售后状态", dataIndex: "status", render: value => <OrderStatusTag type="afterSale" value={value} /> },
              { title: "售后单号", dataIndex: "afterSaleNo", render: emptyText },
              { title: "售后类型", dataIndex: "type", render: emptyText },
              { title: "申请金额", dataIndex: "amount", align: "right", render: formatOrderMoney },
              { title: "操作", render: () => <Button type="link" onClick={() => ctx.go?.("aftersale")}>查看售后单</Button> }
            ]}
          />
        ) : <Empty description="暂无售后" />}
      </Card>

      <Card title="开票信息" className="admin-order-detail-card">
        {invoice ? (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="开票状态"><OrderStatusTag type="invoice" value={invoice.status} /></Descriptions.Item>
            <Descriptions.Item label="发票类型">{invoiceTypeText(invoice.invoiceType)}</Descriptions.Item>
            <Descriptions.Item label="发票抬头">{emptyText(invoice.title)}</Descriptions.Item>
            <Descriptions.Item label="纳税人识别号">{emptyText(invoice.taxNo)}</Descriptions.Item>
            <Descriptions.Item label="可开票金额">{formatOrderMoney(Math.max(0, totalAmount - refundAmount))}</Descriptions.Item>
            <Descriptions.Item label="已开票金额">{formatOrderMoney(invoicedAmount)}</Descriptions.Item>
            <Descriptions.Item label="发票文件">{Array.isArray(invoice.files) && invoice.files.length ? `${invoice.files.length} 个文件` : "暂无"}</Descriptions.Item>
          </Descriptions>
        ) : <Empty description="未申请开票" />}
      </Card>

      <Card title="操作日志" className="admin-order-detail-card">
        <AdminTable
          rowKey="id"
          dataSource={logs}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无操作日志" /> }}
          columns={[
            { title: "时间", dataIndex: "createdAt", render: dateText },
            { title: "操作人", dataIndex: "operatorName", render: emptyText },
            { title: "操作类型", dataIndex: "operationType", render: emptyText },
            { title: "操作内容", dataIndex: "operationContent", render: compactText }
          ]}
        />
      </Card>
    </div>
  );
}

function OrderDetailActions({ ctx, detail, onRefresh, onShipSuccess }: { ctx: Ctx; detail: AnyRecord; onRefresh: () => void; onShipSuccess?: () => void }) {
  const workflow = resolveOrderWorkflowKey(detail);
  if (workflow === "WAIT_PAY") {
    return <Space><Button type="primary" onClick={() => confirmAdminPayment(ctx, detail, onRefresh)}>确认收款</Button><Button danger onClick={() => cancelAdminOrder(ctx, detail, onRefresh)}>取消订单</Button></Space>;
  }
  if (workflow === "WAIT_SHIP") {
    return <Space><Button type="primary" onClick={() => shipOrder(ctx, detail, onShipSuccess || onRefresh)}>发货</Button>{canCancelOrder(detail) ? <Button danger onClick={() => cancelAdminOrder(ctx, detail, onRefresh)}>取消订单</Button> : null}</Space>;
  }
  if (workflow === "PART_SHIPPED") {
    return <Space><Button type="primary" onClick={() => shipOrder(ctx, detail, onShipSuccess || onRefresh)}>继续发货</Button></Space>;
  }
  return null;
}

function OrderProgress({ detail }: { detail: AnyRecord }) {
  const workflow = resolveOrderWorkflowKey(detail);
  if (workflow === "CANCELLED") {
    return <div className="admin-order-cancelled-state">订单已取消</div>;
  }
  const steps = [
    { title: "提交订单", time: detail.createdAt },
    { title: "支付完成", time: detail.paymentTime },
    { title: "后台发货", time: detail.shipmentTime },
    { title: "买家收货", time: detail.receiveTime },
    { title: "订单完成", time: detail.completedTime }
  ];
  const completed = workflow === "COMPLETED";
  const currentIndex = workflow === "WAIT_PAY" ? 0 : workflow === "WAIT_SHIP" ? 1 : workflow === "WAIT_RECEIVE" || workflow === "PART_SHIPPED" ? 2 : completed ? steps.length : 0;
  return (
    <>
      <div className="admin-order-progress">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const current = !completed && index === currentIndex;
          return (
            <div key={step.title} className={`admin-order-progress-step ${done ? "is-done" : ""} ${current ? "is-current" : ""}`}>
              <span>{done ? <CheckOutlined /> : index + 1}</span>
              <strong>{step.title}</strong>
              <small>{dateText(step.time)}</small>
            </div>
          );
        })}
      </div>
      {String(detail.afterSaleStatus || "").toUpperCase() === "PROCESSING" ? <div className="admin-order-after-sale-tip">该订单存在进行中的售后，请处理后续履约和财务动作。</div> : null}
    </>
  );
}

function ShipmentTable({ rows }: { rows: AnyRecord[] }) {
  return (
    <AdminTable
      rowKey="id"
      dataSource={rows}
      pagination={false}
      locale={{ emptyText: <Empty description="暂无发货记录" /> }}
      columns={[
        { title: "发货单号", dataIndex: "shipmentNo", render: emptyText },
        { title: "发货方式", dataIndex: "shipmentMethod", render: shipmentMethodText },
        { title: "快递公司", dataIndex: "logisticsCompany", render: emptyText },
        { title: "快递单号", dataIndex: "logisticsNo", render: emptyText },
        { title: "发货商品", render: () => "-" },
        { title: "发货人", dataIndex: "operatorName", render: emptyText },
        { title: "发货时间", dataIndex: "createdAt", render: dateText },
        { title: "备注", dataIndex: "remark", render: compactText }
      ]}
    />
  );
}

function openShipmentRecords(ctx: Ctx, item: AnyRecord) {
  ctx.setDrawer({
    title: `发货记录 ${item.orderNo || ""}`,
    width: 860,
    body: <ShipmentRecordsPanel ctx={ctx} orderId={item.id} />
  });
}

function ShipmentRecordsPanel({ ctx, orderId }: { ctx: Ctx; orderId: any }) {
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    request(`/api/admin/orders/${orderId}/shipments`)
      .then(result => alive && setRows(Array.isArray(result) ? result : []))
      .catch((error: Error) => ctx.message.error(error.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [orderId]);
  return <Card loading={loading}><ShipmentTable rows={rows} /></Card>;
}

function OrderProductLine({ item }: { item: AnyRecord }) {
  return (
    <div className="admin-order-product-cell">
      <OrderImage src={orderImageSrc(item)} />
      <div>
        <strong>{emptyText(item.productName)}</strong>
        <span>{emptyText(item.skuName)}</span>
      </div>
    </div>
  );
}

function OrderImageStack({ items }: { items: AnyRecord[] }) {
  return (
    <div className="admin-order-image-stack" aria-label={`共 ${items.length} 种商品`}>
      {items.map((item, index) => (
        <span key={`${item.productId || item.productName || index}`} style={{ zIndex: items.length - index }}>
          <OrderImage src={orderImageSrc(item)} />
        </span>
      ))}
    </div>
  );
}

function OrderImage({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const safeSrc = safeOrderImageSrc(src);
  if (!safeSrc || failed) {
    return <span className="admin-order-image-placeholder"><PictureOutlined /></span>;
  }
  return <img className="admin-order-image" src={safeSrc} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

function cancelAdminOrder(ctx: Ctx, item: AnyRecord, onSuccess?: () => void) {
  const operatorName = currentAdminOperatorName();
  if (!operatorName) {
    ctx.message.error("无法获取当前操作人，请重新登录");
    return;
  }
  Modal.confirm({
    title: "确认取消该订单吗？取消后不可恢复。",
    okText: "确认取消",
    cancelText: "再想想",
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await request(`/api/admin/orders/${item.id}/cancel`, {
          method: "POST",
          data: { operatorName, reason: "后台取消" }
        });
        ctx.message.success("订单已取消");
        onSuccess?.();
      } catch (error: any) {
        ctx.message.error(error.message);
        return Promise.reject(error);
      }
    }
  });
}

function confirmAdminPayment(ctx: Ctx, item: AnyRecord, onSuccess?: () => void) {
  const operatorName = currentAdminOperatorName();
  if (!operatorName) {
    ctx.message.error("无法获取当前操作人，请重新登录");
    return;
  }
  Modal.confirm({
    title: "确认已收到该订单款项吗？",
    okText: "确认收款",
    cancelText: "取消",
    onOk: async () => {
      try {
        await request(`/api/admin/orders/${item.id}/confirm-payment`, {
          method: "POST",
          data: { operatorName, paymentMethod: "OFFLINE", paymentRemark: "线下转账确认收款" }
        });
        ctx.message.success("收款已确认");
        onSuccess?.();
      } catch (error: any) {
        ctx.message.error(error.message);
        return Promise.reject(error);
      }
    }
  });
}

function viewRelatedAfterSale(ctx: Ctx, item: AnyRecord) {
  if (String(item.afterSaleStatus || "NONE").toUpperCase() === "NONE") {
    ctx.message.info("暂无售后");
    return;
  }
  ctx.go?.("aftersale");
}

function viewRelatedInvoice(ctx: Ctx, item: AnyRecord) {
  if (String(item.invoiceStatus || "NONE").toUpperCase() === "NONE") {
    ctx.message.info("未申请开票");
    return;
  }
  ctx.go?.("invoice");
}

async function copyReceiverInfo(ctx: Ctx, detail: AnyRecord) {
  const text = `收货人：${detail.receiverName || "-"}\n手机号：${detail.receiverPhone || "-"}\n收货地址：${detail.receiverAddress || "-"}`;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    ctx.message.success("已复制收货信息");
  } catch {
    ctx.message.error("复制失败，请手动复制");
  }
}

function currentAdminOperatorName() {
  const raw = String(localStorage.getItem(adminAccountKey) || "").trim();
  return raw.split("/")[0]?.trim() || "";
}

function resolveOrderWorkflowKey(item: AnyRecord) {
  const orderStatus = String(item.orderStatus || "").toUpperCase();
  const paymentStatus = String(item.paymentStatus || "").toUpperCase();
  const fulfillmentStatus = String(item.fulfillmentStatus || "").toUpperCase();
  if (["CANCELLED", "CANCELED"].includes(orderStatus)) return "CANCELLED";
  if (orderStatus === "COMPLETED") return "COMPLETED";
  if (["WAIT_PAY", "PENDING_PAYMENT"].includes(orderStatus) || paymentStatus === "UNPAID") return "WAIT_PAY";
  if (["PART_SHIPPED", "PARTIAL_SHIPPED"].includes(orderStatus) || ["PART_SHIPPED", "PARTIAL_SHIPPED"].includes(fulfillmentStatus)) return "PART_SHIPPED";
  if (["WAIT_RECEIVE", "SHIPPED"].includes(orderStatus) || ["SHIPPED", "NO_LOGISTICS"].includes(fulfillmentStatus)) return "WAIT_RECEIVE";
  if (["WAIT_SHIP", "PENDING_SHIPMENT"].includes(orderStatus) || (["PAID", "NOT_REQUIRED_BEFORE_RECEIPT"].includes(paymentStatus) && fulfillmentStatus === "UNSHIPPED")) return "WAIT_SHIP";
  return orderStatus || "-";
}

function canCancelOrder(item: AnyRecord) {
  return resolveOrderWorkflowKey(item) === "WAIT_PAY" && String(item.paymentStatus || "").toUpperCase() !== "PAID";
}

function OrderStatusTag({ type, value }: { type: "order" | "payment" | "fulfillment" | "afterSale" | "invoice"; value: any }) {
  const meta = statusMeta(type, value);
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function statusMeta(type: string, value: any) {
  const key = String(value || "").toUpperCase();
  const maps: AnyRecord = {
    order: {
      WAIT_PAY: ["待付款", "orange"],
      PENDING_PAYMENT: ["待付款", "orange"],
      WAIT_SHIP: ["待发货", "blue"],
      PENDING_SHIPMENT: ["待发货", "blue"],
      PART_SHIPPED: ["部分发货", "purple"],
      PARTIAL_SHIPPED: ["部分发货", "purple"],
      WAIT_RECEIVE: ["待收货", "cyan"],
      SHIPPED: ["待收货", "cyan"],
      COMPLETED: ["已完成", "green"],
      CANCELLED: ["已取消", "default"]
    },
    payment: {
      UNPAID: ["未支付", "orange"],
      PAID: ["已支付", "green"],
      REFUNDED: ["已退款", "default"],
      PART_REFUNDED: ["部分退款", "purple"],
      PARTIAL_REFUNDED: ["部分退款", "purple"],
      NOT_REQUIRED_BEFORE_RECEIPT: ["后付款", "blue"]
    },
    fulfillment: {
      UNSHIPPED: ["未发货", "orange"],
      PART_SHIPPED: ["部分发货", "purple"],
      PARTIAL_SHIPPED: ["部分发货", "purple"],
      SHIPPED: ["已发货", "green"],
      NO_LOGISTICS: ["无需物流", "cyan"],
      RECEIVED: ["已收货", "green"],
      CANCELLED: ["已取消", "default"]
    },
    afterSale: {
      NONE: ["无售后", "default"],
      PROCESSING: ["售后中", "red"],
      COMPLETED: ["售后完成", "green"],
      WAIT_AUDIT: ["售后中", "orange"],
      WAIT_REFUND: ["售后中", "orange"]
    },
    invoice: {
      NONE: ["未申请", "default"],
      PENDING_INVOICE: ["待开票", "orange"],
      WAIT_INVOICE: ["待开票", "orange"],
      APPLIED: ["待开票", "orange"],
      INVOICED: ["已开票", "green"],
      REJECTED: ["已驳回", "default"],
      CANCELLED: ["已撤销", "default"]
    }
  };
  const matched = maps[type]?.[key];
  return matched ? { label: matched[0], color: matched[1] } : { label: value || "-", color: "default" };
}

function formatOrderMoney(value: any) {
  const num = Number(value || 0);
  return `¥${(Number.isFinite(num) ? num : 0).toFixed(2)}`;
}

function orderImageSrc(item: AnyRecord) {
  return item.mainImageThumbUrl || item.mainImageThumbnailUrl || item.thumbnailUrl || item.mainImageCardUrl || item.mainImageUrl || item.imageUrl || "";
}

function distinctOrderProducts(items: AnyRecord[]) {
  const rows: AnyRecord[] = [];
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const key = String(item.productId ?? item.spuId ?? item.productCode ?? item.productName ?? index).trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push(item);
  });
  return rows;
}

function normalizeOrderDetailFallback(summary: AnyRecord) {
  return {
    ...summary,
    items: Array.isArray(summary.items) ? summary.items : [],
    shipments: Array.isArray(summary.shipments) ? summary.shipments : [],
    afterSales: Array.isArray(summary.afterSales) ? summary.afterSales : [],
    logs: Array.isArray(summary.logs) ? summary.logs : [],
    invoice: summary.invoice || null
  };
}

function safeOrderImageSrc(value: any) {
  const src = String(value || "").trim();
  if (!src || src.toLowerCase().startsWith("data:image")) return "";
  return src;
}

function shipmentMethodText(value: any) {
  return String(value || "").toUpperCase() === "NO_LOGISTICS" ? "无需物流" : "快递发货";
}

function paymentMethodText(value: any) {
  const raw = String(value || "").trim();
  const upper = raw.toUpperCase();
  if (!raw) return "-";
  if (upper === "WECHAT" || upper === "WECHAT_PAY" || upper === "WX" || upper === "WX_PAY") return "微信支付";
  if (upper === "ALIPAY" || upper === "ALI_PAY") return "支付宝支付";
  if (upper === "OFFLINE" || upper === "OFFLINE_PAY") return "线下支付";
  if (upper === "ONLINE_PAY" || upper === "ONLINE") return "微信支付";
  if (upper === "SHIP_AFTER_PAY") return "先货后款";
  return raw;
}

function invoiceTypeText(value: any) {
  const key = String(value || "").trim().toUpperCase();
  if (!key) return "-";
  if (["E_NORMAL", "NORMAL", "ELECTRONIC_NORMAL"].includes(key)) return "电子普通发票";
  if (["E_SPECIAL", "E_VAT_SPECIAL", "VAT_SPECIAL", "SPECIAL", "ELECTRONIC_SPECIAL", "ELECTRONIC_VAT_SPECIAL"].includes(key)) return "电子增值税专用发票";
  return String(value || "-");
}

const afterSaleStatusOptions = [
  { value: "PENDING_REVIEW", label: "待审核" },
  { value: "WAIT_BUYER_RETURN", label: "待买家退货" },
  { value: "WAIT_SELLER_RECEIVE", label: "待商家收货" },
  { value: "WAIT_REFUND", label: "待退款" },
  { value: "COMPLETED", label: "已完成" },
  { value: "REJECTED", label: "已拒绝" },
  { value: "CLOSED", label: "已关闭" }
];

const afterSaleTabOptions = [
  { key: "ALL", label: "全部", stat: "total" },
  ...afterSaleStatusOptions.map(item => ({
    key: item.value,
    label: item.label,
    stat: ({
      PENDING_REVIEW: "pendingReview",
      WAIT_BUYER_RETURN: "waitBuyerReturn",
      WAIT_SELLER_RECEIVE: "waitSellerReceive",
      WAIT_REFUND: "waitRefund",
      COMPLETED: "completed",
      REJECTED: "rejected"
    } as AnyRecord)[item.value]
  }))
];

const afterSaleTypeOptions = [
  { value: "REFUND_ONLY", label: "仅退款" },
  { value: "RETURN_REFUND", label: "退货退款" }
];

const refundStatusOptions = [
  { value: "NOT_REFUNDED", label: "未退款" },
  { value: "WAIT_REFUND", label: "待退款" },
  { value: "REFUNDED", label: "已退款" },
  { value: "REFUND_FAILED", label: "退款失败" }
];

function AfterSalePage({ ctx }: { ctx: Ctx; loading: boolean }) {
  const [form] = Form.useForm();
  const [operationForm] = Form.useForm();
  const [stats, setStats] = useState<AnyRecord>({});
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState("ALL");
  const [filters, setFilters] = useState<AnyRecord>({});
  const [listLoading, setListLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [operation, setOperation] = useState<{ type: "review" | "receive" | "refund" | "close"; item: AnyRecord } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const reviewAction = Form.useWatch("action", operationForm) || "APPROVE";
  const reviewProcessType = Form.useWatch("processType", operationForm) || operation?.item?.afterSaleType || "REFUND_ONLY";
  const receiveResult = Form.useWatch("receiveResult", operationForm) || "NORMAL";

  const refresh = () => setRefreshTick(value => value + 1);

  useEffect(() => {
    let alive = true;
    request("/api/admin/after-sales/stats")
      .then(result => alive && setStats(result || {}))
      .catch((error: Error) => alive && ctx.message.error(error.message));
    return () => {
      alive = false;
    };
  }, [refreshTick]);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (activeTab !== "ALL" && activeTab !== "TIMEOUT") params.set("tab", activeTab);
    if (activeTab === "TIMEOUT") params.set("timeoutOnly", "true");
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        params.set(key, String(value).trim());
      }
    });
    setListLoading(true);
    request(`/api/admin/after-sales?${params.toString()}`)
      .then(result => {
        if (!alive) return;
        setRows(Array.isArray(result?.list) ? result.list : []);
        setTotal(Number(result?.total || 0));
      })
      .catch((error: Error) => alive && ctx.message.error(error.message))
      .finally(() => alive && setListLoading(false));
    return () => {
      alive = false;
    };
  }, [activeTab, page, pageSize, JSON.stringify(filters), refreshTick]);

  useEffect(() => {
    if (!operation) return;
    const item = operation.item || {};
    operationForm.resetFields();
    if (operation.type === "review") {
      operationForm.setFieldsValue({
        action: "APPROVE",
        processType: item.afterSaleType || "REFUND_ONLY",
        approvedAmount: Number(item.approvedAmount ?? item.applyAmount ?? item.refundAmount ?? 0),
        remark: ""
      });
    }
    if (operation.type === "receive") {
      operationForm.setFieldsValue({
        receivedQuantity: Number(item.applyQuantity || item.quantity || 1),
        receiveResult: "NORMAL",
        returnToStock: true,
        remark: ""
      });
    }
    if (operation.type === "refund") {
      operationForm.setFieldsValue({
        refundMethod: "MANUAL",
        refundAmount: Number(item.approvedAmount ?? item.applyAmount ?? item.refundAmount ?? 0),
        refundNo: "",
        remark: ""
      });
    }
  }, [operation?.type, operation?.item?.id]);

  const applyFilters = (values: AnyRecord) => {
    const range = values.applyDateRange || [];
    setFilters({
      keyword: values.keyword,
      afterSaleType: values.afterSaleType,
      afterSaleStatus: values.afterSaleStatus,
      refundStatus: values.refundStatus,
      orderStatus: values.orderStatus,
      productKeyword: values.productKeyword,
      timeoutOnly: values.timeoutOnly,
      startDate: range[0]?.format?.("YYYY-MM-DD"),
      endDate: range[1]?.format?.("YYYY-MM-DD")
    });
    setPage(1);
  };

  const resetFilters = () => {
    form.resetFields();
    setFilters({});
    setActiveTab("ALL");
    setPage(1);
  };

  const openOperation = (type: "review" | "receive" | "refund" | "close", item: AnyRecord) => setOperation({ type, item });

  const submitOperation = async () => {
    if (!operation) return;
    const operatorName = currentAdminOperatorName();
    if (!operatorName) {
      ctx.message.error("无法获取当前操作人，请重新登录");
      return;
    }
    try {
      const values = await operationForm.validateFields();
      const item = operation.item;
      let url = "";
      let data: AnyRecord = { ...values, operatorName };
      if (operation.type === "review") {
        url = `/api/admin/after-sales/${item.id}/review`;
        if (values.action === "REJECT") {
          data = { action: "REJECT", rejectReason: values.rejectReason, remark: values.remark, operatorName };
        } else {
          data = {
            action: "APPROVE",
            processType: values.processType,
            approvedAmount: values.approvedAmount,
            needReturn: values.processType === "RETURN_REFUND",
            returnAddress: values.processType === "RETURN_REFUND" ? values.returnAddress : "",
            remark: values.remark,
            operatorName
          };
        }
      } else if (operation.type === "receive") {
        url = `/api/admin/after-sales/${item.id}/receive-return`;
      } else if (operation.type === "refund") {
        url = `/api/admin/after-sales/${item.id}/confirm-refund`;
      } else {
        url = `/api/admin/after-sales/${item.id}/close`;
      }
      setSubmitting(true);
      await request(url, { method: "POST", data });
      ctx.message.success(operationSuccessText(operation.type));
      setOperation(null);
      refresh();
    } catch (error: any) {
      if (error?.errorFields) return;
      ctx.message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<AnyRecord> = [
    {
      title: "售后单信息",
      width: 190,
      render: (_, item) => (
        <div className="admin-order-primary">
          <Button type="link" className="admin-order-no" onClick={() => openAfterSaleDetail(ctx, item.id, refresh, openOperation)}>{emptyText(item.afterSaleNo)}</Button>
          <span>{dateText(item.createdAt)}</span>
        </div>
      )
    },
    {
      title: "订单信息",
      width: 160,
      render: (_, item) => (
        <div className="admin-order-primary">
          <span>{emptyText(item.orderNo)}</span>
          <AfterSaleOrderStatusTag value={item.orderStatus} />
        </div>
      )
    },
    {
      title: "买家信息",
      width: 190,
      render: (_, item) => (
        <div className="admin-order-buyer-cell">
          <strong>{emptyText(item.customerName || item.buyerName)}</strong>
          <span>{emptyText(item.receiverName)} / {emptyText(item.customerPhone || item.receiverPhone)}</span>
        </div>
      )
    },
    {
      title: "商品信息",
      width: 300,
      render: (_, item) => (
        <div className="admin-order-product-cell">
          <OrderImage src={item.productImage} />
          <div>
            <strong>{emptyText(item.productName)}</strong>
            <span>SKU：{emptyText(item.skuCode)}</span>
            <small>{emptyText(item.skuName)} / 数量 {numberText(item.applyQuantity || item.quantity)}</small>
          </div>
        </div>
      )
    },
    { title: "售后类型", dataIndex: "afterSaleType", width: 110, render: afterSaleTypeText },
    { title: "申请原因", dataIndex: "reason", width: 150, render: compactText },
    { title: "申请金额", dataIndex: "applyAmount", width: 120, align: "right", render: formatOrderMoney },
    { title: "可退金额", dataIndex: "refundableAmount", width: 120, align: "right", render: formatOrderMoney },
    { title: "售后状态", dataIndex: "afterSaleStatus", width: 130, render: value => <AfterSaleStatusTag value={value} /> },
    { title: "退款状态", dataIndex: "refundStatus", width: 120, render: value => <RefundStatusTag value={value} /> },
    { title: "是否超时", dataIndex: "timeout", width: 100, render: value => value ? <Tag color="red">是</Tag> : <Tag>否</Tag> },
    {
      title: "操作",
      width: 170,
      align: "center",
      className: "admin-order-action-shadow",
      onHeaderCell: () => ({ className: "admin-order-action-shadow", width: 170 }),
      render: (_, item) => <AfterSaleActionButtons item={item} onDetail={() => openAfterSaleDetail(ctx, item.id, refresh, openOperation)} onOperation={openOperation} />
    }
  ];

  return (
    <div className="admin-order-workbench admin-after-sale-workbench">
      <Card className="admin-order-card admin-order-filter-card" bodyStyle={{ paddingBottom: 0 }}>
        <Tabs
          className="admin-order-status-tabs"
          activeKey={activeTab}
          onChange={key => {
            setActiveTab(key);
            setPage(1);
          }}
          items={afterSaleTabOptions.map(item => ({
            key: item.key,
            label: item.stat ? `${item.label} ${Number(stats[item.stat] || 0)}` : item.label
          }))}
        />

        <Form form={form} className="admin-order-filters product-archive-filters admin-after-sale-filters" onFinish={applyFilters}>
          <div className="product-archive-filter-stack">
            <label className="product-archive-filter-keyword">
              <span>关键词</span>
              <Form.Item name="keyword" noStyle>
                <Input className="product-archive-keyword-search" allowClear placeholder="售后单号 / 订单编号 / 买家名称 / 手机号" />
              </Form.Item>
            </label>
            <label>
              <span>商品/SKU</span>
              <Form.Item name="productKeyword" noStyle>
                <Input allowClear placeholder="商品名称 / SKU" />
              </Form.Item>
            </label>
          </div>
          <div className="product-archive-filter-stack">
            <label>
              <span>售后类型</span>
              <Form.Item name="afterSaleType" noStyle>
                <Select allowClear placeholder="全部" options={afterSaleTypeOptions} />
              </Form.Item>
            </label>
            <label>
              <span>订单状态</span>
              <Form.Item name="orderStatus" noStyle>
                <Select allowClear placeholder="全部" options={orderStatusOptions} />
              </Form.Item>
            </label>
          </div>
          <div className="product-archive-filter-stack">
            <label>
              <span>售后状态</span>
              <Form.Item name="afterSaleStatus" noStyle>
                <Select allowClear placeholder="全部" options={afterSaleStatusOptions} />
              </Form.Item>
            </label>
            <label>
              <span>是否超时</span>
              <Form.Item name="timeoutOnly" noStyle>
                <Select allowClear placeholder="全部" options={[{ value: "true", label: "是" }, { value: "false", label: "否" }]} />
              </Form.Item>
            </label>
          </div>
          <div className="product-archive-filter-stack">
            <label>
              <span>退款状态</span>
              <Form.Item name="refundStatus" noStyle>
                <Select allowClear placeholder="全部" options={refundStatusOptions} />
              </Form.Item>
            </label>
            <label>
              <span>申请时间</span>
              <Form.Item name="applyDateRange" noStyle>
                <RangePicker />
              </Form.Item>
            </label>
          </div>
          <div className="product-archive-query-actions admin-order-filter-actions admin-after-sale-filter-actions">
            <Button type="primary" htmlType="submit">查询</Button>
            <Button onClick={resetFilters}>重置</Button>
          </div>
        </Form>
      </Card>

      <Card className="admin-order-card admin-order-table-card">
        <div className="admin-order-list-table product-archive-table anchored-pagination-table">
          <AdminTable
            loading={listLoading}
            rowKey="id"
            dataSource={rows}
            columns={columns}
            scroll={{ x: "max-content", y: "100%" }}
            locale={{ emptyText: <Empty description="暂无售后" /> }}
            pagination={{
              className: "product-archive-pagination",
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (value: number) => `共 ${value} 条`,
              onChange: (nextPage: number, nextPageSize: number) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }
            }}
          />
        </div>
      </Card>

      <Modal
        title={operation ? operationTitle(operation.type) : ""}
        open={Boolean(operation)}
        onCancel={() => setOperation(null)}
        onOk={submitOperation}
        confirmLoading={submitting}
        okText="确认"
        cancelText="取消"
        destroyOnClose
      >
        <AfterSaleOperationForm
          form={operationForm}
          operation={operation}
          reviewAction={reviewAction}
          reviewProcessType={reviewProcessType}
          receiveResult={receiveResult}
        />
      </Modal>
    </div>
  );
}

function AfterSaleOperationForm({ form, operation, reviewAction, reviewProcessType, receiveResult }: any) {
  if (!operation) return null;
  const item = operation.item || {};
  if (operation.type === "review") {
    const maxAmount = Math.min(Number(item.applyAmount || 0), Number(item.refundableAmount || item.applyAmount || 0));
    return (
      <Form form={form} layout="vertical">
        <Form.Item name="action" label="审核结果" rules={[{ required: true }]}>
          <Radio.Group optionType="button" buttonStyle="solid" options={[{ value: "APPROVE", label: "审核通过" }, { value: "REJECT", label: "审核拒绝" }]} />
        </Form.Item>
        {reviewAction === "REJECT" ? (
          <>
            <Form.Item name="rejectReason" label="拒绝原因" rules={[{ required: true, message: "请输入拒绝原因" }]}><Input.TextArea rows={3} maxLength={300} /></Form.Item>
            <Form.Item name="remark" label="审核备注"><Input.TextArea rows={3} maxLength={300} /></Form.Item>
          </>
        ) : (
          <>
            <Form.Item name="processType" label="处理方式" rules={[{ required: true }]}>
              <Radio.Group optionType="button" buttonStyle="solid" options={afterSaleTypeOptions} />
            </Form.Item>
            <Form.Item name="approvedAmount" label="同意退款金额" rules={[{ required: true }, { type: "number", min: 0.01, max: maxAmount, message: `金额不能超过 ${formatOrderMoney(maxAmount)}` }]}>
              <InputNumber min={0.01} max={maxAmount} precision={2} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label="是否需要退货"><Input disabled value={reviewProcessType === "RETURN_REFUND" ? "是" : "否"} /></Form.Item>
            {reviewProcessType === "RETURN_REFUND" ? (
              <Form.Item name="returnAddress" label="退货地址" rules={[{ required: true, message: "请输入退货地址" }]}><Input.TextArea rows={2} maxLength={500} /></Form.Item>
            ) : null}
            <Form.Item name="remark" label="审核备注"><Input.TextArea rows={3} maxLength={300} /></Form.Item>
          </>
        )}
      </Form>
    );
  }
  if (operation.type === "receive") {
    const maxQuantity = Number(item.applyQuantity || item.quantity || 1);
    return (
      <Form form={form} layout="vertical">
        <Form.Item name="receivedQuantity" label="实收数量" rules={[{ required: true }, { type: "number", min: 1, max: maxQuantity, message: `不能大于申请数量 ${maxQuantity}` }]}>
          <InputNumber min={1} max={maxQuantity} precision={0} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="receiveResult" label="收货结果" rules={[{ required: true }]}>
          <Radio.Group optionType="button" buttonStyle="solid" options={[{ value: "NORMAL", label: "正常" }, { value: "ABNORMAL", label: "异常" }]} />
        </Form.Item>
        {receiveResult === "ABNORMAL" ? <Form.Item name="abnormalReason" label="异常说明" rules={[{ required: true, message: "请输入异常说明" }]}><Input.TextArea rows={3} maxLength={300} /></Form.Item> : null}
        <Form.Item name="returnToStock" label="是否入库" valuePropName="checked"><Switch checkedChildren="是" unCheckedChildren="否" /></Form.Item>
        <Form.Item name="remark" label="备注"><Input.TextArea rows={3} maxLength={300} /></Form.Item>
      </Form>
    );
  }
  if (operation.type === "refund") {
    const maxAmount = Math.min(Number(item.approvedAmount ?? item.applyAmount ?? 0), Number(item.refundableAmount ?? item.applyAmount ?? 0));
    return (
      <Form form={form} layout="vertical">
        <Form.Item name="refundMethod" label="退款方式" rules={[{ required: true }]}>
          <Select options={[{ value: "MANUAL", label: "手动确认" }, { value: "OFFLINE_TRANSFER", label: "线下转账" }, { value: "ORIGINAL", label: "原路退回" }]} />
        </Form.Item>
        <Form.Item name="refundAmount" label="退款金额" rules={[{ required: true }, { type: "number", min: 0.01, max: maxAmount, message: `金额不能超过 ${formatOrderMoney(maxAmount)}` }]}>
          <InputNumber min={0.01} max={maxAmount} precision={2} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="refundNo" label="退款流水号"><Input maxLength={80} /></Form.Item>
        <Form.Item name="remark" label="退款备注"><Input.TextArea rows={3} maxLength={300} /></Form.Item>
      </Form>
    );
  }
  return (
    <Form form={form} layout="vertical">
      <Form.Item name="reason" label="关闭原因" rules={[{ required: true, message: "请输入关闭原因" }]}><Input.TextArea rows={3} maxLength={300} /></Form.Item>
    </Form>
  );
}

function AfterSaleActionButtons({ item, onDetail, onOperation }: { item: AnyRecord; onDetail: () => void; onOperation: (type: any, item: AnyRecord) => void }) {
  const status = normalizeAfterSaleStatusValue(item.afterSaleStatus || item.status);
  const buttons = [<Button key="detail" type="link" onClick={onDetail}>详情</Button>];
  if (status === "PENDING_REVIEW") buttons.push(<Button key="review" type="link" onClick={() => onOperation("review", item)}>审核</Button>);
  if (status === "WAIT_BUYER_RETURN") buttons.push(<Button key="close" type="link" danger onClick={() => onOperation("close", item)}>关闭</Button>);
  if (status === "WAIT_SELLER_RECEIVE") buttons.push(<Button key="receive" type="link" onClick={() => onOperation("receive", item)}>确认收货</Button>);
  if (status === "WAIT_REFUND") buttons.push(<Button key="refund" type="link" onClick={() => onOperation("refund", item)}>确认退款</Button>);
  return <Space className="admin-order-action-links" size={4}>{buttons}</Space>;
}

function openAfterSaleDetail(ctx: Ctx, id: any, onRefresh: () => void, onOperation: (type: any, item: AnyRecord) => void) {
  ctx.setDrawer({
    title: "售后详情",
    width: 1120,
    className: "admin-order-detail-drawer admin-after-sale-detail-drawer",
    body: <AfterSaleDetailPanel ctx={ctx} id={id} onRefresh={onRefresh} onOperation={onOperation} />
  });
}

function AfterSaleDetailPanel({ ctx, id, onRefresh, onOperation }: { ctx: Ctx; id: any; onRefresh: () => void; onOperation: (type: any, item: AnyRecord) => void }) {
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const loadDetail = async () => {
    setLoading(true);
    try {
      setDetail(await request(`/api/admin/after-sales/${id}`));
    } catch (error: any) {
      ctx.message.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadDetail();
  }, [id]);
  if (loading && !detail) return <Card loading />;
  if (!detail) return <Empty description="暂无售后详情" />;
  const progress = Array.isArray(detail.progress) ? detail.progress : [];
  const order = detail.order || {};
  const product = detail.product || {};
  const application = detail.application || {};
  const audit = detail.audit || {};
  const logistics = Array.isArray(detail.returnLogistics) ? detail.returnLogistics : [];
  const refund = detail.refund || {};
  const invoiceImpact = detail.invoiceImpact || {};
  const inventoryImpact = detail.inventoryImpact || {};
  const logs = Array.isArray(detail.logs) ? detail.logs : [];
  const credentials = Array.isArray(application.credentials) ? application.credentials : [];
  const progressActions = <AfterSaleDetailActions detail={detail} onOperation={type => onOperation(type, detail)} />;
  return (
    <div className="admin-order-detail admin-after-sale-detail">
      <Card title="售后进度" extra={progressActions} className="admin-order-detail-card">
        <div className="admin-order-progress admin-after-sale-progress">
          {progress.map((step: AnyRecord, index: number) => (
            <div key={`${step.key || step.title}-${index}`} className={`admin-order-progress-step ${step.nodeStatus === "DONE" ? "is-done" : ""} ${step.nodeStatus === "CURRENT" ? "is-current" : ""} ${step.nodeStatus === "ABNORMAL" ? "is-abnormal" : ""}`}>
              <span>{step.nodeStatus === "DONE" ? <CheckOutlined /> : index + 1}</span>
              <strong>{emptyText(step.title)}</strong>
              <small>{dateText(step.time)}</small>
            </div>
          ))}
        </div>
      </Card>

      <div className="admin-order-detail-grid">
        <Card title="售后基本信息" className="admin-order-detail-card">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="售后单号">{emptyText(detail.afterSaleNo)}</Descriptions.Item>
            <Descriptions.Item label="售后类型">{afterSaleTypeText(detail.afterSaleType)}</Descriptions.Item>
            <Descriptions.Item label="售后状态"><AfterSaleStatusTag value={detail.afterSaleStatus} /></Descriptions.Item>
            <Descriptions.Item label="退款状态"><RefundStatusTag value={detail.refundStatus} /></Descriptions.Item>
            <Descriptions.Item label="申请时间">{dateText(detail.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="售后期截止时间">{dateText(detail.afterSaleDeadlineAt)}</Descriptions.Item>
            <Descriptions.Item label="是否超出售后期">{detail.timeout ? <Tag color="red">是</Tag> : <Tag>否</Tag>}</Descriptions.Item>
            <Descriptions.Item label="处理人">{emptyText(detail.reviewerName || detail.refundOperatorName || detail.closedBy)}</Descriptions.Item>
            <Descriptions.Item label="处理时间">{dateText(detail.reviewedAt || detail.refundedAt || detail.closedAt)}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card title="订单信息" className="admin-order-detail-card">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="订单编号">{emptyText(order.orderNo || detail.orderNo)}</Descriptions.Item>
            <Descriptions.Item label="订单状态"><AfterSaleOrderStatusTag value={order.orderStatus || detail.orderStatus} /></Descriptions.Item>
            <Descriptions.Item label="支付状态"><OrderStatusTag type="payment" value={order.paymentStatus || detail.paymentStatus} /></Descriptions.Item>
            <Descriptions.Item label="发货状态"><OrderStatusTag type="fulfillment" value={order.fulfillmentStatus || detail.fulfillmentStatus} /></Descriptions.Item>
            <Descriptions.Item label="订单金额">{formatOrderMoney(order.orderAmount || detail.orderAmount)}</Descriptions.Item>
            <Descriptions.Item label="实付金额">{formatOrderMoney(order.paidAmount || detail.orderAmount)}</Descriptions.Item>
            <Descriptions.Item label="已退款金额">{formatOrderMoney(order.refundedAmount)}</Descriptions.Item>
            <Descriptions.Item label="可退金额">{formatOrderMoney(order.refundableAmount || detail.refundableAmount)}</Descriptions.Item>
            <Descriptions.Item label="开票状态"><OrderStatusTag type="invoice" value={order.invoiceStatus || "NONE"} /></Descriptions.Item>
          </Descriptions>
        </Card>
      </div>

      <Card title="商品信息" className="admin-order-detail-card">
        <AdminTable
          rowKey="productId"
          dataSource={[product]}
          pagination={false}
          columns={[
            { title: "商品", width: 260, render: (_, row) => <div className="admin-order-product-cell"><OrderImage src={row.productImage} /><div><strong>{emptyText(row.productName)}</strong><span>{emptyText(row.skuName)}</span></div></div> },
            { title: "SKU编码", dataIndex: "skuCode", render: emptyText },
            { title: "购买数量", dataIndex: "purchaseQuantity", align: "right", render: numberText },
            { title: "已发数量", dataIndex: "shippedQuantity", align: "right", render: numberText },
            { title: "已售后数量", dataIndex: "afterSaleQuantity", align: "right", render: numberText },
            { title: "本次申请数量", dataIndex: "applyQuantity", align: "right", render: numberText },
            { title: "单价", dataIndex: "unitPrice", align: "right", render: formatOrderMoney },
            { title: "本次申请金额", dataIndex: "applyAmount", align: "right", render: formatOrderMoney }
          ]}
        />
      </Card>

      <div className="admin-order-detail-grid">
        <Card title="买家申请信息" className="admin-order-detail-card">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="申请原因">{emptyText(application.reason || detail.reason)}</Descriptions.Item>
            <Descriptions.Item label="问题描述">{emptyText(application.description || detail.description)}</Descriptions.Item>
            <Descriptions.Item label="申请数量">{numberText(application.applyQuantity || detail.applyQuantity)}</Descriptions.Item>
            <Descriptions.Item label="申请金额">{formatOrderMoney(application.applyAmount || detail.applyAmount)}</Descriptions.Item>
            <Descriptions.Item label="买家凭证">
              {credentials.length ? (
                <Image.PreviewGroup>{credentials.map((url: string, index: number) => <Image key={`${url}-${index}`} width={64} height={64} src={url} />)}</Image.PreviewGroup>
              ) : "买家未上传凭证"}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <Card title="审核信息" className="admin-order-detail-card">
          {audit.emptyText ? <Empty description={audit.emptyText} /> : (
            <Descriptions column={1} size="small">
              <Descriptions.Item label="审核结果">{audit.reviewResult === "REJECT" ? "拒绝" : "通过"}</Descriptions.Item>
              <Descriptions.Item label="处理方式">{afterSaleTypeText(audit.processType)}</Descriptions.Item>
              <Descriptions.Item label="同意退款金额">{formatOrderMoney(audit.approvedAmount)}</Descriptions.Item>
              <Descriptions.Item label="是否需要退货">{audit.needReturn ? "是" : "否"}</Descriptions.Item>
              <Descriptions.Item label="退货地址">{emptyText(audit.returnAddress)}</Descriptions.Item>
              <Descriptions.Item label="拒绝原因">{emptyText(audit.rejectReason)}</Descriptions.Item>
              <Descriptions.Item label="审核备注">{emptyText(audit.remark)}</Descriptions.Item>
              <Descriptions.Item label="审核人">{emptyText(audit.operatorName)}</Descriptions.Item>
              <Descriptions.Item label="审核时间">{dateText(audit.reviewedAt)}</Descriptions.Item>
            </Descriptions>
          )}
        </Card>
      </div>

      <div className="admin-order-detail-grid">
        <Card title="退货物流信息" className="admin-order-detail-card">
          {logistics.length ? <AdminTable rowKey="id" dataSource={logistics} pagination={false} columns={[
            { title: "物流公司", dataIndex: "logisticsCompany", render: emptyText },
            { title: "物流单号", dataIndex: "logisticsNo", render: emptyText },
            { title: "买家发货时间", dataIndex: "returnShippedAt", render: dateText },
            { title: "备注", dataIndex: "returnRemark", render: compactText }
          ]} /> : <Empty description="暂无退货物流信息" />}
          <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="商家确认收货时间">{dateText(detail.receivedAt)}</Descriptions.Item>
            <Descriptions.Item label="实收数量">{numberText(detail.receivedQuantity)}</Descriptions.Item>
            <Descriptions.Item label="收货结果">{emptyText(detail.receiveResult)}</Descriptions.Item>
            <Descriptions.Item label="异常说明">{emptyText(detail.abnormalReason)}</Descriptions.Item>
            <Descriptions.Item label="是否入库">{detail.returnToStock ? "是" : "否"}</Descriptions.Item>
            <Descriptions.Item label="收货备注">{emptyText(detail.receiveRemark)}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card title="退款信息" className="admin-order-detail-card">
          {refund.emptyText ? <Empty description={refund.emptyText} /> : (
            <Descriptions column={1} size="small">
              <Descriptions.Item label="退款状态"><RefundStatusTag value={refund.refundStatus} /></Descriptions.Item>
              <Descriptions.Item label="退款方式">{refundMethodText(refund.refundMethod)}</Descriptions.Item>
              <Descriptions.Item label="退款金额">{formatOrderMoney(refund.refundAmount)}</Descriptions.Item>
              <Descriptions.Item label="退款时间">{dateText(refund.refundedAt)}</Descriptions.Item>
              <Descriptions.Item label="退款流水号">{emptyText(refund.refundNo)}</Descriptions.Item>
              <Descriptions.Item label="退款操作人">{emptyText(refund.operatorName)}</Descriptions.Item>
              <Descriptions.Item label="退款备注">{emptyText(refund.remark)}</Descriptions.Item>
              <Descriptions.Item label="失败原因">{emptyText(refund.failedReason)}</Descriptions.Item>
            </Descriptions>
          )}
        </Card>
      </div>

      <div className="admin-order-detail-grid">
        <Card title="发票影响" className="admin-order-detail-card">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="开票状态"><OrderStatusTag type="invoice" value={invoiceImpact.invoiceStatus || "NONE"} /></Descriptions.Item>
            <Descriptions.Item label="原可开票金额">{formatOrderMoney(invoiceImpact.originalInvoiceableAmount)}</Descriptions.Item>
            <Descriptions.Item label="退款后可开票金额">{formatOrderMoney(invoiceImpact.invoiceableAmount)}</Descriptions.Item>
            <Descriptions.Item label="售后中是否禁止开票">{invoiceImpact.forbidInvoice ? "是" : "否"}</Descriptions.Item>
            <Descriptions.Item label="提示">{emptyText(invoiceImpact.tip)}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card title="库存影响" className="admin-order-detail-card">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="是否需要退货入库">{inventoryImpact.needReturnInbound ? "是" : "否"}</Descriptions.Item>
            <Descriptions.Item label="入库数量">{numberText(inventoryImpact.inboundQuantity)}</Descriptions.Item>
            <Descriptions.Item label="入库时间">{dateText(inventoryImpact.inboundTime)}</Descriptions.Item>
            <Descriptions.Item label="关联库存流水号/记录">{emptyText(inventoryImpact.relatedBizNo)}</Descriptions.Item>
            <Descriptions.Item label="备注">{emptyText(inventoryImpact.remark)}</Descriptions.Item>
          </Descriptions>
        </Card>
      </div>

      <Card title="操作日志" className="admin-order-detail-card">
        <AdminTable
          rowKey="id"
          dataSource={logs}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无操作日志" /> }}
          columns={[
            { title: "时间", dataIndex: "createdAt", render: dateText },
            { title: "操作人", dataIndex: "operatorName", render: emptyText },
            { title: "操作类型", dataIndex: "operationType", render: emptyText },
            { title: "操作内容", dataIndex: "operationContent", render: compactText }
          ]}
        />
      </Card>
    </div>
  );
}

function AfterSaleDetailActions({ detail, onOperation }: { detail: AnyRecord; onOperation: (type: any) => void }) {
  const status = normalizeAfterSaleStatusValue(detail.afterSaleStatus);
  if (status === "PENDING_REVIEW") return <Space><Button type="primary" onClick={() => onOperation("review")}>审核通过 / 拒绝</Button></Space>;
  if (status === "WAIT_BUYER_RETURN") return <Space><Button danger onClick={() => onOperation("close")}>关闭售后</Button></Space>;
  if (status === "WAIT_SELLER_RECEIVE") return <Space><Button type="primary" onClick={() => onOperation("receive")}>确认收到退货</Button></Space>;
  if (status === "WAIT_REFUND") return <Space><Button type="primary" onClick={() => onOperation("refund")}>确认退款</Button></Space>;
  return null;
}

function normalizeAfterSaleStatusValue(value: any) {
  const key = String(value || "").toUpperCase();
  if (key === "WAIT_AUDIT") return "PENDING_REVIEW";
  if (key === "WAIT_RETURN_RECEIVE") return "WAIT_SELLER_RECEIVE";
  if (key === "CANCELLED" || key === "CANCELED") return "CLOSED";
  return key || "PENDING_REVIEW";
}

function AfterSaleStatusTag({ value }: { value: any }) {
  const map: AnyRecord = {
    PENDING_REVIEW: ["待审核", "orange"],
    WAIT_BUYER_RETURN: ["待买家退货", "blue"],
    WAIT_SELLER_RECEIVE: ["待商家收货", "purple"],
    WAIT_REFUND: ["待退款", "red"],
    COMPLETED: ["已完成", "green"],
    REJECTED: ["已拒绝", "default"],
    CLOSED: ["已关闭", "default"]
  };
  const matched = map[normalizeAfterSaleStatusValue(value)];
  return <Tag color={matched?.[1] || "default"}>{matched?.[0] || emptyText(value)}</Tag>;
}

function RefundStatusTag({ value }: { value: any }) {
  const key = String(value || "NOT_REFUNDED").toUpperCase() === "SUCCESS" ? "REFUNDED" : String(value || "NOT_REFUNDED").toUpperCase();
  const map: AnyRecord = {
    NOT_REFUNDED: ["未退款", "default"],
    WAIT_REFUND: ["待退款", "orange"],
    REFUNDED: ["已退款", "green"],
    REFUND_FAILED: ["退款失败", "red"]
  };
  const matched = map[key];
  return <Tag color={matched?.[1] || "default"}>{matched?.[0] || emptyText(value)}</Tag>;
}

function afterSaleTypeText(value: any) {
  const key = String(value || "").toUpperCase();
  if (key === "REFUND_ONLY" || key === "ONLY_REFUND") return "仅退款";
  if (key === "RETURN_REFUND") return "退货退款";
  return emptyText(value);
}

function refundMethodText(value: any) {
  const key = String(value || "").toUpperCase();
  if (key === "MANUAL") return "手动确认";
  if (key === "OFFLINE_TRANSFER") return "线下转账";
  if (key === "ORIGINAL") return "原路退回";
  return emptyText(value);
}

function AfterSaleOrderStatusTag({ value }: { value: any }) {
  return <OrderStatusTag type="order" value={resolveOrderWorkflowKey({ orderStatus: value })} />;
}

function operationTitle(type: string) {
  return ({ review: "售后审核", receive: "确认收到退货", refund: "确认退款", close: "关闭售后" } as AnyRecord)[type] || "售后操作";
}

function operationSuccessText(type: string) {
  return ({ review: "售后审核已处理", receive: "退货收货已确认", refund: "退款已确认", close: "售后已关闭" } as AnyRecord)[type] || "操作成功";
}

const invoiceStatusTabs = [
  { key: "ALL", label: "全部" },
  { key: "PENDING_INVOICE", label: "待开票" },
  { key: "INVOICED", label: "已开票" },
  { key: "REJECTED", label: "已驳回" },
  { key: "CANCELLED", label: "已撤销" }
];

const invoiceTypeOptions = [
  { value: "", label: "全部" },
  { value: "ELECTRONIC_NORMAL", label: "电子普通发票" },
  { value: "ELECTRONIC_VAT_SPECIAL", label: "电子增值税专用发票" }
];

function InvoicePage({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const [form] = Form.useForm();
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState("ALL");
  const [query, setQuery] = useState<AnyRecord>({});
  const [listLoading, setListLoading] = useState(false);

  const load = async (next: AnyRecord = {}) => {
    const finalPage = next.page ?? page;
    const finalPageSize = next.pageSize ?? pageSize;
    const finalTab = next.tab ?? activeTab;
    const finalQuery = next.query ?? query;
    setListLoading(true);
    try {
      const params = normalizeInvoiceQueryParams({ ...finalQuery, page: finalPage, pageSize: finalPageSize, tab: finalTab });
      const result = await request<AnyRecord>("/api/admin/invoices", { params });
      setRows(Array.isArray(result?.list) ? result.list : []);
      setTotal(Number(result?.total || 0));
      setPage(Number(result?.page || finalPage));
      setPageSize(Number(result?.pageSize || finalPageSize));
      setActiveTab(finalTab);
      setQuery(finalQuery);
    } catch (error: any) {
      ctx.message.error(error.message);
      setRows([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void load({ page: 1 });
  }, []);

  const onSearch = async () => {
    const values = form.getFieldsValue();
    await load({ page: 1, query: values });
  };

  const onReset = async () => {
    form.resetFields();
    await load({ page: 1, query: {} });
  };

  const columns: ColumnsType<AnyRecord> = [
    { title: "申请单信息", width: 170, render: (_, item) => <div className="admin-order-primary"><strong>{emptyText(item.invoiceApplyNo)}</strong><span>{dateText(item.applyTime || item.createdAt)}</span></div> },
    { title: "订单信息", width: 180, render: (_, item) => <InvoiceOrderStatusLine item={item} /> },
    { title: "买家信息", width: 150, render: (_, item) => <div className="admin-order-buyer-cell"><strong>{emptyText(item.customerName || item.buyerName)}</strong><span>{emptyText(item.customerPhone || item.customerAccount)}</span></div> },
    { title: "发票抬头", width: 210, render: (_, item) => <div className="admin-order-primary"><strong>{emptyText(item.invoiceTitle || item.title)}</strong><span>{emptyText(item.taxpayerNo || item.taxNo)}</span></div> },
    { title: "发票类型", width: 150, dataIndex: "invoiceType", render: invoiceTypeText },
    { title: "金额信息", width: 190, align: "right", render: (_, item) => <div className="admin-stack-cell admin-money-cell"><span>申请 {formatOrderMoney(item.applyAmount)}</span><span>可开 {formatOrderMoney(item.availableInvoiceAmount)}</span><span>已开 {formatOrderMoney(item.invoicedAmount)}</span></div> },
    { title: "开票超时", width: 140, render: (_, item) => <div className="admin-stack-cell"><span>{dateText(item.invoiceTimeoutDate).slice(0, 10)}</span><InvoiceTimeoutTag value={item.timeoutText} invoiceStatus={item.invoiceStatus || item.status} /></div> },
    { title: "售后状态", width: 110, dataIndex: "afterSaleStatus", render: value => <AfterSaleInvoiceTag value={value} /> },
    { title: "开票状态", width: 110, dataIndex: "invoiceStatus", render: value => <InvoiceStatusTag value={value} /> },
    { title: "发票文件", width: 90, align: "right", dataIndex: "uploadedFileCount", render: numberText },
    {
      title: "操作",
      width: 260,
      align: "center",
      fixed: "right",
      className: "admin-order-action-shadow",
      onHeaderCell: () => ({ className: "admin-order-action-shadow", width: 260 }),
      render: (_, item) => <InvoiceActionButtons ctx={ctx} item={item} onReload={() => load()} />
    }
  ];

  return (
    <div className="admin-order-workbench admin-invoice-workbench">
      <Card className="admin-order-card admin-order-filter-card" bodyStyle={{ paddingBottom: 0 }}>
        <Tabs
          className="admin-order-status-tabs"
          activeKey={activeTab}
          items={invoiceStatusTabs}
          onChange={key => void load({ page: 1, tab: key })}
        />

        <Form form={form} className="admin-order-filters product-archive-filters admin-invoice-filters" onFinish={onSearch}>
          <div className="product-archive-filter-stack">
            <label className="product-archive-filter-keyword">
              <span>关键词</span>
              <Form.Item name="keyword" noStyle>
                <Input className="product-archive-keyword-search" allowClear placeholder="开票申请单号 / 订单编号 / 买家名称 / 发票抬头 / 税号" />
              </Form.Item>
            </label>
            <label>
              <span>申请时间</span>
              <Form.Item name="applyRange" noStyle>
                <RangePicker placeholder={["开始", "结束"]} />
              </Form.Item>
            </label>
          </div>
          <div className="product-archive-filter-stack">
            <label>
              <span>发票类型</span>
              <Form.Item name="invoiceType" noStyle>
                <Select options={invoiceTypeOptions} placeholder="全部" allowClear />
              </Form.Item>
            </label>
            <label>
              <span>订单状态</span>
              <Form.Item name="orderStatus" noStyle>
                <Select options={[{ value: "", label: "全部" }, { value: "COMPLETED", label: "已完成" }, { value: "REFUNDED", label: "已退款" }, { value: "PART_REFUNDED", label: "部分退款" }]} placeholder="全部" allowClear />
              </Form.Item>
            </label>
          </div>
          <div className="product-archive-filter-stack">
            <label>
              <span>开票状态</span>
              <Form.Item name="invoiceStatus" noStyle>
                <Select options={invoiceStatusTabs.map(x => ({ value: x.key === "ALL" ? "" : x.key, label: x.label }))} placeholder="全部" allowClear />
              </Form.Item>
            </label>
            <label>
              <span>售后状态</span>
              <Form.Item name="afterSaleStatus" noStyle>
                <Select options={[{ value: "", label: "全部" }, { value: "NONE", label: "无售后" }, { value: "PROCESSING", label: "售后中" }, { value: "COMPLETED", label: "售后完成" }]} placeholder="全部" allowClear />
              </Form.Item>
            </label>
          </div>
          <div className="product-archive-filter-stack">
            <label>
              <span>是否上传发票</span>
              <Form.Item name="uploadedOnly" noStyle>
                <Select options={[{ value: "", label: "全部" }, { value: true, label: "是" }, { value: false, label: "否" }]} placeholder="全部" allowClear />
              </Form.Item>
            </label>
            <label>
              <span>超时时间</span>
              <Form.Item name="timeoutRange" noStyle>
                <RangePicker placeholder={["开始", "结束"]} />
              </Form.Item>
            </label>
          </div>
          <div className="product-archive-query-actions admin-order-filter-actions admin-invoice-filter-actions">
            <Button type="primary" htmlType="submit">查询</Button>
            <Button onClick={onReset}>重置</Button>
          </div>
        </Form>
      </Card>

      <Card className="admin-order-card admin-order-table-card">
        <div className="admin-order-list-table admin-invoice-list-table product-archive-table anchored-pagination-table">
          <AdminTable
            loading={loading || listLoading}
            rowKey="id"
            dataSource={rows}
            columns={columns}
            scroll={{ x: "max-content", y: "100%" }}
            locale={{ emptyText: <Empty description="暂无数据" /> }}
            pagination={{
              className: "product-archive-pagination",
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (count: number) => `共 ${count} 条`,
              onChange: (nextPage: number, nextSize: number) => void load({ page: nextPage, pageSize: nextSize })
            }}
          />
        </div>
      </Card>
    </div>
  );
}

function InvoiceOrderStatusLine({ item }: { item: AnyRecord }) {
  const paymentStatus = invoicePaymentStatusValue(item);
  return (
    <div className="admin-order-primary">
      <strong>{emptyText(item.orderNo)}</strong>
      <span>
        <OrderStatusTag type="order" value={resolveOrderWorkflowKey(item)} />
        {paymentStatus ? <OrderStatusTag type="payment" value={paymentStatus} /> : null}
      </span>
    </div>
  );
}

function invoicePaymentStatusValue(item: AnyRecord) {
  const candidates = [
    item.paymentStatus,
    item.payStatus,
    item.orderPaymentStatus,
    item.refundStatus
  ];
  return candidates.find(value => ["UNPAID", "PAID", "REFUNDED", "PART_REFUNDED", "PARTIAL_REFUNDED", "NOT_REQUIRED_BEFORE_RECEIPT"].includes(String(value || "").toUpperCase()));
}

function normalizeInvoiceQueryParams(values: AnyRecord) {
  const [applyStart, applyEnd] = values.applyRange || [];
  const [timeoutStart, timeoutEnd] = values.timeoutRange || [];
  const params: AnyRecord = {
    page: values.page,
    pageSize: values.pageSize,
    tab: values.tab === "ALL" ? undefined : values.tab,
    keyword: values.keyword,
    invoiceType: values.invoiceType,
    invoiceStatus: values.invoiceStatus,
    orderStatus: values.orderStatus,
    afterSaleStatus: values.afterSaleStatus,
    uploadedOnly: values.uploadedOnly,
    applyStartDate: applyStart?.format?.("YYYY-MM-DD"),
    applyEndDate: applyEnd?.format?.("YYYY-MM-DD"),
    timeoutStartDate: timeoutStart?.format?.("YYYY-MM-DD"),
    timeoutEndDate: timeoutEnd?.format?.("YYYY-MM-DD")
  };
  Object.keys(params).forEach(key => (params[key] === "" || params[key] === undefined || params[key] === null) && delete params[key]);
  return params;
}

function InvoiceActionButtons({ ctx, item, onReload }: { ctx: Ctx; item: AnyRecord; onReload: () => void }) {
  const status = normalizeInvoiceStatusValue(item.invoiceStatus || item.status);
  const hasFiles = Number(item.uploadedFileCount || 0) > 0;
  const buttons = [<Button key="detail" type="link" onClick={() => openInvoiceDetail(ctx, item.id, onReload)}>详情</Button>];
  if (status === "PENDING_INVOICE") {
    buttons.push(<Button key="upload" type="link" onClick={() => invoiceUploadModal(ctx, item.id, onReload)}>{hasFiles ? "继续上传" : "上传发票"}</Button>);
    buttons.push(<Button key="confirm" type="link" onClick={() => confirmInvoiceApply(ctx, item.id, onReload)}>确认开票</Button>);
    buttons.push(<Button key="reject" type="link" danger onClick={() => rejectInvoiceModal(ctx, item.id, onReload)}>驳回</Button>);
  }
  if (status === "INVOICED") {
    buttons.push(<Button key="preview" type="link" disabled={!hasFiles} onClick={() => openInvoiceDetail(ctx, item.id, onReload)}>预览</Button>);
    buttons.push(<Button key="download" type="link" disabled={!hasFiles} onClick={() => openInvoiceDetail(ctx, item.id, onReload)}>下载</Button>);
  }
  return <Space className="admin-order-action-links admin-invoice-action-links" size={12}>{buttons}</Space>;
}

function openInvoiceDetail(ctx: Ctx, id: any, onReload: () => void) {
  ctx.setDrawer({
    title: "开票详情",
    width: "min(1280px, 96vw)",
    className: "admin-order-detail-drawer admin-invoice-detail-drawer",
    body: <InvoiceDetailPanel ctx={ctx} id={id} onReload={onReload} />
  });
}

function InvoiceDetailPanel({ ctx, id, onReload }: { ctx: Ctx; id: any; onReload: () => void }) {
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const loadDetail = async () => {
    setLoading(true);
    try {
      setDetail(await request(`/api/admin/invoices/${id}`));
    } catch (error: any) {
      ctx.message.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadDetail(); }, [id]);
  if (loading && !detail) return <Card loading />;
  if (!detail) return <Empty description="暂无开票详情" />;
  const files = Array.isArray(detail.files) ? detail.files : [];
  const logs = invoiceOperationLogs(Array.isArray(detail.logs) ? detail.logs : [], detail);
  const progress = Array.isArray(detail.progress) ? detail.progress : [];
  const status = normalizeInvoiceStatusValue(detail.invoiceStatus || detail.status);
  const actions = <InvoiceDetailActions ctx={ctx} detail={detail} onChanged={async () => { await loadDetail(); onReload(); }} />;
  return (
    <div className="admin-order-detail admin-invoice-detail">
      <Card title="开票进度" extra={actions} className="admin-order-detail-card">
        <div className="admin-order-progress">
          {progress.map((step: AnyRecord, index: number) => (
            <div key={`${step.key || step.title}-${index}`} className={`admin-order-progress-step ${step.nodeStatus === "DONE" ? "is-done" : ""} ${step.nodeStatus === "CURRENT" ? "is-current" : ""} ${step.nodeStatus === "ABNORMAL" ? "is-abnormal" : ""}`}>
              <span>{step.nodeStatus === "DONE" ? <CheckOutlined /> : index + 1}</span><strong>{emptyText(step.title)}</strong><small>{dateText(step.time)}</small>
            </div>
          ))}
        </div>
      </Card>

      <div className="admin-order-detail-grid">
        <Card title="开票申请信息" className="admin-order-detail-card"><Descriptions column={1} size="small">
          <Descriptions.Item label="开票申请单号">{emptyText(detail.invoiceApplyNo)}</Descriptions.Item>
          <Descriptions.Item label="开票状态"><InvoiceStatusTag value={detail.invoiceStatus} /></Descriptions.Item>
          <Descriptions.Item label="申请时间">{dateText(detail.applyTime || detail.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="申请人">{emptyText(detail.applicantName || detail.customerName)}</Descriptions.Item>
          <Descriptions.Item label="发票类型">{invoiceTypeText(detail.invoiceType)}</Descriptions.Item>
          <Descriptions.Item label="发票类型来源">{invoiceTypeSourceText(detail.invoiceTypeSource)}</Descriptions.Item>
          <Descriptions.Item label="开票申请金额">{formatOrderMoney(detail.applyAmount)}</Descriptions.Item>
          <Descriptions.Item label="买家备注">{emptyText(detail.buyerRemark)}</Descriptions.Item>
          <Descriptions.Item label="后台备注">{emptyText(detail.adminRemark)}</Descriptions.Item>
        </Descriptions></Card>
        <Card title="订单信息" className="admin-order-detail-card"><Descriptions column={1} size="small">
          <Descriptions.Item label="订单编号">{emptyText(detail.orderNo)}</Descriptions.Item>
          <Descriptions.Item label="订单状态"><OrderStatusTag type="order" value={resolveOrderWorkflowKey(detail)} /></Descriptions.Item>
          <Descriptions.Item label="支付状态"><OrderStatusTag type="payment" value={detail.paymentStatus} /></Descriptions.Item>
          <Descriptions.Item label="发货状态"><OrderStatusTag type="fulfillment" value={detail.fulfillmentStatus} /></Descriptions.Item>
          <Descriptions.Item label="退款状态"><RefundStatusTag value={detail.refundStatus} /></Descriptions.Item>
          <Descriptions.Item label="订单实付金额">{formatOrderMoney(Number(detail.applyAmount || 0) + Number(detail.availableInvoiceAmount || 0))}</Descriptions.Item>
          <Descriptions.Item label="已退款金额">{formatOrderMoney(detail.refundedAmount)}</Descriptions.Item>
          <Descriptions.Item label="已开票金额">{formatOrderMoney(detail.invoicedAmount)}</Descriptions.Item>
          <Descriptions.Item label="可开票金额">{formatOrderMoney(detail.availableInvoiceAmount)}</Descriptions.Item>
          <Descriptions.Item label="售后状态"><AfterSaleInvoiceTag value={detail.afterSaleStatus} /></Descriptions.Item>
        </Descriptions></Card>
      </div>

      <div className="admin-order-detail-grid">
        <Card title="买家信息" className="admin-order-detail-card"><Descriptions column={1} size="small">
          <Descriptions.Item label="买家名称">{emptyText(detail.customerName)}</Descriptions.Item>
          <Descriptions.Item label="买家账号">{emptyText(detail.customerAccount)}</Descriptions.Item>
          <Descriptions.Item label="联系人">{emptyText(detail.contactName)}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{emptyText(detail.customerPhone)}</Descriptions.Item>
        </Descriptions></Card>
        <Card title="发票抬头信息" className="admin-order-detail-card"><Descriptions column={1} size="small">
          <Descriptions.Item label={detail.titleType === "PERSONAL" ? "个人名称" : "企业名称"}>{emptyText(detail.invoiceTitle || detail.title)}</Descriptions.Item>
          <Descriptions.Item label="纳税人识别号">{emptyText(detail.taxpayerNo)}</Descriptions.Item>
          <Descriptions.Item label="发票类型">{invoiceTypeText(detail.invoiceType)}</Descriptions.Item>
          <Descriptions.Item label="注册地址">-</Descriptions.Item>
          <Descriptions.Item label="注册电话">-</Descriptions.Item>
          <Descriptions.Item label="开户银行">-</Descriptions.Item>
          <Descriptions.Item label="银行账号">-</Descriptions.Item>
        </Descriptions></Card>
      </div>

      <div className="admin-order-detail-grid">
        <Card title="开票金额信息" className="admin-order-detail-card"><Descriptions column={1} size="small">
          <Descriptions.Item label="订单实付金额">{formatOrderMoney(Number(detail.applyAmount || 0) + Number(detail.availableInvoiceAmount || 0))}</Descriptions.Item>
          <Descriptions.Item label="已退款金额">{formatOrderMoney(detail.refundedAmount)}</Descriptions.Item>
          <Descriptions.Item label="已开票金额">{formatOrderMoney(detail.invoicedAmount)}</Descriptions.Item>
          <Descriptions.Item label="本次申请开票金额">{formatOrderMoney(detail.applyAmount)}</Descriptions.Item>
          <Descriptions.Item label="当前可开票金额">{formatOrderMoney(detail.availableInvoiceAmount)}</Descriptions.Item>
          <Descriptions.Item label="已上传发票金额合计">{formatOrderMoney(detail.uploadedInvoiceAmount)}</Descriptions.Item>
          <Descriptions.Item label="剩余待上传金额">{formatOrderMoney(Math.max(0, Number(detail.applyAmount || 0) - Number(detail.uploadedInvoiceAmount || 0)))}</Descriptions.Item>
        </Descriptions></Card>
        <Card title="售后影响" className="admin-order-detail-card"><Descriptions column={1} size="small">
          <Descriptions.Item label="售后状态"><AfterSaleInvoiceTag value={detail.afterSaleStatus} /></Descriptions.Item>
          <Descriptions.Item label="是否售后中">{detail.afterSaleStatus === "PROCESSING" ? "是" : "否"}</Descriptions.Item>
          <Descriptions.Item label="已退款金额">{formatOrderMoney(detail.refundedAmount)}</Descriptions.Item>
          <Descriptions.Item label="退款后可开票金额">{formatOrderMoney(detail.availableInvoiceAmount)}</Descriptions.Item>
          <Descriptions.Item label="是否禁止开票">{detail.afterSaleStatus === "PROCESSING" || Number(detail.availableInvoiceAmount || 0) <= 0 ? "是" : "否"}</Descriptions.Item>
          <Descriptions.Item label="提示">{invoiceAfterSaleTip(detail)}</Descriptions.Item>
        </Descriptions></Card>
      </div>

      <Card title="发票文件信息" className="admin-order-detail-card">
        <AdminTable rowKey="id" dataSource={files} pagination={false} locale={{ emptyText: <Empty description="暂无发票文件" /> }} columns={[
          { title: "文件名", dataIndex: "fileName", render: emptyText },
          { title: "发票号码", dataIndex: "invoiceNo", render: emptyText },
          { title: "发票代码", dataIndex: "invoiceCode", render: emptyText },
          { title: "开票日期", dataIndex: "invoiceDate", render: value => dateText(value).slice(0, 10) },
          { title: "发票金额", dataIndex: "invoiceAmount", align: "right", render: formatOrderMoney },
          { title: "上传人", dataIndex: "uploadedBy", render: emptyText },
          { title: "上传时间", dataIndex: "createdAt", render: dateText },
          { title: "操作", render: (_, file) => <Space><Button type="link" onClick={() => previewInvoiceFile(file)}>预览</Button><Button type="link" onClick={() => downloadInvoiceFile(file)}>下载</Button>{status === "PENDING_INVOICE" ? <Button type="link" danger onClick={() => deleteInvoiceFile(ctx, file, async () => { await loadDetail(); onReload(); })}>删除</Button> : null}</Space> }
        ]} />
      </Card>

      <div className="admin-order-detail-grid">
        <Card title="超时信息" className="admin-order-detail-card"><Descriptions column={1} size="small">
          <Descriptions.Item label="申请时间">{dateText(detail.applyTime || detail.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="开票超时日期">{dateText(detail.invoiceTimeoutDate).slice(0, 10)}</Descriptions.Item>
          <Descriptions.Item label="超时提示"><InvoiceTimeoutTag value={detail.timeoutText} invoiceStatus={detail.invoiceStatus || detail.status} /></Descriptions.Item>
          <Descriptions.Item label="剩余天数">{invoiceRemainingDays(detail.invoiceTimeoutDate)}</Descriptions.Item>
        </Descriptions></Card>
        <Card title="撤销信息" className="admin-order-detail-card">
          {status === "CANCELLED" ? <Descriptions column={1} size="small">
            <Descriptions.Item label="撤销状态"><InvoiceStatusTag value="CANCELLED" /></Descriptions.Item>
            <Descriptions.Item label="撤销时间">{dateText(detail.cancelledAt)}</Descriptions.Item>
            <Descriptions.Item label="撤销人">{emptyText(detail.cancelledBy)}</Descriptions.Item>
            <Descriptions.Item label="撤销原因 / 备注">{emptyText(detail.cancelledReason)}</Descriptions.Item>
            <Descriptions.Item label="提示">该开票申请已由买家撤销，后台无需处理。</Descriptions.Item>
          </Descriptions> : <Empty description="暂无撤销信息" />}
        </Card>
      </div>

      <Card title="操作日志" className="admin-order-detail-card">
        <AdminTable rowKey="id" dataSource={logs} pagination={false} locale={{ emptyText: <Empty description="暂无操作日志" /> }} columns={[
          { title: "时间", dataIndex: "createdAt", render: dateText },
          { title: "操作人", dataIndex: "operatorName", render: emptyText },
          { title: "操作类型", dataIndex: "operationType", render: emptyText },
          { title: "操作内容", dataIndex: "operationContent", render: compactText }
        ]} />
      </Card>
    </div>
  );
}

function invoiceOperationLogs(logs: AnyRecord[], detail: AnyRecord) {
  const invoiceKeys = [
    detail.id,
    detail.invoiceId,
    detail.invoiceApplyNo
  ].map(value => String(value || "").trim()).filter(Boolean);
  const invoiceWords = ["开票", "发票", "invoice"];
  return logs.filter(log => {
    const fields = [
      log.operationType,
      log.operationContent,
      log.actionType,
      log.actionContent,
      log.bizType,
      log.businessType,
      log.module,
      log.moduleName,
      log.relationType,
      log.relatedBizNo,
      log.bizNo,
      log.targetNo,
      log.remark
    ].map(value => String(value || ""));
    const text = fields.join(" ").toLowerCase();
    if (invoiceWords.some(word => text.includes(word.toLowerCase()))) return true;
    return invoiceKeys.some(key => fields.some(value => value === key));
  });
}

function InvoiceDetailActions({ ctx, detail, onChanged }: { ctx: Ctx; detail: AnyRecord; onChanged: () => void }) {
  const status = normalizeInvoiceStatusValue(detail.invoiceStatus);
  if (status === "PENDING_INVOICE") return <Space><Button onClick={() => invoiceUploadModal(ctx, detail.id, onChanged)}>{Number(detail.uploadedFileCount || 0) > 0 ? "继续上传" : "上传发票"}</Button><Button type="primary" onClick={() => confirmInvoiceApply(ctx, detail.id, onChanged)}>确认开票</Button><Button danger onClick={() => rejectInvoiceModal(ctx, detail.id, onChanged)}>驳回</Button></Space>;
  if (status === "INVOICED") return <Space><Button onClick={() => detail.files?.[0] && previewInvoiceFile(detail.files[0])}>预览发票</Button><Button onClick={() => detail.files?.[0] && downloadInvoiceFile(detail.files[0])}>下载发票</Button></Space>;
  return null;
}

function invoiceUploadModal(ctx: Ctx, id: any, onSuccess: () => void) {
  let modal: any;
  modal = Modal.confirm({ title: "上传发票", icon: null, width: 680, footer: null, content: <InvoiceUploadForm ctx={ctx} invoiceId={id} onSuccess={() => { modal.destroy(); onSuccess(); }} /> });
}

function InvoiceUploadForm({ ctx, invoiceId, onSuccess }: { ctx: Ctx; invoiceId: any; onSuccess: () => void }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  return <Form form={form} layout="vertical" onFinish={async values => {
    const operatorName = currentAdminOperatorName();
    if (!operatorName) return ctx.message.error("无法获取当前操作人，请重新登录");
    const fileList = values.files?.fileList || [];
    const pdfFiles = fileList.map((x: AnyRecord) => x.originFileObj).filter(Boolean);
    if (!pdfFiles.length) return ctx.message.error("请选择 PDF 发票文件");
    const formData = new FormData();
    for (const file of pdfFiles) formData.append("files", file);
    ["invoiceNo", "invoiceCode", "invoiceDate", "invoiceAmount", "remark"].forEach(key => {
      const value = values[key];
      if (value !== undefined && value !== null && value !== "") formData.append(key, key === "invoiceDate" ? value.format("YYYY-MM-DD") : String(value));
    });
    formData.append("operatorName", operatorName);
    setSubmitting(true);
    try {
      await request(`/api/admin/invoices/${invoiceId}/files`, { method: "POST", data: formData });
      ctx.message.success("发票已上传");
      onSuccess();
    } catch (error: any) {
      ctx.message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }}>
    <Form.Item name="files" label="发票文件" rules={[{ required: true, message: "请选择 PDF 发票文件" }]}><Upload.Dragger multiple accept="application/pdf,.pdf" beforeUpload={file => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { ctx.message.error("只能上传 PDF 发票文件"); return Upload.LIST_IGNORE; }
      if (file.size > 10 * 1024 * 1024) { ctx.message.error("单个文件大小不能超过 10MB"); return Upload.LIST_IGNORE; }
      return false;
    }}><p className="ant-upload-drag-icon"><FileTextOutlined /></p></Upload.Dragger></Form.Item>
    <Form.Item name="invoiceNo" label="发票号码"><Input allowClear /></Form.Item>
    <Form.Item name="invoiceCode" label="发票代码"><Input allowClear /></Form.Item>
    <Form.Item name="invoiceAmount" label="发票金额"><InputNumber min={0.01} precision={2} style={{ width: "100%" }} /></Form.Item>
    <Form.Item name="invoiceDate" label="开票日期"><DatePicker style={{ width: "100%" }} /></Form.Item>
    <Form.Item name="remark" label="备注"><Input.TextArea rows={3} /></Form.Item>
    <Space><Button type="primary" htmlType="submit" loading={submitting}>上传</Button><Button onClick={() => Modal.destroyAll()}>取消</Button></Space>
  </Form>;
}

function confirmInvoiceApply(ctx: Ctx, id: any, onSuccess: () => void) {
  const operatorName = currentAdminOperatorName();
  if (!operatorName) return ctx.message.error("无法获取当前操作人，请重新登录");
  Modal.confirm({ title: "确认该申请已完成开票吗？确认后发票文件不可删除。", okText: "确认开票", cancelText: "取消", onOk: async () => {
    try { await request(`/api/admin/invoices/${id}/confirm`, { method: "POST", data: { operatorName, remark: "发票已上传并确认" } }); ctx.message.success("开票已确认"); onSuccess(); }
    catch (error: any) { ctx.message.error(error.message); return Promise.reject(error); }
  }});
}

function rejectInvoiceModal(ctx: Ctx, id: any, onSuccess: () => void) {
  let modal: any;
  modal = Modal.confirm({ title: "驳回申请", icon: null, width: 560, footer: null, content: <InvoiceRejectForm ctx={ctx} invoiceId={id} onSuccess={() => { modal.destroy(); onSuccess(); }} /> });
}

function InvoiceRejectForm({ ctx, invoiceId, onSuccess }: { ctx: Ctx; invoiceId: any; onSuccess: () => void }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  return <Form form={form} layout="vertical" onFinish={async values => {
    const operatorName = currentAdminOperatorName();
    if (!operatorName) return ctx.message.error("无法获取当前操作人，请重新登录");
    setSubmitting(true);
    try { await request(`/api/admin/invoices/${invoiceId}/reject`, { method: "POST", data: { ...values, operatorName } }); ctx.message.success("开票申请已驳回"); onSuccess(); }
    catch (error: any) { ctx.message.error(error.message); }
    finally { setSubmitting(false); }
  }}>
    <Form.Item name="rejectReason" label="驳回原因" rules={[{ required: true }]}><Select options={["订单存在售后处理中", "订单已全额退款", "发票抬头信息不完整", "税号信息错误", "开票金额异常", "其它"].map(value => ({ value, label: value }))} /></Form.Item>
    <Form.Item name="remark" label="备注"><Input.TextArea rows={3} /></Form.Item>
    <Space><Button type="primary" danger htmlType="submit" loading={submitting}>驳回</Button><Button onClick={() => Modal.destroyAll()}>取消</Button></Space>
  </Form>;
}

function deleteInvoiceFile(ctx: Ctx, file: AnyRecord, onSuccess: () => void) {
  const operatorName = currentAdminOperatorName();
  if (!operatorName) return ctx.message.error("无法获取当前操作人，请重新登录");
  Modal.confirm({ title: "确认删除该发票文件吗？", okText: "删除", okButtonProps: { danger: true }, onOk: async () => {
    try { await request(`/api/admin/invoices/files/${file.id}`, { method: "DELETE", data: { operatorName } }); ctx.message.success("发票文件已删除"); onSuccess(); }
    catch (error: any) { ctx.message.error(error.message); return Promise.reject(error); }
  }});
}

function previewInvoiceFile(file: AnyRecord) { window.open(`/api/admin/invoices/files/${file.id}/preview`, "_blank"); }
function downloadInvoiceFile(file: AnyRecord) { window.open(`/api/admin/invoices/files/${file.id}/download`, "_blank"); }

function normalizeInvoiceStatusValue(value: any) {
  const key = String(value || "").toUpperCase();
  if (key === "WAIT_INVOICE" || key === "APPLIED") return "PENDING_INVOICE";
  if (key === "CANCELED") return "CANCELLED";
  return key || "PENDING_INVOICE";
}

function InvoiceStatusTag({ value }: { value: any }) {
  const map: AnyRecord = { PENDING_INVOICE: ["待开票", "orange"], INVOICED: ["已开票", "green"], REJECTED: ["已驳回", "default"], CANCELLED: ["已撤销", "default"] };
  const matched = map[normalizeInvoiceStatusValue(value)];
  return <Tag color={matched?.[1] || "default"}>{matched?.[0] || emptyText(value)}</Tag>;
}

function invoiceTypeSourceText(value: any) {
  const key = String(value || "").toUpperCase();
  if (key === "BUYER_DEFAULT") return "买家默认开票类型";
  if (key === "BUYER_SELECTED") return "买家手动选择";
  return "其它";
}

function InvoiceTimeoutTag({ value, invoiceStatus }: { value: any; invoiceStatus?: any }) {
  if (normalizeInvoiceStatusValue(invoiceStatus) === "INVOICED") return null;
  const map: AnyRecord = { NORMAL: ["正常", "green"], NEARLY_TIMEOUT: ["明日超时", "orange"], OVERDUE: ["逾期未处理", "red"] };
  const key = String(value || "NORMAL").toUpperCase();
  return <Tag color={map[key]?.[1] || "default"}>{map[key]?.[0] || "正常"}</Tag>;
}

function AfterSaleInvoiceTag({ value }: { value: any }) {
  const key = String(value || "NONE").toUpperCase();
  const map: AnyRecord = { NONE: ["无售后", "default"], PROCESSING: ["售后中", "orange"], COMPLETED: ["售后完成", "green"], REFUNDED: ["已退款", "default"] };
  return <Tag color={map[key]?.[1] || "default"}>{map[key]?.[0] || emptyText(value)}</Tag>;
}

function invoiceAfterSaleTip(detail: AnyRecord) {
  if (detail.afterSaleStatus === "PROCESSING") return "该订单存在售后处理中，暂不允许开票。";
  if (detail.afterSaleStatus === "REFUNDED") return "该订单已全额退款，不支持开票。";
  if (Number(detail.refundedAmount || 0) > 0 && normalizeInvoiceStatusValue(detail.invoiceStatus) === "INVOICED") return "已开票订单发生退款，后续需处理红冲。";
  if (Number(detail.refundedAmount || 0) > 0) return `该订单已退款 ${formatOrderMoney(detail.refundedAmount)}，当前可开票金额为 ${formatOrderMoney(detail.availableInvoiceAmount)}。`;
  return "-";
}

function invoiceRemainingDays(value: any) {
  if (!value) return "-";
  const timeout = new Date(String(value).slice(0, 10));
  const today = new Date();
  timeout.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((timeout.getTime() - today.getTime()) / 86400000));
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
  { title: "入库单号", dataIndex: "inboundNo" },
  { title: "供应商", dataIndex: "supplierName" },
  { title: "状态", dataIndex: "status", render: tag },
  { title: "入库日期", dataIndex: "inboundDate", render: dateText }
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
  const [form] = Form.useForm();
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tab, setTab] = useState("ALL");
  const [filters, setFilters] = useState<AnyRecord>({});
  const [tableLoading, setTableLoading] = useState(false);

  const loadBuyers = async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (tab !== "ALL") params.set("tab", tab);
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() && value !== "ALL") {
          params.set(key, String(value).trim());
        }
      });
      const result = await request<AnyRecord>(`/api/customers?${params.toString()}`);
      const list = Array.isArray(result) ? result : result.list || [];
      setRows(list);
      setTotal(Number(Array.isArray(result) ? list.length : result.total || 0));
    } catch (error: any) {
      ctx.message.error(error.message);
      setRows([]);
      setTotal(0);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    void loadBuyers();
  }, [page, pageSize, tab, filters]);

  const submitFilters = (values: AnyRecord) => {
    const range = values.registerRange || [];
    setFilters({
      keyword: values.keyword,
      status: values.status,
      salesmanName: values.salesmanName,
      hasOrder: values.hasOrder,
      startDate: range[0]?.format?.("YYYY-MM-DD"),
      endDate: range[1]?.format?.("YYYY-MM-DD")
    });
    setPage(1);
  };

  const resetFilters = () => {
    form.resetFields();
    setFilters({});
    setTab("ALL");
    setPage(1);
  };

  const refresh = () => void loadBuyers();

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Tabs
        activeKey={tab}
        onChange={key => {
          setTab(key);
          setPage(1);
        }}
        items={[
          { key: "ALL", label: "全部" },
          { key: "ENABLED", label: "启用" },
          { key: "DISABLED", label: "停用" }
        ]}
      />
      <Card>
        <Form form={form} layout="inline" onFinish={submitFilters} className="admin-filter-form">
          <Form.Item name="keyword"><Input allowClear style={{ width: 280 }} placeholder="买家名称 / 买家编码 / 联系人 / 手机号" /></Form.Item>
          <Form.Item name="status"><Select allowClear style={{ width: 120 }} placeholder="买家状态" options={[{ value: "ALL", label: "全部" }, { value: "ENABLED", label: "启用" }, { value: "DISABLED", label: "停用" }]} /></Form.Item>
          <Form.Item name="salesmanName"><Input allowClear style={{ width: 160 }} placeholder="业务员" /></Form.Item>
          <Form.Item name="registerRange"><RangePicker /></Form.Item>
          <Form.Item name="hasOrder"><Select allowClear style={{ width: 120 }} placeholder="是否有订单" options={[{ value: "ALL", label: "全部" }, { value: "YES", label: "是" }, { value: "NO", label: "否" }]} /></Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">查询</Button>
              <Button onClick={resetFilters}>重置</Button>
              <Button onClick={() => ctx.message.info("导出功能待接入")}>导出买家</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
      <Card
        title="买家列表"
        extra={<Space><Button type="primary" icon={<PlusOutlined />} onClick={() => openBuyerForm(ctx, undefined, refresh)}>新增买家</Button><Button onClick={() => ctx.message.info("导出功能待接入")}>导出买家</Button></Space>}
      >
        <AdminTable
          loading={loading || tableLoading}
          rowKey="id"
          columns={buyerColumns(ctx, refresh)}
          dataSource={rows}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: value => `共 ${value} 条`,
            onChange: (nextPage: number, nextSize: number) => {
              setPage(nextPage);
              setPageSize(nextSize);
            }
          }}
          locale={{ emptyText: <Empty description="暂无数据" /> }}
        />
      </Card>
    </Space>
  );
}

const buyerColumns = (ctx: Ctx, refresh: () => void): ColumnsType<AnyRecord> => [
  { title: "买家编码", dataIndex: "customerCode", width: 140, render: emptyText },
  { title: "买家名称", dataIndex: "companyName", width: 180, render: emptyText },
  { title: "联系人", dataIndex: "contactName", width: 120, render: emptyText },
  { title: "手机号", width: 140, render: (_, item) => emptyText(item.contactPhone || item.loginPhone) },
  { title: "业务员", dataIndex: "salesmanName", width: 120, render: emptyText },
  { title: "状态", width: 90, render: (_, item) => buyerStatusTag(item) },
  { title: "累计订单数", dataIndex: "orderCount", width: 110, align: "right", render: countText },
  { title: "累计成交金额", dataIndex: "totalPaidAmount", width: 130, align: "right", render: yuan },
  { title: "累计退款金额", dataIndex: "totalRefundAmount", width: 130, align: "right", render: yuan },
  { title: "最近下单时间", dataIndex: "lastOrderTime", width: 150, render: dateText },
  { title: "最近登录时间", dataIndex: "lastLoginAt", width: 150, render: dateText },
  { title: "注册时间", dataIndex: "createdAt", width: 150, render: dateText },
  {
    title: "操作",
    width: 260,
    render: (_, item) => {
      const status = customerStatus(item);
      return (
        <Space>
          <Button type="link" onClick={() => openBuyerDetail(ctx, item.id, refresh)}>详情</Button>
          <Button type="link" onClick={() => openBuyerForm(ctx, item, refresh)}>编辑</Button>
          <Button type="link" danger={status === "ENABLED"} onClick={() => openBuyerStatusForm(ctx, item, refresh)}>{status === "ENABLED" ? "停用" : "启用"}</Button>
          <Button type="link" onClick={() => openBuyerPasswordReset(ctx, item, refresh)}>重置密码</Button>
        </Space>
      );
    }
  }
];

function buyerStatusTag(item: AnyRecord) {
  const status = typeof item === "string" ? item : customerStatus(item);
  if (status === "DISABLED") return <Tag color="red">停用</Tag>;
  if (status === "ENABLED") return <Tag color="green">启用</Tag>;
  return <Tag>{emptyText(status)}</Tag>;
}

function countText(value: any) {
  return Number(value || 0);
}

function yuan(value: any) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function requireOperator(ctx: Ctx) {
  const operatorName = adminOperatorName();
  if (!operatorName) {
    ctx.message.error("无法获取当前操作人，请重新登录");
    return "";
  }
  return operatorName;
}

function openBuyerForm(ctx: Ctx, item: AnyRecord | undefined, onDone: () => void) {
  const isEdit = Boolean(item?.id);
  ctx.setDrawer({
    title: isEdit ? "编辑买家" : "新增买家",
    width: 620,
    body: (
      <BuyerEditForm
        item={item}
        isEdit={isEdit}
        onCancel={() => ctx.setDrawer(null)}
        onSubmit={async values => {
          const operatorName = requireOperator(ctx);
          if (!operatorName) return;
          try {
            await request(isEdit ? `/api/customers/${item.id}` : "/api/customers", {
              method: isEdit ? "PUT" : "POST",
              data: { ...values, operatorName, contactPhone: values.loginPhone || values.contactPhone }
            });
            ctx.message.success("保存成功");
            ctx.setDrawer(null);
            onDone();
          } catch (error: any) {
            ctx.message.error(error.message);
          }
        }}
      />
    )
  });
}

function BuyerEditForm({ item, isEdit, onSubmit, onCancel }: { item?: AnyRecord; isEdit: boolean; onSubmit: (values: AnyRecord) => Promise<void>; onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Form
      layout="vertical"
      initialValues={{ ...item, loginPhone: item?.loginPhone || item?.contactPhone }}
      onFinish={async values => {
        setSubmitting(true);
        try {
          await onSubmit(values);
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <Form.Item name="companyName" label="买家名称" rules={[{ required: true, message: "请输入买家名称" }]}><Input maxLength={120} /></Form.Item>
      <Form.Item name="contactName" label="联系人" rules={[{ required: true, message: "请输入联系人" }]}><Input maxLength={60} /></Form.Item>
      <Form.Item name="loginPhone" label="登录手机号" rules={phoneRules("登录手机号")}><Input maxLength={11} /></Form.Item>
      {!isEdit ? <Form.Item name="password" label="初始密码" rules={passwordRules("初始密码")}><Input.Password maxLength={20} /></Form.Item> : null}
      <Form.Item name="address" label="地址"><Input.TextArea rows={3} maxLength={255} /></Form.Item>
      <Form.Item name="salesmanName" label="业务员"><Input maxLength={60} /></Form.Item>
      <Form.Item name="remark" label="备注"><Input.TextArea rows={3} maxLength={500} /></Form.Item>
      <Space><Button onClick={onCancel}>取消</Button><Button type="primary" htmlType="submit" loading={submitting}>保存</Button></Space>
    </Form>
  );
}

function openBuyerStatusForm(ctx: Ctx, item: AnyRecord, onDone: () => void) {
  const currentStatus = customerStatus(item);
  const nextStatus = currentStatus === "ENABLED" ? "DISABLED" : "ENABLED";
  ctx.setDrawer({
    title: nextStatus === "DISABLED" ? "停用买家" : "启用买家",
    width: 520,
    body: (
      <BuyerStatusForm
        status={nextStatus}
        onCancel={() => ctx.setDrawer(null)}
        onSubmit={async values => {
          const operatorName = requireOperator(ctx);
          if (!operatorName) return;
          try {
            await request(`/api/customers/${item.id}/status`, { method: "PUT", data: { ...values, status: nextStatus, operatorName } });
            ctx.message.success("状态已更新");
            ctx.setDrawer(null);
            onDone();
          } catch (error: any) {
            ctx.message.error(error.message);
          }
        }}
      />
    )
  });
}

function BuyerStatusForm({ status, onSubmit, onCancel }: { status: string; onSubmit: (values: AnyRecord) => Promise<void>; onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Form layout="vertical" onFinish={async values => { setSubmitting(true); try { await onSubmit(values); } finally { setSubmitting(false); } }}>
      {status === "DISABLED" ? (
        <Form.Item name="reason" label="停用原因" rules={[{ required: true, message: "请选择停用原因" }]}>
          <Select options={["买家主动停用", "账号异常", "长期未合作", "信息错误", "其它"].map(value => ({ value, label: value }))} />
        </Form.Item>
      ) : null}
      <Form.Item name="remark" label={status === "DISABLED" ? "备注" : "启用备注"}><Input.TextArea rows={3} maxLength={500} /></Form.Item>
      <Space><Button onClick={onCancel}>取消</Button><Button type="primary" htmlType="submit" loading={submitting}>{status === "DISABLED" ? "停用" : "启用"}</Button></Space>
    </Form>
  );
}

function openBuyerPasswordReset(ctx: Ctx, item: AnyRecord, onDone: () => void) {
  ctx.setDrawer({
    title: "重置买家密码",
    width: 520,
    body: (
      <BuyerPasswordForm
        onCancel={() => ctx.setDrawer(null)}
        onSubmit={async values => {
          if (values.newPassword !== values.confirmPassword) {
            ctx.message.error("新密码和确认密码不一致");
            return;
          }
          const operatorName = requireOperator(ctx);
          if (!operatorName) return;
          try {
            await request(`/api/customers/${item.id}/password/reset`, { method: "POST", data: { newPassword: values.newPassword, remark: values.remark, operatorName } });
            ctx.message.success("密码已重置");
            ctx.setDrawer(null);
            onDone();
          } catch (error: any) {
            ctx.message.error(error.message);
          }
        }}
      />
    )
  });
}

function BuyerPasswordForm({ onSubmit, onCancel }: { onSubmit: (values: AnyRecord) => Promise<void>; onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Form layout="vertical" onFinish={async values => { setSubmitting(true); try { await onSubmit(values); } finally { setSubmitting(false); } }}>
      <Form.Item name="newPassword" label="新密码" rules={passwordRules("新密码")}><Input.Password maxLength={20} /></Form.Item>
      <Form.Item name="confirmPassword" label="确认密码" rules={passwordRules("确认密码")}><Input.Password maxLength={20} /></Form.Item>
      <Form.Item name="remark" label="备注"><Input.TextArea rows={3} maxLength={500} /></Form.Item>
      <Space><Button onClick={onCancel}>取消</Button><Button type="primary" htmlType="submit" loading={submitting}>确认重置</Button></Space>
    </Form>
  );
}

function openBuyerDetail(ctx: Ctx, customerId: any, onChanged: () => void) {
  ctx.setDrawer({
    title: "买家详情",
    width: "92vw",
    className: "buyer-detail-drawer",
    body: <BuyerDetail customerId={customerId} ctx={ctx} onChanged={onChanged} />
  });
}

function BuyerDetail({ customerId, ctx, onChanged }: { customerId: any; ctx: Ctx; onChanged: () => void }) {
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      setDetail(await request<AnyRecord>(`/api/customers/${customerId}`));
    } catch (error: any) {
      ctx.message.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [customerId]);
  const basic = detail?.basicInfo || {};
  const account = detail?.accountInfo || {};
  const status = customerStatus(basic);
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space>
        <Button onClick={() => openBuyerForm(ctx, basic, () => { onChanged(); void load(); })}>编辑</Button>
        <Button danger={status === "ENABLED"} onClick={() => openBuyerStatusForm(ctx, basic, () => { onChanged(); void load(); })}>{status === "ENABLED" ? "停用" : "启用"}</Button>
        <Button onClick={() => openBuyerPasswordReset(ctx, basic, () => { onChanged(); void load(); })}>重置密码</Button>
        <Button onClick={() => ctx.setDrawer(null)}>返回</Button>
      </Space>
      <Card loading={loading} title="买家基础信息">
        <Descriptions bordered column={3} size="small">
          <Descriptions.Item label="买家编码">{emptyText(basic.customerCode)}</Descriptions.Item>
          <Descriptions.Item label="买家名称">{emptyText(basic.companyName)}</Descriptions.Item>
          <Descriptions.Item label="联系人">{emptyText(basic.contactName)}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{emptyText(basic.contactPhone)}</Descriptions.Item>
          <Descriptions.Item label="业务员">{emptyText(basic.salesmanName)}</Descriptions.Item>
          <Descriptions.Item label="状态">{buyerStatusTag(basic)}</Descriptions.Item>
          <Descriptions.Item label="地址" span={2}>{emptyText(basic.address)}</Descriptions.Item>
          <Descriptions.Item label="注册时间">{dateText(basic.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{dateText(basic.updatedAt)}</Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>{emptyText(basic.remark)}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card loading={loading} title="账号信息">
        <Descriptions bordered column={3} size="small">
          <Descriptions.Item label="登录手机号">{emptyText(account.loginPhone)}</Descriptions.Item>
          <Descriptions.Item label="账号状态">{buyerStatusTag(account)}</Descriptions.Item>
          <Descriptions.Item label="最近登录时间">{dateText(account.lastLoginAt)}</Descriptions.Item>
          <Descriptions.Item label="密码更新时间">{dateText(account.passwordUpdatedAt)}</Descriptions.Item>
          <Descriptions.Item label="注册来源">{emptyText(account.registerSource)}</Descriptions.Item>
          <Descriptions.Item label="停用原因">{emptyText(account.disabledReason)}</Descriptions.Item>
          <Descriptions.Item label="停用时间">{dateText(account.disabledAt)}</Descriptions.Item>
          <Descriptions.Item label="停用操作人">{emptyText(account.disabledBy)}</Descriptions.Item>
        </Descriptions>
      </Card>
      <BuyerRelatedTable title="收货地址" empty="暂无收货地址" rows={detail?.addresses || []} columns={[
        { title: "收货人", dataIndex: "receiverName" },
        { title: "手机号", dataIndex: "receiverPhone" },
        { title: "地区", dataIndex: "region", render: emptyText },
        { title: "详细地址", dataIndex: "detailAddress", render: emptyText },
        { title: "是否默认", dataIndex: "isDefault", render: value => value ? <Tag color="blue">默认</Tag> : "-" },
        { title: "创建时间", dataIndex: "createdAt", render: dateText }
      ]} />
      <BuyerRelatedTable title="发票抬头" empty="暂无发票抬头" rows={detail?.invoiceTitles || []} columns={[
        { title: "抬头类型", dataIndex: "titleType", render: value => value === "PERSONAL" ? "个人" : "企业" },
        { title: "发票抬头", dataIndex: "invoiceTitle", render: emptyText },
        { title: "纳税人识别号", dataIndex: "taxNo", render: emptyText },
        { title: "支持发票类型", dataIndex: "supportedInvoiceTypes", render: emptyText },
        { title: "默认开票类型", dataIndex: "defaultInvoiceType", render: emptyText },
        { title: "邮箱", dataIndex: "email", render: emptyText },
        { title: "是否默认", dataIndex: "isDefault", render: value => value ? <Tag color="blue">默认</Tag> : "-" },
        { title: "创建时间", dataIndex: "createdAt", render: dateText }
      ]} />
      <BuyerRelatedTable title="订单记录" empty="暂无订单记录" rows={detail?.orders || []} columns={[
        { title: "订单编号", dataIndex: "orderNo" },
        { title: "订单状态", dataIndex: "orderStatus", render: tag },
        { title: "支付状态", dataIndex: "paymentStatus", render: tag },
        { title: "发货状态", dataIndex: "fulfillmentStatus", render: tag },
        { title: "订单金额", dataIndex: "totalAmount", align: "right", render: yuan },
        { title: "实付金额", dataIndex: "paidAmount", align: "right", render: yuan },
        { title: "下单时间", dataIndex: "createdAt", render: dateText },
        { title: "操作", render: () => <Button type="link" onClick={() => ctx.message.info("订单详情跳转待接入")}>查看订单</Button> }
      ]} />
      <BuyerRelatedTable title="售后记录" empty="暂无售后记录" rows={detail?.afterSales || []} columns={[
        { title: "售后单号", dataIndex: "afterSaleNo" },
        { title: "订单编号", dataIndex: "orderNo" },
        { title: "售后类型", dataIndex: "afterSaleType", render: emptyText },
        { title: "售后状态", dataIndex: "afterSaleStatus", render: tag },
        { title: "申请金额", dataIndex: "refundAmount", align: "right", render: yuan },
        { title: "退款状态", dataIndex: "refundStatus", render: tag },
        { title: "申请时间", dataIndex: "createdAt", render: dateText },
        { title: "操作", render: () => <Button type="link" onClick={() => ctx.message.info("售后详情跳转待接入")}>查看售后</Button> }
      ]} />
      <BuyerRelatedTable title="开票记录" empty="暂无开票记录" rows={detail?.invoices || []} columns={[
        { title: "开票申请单号", dataIndex: "invoiceApplyNo" },
        { title: "订单编号", dataIndex: "orderNo" },
        { title: "发票类型", dataIndex: "invoiceType", render: emptyText },
        { title: "发票抬头", dataIndex: "invoiceTitle", render: emptyText },
        { title: "开票金额", dataIndex: "applyAmount", align: "right", render: yuan },
        { title: "开票状态", dataIndex: "invoiceStatus", render: tag },
        { title: "申请时间", dataIndex: "createdAt", render: dateText },
        { title: "操作", render: () => <Button type="link" onClick={() => ctx.message.info("开票详情跳转待接入")}>查看开票</Button> }
      ]} />
      <BuyerRelatedTable title="操作日志" empty="暂无操作日志" rows={detail?.logs || []} columns={[
        { title: "时间", dataIndex: "createdAt", render: dateText },
        { title: "操作人", dataIndex: "operatorName", render: emptyText },
        { title: "操作类型", dataIndex: "actionType", render: emptyText },
        { title: "操作内容", dataIndex: "actionContent", render: emptyText }
      ]} />
    </Space>
  );
}

function BuyerRelatedTable({ title, empty, rows, columns }: { title: string; empty: string; rows: AnyRecord[]; columns: ColumnsType<AnyRecord> }) {
  return (
    <Card title={title}>
      <AdminTable rowKey={row => String(row.id ?? row.orderNo ?? row.afterSaleNo ?? row.invoiceApplyNo ?? Math.random())} dataSource={rows} columns={columns} pagination={false} locale={{ emptyText: <Empty description={empty} /> }} />
    </Card>
  );
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

