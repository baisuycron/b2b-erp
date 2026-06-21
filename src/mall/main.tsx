// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  App as AntApp,
  Badge,
  Button,
  Card,
  Carousel,
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
  Pagination,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography
} from "antd";
import {
  AlipayCircleOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
  CameraOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  DownOutlined,
  EnvironmentOutlined,
  ExclamationCircleFilled,
  HeartOutlined,
  HomeOutlined,
  PictureOutlined,
  SearchOutlined,
  MinusOutlined,
  PlusOutlined,
  ProfileOutlined,
  RightOutlined,
  RobotOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  UserOutlined,
  WechatOutlined
} from "@ant-design/icons";
import "antd/dist/reset.css";
import zhCN from "antd/locale/zh_CN";
import "../shared/styles.css";
import GlobalLoadingMask from "../shared/GlobalLoadingMask";
import { AnyRecord, buyerAccountKey, buyerTokenKey, dateText, money, parseDetailContent, parseRows, request, statusText } from "../shared/api";

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
const mallImageSearchTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/bmp"];
const mallImageSearchMaxSize = 5 * 1024 * 1024;
const mallListPageSize = 10;
const mallPageSnapshotKey = "b2b-erp-mall-page-snapshot";
const mallPageSnapshotMaxAge = 10 * 60 * 1000;

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

function buyerLoginPayload(identifier: string, password: string) {
  const account = String(identifier || "").trim();
  const data: AnyRecord = { account, password };
  if (phonePattern.test(account)) data.phone = account;
  return data;
}

type Page = "home" | "list" | "detail" | "cart" | "confirm" | "pay" | "orders" | "orderDetail" | "addresses" | "invoiceTitles" | "history" | "profile" | "login" | "register";
const authPages: Page[] = ["login", "register"];
const protectedPages: Page[] = ["detail", "cart", "confirm", "pay", "orders", "orderDetail", "addresses", "invoiceTitles", "history", "profile"];

function initialBuyerToken() {
  const token = localStorage.getItem(buyerTokenKey) || "";
  const account = localStorage.getItem(buyerAccountKey) || "";
  if (token === "buyer-token" && (!account || account === "采购用户")) {
    localStorage.removeItem(buyerTokenKey);
    localStorage.removeItem(buyerAccountKey);
    return "";
  }
  return token;
}

function pageFromView(value: string | null): Page {
  const map: Record<string, Page> = {
    login: "login",
    register: "register",
    list: "list",
    cart: "cart",
    orders: "orders",
    orderDetail: "orderDetail",
    account: "profile",
    profile: "profile",
    addresses: "addresses",
    invoiceTitles: "invoiceTitles",
    history: "history",
    confirm: "confirm",
    pay: "pay"
  };
  return map[String(value || "")] || "home";
}

function pageFromInitialUrl(): Page {
  const params = new URLSearchParams(window.location.search);
  if (params.get("productId")) return "detail";
  const viewPage = pageFromView(params.get("view"));
  if (viewPage !== "home") return viewPage;
  const hasListQuery = ["keyword", "brandName", "brandId", "minPrice", "maxPrice", "searchType", "imageSearchId"].some(key => Boolean(params.get(key)))
    || params.get("inStock") === "true"
    || Number(params.get("page") || 1) > 1
    || Boolean(params.get("order"))
    || (Boolean(params.get("sort")) && params.get("sort") !== "comprehensive");
  return hasListQuery ? "list" : "home";
}

function authPath(type: "login" | "register", redirect = "") {
  const params = new URLSearchParams({ view: type });
  if (redirect) params.set("redirect", redirect);
  return `/mall.html?${params.toString()}`;
}

function redirectForPage(page: Page) {
  const map: Partial<Record<Page, string>> = {
    cart: "/cart",
    orders: "/orders",
    profile: "/account",
    addresses: "/account",
    invoiceTitles: "/account",
    history: "/history",
    confirm: "/cart",
    pay: "/orders",
    orderDetail: "/orders"
  };
  return map[page] || "/mall";
}

function getRedirectParam() {
  return new URLSearchParams(window.location.search).get("redirect") || "";
}

function mallUrlForRedirect(redirect: string) {
  const productMatch = redirect.match(/^\/product\/(\d+)/);
  if (productMatch) return `/mall.html?productId=${encodeURIComponent(productMatch[1])}`;
  const map: Record<string, string> = {
    "/cart": "/mall.html?view=cart",
    "/orders": "/mall.html?view=orders",
    "/account": "/mall.html?view=account",
    "/history": "/mall.html?view=history",
    "/mall": "/mall.html"
  };
  return map[redirect] || "/mall.html";
}

function tag(value: any) {
  const text = statusText(value);
  const color = /已支付|已完成|启用|成功/.test(text) ? "green" : /取消|失败/.test(text) ? "red" : /待|未/.test(text) ? "orange" : "blue";
  return <Tag color={color}>{text}</Tag>;
}

function listQueryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    keyword: params.get("keyword") || "",
    brandName: params.get("brandName") || "",
    brandId: params.get("brandId") || "",
    minPrice: params.get("minPrice") || "",
    maxPrice: params.get("maxPrice") || "",
    sort: params.get("sort") || "comprehensive",
    order: params.get("order") || "",
    inStock: params.get("inStock") === "true",
    page: Math.max(1, Number(params.get("page") || 1)),
    pageSize: Math.max(1, Number(params.get("pageSize") || mallListPageSize)),
    searchType: params.get("searchType") || "",
    imageSearchId: params.get("imageSearchId") || "",
    categoryId: params.get("categoryId") || "",
    categoryName: params.get("categoryName") || ""
  };
}

function cleanQueryParams(query: AnyRecord) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === false) return;
    if ((key === "page" && Number(value) === 1) || (key === "pageSize" && Number(value) === mallListPageSize)) return;
    if (key === "sort" && value === "comprehensive") return;
    params.set(key, String(value));
  });
  return params;
}

function defaultMallListQuery(patch: AnyRecord = {}) {
  return {
    keyword: "",
    brandName: "",
    brandId: "",
    minPrice: "",
    maxPrice: "",
    sort: "comprehensive",
    order: "",
    inStock: false,
    page: 1,
    pageSize: mallListPageSize,
    searchType: "",
    imageSearchId: "",
    categoryId: "",
    categoryName: "",
    ...patch
  };
}

function hasExplicitMallRoute() {
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get("productId") || params.get("view") || params.toString());
}

function snapshotDetailProduct(snapshot: AnyRecord | null | undefined) {
  const product = snapshot?.selectedProduct;
  if (!product) return null;
  const productId = product.id || product.apiId;
  return productId ? { product, productId } : null;
}

function snapshotHasRecoverableContent(snapshot: AnyRecord | null | undefined) {
  if (!snapshot) return false;
  if (snapshot.page === "detail") return Boolean(snapshotDetailProduct(snapshot));
  if (Array.isArray(snapshot.products) && snapshot.products.length > 0) return true;
  return snapshot.hydrated === true;
}

function readMallPageSnapshot(urlPage: Page): AnyRecord | null {
  try {
    const raw = sessionStorage.getItem(mallPageSnapshotKey);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (!snapshot || Date.now() - Number(snapshot.savedAt || 0) > mallPageSnapshotMaxAge) return null;
    if (snapshot.path && snapshot.path !== window.location.pathname) return null;
    if (!snapshotHasRecoverableContent(snapshot)) return null;
    if (snapshot.page === "detail" && !snapshotDetailProduct(snapshot)) return null;

    const productId = new URLSearchParams(window.location.search).get("productId") || "";
    if (productId) {
      const detail = snapshotDetailProduct(snapshot);
      return detail && String(detail.productId) === String(productId) ? { ...snapshot, page: "detail" } : null;
    }

    if (!hasExplicitMallRoute()) return snapshot;
    return snapshot.page === urlPage ? snapshot : null;
  } catch {
    return null;
  }
}

function writeMallPageSnapshot(snapshot: AnyRecord) {
  try {
    sessionStorage.setItem(mallPageSnapshotKey, JSON.stringify({
      ...snapshot,
      hydrated: true,
      path: window.location.pathname,
      search: window.location.search,
      savedAt: Date.now()
    }));
  } catch {
    // ignore storage quota/private mode errors
  }
}

function MallRoot() {
  const { message } = AntApp.useApp();
  const urlInitialView = pageFromInitialUrl();
  const initialSnapshot = readMallPageSnapshot(urlInitialView);
  const initialView = (initialSnapshot?.page || urlInitialView) as Page;
  const initialListQuery = initialSnapshot?.listQuery || listQueryFromUrl();
  const [page, setPage] = useState<Page>(initialView);
  const [loading, setLoading] = useState(false);
  const [buyerToken, setBuyerToken] = useState(() => initialBuyerToken());
  const [loginRedirect, setLoginRedirect] = useState(() => getRedirectParam());
  const [showLoginGuide, setShowLoginGuide] = useState(true);
  const [products, setProducts] = useState<AnyRecord[]>(() => Array.isArray(initialSnapshot?.products) ? initialSnapshot.products : []);
  const [categories, setCategories] = useState<string[]>(() => Array.isArray(initialSnapshot?.categories) ? initialSnapshot.categories : []);
  const [categoryRows, setCategoryRows] = useState<AnyRecord[]>(() => Array.isArray(initialSnapshot?.categoryRows) ? initialSnapshot.categoryRows : []);
  const [brands, setBrands] = useState<string[]>(() => Array.isArray(initialSnapshot?.brands) ? initialSnapshot.brands : []);
  const [cart, setCart] = useState<AnyRecord[]>(() => Array.isArray(initialSnapshot?.cart) ? initialSnapshot.cart : []);
  const [orders, setOrders] = useState<AnyRecord[]>(() => Array.isArray(initialSnapshot?.orders) ? initialSnapshot.orders : []);
  const [addresses, setAddresses] = useState<AnyRecord[]>(() => Array.isArray(initialSnapshot?.addresses) ? initialSnapshot.addresses : []);
  const [invoiceTitles, setInvoiceTitles] = useState<AnyRecord[]>(() => Array.isArray(initialSnapshot?.invoiceTitles) ? initialSnapshot.invoiceTitles : []);
  const [profile, setProfile] = useState<AnyRecord>(() => initialSnapshot?.profile || {});
  const [selectedProduct, setSelectedProduct] = useState<AnyRecord | null>(() => initialSnapshot?.selectedProduct || null);
  const [detailQty, setDetailQty] = useState<Record<number, number>>(() => initialSnapshot?.detailQty || {});
  const [checkoutItems, setCheckoutItems] = useState<AnyRecord[] | null>(null);
  const [currentOrder, setCurrentOrder] = useState<AnyRecord | null>(null);
  const [payMethod, setPayMethod] = useState("wechat");
  const [filters, setFilters] = useState(() => initialSnapshot?.filters || { category: "全部分类", brand: "全部品牌" });
  const [listQuery, setListQuery] = useState<AnyRecord>(() => initialListQuery);
  const [searchText, setSearchText] = useState(() => initialSnapshot?.searchText || initialListQuery.keyword || "");
  const [searchSummary, setSearchSummary] = useState<AnyRecord>(() => initialSnapshot?.searchSummary || { type: "all", count: 0 });
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiAssistantPosition, setAiAssistantPosition] = useState<AnyRecord>({ left: 16, top: 90 });
  const aiButtonRef = useRef<HTMLButtonElement | null>(null);
  const productCacheRef = useRef<Map<string, AnyRecord[]>>(new Map());
  const productDetailCacheRef = useRef<Map<string, AnyRecord>>(new Map());
  const productDetailRequestsRef = useRef<Map<string, Promise<AnyRecord>>>(new Map());
  const detailRequestSeqRef = useRef(0);
  const imageSearchRequestRef = useRef(false);
  const browseHistoryRecordRef = useRef("");
  const snapshotWriteReadyRef = useRef(Boolean(initialSnapshot));
  const isLoggedIn = Boolean(buyerToken);

  const syncAiAssistantPosition = () => {
    const rect = aiButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAiAssistantPosition({
      left: Math.round(rect.left),
      top: Math.round(rect.bottom + 10)
    });
  };

  const openAiAssistant = () => {
    syncAiAssistantPosition();
    setAiAssistantOpen(true);
  };

  useEffect(() => {
    if (!aiAssistantOpen) return;
    syncAiAssistantPosition();
    window.addEventListener("resize", syncAiAssistantPosition);
    window.addEventListener("scroll", syncAiAssistantPosition, true);
    return () => {
      window.removeEventListener("resize", syncAiAssistantPosition);
      window.removeEventListener("scroll", syncAiAssistantPosition, true);
    };
  }, [aiAssistantOpen]);

  useEffect(() => {
    if (Array.isArray(initialSnapshot?.products) && initialSnapshot.products.length) {
      productCacheRef.current.set("all", initialSnapshot.products);
    }
    if (initialSnapshot?.selectedProduct?.id) {
      productDetailCacheRef.current.set(String(initialSnapshot.selectedProduct.id), initialSnapshot.selectedProduct);
    }
  }, []);

  useEffect(() => {
    const handleBuyerAuthExpired = () => {
      setBuyerToken("");
      setCart([]);
      setOrders([]);
      setAddresses([]);
      setInvoiceTitles([]);
      setProfile({});
      if (protectedPages.includes(page)) {
        setLoginRedirect(redirectForPage(page));
        setPage("login");
        window.history.replaceState({}, "", authPath("login", redirectForPage(page)));
      }
    };
    window.addEventListener("b2b-erp-buyer-auth-expired", handleBuyerAuthExpired);
    return () => window.removeEventListener("b2b-erp-buyer-auth-expired", handleBuyerAuthExpired);
  }, [page]);

  useEffect(() => {
    if (page !== "detail") {
      browseHistoryRecordRef.current = "";
      return;
    }
    const productId = selectedProduct?.id;
    if (!isLoggedIn || !productId) return;
    const recordKey = `${buyerToken}:${productId}`;
    if (browseHistoryRecordRef.current === recordKey) return;
    browseHistoryRecordRef.current = recordKey;
    request("/api/mall/browse-history", {
      method: "POST",
      data: { productId: Number(productId) }
    }).catch(() => undefined);
  }, [page, selectedProduct?.id, isLoggedIn, buyerToken]);

  const apiGuard = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
      return true;
    } catch (error: any) {
      message.error(error.message);
      return false;
    } finally {
      snapshotWriteReadyRef.current = true;
      setLoading(false);
    }
  };

  const hydrateProducts = async () => {
    const initialQuery = listQueryFromUrl();
    const initialKeyword = initialQuery.keyword || "";
    const initialCategoryId = initialQuery.categoryId || "";
    const initialCategoryName = initialQuery.categoryName || "";
    const initialProductId = new URLSearchParams(window.location.search).get("productId")
      || (page === "detail" && selectedProduct?.id ? String(selectedProduct.id) : "");
    const productQuery = new URLSearchParams();
    if (initialKeyword) productQuery.set("keyword", initialKeyword);
    if (initialCategoryId) productQuery.set("categoryId", initialCategoryId);
    if (initialCategoryName) productQuery.set("categoryName", initialCategoryName);
    const [categoryRows, brandRows, productRows] = await Promise.all([
      request<AnyRecord[]>("/api/mall/product-categories").catch(() => []),
      request<AnyRecord[]>("/api/admin/product-brands").catch(() => []),
      request<AnyRecord[]>(`/api/mall/products${productQuery.toString() ? `?${productQuery}` : ""}`)
    ]);
    const enabledCategories = categoryRows.filter(x => x.status === "ENABLED");
    const productCategories = Array.from(new Set(productRows
      .map((row: AnyRecord) => String(row.categoryName || row.category || "").trim())
      .filter(Boolean)))
      .map((categoryName, index) => ({
        id: `product-category-${index}`,
        categoryName,
        parentName: "-",
        sortNo: index,
        status: "ENABLED"
      }));
    const availableCategories = enabledCategories.length ? enabledCategories : productCategories;
    setCategoryRows(availableCategories);
    setCategories(availableCategories.map(x => x.categoryName));
    setBrands(brandRows.filter(x => x.status === "ENABLED").map(x => x.brandName));
    let mapped = productRows.map(productFromApi);
    if (!initialKeyword && !initialProductId && (initialCategoryId || initialCategoryName)) {
      const flatCategory = availableCategories.find(x => String(x.id) === String(initialCategoryId)) || { categoryName: initialCategoryName };
      const selectedCategoryNode = findCategoryNodeInTree(
        buildCategoryTree(availableCategories),
        flatCategory.categoryName || initialCategoryName
      );
      const descendantNames = collectCategoryNames(selectedCategoryNode || flatCategory);
      if (descendantNames.length > 1) {
        const allRows = await request<AnyRecord[]>("/api/mall/products");
        mapped = allRows
          .map(productFromApi)
          .filter((product: AnyRecord) => descendantNames.includes(product.category));
      }
    }
    setProducts(mapped);
    if (!initialKeyword && !initialCategoryId && !initialCategoryName && !initialProductId) {
      productCacheRef.current.set("all", mapped);
    }
    setListQuery(initialQuery);
    setSearchText(initialKeyword);
    if (initialProductId) {
      const product = mapped.find(item => String(item.id) === String(initialProductId));
      if (localStorage.getItem(buyerTokenKey)) {
        let detailProduct = product || null;
        try {
          detailProduct = productFromApi(await request<AnyRecord>(`/api/mall/products/${initialProductId}`));
        } catch {
          detailProduct = product || null;
        }
        if (!detailProduct) {
          setSearchSummary({ type: "all", count: mapped.length });
          return;
        }
        setSelectedProduct(detailProduct);
        setDetailQty(Object.fromEntries((detailProduct.specs || []).map((_: AnyRecord, idx: number) => [idx, 0])));
        setPage("detail");
      } else {
        setLoginRedirect(`/product/${initialProductId}`);
        setPage("login");
        window.history.replaceState({}, "", authPath("login", `/product/${initialProductId}`));
      }
    } else if (initialKeyword) {
      setSearchSummary({ type: "text", keyword: initialKeyword, count: mapped.length });
      setPage("list");
    } else if (initialCategoryId || initialCategoryName) {
      const category = availableCategories.find(x => String(x.id) === String(initialCategoryId)) || { categoryName: initialCategoryName };
      setSearchSummary({ type: "category", categoryName: category.categoryName || initialCategoryName, count: mapped.length });
      setFilters({ category: category.categoryName || initialCategoryName || "全部分类", brand: "全部品牌" });
      setPage("home");
    } else {
      setSearchSummary({ type: "all", count: mapped.length });
    }
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
    const data = await request<AnyRecord>("/api/buyer/profile").catch(() => ({}));
    const savedName = localStorage.getItem(buyerAccountKey) || "";
    setProfile({ ...data, buyerName: savedName || data.buyerName });
  };

  const hydratePrivateData = async () => {
    if (!localStorage.getItem(buyerTokenKey)) {
      setCart([]);
      setOrders([]);
      setAddresses([]);
      setInvoiceTitles([]);
      setProfile({});
      return;
    }
    await Promise.all([hydrateCart(), hydrateOrders(), hydrateAddresses(), hydrateInvoiceTitles(), hydrateProfile()]);
  };

  const hydrateAll = () => apiGuard(async () => {
    await hydrateProducts();
    hydratePrivateData().catch((error: any) => {
      console.warn("mall private data hydrate failed", error);
    });
  });

  useEffect(() => {
    if (protectedPages.includes(initialView) && !localStorage.getItem(buyerTokenKey)) {
      const initialProductId = new URLSearchParams(window.location.search).get("productId")
        || (initialView === "detail" && selectedProduct?.id ? String(selectedProduct.id) : "");
      const redirect = initialView === "detail" && initialProductId ? `/product/${initialProductId}` : redirectForPage(initialView);
      setLoginRedirect(redirect);
      setPage("login");
      window.history.replaceState({}, "", authPath("login", redirect));
      hydrateProducts();
      return;
    }
    hydrateAll();
  }, []);

  useEffect(() => {
    if (authPages.includes(page)) return;
    if (!snapshotWriteReadyRef.current || loading) return;
    if (page === "detail" && !selectedProduct?.id && !selectedProduct?.apiId) return;
    if ((page === "home" || page === "list") && !products.length) return;
    writeMallPageSnapshot({
      page,
      products,
      categories,
      categoryRows,
      brands,
      cart,
      orders,
      addresses,
      invoiceTitles,
      profile,
      selectedProduct,
      detailQty,
      filters,
      listQuery,
      searchText,
      searchSummary
    });
  }, [
    page,
    products,
    categories,
    categoryRows,
    brands,
    cart,
    orders,
    addresses,
    invoiceTitles,
    profile,
    selectedProduct,
    detailQty,
    filters,
    listQuery,
    searchText,
    searchSummary,
    loading
  ]);

  const pushViewUrl = (next: Page, redirect = "", productId = "") => {
    const auth = authPages.includes(next);
    const params = new URLSearchParams();
    if (auth) params.set("view", next);
    if (auth && redirect) params.set("redirect", redirect);
    if (next === "detail" && productId) params.set("productId", String(productId));
    if (!auth && next !== "home" && next !== "detail") {
      params.set("view", next === "profile" ? "account" : next);
    }
    const query = params.toString();
    window.history.pushState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  };

  const requireLogin = (redirect: string) => {
    // TODO: 后端仍需对买家接口做鉴权校验，前端跳转不能替代服务端权限控制。
    setLoginRedirect(redirect);
    setPage("login");
    window.history.pushState({}, "", authPath("login", redirect));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openRedirect = async (redirect = "") => {
    if (!redirect || redirect === "/mall") {
      pushViewUrl("home");
      setPage("home");
      return;
    }
    const productMatch = redirect.match(/^\/product\/(\d+)/);
    if (productMatch) {
      const id = Number(productMatch[1]);
      const product = products.find(item => Number(item.id) === id);
      if (product) {
        window.history.pushState({}, "", mallUrlForRedirect(redirect));
        await go("detail", product, { skipAuth: true, skipUrl: true });
      } else {
        window.history.pushState({}, "", "/mall.html");
        setPage("list");
      }
      return;
    }
    const map: Record<string, Page> = {
      "/cart": "cart",
      "/orders": "orders",
      "/account": "profile",
      "/history": "history"
    };
    window.history.pushState({}, "", mallUrlForRedirect(redirect));
    await go(map[redirect] || "home", undefined, { skipAuth: true, skipUrl: true });
  };

  const completeLogin = async (result: AnyRecord, fallbackName: string, redirect = "", fallbackPhone = "", preferFallbackIdentity = false) => {
    const token = String(result?.token || "");
    if (!token) throw new Error("登录失败，请重新输入账号和密码");
    const serverName = String(result?.buyerName || result?.accountName || fallbackName || "");
    const submittedName = String(fallbackName || serverName || "");
    const name = preferFallbackIdentity ? submittedName : serverName;
    const phone = String(result?.phone || fallbackPhone || (phonePattern.test(submittedName) ? submittedName : ""));
    if (!name) throw new Error("登录失败，请重新输入账号和密码");
    localStorage.setItem(buyerTokenKey, token);
    localStorage.setItem(buyerAccountKey, name);
    setBuyerToken(token);
    setProfile({ buyerName: name, companyName: result?.companyName, phone });
    await hydratePrivateData();
    if (preferFallbackIdentity) {
      setProfile(prev => ({ ...prev, buyerName: submittedName, phone: fallbackPhone || prev?.phone || phone }));
    }
    await openRedirect(redirect);
  };

  const logout = () => {
    localStorage.removeItem(buyerTokenKey);
    localStorage.removeItem(buyerAccountKey);
    setBuyerToken("");
    setProfile({});
    setCart([]);
    setOrders([]);
    setAddresses([]);
    setInvoiceTitles([]);
    setCheckoutItems(null);
    setCurrentOrder(null);
    pushViewUrl("home");
    setPage("home");
  };

  const loadProductDetail = async (payload: AnyRecord) => {
    const productKey = String(payload?.id || "");
    if (!productKey) throw new Error("商品信息不存在");
    const cached = productDetailCacheRef.current.get(productKey);
    if (cached) return cached;
    const payloadIsDetail = payload?.raw && Object.prototype.hasOwnProperty.call(payload.raw, "skuListJson");
    if (payloadIsDetail) {
      productDetailCacheRef.current.set(productKey, payload);
      return payload;
    }
    const existing = productDetailRequestsRef.current.get(productKey);
    if (existing) return existing;
    const detailRequest = request<AnyRecord>(`/api/mall/products/${payload.id}`)
      .then(productFromApi)
      .then(detail => {
        productDetailCacheRef.current.set(productKey, detail);
        setProducts(current => current.map(item => String(item.id) === productKey ? detail : item));
        return detail;
      })
      .finally(() => productDetailRequestsRef.current.delete(productKey));
    productDetailRequestsRef.current.set(productKey, detailRequest);
    return detailRequest;
  };

  const go = async (next: Page, payload?: AnyRecord, options: AnyRecord = {}) => {
    if (!options.skipAuth && protectedPages.includes(next) && !isLoggedIn) {
      const redirect = next === "detail" && payload?.id ? `/product/${payload.id}` : redirectForPage(next);
      requireLogin(redirect);
      return;
    }
    if (next === "detail" && payload?.id) {
      const productKey = String(payload.id);
      const requestSeq = ++detailRequestSeqRef.current;
      const cachedDetail = productDetailCacheRef.current.get(productKey);
      const payloadIsDetail = payload?.raw && Object.prototype.hasOwnProperty.call(payload.raw, "skuListJson");
      if (payloadIsDetail) productDetailCacheRef.current.set(productKey, payload);
      const readyDetail = cachedDetail || (payloadIsDetail ? payload : null);
      if (readyDetail) {
        setSelectedProduct(readyDetail);
        setDetailQty(Object.fromEntries((readyDetail.specs || []).map((_: AnyRecord, idx: number) => [idx, 0])));
        setPage("detail");
        if (!options.skipUrl) pushViewUrl("detail", "", productKey);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setLoading(true);
      try {
        const detailPayload = await loadProductDetail(payload);
        if (detailRequestSeqRef.current !== requestSeq) return;
        setSelectedProduct(detailPayload);
        setDetailQty(Object.fromEntries((detailPayload.specs || []).map((_: AnyRecord, idx: number) => [idx, 0])));
      } catch {
        if (detailRequestSeqRef.current === requestSeq) {
          message.error("商品详情加载失败，请稍后重试");
        }
        return;
      } finally {
        snapshotWriteReadyRef.current = true;
        setLoading(false);
      }
      if (detailRequestSeqRef.current !== requestSeq) return;
      setPage("detail");
      if (!options.skipUrl) pushViewUrl("detail", "", productKey);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    detailRequestSeqRef.current += 1;
    let detailPayload = payload;
    if (next === "detail" && payload?.id && !payload?.raw?.detailContent) {
      try {
        detailPayload = productFromApi(await request<AnyRecord>(`/api/mall/products/${payload.id}`));
      } catch (error: any) {
        message.error(error?.message || "商品详情加载失败，请稍后重试");
      }
    }
    if (next === "detail" && detailPayload) {
      setSelectedProduct(detailPayload);
      setDetailQty(Object.fromEntries((detailPayload.specs || []).map((_: AnyRecord, idx: number) => [idx, 0])));
    }
    if (isLoggedIn || options.skipAuth) {
      if (next === "orders" && !(await apiGuard(hydrateOrders))) return;
      if (next === "cart" && !(await apiGuard(hydrateCart))) return;
      if (next === "addresses" && !(await apiGuard(hydrateAddresses))) return;
      if (next === "invoiceTitles" && !(await apiGuard(hydrateInvoiceTitles))) return;
    }
    setPage(next);
    if (!options.skipUrl) pushViewUrl(next, "", next === "detail" ? String(detailPayload?.id || payload?.id || "") : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const replaceMallQuery = (params: AnyRecord, nextPage: Page = "list") => {
    const query = cleanQueryParams(params);
    if (nextPage === "list") query.set("view", "list");
    const nextUrl = `${window.location.pathname}${query.toString() ? `?${query}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  };

  const searchProducts = async (keyword: string) => {
    const text = String(keyword || "").trim();
    if (!text) {
      await browseAllProducts();
      return;
    }
    await apiGuard(async () => {
      const rows = await request<AnyRecord[]>(`/api/mall/products?keyword=${encodeURIComponent(text)}`);
      const mapped = rows.map(productFromApi);
      setProducts(mapped);
      setFilters({ category: "全部分类", brand: "全部品牌" });
      const nextQuery = { ...listQuery, keyword: text, searchType: "", imageSearchId: "", page: 1 };
      setListQuery(nextQuery);
      setSearchSummary({ type: "text", keyword: text, count: mapped.length });
      replaceMallQuery(nextQuery, "list");
      setPage("list");
    });
  };

  const loadProductsByCategory = async (category: AnyRecord, targetPage: Page) => {
    const categoryId = category?.id;
    const categoryName = category?.categoryName || category?.name || "";
    const descendantNames = collectCategoryNames(category);
    const shouldIncludeChildren = descendantNames.length > 1;
    const nextQuery = defaultMallListQuery({ categoryId: categoryId || "", categoryName: categoryId ? "" : categoryName });
    const cacheKey = shouldIncludeChildren
      ? `category-tree:${descendantNames.join("|")}`
      : `category:${categoryId || categoryName}`;
    const applyProducts = (mapped: AnyRecord[]) => {
      setProducts(mapped);
      setFilters({ category: categoryName || "全部分类", brand: "全部品牌" });
      setListQuery(nextQuery);
      setSearchText("");
      setSearchSummary({ type: "category", categoryName, count: mapped.length });
      replaceMallQuery(nextQuery, targetPage);
      setPage(targetPage);
    };
    const cached = productCacheRef.current.get(cacheKey);
    if (cached) {
      applyProducts(cached);
      return;
    }
    await apiGuard(async () => {
      const query = categoryId ? `categoryId=${encodeURIComponent(categoryId)}` : `categoryName=${encodeURIComponent(categoryName)}`;
      const rows = shouldIncludeChildren
        ? await request<AnyRecord[]>("/api/mall/products")
        : await request<AnyRecord[]>(`/api/mall/products?${query}`);
      const mapped = rows
        .map(productFromApi)
        .filter((product: AnyRecord) => !shouldIncludeChildren || descendantNames.includes(product.category));
      productCacheRef.current.set(cacheKey, mapped);
      applyProducts(mapped);
    });
  };

  const searchByCategory = async (category: AnyRecord) => {
    await loadProductsByCategory(category, "list");
  };

  const browseHomeProductsByCategory = async (category: AnyRecord) => {
    await loadProductsByCategory(category, "home");
  };

  const browseAllProducts = async (targetPage: Page = "list") => {
    const applyProducts = (mapped: AnyRecord[]) => {
      setProducts(mapped);
      const nextQuery = defaultMallListQuery();
      setListQuery(nextQuery);
      setSearchText("");
      setFilters({ category: "全部分类", brand: "全部品牌" });
      setSearchSummary({ type: "all", count: mapped.length });
      replaceMallQuery(nextQuery);
      setPage(targetPage);
    };
    const cached = productCacheRef.current.get("all");
    if (cached) {
      applyProducts(cached);
      return;
    }
    await apiGuard(async () => {
      const rows = await request<AnyRecord[]>("/api/mall/products");
      const mapped = rows.map(productFromApi);
      productCacheRef.current.set("all", mapped);
      applyProducts(mapped);
    });
  };

  const browseHomeAllProducts = async () => {
    await browseAllProducts("home");
  };

  const searchProductsByImage = async (file: File) => {
    if (!file || imageSearchRequestRef.current) return;
    imageSearchRequestRef.current = true;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("topK", "20");
    setImageSearchLoading(true);
    try {
      const response = await request<any>("/api/mall/products/search-by-image", { method: "POST", data: formData });
      const rows = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
      const mapped = rows
        .map((row: AnyRecord) => productFromApi(imageSearchProductToApi(row)))
        .sort((a: AnyRecord, b: AnyRecord) => Number(b.similarity || 0) - Number(a.similarity || 0));
      setProducts(mapped);
      setFilters({ category: "全部分类", brand: "全部品牌" });
      const nextQuery = { ...listQuery, searchType: "image", imageSearchId: Date.now(), page: 1, sort: "similarity", order: "desc" };
      setListQuery(nextQuery);
      setSearchSummary({ type: "image", count: mapped.length });
      replaceMallQuery(nextQuery);
      setPage("list");
      if (!mapped.length) {
        message.open({ type: "warning", content: "未找到相似商品，请更换图片后重试", key: "mall-image-search-result", duration: 2 });
      }
    } catch (error: any) {
      const text = String(error?.message || "");
      if (/404|501|暂未接入|not implemented/i.test(text)) {
        message.open({ type: "warning", content: "图片搜索能力暂未接入，请联系管理员配置图片搜索服务", key: "mall-image-search-error", duration: 2 });
      } else {
        message.open({ type: "error", content: text || "图片搜索失败，请稍后重试", key: "mall-image-search-error", duration: 2 });
      }
    } finally {
      imageSearchRequestRef.current = false;
      setImageSearchLoading(false);
    }
  };

  const cartCount = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const checkoutRows = checkoutItems || cart.filter(item => item.checked !== false);
  const checkoutTotal = checkoutRows.reduce((sum, item) => sum + cartItemPrice(products, item) * Number(item.qty || 0), 0);

  const ctx = {
    message,
    products,
    categories,
    categoryRows,
    brands,
    cart,
    cartCount,
    setCart,
    orders,
    setOrders,
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
    searchText,
    setSearchText,
    searchSummary,
    setSearchSummary,
    listQuery,
    setListQuery,
    replaceMallQuery,
    imageSearchLoading,
    aiAssistantOpen,
    aiAssistantPosition,
    setAiAssistantOpen,
    isLoggedIn,
    buyerName: profile.buyerName || localStorage.getItem(buyerAccountKey) || "",
    loginRedirect,
    setLoginRedirect,
    showLoginGuide,
    setShowLoginGuide,
    searchProducts,
    searchProductsByImage,
    searchByCategory,
    browseHomeProductsByCategory,
    browseAllProducts,
    browseHomeAllProducts,
    go,
    hydrateCart,
    hydrateOrders,
    hydrateAddresses,
    hydrateInvoiceTitles,
    hydrateProfile,
    hydratePrivateData,
    loadProductDetail,
    requireLogin,
    completeLogin,
    logout,
    apiGuard
  };

  if (authPages.includes(page)) {
    return (
      <Layout className="mall-auth-shell">
        <div className="mall-auth-header">
          <button type="button" className="mall-auth-logo" onClick={() => go("home", undefined, { skipAuth: true })}>
            <div className="admin-logo" style={{ width: 40, height: 40, fontSize: 16 }}>B</div>
            <span>夏至商城</span>
          </button>
        </div>
        <AuthPage ctx={ctx} type={page} />
      </Layout>
    );
  }

  return (
    <Layout className="mall-shell">
      <div className="mall-welcome-bar">
        <div className="mall-welcome-inner">
          {isLoggedIn ? (
            <span className="mall-welcome-text">您好，{ctx.buyerName || "采购用户"} <button type="button" onClick={logout}>退出登录</button></span>
          ) : (
            <span className="mall-welcome-text">您好，欢迎来到夏至商城！ <button type="button" onClick={() => requireLogin("/mall")}>请登录</button><span className="mall-welcome-separator">或</span><button type="button" onClick={() => { setLoginRedirect(""); setPage("register"); window.history.pushState({}, "", authPath("register")); }}>免费注册</button></span>
          )}
          <div className="mall-top-links">
            <button type="button" onClick={() => go("cart")}><ShoppingCartOutlined />购物车（{cartCount}）</button>
            <button type="button" onClick={() => go("orders")}><ProfileOutlined />我的订单</button>
            <button type="button" onClick={() => go("profile")}><UserOutlined />个人中心</button>
          </div>
        </div>
      </div>
      <div className="mall-header">
        <div className="mall-logo" onClick={() => go("home")}><div className="admin-logo" style={{ width: 36, height: 36, fontSize: 16 }}>B</div>夏至商城</div>
        <MallSearchBar ctx={ctx} />
        <Button ref={aiButtonRef} className="mall-ai-header-button" type="primary" icon={<RobotOutlined />} onClick={openAiAssistant}>AI助手</Button>
      </div>
      <main className={`mall-main is-${page}`}>
        <div className="mall-live-content">
          {page === "home" && <HomePage ctx={ctx} loading={false} />}
          {page === "list" && <ListPage ctx={ctx} loading={false} />}
          {page === "detail" && <DetailPage ctx={ctx} />}
          {page === "cart" && <CartPage ctx={ctx} loading={false} />}
          {page === "confirm" && <ConfirmPage ctx={ctx} />}
          {page === "pay" && <PayPage ctx={ctx} />}
          {page === "orders" && <OrdersPage ctx={ctx} loading={false} />}
          {page === "orderDetail" && <OrderDetailPage ctx={ctx} />}
          {page === "addresses" && <AddressPage ctx={ctx} loading={false} />}
          {page === "invoiceTitles" && <InvoiceTitlePage ctx={ctx} loading={false} />}
          {page === "history" && <BrowseHistoryPage ctx={ctx} />}
          {page === "profile" && <ProfilePage ctx={ctx} />}
          {page === "login" && <AuthPage ctx={ctx} type="login" />}
          {page === "register" && <AuthPage ctx={ctx} type="register" />}
        </div>
        <GlobalLoadingMask visible={loading} />
      </main>
      <MallFloatingToolbar ctx={ctx} />
      <MallAiAssistant ctx={ctx} />
      {!isLoggedIn && showLoginGuide ? <MallLoginGuide ctx={ctx} /> : null}
    </Layout>
  );
}

function productFromApi(item: AnyRecord) {
  const cardImage = mallProductCardImageSrc(item);
  const mainImage = String(item.mainImageUrl || item.mainImageCardUrl || item.mainImageThumbnailUrl || item.thumbnailUrl || "").trim();
  const saleMode = item.saleMode === "BATCH" ? "BATCH" : "NORMAL";
  const saleUnit = String(item.saleUnit || "").trim();
  const baseUnit = item.unit || "件";
  const displayUnit = saleMode === "BATCH" && saleUnit ? saleUnit : baseUnit;
  const skuRows = parseRows(item.skuListJson || item.skuList);
  const specValueImageMap = new Map<string, string>();
  skuRows.forEach((row: AnyRecord) => {
    normalizeSkuSpecValues(row.specValues).forEach((cell: AnyRecord) => {
      const image = safeMallImageUrl(cell.image);
      if (image) specValueImageMap.set(mallSpecValueImageKey(cell), image);
    });
  });
  const specs = skuRows.length ? skuRows.map((row, index) => {
    const specValues = normalizeSkuSpecValues(row.specValues).map((cell: AnyRecord) => ({
      ...cell,
      image: safeMallImageUrl(cell.image) || specValueImageMap.get(mallSpecValueImageKey(cell)) || ""
    }));
    return {
      code: row.skuCode || item.skuCode || `${item.id || item.productId}-${index}`,
      barcode: row.skuBarcode || row.barCode || row.barcode || item.skuBarcode || item.barCode || item.barcode || "",
      name: row.skuName || item.skuName || "默认规格",
      image: mallSkuImageSrc(row) || firstSpecValueImage(specValues),
      price: Number(row.salePrice ?? item.salePrice ?? 0),
      stock: Number(row.stockQuantity ?? item.stockQuantity ?? 0),
      min: Number(row.minOrderQuantity ?? item.minOrderQuantity ?? 1),
      status: row.skuStatus || "ENABLED",
      specValues,
      tierPrices: parseRows(row.tierPrices)
    };
  }) : [{
    code: item.skuCode,
    barcode: item.skuBarcode || item.barCode || item.barcode || "",
    name: item.skuName || "默认规格",
    image: mallSkuImageSrc(item),
    price: Number(item.salePrice || 0),
    stock: Number(item.stockQuantity || 0),
    min: Number(item.minOrderQuantity || 1),
    status: item.skuStatus || "ENABLED",
    specValues: [],
    tierPrices: []
  }];
  const detail = parseDetailContent(item.detailContent || "");
  const tierPrices = parseRows(item.tierPricesJson || item.tierPrices);
  const customAttributes = productCustomAttributes(item.customAttributes || item.customAttributesJson);
  const carouselImages = uniqueTruthy([mainImage, ...(detail.carouselImages || [])]).slice(0, 5);
  const gallery = carouselImages.length ? carouselImages : uniqueTruthy([mainImage]);
  return {
    id: Number(item.id || item.productId),
    apiId: Number(item.id || item.productId),
    name: item.productName,
    category: item.categoryName || "后台商品",
    brand: item.brandName || "B2B",
    unit: displayUnit,
    baseUnit,
    saleMode,
    saleUnit,
    saleUnitRatio: Number(item.saleUnitRatio || 0) || null,
    rawQuoteType: item.quoteType,
    quoteType: item.quoteType === "TIER_PRICE" ? "阶梯报价" : "规格独立报价",
    image: mainImage,
    cardImage,
    pinyinCode: item.pinyinCode || "",
    pinyinFull: item.pinyinFull || "",
    initialCode: item.initialCode || item.mnemonicCode || "",
    skuCode: item.skuCode || "",
    barCode: item.barCode || item.skuBarcode || "",
    similarity: Number(item.similarity || 0) || null,
    carouselImages,
    gallery,
    detailText: detail.text,
    detailImageUrl: detail.imageUrl,
    customAttributes,
    tierPrices,
    specs,
    specGroups: buildMallSpecGroups(specs),
    raw: item
  };
}

function mallProductCardImageSrc(item: AnyRecord) {
  const src = String(item?.mainImageCardUrl || item?.cardImage || item?.mainImageThumbnailUrl || item?.thumbnailUrl || item?.mainImageUrl || item?.image || "").trim();
  if (!src) return "";
  if (src.toLowerCase().startsWith("data:image")) return "";
  return src;
}

function MallProductCardCover({ product }: { product: AnyRecord }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? "" : mallProductCardImageSrc(product);
  if (!src) {
    return <div className="product-card-img" style={{ display: "grid", placeItems: "center", fontWeight: 800, color: "#4e7cff" }}>{product?.brand?.[0] || "商"}</div>;
  }
  return <img className="product-card-img" src={src} loading="lazy" decoding="async" alt={product?.name || ""} onError={() => setFailed(true)} />;
}

function productCustomAttributes(value: any) {
  return parseRows(value)
    .map((row: AnyRecord, index: number) => ({
      key: String(row.fieldId || row.id || row.name || `attribute-${index}`),
      name: String(row.name || row.attributeName || row.fieldName || "").trim(),
      value: String(row.value ?? row.attributeValue ?? row.fieldValue ?? "").trim()
    }))
    .filter((row: AnyRecord) => row.name && row.value);
}

function imageSearchProductToApi(row: AnyRecord) {
  return {
    id: row.productId || row.id,
    productName: row.productName || row.name,
    categoryName: row.categoryName,
    brandName: row.brandName,
    mainImageCardUrl: row.mainImageCardUrl || row.cardUrl,
    mainImageThumbnailUrl: row.mainImageThumbnailUrl || row.thumbnailUrl,
    mainImageUrl: row.imageUrl || row.image || row.mainImageUrl,
    salePrice: row.price || row.salePrice || 0,
    stockQuantity: row.stockQuantity || 0,
    minOrderQuantity: row.minOrderQuantity || 1,
    saleStatus: "ON_SALE",
    similarity: row.similarity,
    skuCode: row.skuCode,
    skuBarcode: row.barCode || row.skuBarcode
  };
}

function uniqueTruthy(values: any[]) {
  return Array.from(new Set(values.map(value => String(value || "").trim()).filter(Boolean)));
}

function mallSkuImageSrc(value: any) {
  return String(
    value?.skuImageUrl
    || value?.specImageUrl
    || value?.specImage
    || value?.imageUrl
    || value?.image
    || value?.imagePath
    || value?.picUrl
    || value?.pic
    || value?.url
    || value?.specValueImageUrl
    || value?.specValueImage
    || value?.valueImageUrl
    || value?.valueImage
    || ""
  ).trim();
}

function normalizeSkuSpecValues(value: any) {
  if (!Array.isArray(value)) return [];
  return value
    .map((cell, index) => ({
      groupId: String(cell?.groupId || cell?.groupName || `group_${index}`),
      groupName: String(cell?.groupName || `规格${index + 1}`),
      valueId: String(cell?.valueId || cell?.value || ""),
      value: String(cell?.value || ""),
      image: mallSkuImageSrc(cell)
    }))
    .filter(cell => cell.value);
}

function mallSpecValueImageKey(cell: AnyRecord) {
  return `${String(cell?.groupId || cell?.groupName || "")}:${String(cell?.valueId || cell?.value || "")}`;
}

function firstSpecValueImage(specValues: AnyRecord[]) {
  return String((specValues || []).find(cell => safeMallImageUrl(cell.image))?.image || "");
}

function buildMallSpecGroups(specs: AnyRecord[]) {
  const groups: AnyRecord[] = [];
  const groupMap = new Map<string, AnyRecord>();
  specs.forEach((spec: AnyRecord) => {
    (spec.specValues || []).forEach((cell: AnyRecord, index: number) => {
      const groupKey = cell.groupId || cell.groupName || `group_${index}`;
      let group = groupMap.get(groupKey);
      if (!group) {
        group = { key: groupKey, name: cell.groupName || `规格${index + 1}`, values: [] };
        groupMap.set(groupKey, group);
        groups.push(group);
      }
      const valueKey = cell.valueId || cell.value;
      if (!group.values.some((item: AnyRecord) => item.key === valueKey || item.value === cell.value)) {
        group.values.push({ key: valueKey, value: cell.value, image: cell.image || "" });
      }
    });
  });

  if (!groups.length) {
    return [{
      key: "default_spec",
      name: "规格",
      values: specs.map((spec: AnyRecord, index: number) => ({
        key: spec.code || String(index),
        value: spec.name || "默认规格",
        image: spec.image || ""
      }))
    }];
  }

  return groups;
}

function cartFromApi(item: AnyRecord) {
  return {
    cartItemId: String(item.cartItemId || item.id),
    productId: Number(item.productId),
    specIndex: Number(item.specIndex || 0),
    qty: Number(item.quantity || item.qty || 1),
    checked: item.checked !== false,
    raw: item
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
    orderTime: orderDateTimeText(order.createdAt),
    receiverName: order.receiverName,
    receiverPhone: order.receiverPhone,
    receiverAddress: order.receiverAddress,
    items: order.items || [],
    raw: order
  };
}

function orderDateTimeText(value: any) {
  if (!value) return "-";
  const normalized = String(value).replace("T", " ").replace(/\.\d+.*$/, "");
  if (normalized.length >= 19) return normalized.slice(0, 19);
  if (normalized.length === 16) return `${normalized}:00`;
  return normalized;
}

function addressFromApi(item: AnyRecord) {
  const region = item.region === "-" ? "" : item.region || "";
  const detailAddress = item.detailAddress || "";
  return {
    id: item.id,
    name: item.receiverName,
    phone: item.receiverPhone,
    region,
    detailAddress,
    address: item.receiverAddress || [region, detailAddress].filter(Boolean).join(" ") || item.fullAddress,
    isDefault: Boolean(item.isDefault)
  };
}

function invoiceTitleFromApi(item: AnyRecord) {
  return { ...item, title: item.title || item.invoiceTitle, taxNo: item.taxNo || item.taxpayerNo };
}

function MallSearchBar({ ctx }: any) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const setSearchImage = (file: File | null) => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    if (!file) {
      setImageFile(null);
      setImagePreview("");
      return;
    }
    if (!mallImageSearchTypes.includes(file.type)) {
      ctx.message.warning("当前图片格式不支持");
      return;
    }
    if (file.size > mallImageSearchMaxSize) {
      ctx.message.warning("图片大小不能超过 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const pickImageFromItems = (items: DataTransferItemList | null) => {
    if (!items) return false;
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setSearchImage(file);
          return true;
        }
      }
    }
    return false;
  };

  const submit = () => {
    if (imageFile) {
      ctx.searchProductsByImage(imageFile);
      return;
    }
    ctx.searchProducts(ctx.searchText);
  };

  return (
    <div
      className={`mall-search ${dragging ? "is-dragging" : ""}`}
      onDragOver={event => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        const file = Array.from(event.dataTransfer.files || []).find((item: File) => item.type.startsWith("image/"));
        if (file) setSearchImage(file);
      }}
    >
      <Input
        value={ctx.searchText}
        placeholder="搜索商品名称 / 拼音码，支持粘贴图片搜索"
        allowClear
        onChange={event => ctx.setSearchText(event.target.value)}
        onPressEnter={submit}
        onPaste={event => {
          if (pickImageFromItems(event.clipboardData?.items || null)) {
            event.preventDefault();
          }
        }}
        prefix={<SearchOutlined />}
        suffix={
          <Button
            type="text"
            icon={<CameraOutlined />}
            aria-label="上传商品图片搜索"
            onClick={() => fileInputRef.current?.click()}
          />
        }
      />
      <Button type="primary" icon={<SearchOutlined />} loading={ctx.imageSearchLoading} onClick={submit}>搜索</Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp"
        hidden
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) setSearchImage(file);
          event.target.value = "";
        }}
      />
      {imagePreview ? (
        <div className="mall-search-preview">
          <img src={imagePreview} alt="" />
          <div className="mall-search-preview-text">
            <b>已识别到图片</b>
            <span>点击搜索将查询相似商品</span>
            <small>{Math.ceil((imageFile?.size || 0) / 1024)} KB</small>
          </div>
          <Button type="text" icon={<CloseOutlined />} onClick={() => setSearchImage(null)} />
        </div>
      ) : null}
    </div>
  );
}

function buildCategoryTree(rows: AnyRecord[]) {
  const nodes = rows.map((row: AnyRecord) => ({
    ...row,
    name: row.categoryName || row.name,
    parentName: row.parentName || "-",
    children: []
  }));
  const byName = new Map(nodes.map((node: AnyRecord) => [node.name, node]));
  const roots: AnyRecord[] = [];
  nodes.forEach((node: AnyRecord) => {
    const parent = byName.get(node.parentName);
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function findCategoryPath(rows: AnyRecord[], categoryName: string) {
  const byName = new Map((rows || []).map((row: AnyRecord) => [row.categoryName || row.name, row]));
  const path: AnyRecord[] = [];
  let current = byName.get(categoryName);
  if (!current && categoryName) {
    return [{ categoryName, name: categoryName }];
  }
  const visited = new Set<string>();
  while (current) {
    const name = current.categoryName || current.name;
    if (!name || visited.has(name)) break;
    visited.add(name);
    path.unshift(current);
    const parentName = current.parentName || "-";
    current = byName.get(parentName);
  }
  return path;
}

function MallCategoryBreadcrumb({ ctx, product }: any) {
  const path = findCategoryPath(ctx.categoryRows || [], product?.category || product?.categoryName || "");
  return (
    <div className="mall-category-breadcrumb">
      <span className="mall-category-breadcrumb-label">商品分类：</span>
      <button type="button" onClick={() => ctx.browseHomeAllProducts()}>全部商品</button>
      {path.map((item: AnyRecord, index: number) => {
        const name = item.categoryName || item.name;
        return (
          <React.Fragment key={`${name}-${index}`}>
            <span className="mall-category-separator">/</span>
            <button type="button" onClick={() => ctx.browseHomeProductsByCategory(item)}>{name}</button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function categoryNodeContainsName(node: AnyRecord, name: string) {
  if (!name) return false;
  if ((node.categoryName || node.name) === name) return true;
  return (node.children || []).some((child: AnyRecord) => categoryNodeContainsName(child, name));
}

function collectCategoryNames(category: AnyRecord) {
  if (!category) return [];
  return Array.from(new Set([
    category.categoryName || category.name,
    ...((category.children || []).flatMap((child: AnyRecord) => collectCategoryNames(child)))
  ].map(name => String(name || "").trim()).filter(Boolean)));
}

function categoryNodeName(node: AnyRecord) {
  return node?.categoryName || node?.name || "";
}

function findCategoryNodeInTree(nodes: AnyRecord[], name: string): AnyRecord | null {
  if (!name) return null;
  for (const node of nodes || []) {
    if (categoryNodeName(node) === name) return node;
    const child = findCategoryNodeInTree(node.children || [], name);
    if (child) return child;
  }
  return null;
}

function homeSubcategoryState(rows: AnyRecord[], selectedCategoryName: string) {
  const tree = buildCategoryTree(rows || []);
  const selected = findCategoryNodeInTree(tree, selectedCategoryName);
  if (!selected) return { root: null, selected: null, children: [] };
  const path = findCategoryPath(rows || [], selectedCategoryName);
  const rootName = categoryNodeName(path[0] || selected);
  const root = findCategoryNodeInTree(tree, rootName) || selected;
  return { root, selected, children: root.children || [] };
}

function HomeCategoryNav({ rows, onChoose, onAll, selectedCategoryName }: any) {
  const tree = buildCategoryTree(rows || []);

  return (
    <aside className="mall-category-sidebar">
      <button
        type="button"
        className={`mall-category-title ${!selectedCategoryName ? "is-active" : ""}`}
        onClick={onAll}
      >
        <AppstoreOutlined />全部分类
      </button>
      {tree.length ? tree.map((item: AnyRecord) => (
        <button
          type="button"
          key={item.id || item.name}
          className={`mall-category-root ${categoryNodeContainsName(item, selectedCategoryName) ? "is-active" : ""}`}
          onClick={() => onChoose(item)}
        >
          <span>{item.name}</span>
        </button>
      )) : <div className="mall-category-empty">暂无分类</div>}
    </aside>
  );
}

function HomeSubcategoryTabs({ rows, selectedCategoryName, onChoose }: any) {
  const { root, selected, children } = homeSubcategoryState(rows || [], selectedCategoryName);
  if (!root || !children.length) return null;
  const rootName = categoryNodeName(root);
  const selectedName = categoryNodeName(selected);
  return (
    <div className="mall-home-subcategory-bar">
      <button
        type="button"
        className={selectedName === rootName ? "is-active" : ""}
        onClick={() => onChoose(root)}
      >
        全部
      </button>
      {children.map((child: AnyRecord) => {
        const childName = categoryNodeName(child);
        return (
          <button
            type="button"
            key={child.id || childName}
            className={selectedName === childName ? "is-active" : ""}
            onClick={() => onChoose(child)}
          >
            {childName}
          </button>
        );
      })}
    </div>
  );
}

function HomePage({ ctx, loading }: any) {
  const selectedCategoryName = ctx.filters?.category && ctx.filters.category !== "全部分类" ? ctx.filters.category : "";
  const subcategoryState = homeSubcategoryState(ctx.categoryRows || [], selectedCategoryName);
  const sectionTitle = subcategoryState.root ? categoryNodeName(subcategoryState.root) : selectedCategoryName || "全部商品";
  const clearCategory = selectedCategoryName ? (
    <Button type="link" className="mall-home-clear-category" onClick={ctx.browseHomeAllProducts}>清空分类</Button>
  ) : null;
  return (
    <div className="mall-home-layout">
      <HomeCategoryNav
        rows={ctx.categoryRows}
        selectedCategoryName={selectedCategoryName}
        onChoose={ctx.browseHomeProductsByCategory}
        onAll={ctx.browseHomeAllProducts}
      />
      <main className="mall-home-content">
        <Section title={sectionTitle} extra={clearCategory}>
          <HomeSubcategoryTabs
            rows={ctx.categoryRows}
            selectedCategoryName={selectedCategoryName}
            onChoose={ctx.browseHomeProductsByCategory}
          />
          <ProductGrid products={ctx.products} ctx={ctx} loading={loading} />
        </Section>
      </main>
    </div>
  );
}

function Section({ title, extra, children }: any) {
  return <Card title={title} extra={extra}>{children}</Card>;
}

function ProductGrid({ products, ctx, loading }: any) {
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [quickBuyLoading, setQuickBuyLoading] = useState(false);
  const [quickBuyProduct, setQuickBuyProduct] = useState<AnyRecord | null>(null);
  const openQuickBuy = async (event: any, product: AnyRecord) => {
    event.stopPropagation();
    if (!ctx.isLoggedIn) {
      ctx.requireLogin(`/product/${product.id}`);
      return;
    }
    setQuickBuyProduct(null);
    setQuickBuyOpen(true);
    setQuickBuyLoading(true);
    try {
      setQuickBuyProduct(await ctx.loadProductDetail(product));
    } catch (error: any) {
      setQuickBuyOpen(false);
      ctx.message.error(error?.message || "商品详情加载失败，请稍后重试");
    } finally {
      setQuickBuyLoading(false);
    }
  };
  return (
    <div className="product-grid-shell" aria-busy={loading}>
      {!products.length ? (
        <Empty description="暂无匹配商品，请调整搜索关键词或筛选条件" />
      ) : (
        <div className="product-grid">
          {products.map((p: AnyRecord) => (
            <Card
              key={p.id}
              className="mall-product-card"
              hoverable
              onClick={() => ctx.isLoggedIn ? ctx.go("detail", p) : ctx.requireLogin(`/product/${p.id}`)}
              cover={<MallProductCardCover product={p} />}
            >
              <div className="mall-product-card-body">
                <div className="mall-product-card-title" title={p.name}>{p.name}</div>
                {p.similarity ? <Tag color="blue" className="mall-product-similarity">相似度 {Math.round(Number(p.similarity) * 100)}%</Tag> : null}
                <div className="mall-product-card-price">{money(firstPrice(p))}<span> / {stockUnitForProduct(p)}</span></div>
                <div className="mall-product-card-foot">
                  <div>
                    <span>库存：{productStockText(p)}</span>
                  </div>
                  <Button
                    type="primary"
                    size="small"
                     className="mall-product-cart-icon"
                     icon={<ShoppingCartOutlined />}
                     aria-label="选择规格并购买"
                     title="选择规格并购买"
                     onClick={(event) => openQuickBuy(event, p)}
                   />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <QuickBuyModal
        ctx={ctx}
        open={quickBuyOpen}
        loading={quickBuyLoading}
        product={quickBuyProduct}
        onClose={() => setQuickBuyOpen(false)}
      />
    </div>
  );
}

function QuickBuyModal({ ctx, open, loading, product, onClose }: any) {
  const [selectedSpecValues, setSelectedSpecValues] = useState<AnyRecord>({});
  const [qtyMap, setQtyMap] = useState<AnyRecord>({});
  const [activeImage, setActiveImage] = useState("");
  const [submitting, setSubmitting] = useState<"cart" | "buy" | "">("");

  useEffect(() => {
    if (!open || !product) return;
    setSelectedSpecValues(defaultSpecSelection(product));
    setQtyMap(Object.fromEntries((product.specs || []).map((_: AnyRecord, index: number) => [index, 0])));
    setActiveImage(product.gallery?.[0] || product.image || "");
    setSubmitting("");
  }, [open, product?.id]);

  const selected = Object.entries(qtyMap).filter(([, qty]) => Number(qty) > 0);
  const totalQty = selected.reduce((sum, [, qty]) => sum + Number(qty), 0);
  const totalAmount = product
    ? selected.reduce((sum, [index, qty]) => sum + detailUnitPrice(product, Number(index), totalQty) * Number(qty), 0)
    : 0;
  const selectionGroups = product ? selectionGroupsFor(product) : [];
  const displaySelectionGroups = visibleSelectionGroupsForProduct(product, selectionGroups);
  const lastGroup = product ? lastSkuGroupFor(product) : null;
  const isSingleSpecProduct = lastGroup?.key === "default_spec";
  const visibleSpecs = product ? product.specs
    .map((spec: AnyRecord, index: number) => ({ ...spec, originalIndex: index }))
    .filter((spec: AnyRecord) => specMatchesSelection(spec, selectedSpecValues, selectionGroups, product)) : [];
  const priceTiers = product ? tierRowsForProduct(product) : [];
  const stockUnitLabel = product ? stockUnitForProduct(product) : "件";
  const quantityStep = product ? quantityStepForProduct(product) : 1;
  const batchSaleTip = product ? batchSaleTipForProduct(product) : "";

  const setSkuQty = (specIndex: number, value: any) => {
    const spec = product?.specs?.[specIndex] || {};
    const next = clampQty(value, Number(spec.stock || 0));
    setQtyMap((old: AnyRecord) => ({ ...old, [specIndex]: next }));
  };

  const increaseQty = (specIndex: number) => {
    const spec = product?.specs?.[specIndex] || {};
    const current = Number(qtyMap[specIndex] || 0);
    const minimum = nextValidPurchaseQty(product, Number(spec.min || 1));
    setSkuQty(specIndex, current <= 0 ? minimum : current + quantityStep);
  };

  const chooseSpecValue = (group: AnyRecord, value: AnyRecord) => {
    setSelectedSpecValues(normalizeSpecSelection(product, { ...selectedSpecValues, [group.key]: value.key }));
  };

  const purchaseRows = () => {
    const rows = selectedItemsForProduct(product, qtyMap, ctx.message);
    if (rows === null) return null;
    if (!rows.length) {
      ctx.message.warning("请选择采购数量");
      return null;
    }
    return rows;
  };

  const addToCart = async () => {
    const rows = purchaseRows();
    if (!rows) return;
    setSubmitting("cart");
    try {
      for (const row of rows) {
        await request("/api/mall/cart/items", { method: "POST", data: { productId: product.id, quantity: row.qty, specIndex: row.specIndex } });
      }
      await ctx.hydrateCart();
      ctx.message.open({ type: "success", content: "已加入购物车", key: "mall-cart-add", duration: 1.2 });
      onClose();
    } catch (error: any) {
      ctx.message.error(error?.message || "加入购物车失败");
    } finally {
      setSubmitting("");
    }
  };

  const buyNow = () => {
    const rows = purchaseRows();
    if (!rows) return;
    setSubmitting("buy");
    ctx.setCheckoutItems(rows.map((row: AnyRecord) => ({ productId: product.id, specIndex: row.specIndex, qty: row.qty, checked: true })));
    onClose();
    ctx.go("confirm");
  };

  return (
    <Modal
      open={open}
      footer={null}
      width={1280}
      centered
      destroyOnHidden
      className="mall-quick-buy-modal"
      onCancel={submitting ? undefined : onClose}
    >
      {loading || !product ? (
        <div className="mall-quick-buy-loading">商品详情加载中...</div>
      ) : (
        <div className="mall-detail-layout mall-quick-buy-layout">
          <div className="mall-detail-gallery">
            {activeImage ? <Image src={activeImage} className="mall-detail-main-image" preview={false} /> : <div className="mall-detail-image-placeholder">暂无图片</div>}
            {product.gallery?.length ? (
              <div className="mall-detail-thumbs">
                {product.gallery.map((url: string) => (
                  <button key={url} type="button" className={`mall-detail-thumb ${activeImage === url ? "is-active" : ""}`} onClick={() => setActiveImage(url)}>
                    <img src={url} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mall-detail-buy">
            <Typography.Title level={2} className="mall-detail-title">{product.name}</Typography.Title>
            <div className="mall-detail-meta"><span>{product.category}</span><span>{product.brand}</span></div>
            <div className="mall-detail-price-panel">
              {priceTiers.length ? priceTiers.map((tier: AnyRecord, index: number) => (
                <div className="mall-detail-price-tier" key={`${tier.minQty || 1}-${index}`}>
                  <div className="mall-detail-price">{money(tier.price)}</div>
                  <div className="mall-detail-threshold">{Number(tier.minQty || 1) <= 1 ? `${Number(tier.minQty || 1)}${stockUnitLabel}起批` : `≥${Number(tier.minQty)}${stockUnitLabel}`}</div>
                </div>
              )) : (
                <div className="mall-detail-price-tier">
                  <div className="mall-detail-price">{money(firstPrice(product))}</div>
                  <div className="mall-detail-threshold">{Math.max(1, minOrderQtyForProduct(product))}{stockUnitLabel}起批</div>
                </div>
              )}
            </div>

            <div className={`mall-detail-spec-area ${isSingleSpecProduct ? "is-single-spec" : ""}`}>
              {displaySelectionGroups.map((group: AnyRecord, groupIndex: number) => (
                <div className="mall-detail-spec-row" key={group.key}>
                  <div className="mall-detail-spec-label">{group.name}</div>
                  <div className="mall-detail-spec-options">
                    {group.values.map((value: AnyRecord) => {
                      const disabled = !specOptionHasStock(product, group, value, selectedSpecValues, selectionGroups);
                      const active = selectedSpecValues[group.key] === value.key;
                      const optionQty = selectedQtyForOption(product, group, value, qtyMap);
                      return (
                        <Badge key={value.key} count={optionQty} size="small" offset={[-2, 2]}>
                          <button type="button" className={`mall-detail-spec-option ${active ? "is-active" : ""}`} disabled={disabled} onClick={() => chooseSpecValue(group, value)}>
                            {shouldShowSpecOptionImage(groupIndex, group) ? <SpecImageThumb src={value.image} /> : null}
                            <span>{value.value}</span>
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className={`mall-detail-sku-box ${batchSaleTip ? "" : "is-plain"} ${isSingleSpecProduct ? "is-single-spec" : ""}`}>
                {batchSaleTip || !isSingleSpecProduct ? <div className="mall-detail-sku-top">
                  {!isSingleSpecProduct ? <div className="mall-detail-sku-group-name">{lastGroup?.name || "规格"}</div> : null}
                  {batchSaleTip ? <div className="mall-detail-batch-tip"><ExclamationCircleFilled /><span>{batchSaleTip}</span></div> : null}
                </div> : null}
                <div className="mall-detail-sku-list">
                  {visibleSpecs.length ? visibleSpecs.map((spec: AnyRecord) => {
                    const specIndex = Number(spec.originalIndex);
                    const qty = Number(qtyMap[specIndex] || 0);
                    const soldOut = spec.status === "DISABLED" || Number(spec.stock || 0) <= 0;
                    return (
                      <div className={`mall-detail-sku-row ${soldOut ? "is-sold-out" : ""}`} key={`${spec.code}-${specIndex}`}>
                        <div className="mall-detail-sku-name">{isSingleSpecProduct ? <em>SKU条码:{spec.barcode || "-"}</em> : <><span>{skuRowLabel(spec, lastGroup, product)}</span><em>SKU条码:{spec.barcode || "-"}</em></>}</div>
                        <div className="mall-detail-sku-price">{money(detailUnitPrice(product, specIndex, totalQty))}</div>
                        <div className="mall-detail-sku-stock">{Number(spec.stock || 0)} {stockUnitLabel}</div>
                        {soldOut ? <div className="mall-detail-stock-empty">库存不足</div> : <div className="mall-detail-stepper">
                          <Button icon={<MinusOutlined />} disabled={qty <= 0} onClick={() => setSkuQty(specIndex, qty - quantityStep)} />
                          <InputNumber min={0} max={Number(spec.stock || 0)} step={quantityStep} controls={false} precision={0} value={qty} disabled={soldOut} onChange={value => setSkuQty(specIndex, value)} />
                          <Button icon={<PlusOutlined />} disabled={soldOut || qty + quantityStep > Number(spec.stock || 0)} onClick={() => increaseQty(specIndex)} />
                        </div>}
                      </div>
                    );
                  }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前规格暂无可购 SKU" />}
                </div>
              </div>
            </div>

            <div className="mall-detail-summary">
              <span>已选 <b>{selected.length}</b> 款 <b>{totalQty}</b> {stockUnitLabel}</span>
              <span>商品金额：<b>{money(totalAmount)}</b></span>
              <span>另需运费：¥0.00</span>
            </div>
            <div className="mall-detail-actions">
              <Button className="mall-detail-primary-action" size="large" loading={submitting === "buy"} disabled={Boolean(submitting && submitting !== "buy")} onClick={buyNow}>立即下单</Button>
              <Button className="mall-detail-secondary-action" size="large" loading={submitting === "cart"} disabled={Boolean(submitting && submitting !== "cart")} onClick={addToCart}>加入购物车</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function productStock(product: AnyRecord) {
  return (product.specs || []).reduce((sum: number, spec: AnyRecord) => sum + Number(spec.stock || 0), 0);
}

function productStockText(product: AnyRecord) {
  return `${productStock(product)}${stockUnitForProduct(product)}`;
}

function productMinOrderText(product: AnyRecord) {
  const min = Math.max(1, ...((product.specs || []).map((spec: AnyRecord) => Number(spec.min || 1))));
  return `${min}${purchaseUnitLabel(product)}`;
}

function productCreatedAt(product: AnyRecord) {
  return new Date(product.raw?.createdAt || product.raw?.updatedAt || 0).getTime() || 0;
}

function listBrandOptions(products: AnyRecord[], fallbackBrands: string[]) {
  const names = new Map<string, number>();
  products.forEach((product: AnyRecord) => {
    if (product.brand) names.set(product.brand, (names.get(product.brand) || 0) + 1);
  });
  fallbackBrands.forEach((brand: string) => {
    if (brand) names.set(brand, names.get(brand) || 0);
  });
  return Array.from(names.entries()).map(([name, count]) => ({ name, count }));
}

function applyListQuery(products: AnyRecord[], query: AnyRecord) {
  let rows = [...products];
  if (query.brandName) {
    rows = rows.filter((product: AnyRecord) => product.brand === query.brandName);
  }
  const minPrice = query.minPrice === "" ? null : Number(query.minPrice);
  const maxPrice = query.maxPrice === "" ? null : Number(query.maxPrice);
  if (minPrice !== null && Number.isFinite(minPrice)) rows = rows.filter((product: AnyRecord) => firstPrice(product) >= minPrice);
  if (maxPrice !== null && Number.isFinite(maxPrice)) rows = rows.filter((product: AnyRecord) => firstPrice(product) <= maxPrice);
  if (query.inStock) {
    rows = rows.filter((product: AnyRecord) => productStock(product) > 0);
  }

  const sort = query.sort || "comprehensive";
  const order = query.order || "";
  rows.sort((a: AnyRecord, b: AnyRecord) => {
    if (sort === "price") {
      const diff = firstPrice(a) - firstPrice(b);
      return order === "desc" ? -diff : diff;
    }
    if (sort === "createdAt") return productCreatedAt(b) - productCreatedAt(a);
    if (sort === "stock") return productStock(b) - productStock(a);
    if (sort === "sales") return Number(b.raw?.salesCount || 0) - Number(a.raw?.salesCount || 0);
    if (sort === "similarity") return Number(b.similarity || 0) - Number(a.similarity || 0);
    return Number(b.similarity || 0) - Number(a.similarity || 0);
  });
  return rows;
}

function ListPage({ ctx, loading }: any) {
  const query = ctx.listQuery || {};
  const summary = ctx.searchSummary || {};
  const [brandExpanded, setBrandExpanded] = useState(false);
  const [priceDraft, setPriceDraft] = useState({ minPrice: query.minPrice || "", maxPrice: query.maxPrice || "" });
  const brandOptions = listBrandOptions(ctx.products, ctx.brands);
  const visibleBrands = brandExpanded ? brandOptions : brandOptions.slice(0, 10);
  const filteredRows = applyListQuery(ctx.products, query);
  const pageSize = Number(query.pageSize || mallListPageSize);
  const currentPage = Math.max(1, Math.min(Number(query.page || 1), Math.max(1, Math.ceil(filteredRows.length / pageSize))));
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPriceDraft({ minPrice: query.minPrice || "", maxPrice: query.maxPrice || "" });
  }, [query.minPrice, query.maxPrice]);

  const updateListQuery = (patch: AnyRecord) => {
    const next = { ...query, ...patch };
    if (!("page" in patch)) next.page = 1;
    ctx.setListQuery(next);
    ctx.replaceMallQuery(next);
  };

  const applyPrice = () => {
    const min = priceDraft.minPrice === "" ? "" : Number(priceDraft.minPrice);
    const max = priceDraft.maxPrice === "" ? "" : Number(priceDraft.maxPrice);
    if (min !== "" && max !== "" && min > max) {
      ctx.message.warning("最低价不能大于最高价");
      return;
    }
    updateListQuery({ minPrice: min === "" ? "" : min, maxPrice: max === "" ? "" : max });
  };

  const clearFilters = () => {
    updateListQuery({ brandName: "", brandId: "", minPrice: "", maxPrice: "", sort: "comprehensive", order: "", inStock: false, page: 1 });
  };

  const chooseSort = (sort: string) => {
    if (sort === "price") {
      const nextOrder = query.sort === "price" && query.order === "asc" ? "desc" : "asc";
      updateListQuery({ sort: "price", order: nextOrder });
      return;
    }
    updateListQuery({ sort, order: sort === "similarity" ? "desc" : "" });
  };

  const summaryTitle = summary.type === "text"
    ? `搜索结果：${summary.keyword || query.keyword || ""}`
    : summary.type === "image" || query.searchType === "image"
      ? "图片搜索结果"
      : "全部商品";
  const summaryCountText = summary.type === "image" || query.searchType === "image"
    ? `共找到 ${filteredRows.length} 个相似商品`
    : `共找到 ${filteredRows.length} 个商品`;

  return (
    <div className="mall-list-page">
      <Card className="mall-search-result-card">
        <div><b>{summaryTitle}</b><span>{summaryCountText}</span></div>
      </Card>

      <Card className="mall-filter-card">
        <div className="mall-filter-row">
          <span className="mall-filter-label">品牌：</span>
          <button type="button" className={!query.brandName ? "is-active" : ""} onClick={() => updateListQuery({ brandName: "", brandId: "" })}>全部</button>
          {visibleBrands.map((brand: AnyRecord) => (
            <button
              type="button"
              key={brand.name}
              className={query.brandName === brand.name ? "is-active" : ""}
              onClick={() => updateListQuery({ brandName: query.brandName === brand.name ? "" : brand.name, brandId: "" })}
            >
              {brand.name}
            </button>
          ))}
          {brandOptions.length > 10 ? <Button type="link" onClick={() => setBrandExpanded(!brandExpanded)}>{brandExpanded ? "收起" : "更多"}</Button> : null}
        </div>

        <div className="mall-price-filter-row">
          <span className="mall-filter-label">价格筛选：</span>
          <InputNumber min={0} value={priceDraft.minPrice === "" ? null : Number(priceDraft.minPrice)} placeholder="最低价" onChange={(value) => setPriceDraft(old => ({ ...old, minPrice: value ?? "" }))} />
          <span>-</span>
          <InputNumber min={0} value={priceDraft.maxPrice === "" ? null : Number(priceDraft.maxPrice)} placeholder="最高价" onChange={(value) => setPriceDraft(old => ({ ...old, maxPrice: value ?? "" }))} />
          <Button onClick={applyPrice}>确定</Button>
        </div>

        {(query.brandName || query.minPrice || query.maxPrice) ? (
          <div className="mall-selected-filters">
            {query.brandName ? <Tag closable onClose={(event) => { event.preventDefault(); updateListQuery({ brandName: "", brandId: "" }); }}>品牌：{query.brandName}</Tag> : null}
            {(query.minPrice || query.maxPrice) ? <Tag closable onClose={(event) => { event.preventDefault(); updateListQuery({ minPrice: "", maxPrice: "" }); }}>价格区间：{query.minPrice || "不限"}-{query.maxPrice || "不限"}</Tag> : null}
            <Button type="link" onClick={clearFilters}>清空筛选</Button>
          </div>
        ) : null}
      </Card>

      <Card className="mall-sort-card">
        <div className="mall-sort-row">
          <button type="button" className={query.sort === "comprehensive" ? "is-active" : ""} onClick={() => chooseSort("comprehensive")}>综合</button>
          <button type="button" className={query.sort === "sales" ? "is-active" : ""} onClick={() => chooseSort("sales")}>销量</button>
          <button type="button" className={query.sort === "price" ? "is-active" : ""} onClick={() => chooseSort("price")}>价格 {query.sort === "price" ? (query.order === "desc" ? "↓" : "↑") : "↕"}</button>
          <button type="button" className={query.sort === "createdAt" ? "is-active" : ""} onClick={() => chooseSort("createdAt")}>上架时间</button>
          <button type="button" className={query.sort === "stock" ? "is-active" : ""} onClick={() => chooseSort("stock")}>库存优先</button>
          <label><span>仅看有货</span><Switch className="mall-stock-switch" checked={Boolean(query.inStock)} onChange={(checked) => updateListQuery({ inStock: checked })} /></label>
        </div>
      </Card>

      <ProductGrid products={pageRows} ctx={ctx} loading={loading} />
      {!pageRows.length && filteredRows.length === 0 ? <Button className="mall-empty-clear" onClick={clearFilters}>清空筛选</Button> : null}
      <div className="mall-list-pagination">
        <Pagination
          current={currentPage}
          pageSize={pageSize}
          total={filteredRows.length}
          showSizeChanger={{ showSearch: false }}
          pageSizeOptions={["10", "20", "50", "100"]}
          showTotal={(total) => `共 ${total} 条`}
          onChange={(page, nextPageSize) => updateListQuery({ page, pageSize: nextPageSize })}
        />
      </div>
    </div>
  );
}

function DetailPage({ ctx }: any) {
  const p = ctx.selectedProduct;
  const [selectedSpecValues, setSelectedSpecValues] = useState<AnyRecord>({});
  const [activeImage, setActiveImage] = useState("");
  const carouselRef = useRef<any>(null);

  useEffect(() => {
    if (!p) return;
    setActiveImage(p.gallery?.[0] || p.image || "");
    setSelectedSpecValues(defaultSpecSelection(p));
  }, [p?.id]);

  if (!p) return <Card className="mall-detail-card"><Empty description="商品详情加载中..." /></Card>;
  const selected = Object.entries(ctx.detailQty).filter(([, qty]) => Number(qty) > 0);
  const totalQty = selected.reduce((sum, [, qty]) => sum + Number(qty), 0);
  const totalAmount = selected.reduce((sum, [idx, qty]) => sum + detailUnitPrice(p, Number(idx), totalQty) * Number(qty), 0);
  const unitLabel = purchaseUnitLabel(p);
  const stockUnitLabel = stockUnitForProduct(p);
  const quantityStep = quantityStepForProduct(p);
  const batchSaleTip = batchSaleTipForProduct(p);
  const selectionGroups = selectionGroupsFor(p);
  const displaySelectionGroups = visibleSelectionGroupsForProduct(p, selectionGroups);
  const lastGroup = lastSkuGroupFor(p);
  const isSingleSpecProduct = lastGroup?.key === "default_spec";
  const useCarouselImages = (p.gallery || []).length > 1;
  const visibleSpecs = p.specs
    .map((spec: AnyRecord, index: number) => ({ ...spec, originalIndex: index }))
    .filter((spec: AnyRecord) => specMatchesSelection(spec, selectedSpecValues, selectionGroups, p));
  const priceTiers = tierRowsForProduct(p);

  const setSkuQty = (specIndex: number, value: any) => {
    const spec = p.specs?.[specIndex] || {};
    const next = clampQty(value, Number(spec.stock || 0));
    ctx.setDetailQty((old: AnyRecord) => ({ ...old, [specIndex]: next }));
  };

  const increaseQty = (specIndex: number) => {
    const spec = p.specs?.[specIndex] || {};
    const current = Number(ctx.detailQty[specIndex] || 0);
    const min = nextValidPurchaseQty(p, Number(spec.min || 1));
    setSkuQty(specIndex, current <= 0 ? min : current + quantityStep);
  };

  const chooseSpecValue = (group: AnyRecord, value: AnyRecord) => {
    const next = normalizeSpecSelection(p, { ...selectedSpecValues, [group.key]: value.key });
    setSelectedSpecValues(next);
  };

  const submitCart = async (jump: boolean) => {
    if (!ctx.isLoggedIn) {
      ctx.requireLogin(`/product/${p.id}`);
      return;
    }
    const rows = selectedItems(ctx);
    if (rows === null) return;
    if (!rows.length) return ctx.message.warning("请选择采购数量");
    await ctx.apiGuard(async () => {
      for (const row of rows) {
        await request("/api/mall/cart/items", { method: "POST", data: { productId: p.id, quantity: row.qty, specIndex: row.specIndex } });
      }
      await ctx.hydrateCart();
      ctx.message.open({ type: "success", content: "已加入购物车", key: "mall-cart-add", duration: 1.2 });
      if (jump) ctx.go("cart");
    });
  };

  const buyNow = async () => {
    if (!ctx.isLoggedIn) {
      ctx.requireLogin(`/product/${p.id}`);
      return;
    }
    const selectedRows = selectedItems(ctx);
    if (selectedRows === null) return;
    const rows = selectedRows.map((row: AnyRecord) => ({ productId: p.id, specIndex: row.specIndex, qty: row.qty, checked: true }));
    if (!rows.length) return ctx.message.warning("请选择采购数量");
    ctx.setCheckoutItems(rows);
    ctx.go("confirm");
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <MallCategoryBreadcrumb ctx={ctx} product={p} />
      <Card className="mall-detail-card">
        <div className="mall-detail-layout">
          <div className="mall-detail-gallery">
            {useCarouselImages ? (
              <Carousel
                ref={carouselRef}
                autoplay
                autoplaySpeed={3000}
                dots={false}
                afterChange={(index) => setActiveImage(p.gallery?.[index] || "")}
                className="mall-detail-carousel"
              >
                {p.gallery.map((url: string) => (
                  <div key={url}>
                    <img src={url} className="mall-detail-main-image" alt="" />
                  </div>
                ))}
              </Carousel>
            ) : activeImage ? <Image src={activeImage} className="mall-detail-main-image" /> : <div className="mall-detail-image-placeholder">暂无图片</div>}
            {p.gallery?.length ? (
              <div className="mall-detail-thumbs">
                {p.gallery.map((url: string, index: number) => (
                  <button key={url} type="button" className={`mall-detail-thumb ${activeImage === url ? "is-active" : ""}`} onClick={() => {
                    setActiveImage(url);
                    if (useCarouselImages) carouselRef.current?.goTo?.(index);
                  }}>
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mall-detail-buy">
            <Typography.Title level={2} className="mall-detail-title">{p.name}</Typography.Title>
            <div className="mall-detail-meta">
              <span>{p.category}</span>
              <span>{p.brand}</span>
            </div>

            <div className="mall-detail-price-panel">
              {priceTiers.length ? priceTiers.map((tier: AnyRecord, index: number) => (
                <div className="mall-detail-price-tier" key={`${tier.minQty || 1}-${index}`}>
                  <div className="mall-detail-price">{money(tier.price)}</div>
                  <div className="mall-detail-threshold">{Number(tier.minQty || 1) <= 1 ? `${Number(tier.minQty || 1)}${stockUnitLabel}起批` : `≥${Number(tier.minQty)}${stockUnitLabel}`}</div>
                </div>
              )) : (
                <div className="mall-detail-price-tier">
                  <div className="mall-detail-price">{money(firstPrice(p))}</div>
                  <div className="mall-detail-threshold">{Math.max(1, minOrderQtyForProduct(p))}{stockUnitLabel}起批</div>
                </div>
              )}
            </div>

            <div className={`mall-detail-spec-area ${isSingleSpecProduct ? "is-single-spec" : ""}`}>
              {displaySelectionGroups.map((group: AnyRecord, groupIndex: number) => (
                <div className="mall-detail-spec-row" key={group.key}>
                  <div className="mall-detail-spec-label">{group.name}</div>
                  <div className="mall-detail-spec-options">
                    {group.values.map((value: AnyRecord) => {
                      const disabled = !specOptionHasStock(p, group, value, selectedSpecValues, selectionGroups);
                      const active = selectedSpecValues[group.key] === value.key;
                      const optionQty = selectedQtyForOption(p, group, value, ctx.detailQty);
                      return (
                        <Badge key={value.key} count={optionQty} size="small" offset={[-2, 2]}>
                          <button
                            type="button"
                            className={`mall-detail-spec-option ${active ? "is-active" : ""}`}
                            disabled={disabled}
                            onClick={() => chooseSpecValue(group, value)}
                          >
                            {shouldShowSpecOptionImage(groupIndex, group) ? <SpecImageThumb src={value.image} /> : null}
                            <span>{value.value}</span>
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className={`mall-detail-sku-box ${batchSaleTip ? "" : "is-plain"} ${isSingleSpecProduct ? "is-single-spec" : ""}`}>
                {batchSaleTip || !isSingleSpecProduct ? <div className="mall-detail-sku-top">
                  {!isSingleSpecProduct ? <div className="mall-detail-sku-group-name">{lastGroup?.name || "规格"}</div> : null}
                  {batchSaleTip ? (
                    <div className="mall-detail-batch-tip">
                      <ExclamationCircleFilled />
                      <span>{batchSaleTip}</span>
                    </div>
                  ) : null}
                </div> : null}
                <div className="mall-detail-sku-list">
                  {visibleSpecs.length ? visibleSpecs.map((spec: AnyRecord) => {
                    const specIndex = Number(spec.originalIndex);
                    const qty = Number(ctx.detailQty[specIndex] || 0);
                    const soldOut = spec.status === "DISABLED" || Number(spec.stock || 0) <= 0;
                    return (
                      <div className={`mall-detail-sku-row ${soldOut ? "is-sold-out" : ""}`} key={`${spec.code}-${specIndex}`}>
                        <div className="mall-detail-sku-name">
                          {isSingleSpecProduct ? <em>SKU条码:{spec.barcode || "-"}</em> : <><span>{skuRowLabel(spec, lastGroup, p)}</span><em>SKU条码:{spec.barcode || "-"}</em></>}
                        </div>
                        <div className="mall-detail-sku-price">{money(detailUnitPrice(p, specIndex, totalQty))}</div>
                        <div className="mall-detail-sku-stock">{Number(spec.stock || 0)} {stockUnitLabel}</div>
                        {soldOut ? <div className="mall-detail-stock-empty">库存不足</div> : <div className="mall-detail-stepper">
                          <Button icon={<MinusOutlined />} disabled={qty <= 0} onClick={() => setSkuQty(specIndex, qty - quantityStep)} />
                          <InputNumber min={0} max={Number(spec.stock || 0)} step={quantityStep} controls={false} precision={0} value={qty} disabled={soldOut} onChange={value => setSkuQty(specIndex, value)} />
                          <Button icon={<PlusOutlined />} disabled={soldOut || qty + quantityStep > Number(spec.stock || 0)} onClick={() => increaseQty(specIndex)} />
                        </div>}
                      </div>
                    );
                  }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前规格暂无可购 SKU" />}
                </div>
              </div>
            </div>

            <div className="mall-detail-summary">
              <span>已选 <b>{selected.length}</b> 款 <b>{totalQty}</b> {stockUnitLabel}</span>
              <span>商品金额：<b>{money(totalAmount)}</b></span>
              <span>另需运费：¥0.00</span>
            </div>

            <div className="mall-detail-actions">
              <Button className="mall-detail-primary-action" size="large" onClick={buyNow}>立即下单</Button>
              <Button className="mall-detail-secondary-action" size="large" onClick={() => submitCart(false)}>加入购物车</Button>
            </div>
          </div>
        </div>
      </Card>
      <ProductAttributeCard attributes={p.customAttributes || []} />
      <Card title="商品详情">
        <div className="product-detail-render" dangerouslySetInnerHTML={{ __html: p.detailText || "暂无详情" }} />
        {p.detailImageUrl ? <Image src={p.detailImageUrl} className="detail-image" /> : null}
      </Card>
    </Space>
  );
}

function ProductAttributeCard({ attributes }: { attributes: AnyRecord[] }) {
  const rows = Array.isArray(attributes) ? attributes.filter(item => item?.name && String(item?.value ?? "").trim()) : [];
  if (!rows.length) return null;
  return (
    <Card title="商品属性" className="mall-product-attributes-card">
      <div className="mall-product-attributes-table">
        {rows.map((item: AnyRecord) => (
          <React.Fragment key={item.key || item.name}>
            <div className="mall-product-attribute-name">{item.name}</div>
            <div className="mall-product-attribute-value" title={String(item.value || "-")}>{item.value || "-"}</div>
          </React.Fragment>
        ))}
        {rows.length % 2 ? (
          <>
            <div className="mall-product-attribute-name is-empty" />
            <div className="mall-product-attribute-value is-empty" />
          </>
        ) : null}
      </div>
    </Card>
  );
}

function selectionGroupsFor(product: AnyRecord) {
  const groups = product?.specGroups || [];
  if (groups.length <= 1) return groups;
  return groups.slice(0, -1);
}

function visibleSelectionGroupsForProduct(product: AnyRecord, groups = selectionGroupsFor(product)) {
  return groups.filter((group: AnyRecord) => groups.length > 1 || (group.values || []).length > 1);
}

function lastSkuGroupFor(product: AnyRecord) {
  const groups = product?.specGroups || [];
  return groups.length ? groups[groups.length - 1] : null;
}

function specCellForGroup(spec: AnyRecord, group: AnyRecord) {
  if (!group) return null;
  if (group.key === "default_spec") {
    return { valueId: spec.code, value: spec.name };
  }
  return (spec.specValues || []).find((cell: AnyRecord) => cell.groupId === group.key || cell.groupName === group.name);
}

function specMatchesGroup(spec: AnyRecord, group: AnyRecord, valueKey: string) {
  const cell = specCellForGroup(spec, group);
  return Boolean(cell && String(cell.valueId || cell.value) === String(valueKey));
}

function specMatchesSelection(spec: AnyRecord, selection: AnyRecord, groups: AnyRecord[], product: AnyRecord) {
  const activeGroups = groups.length ? groups : selectionGroupsFor(product);
  return activeGroups.every((group: AnyRecord) => {
    const selectedValue = selection[group.key];
    return !selectedValue || specMatchesGroup(spec, group, selectedValue);
  });
}

function specOptionHasStock(product: AnyRecord, group: AnyRecord, value: AnyRecord, selection: AnyRecord, groups: AnyRecord[]) {
  const groupPosition = groups.findIndex((item: AnyRecord) => item.key === group.key);
  return (product.specs || []).some((spec: AnyRecord) => {
    if (!specMatchesGroup(spec, group, value.key)) return false;
    const otherGroupsMatch = groups.every((item: AnyRecord, index: number) => item.key === group.key || index > groupPosition || !selection[item.key] || specMatchesGroup(spec, item, selection[item.key]));
    return otherGroupsMatch && spec.status !== "DISABLED" && Number(spec.stock || 0) > 0;
  });
}

function selectedQtyForOption(product: AnyRecord, group: AnyRecord, value: AnyRecord, qtyMap: AnyRecord) {
  return (product.specs || []).reduce((sum: number, spec: AnyRecord, index: number) => {
    if (!specMatchesGroup(spec, group, value.key)) return sum;
    return sum + Number(qtyMap[index] || 0);
  }, 0);
}

function defaultSpecSelection(product: AnyRecord) {
  return normalizeSpecSelection(product, {});
}

function normalizeSpecSelection(product: AnyRecord, current: AnyRecord) {
  const next = { ...current };
  const groups = selectionGroupsFor(product);
  groups.forEach((group: AnyRecord) => {
    const currentValue = next[group.key];
    const currentOk = group.values.some((value: AnyRecord) => value.key === currentValue && specOptionHasStock(product, group, value, next, groups));
    if (currentOk) return;
    const firstAvailable = group.values.find((value: AnyRecord) => specOptionHasStock(product, group, value, next, groups)) || group.values[0];
    if (firstAvailable) next[group.key] = firstAvailable.key;
  });
  return next;
}

function skuRowLabel(spec: AnyRecord, lastGroup: AnyRecord, product: AnyRecord) {
  const cell = specCellForGroup(spec, lastGroup);
  if (cell?.value) return cell.value;
  if (lastGroup?.key === "default_spec") return spec.name || "默认规格";
  return spec.name || product?.name || "默认规格";
}

function clampQty(value: any, stock: number) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(Math.floor(number), Math.max(0, Number(stock || 0))));
}

function minOrderQtyForProduct(product: AnyRecord) {
  const mins = (product.specs || []).map((spec: AnyRecord) => Number(spec.min || 1)).filter((value: number) => value > 0);
  return mins.length ? Math.min(...mins) : 1;
}

function tierRowsForProduct(product: AnyRecord) {
  const rows = parseRows(product?.tierPrices)
    .map((row: AnyRecord) => ({ minQty: Number(row.minQty || 1), maxQty: row.maxQty, price: Number(row.price || 0) }))
    .filter((row: AnyRecord) => row.minQty > 0 && row.price > 0);
  if (rows.length) return rows.sort((a: AnyRecord, b: AnyRecord) => Number(a.minQty || 1) - Number(b.minQty || 1));

  const skuTierRows = (product?.specs || [])
    .flatMap((spec: AnyRecord) => parseRows(spec.tierPrices))
    .map((row: AnyRecord) => ({ minQty: Number(row.minQty || 1), maxQty: row.maxQty, price: Number(row.price || 0) }))
    .filter((row: AnyRecord) => row.minQty > 0 && row.price > 0);
  const unique = new Map<string, AnyRecord>();
  skuTierRows.forEach((row: AnyRecord) => unique.set(`${row.minQty}-${row.price}`, row));
  return Array.from(unique.values()).sort((a: AnyRecord, b: AnyRecord) => Number(a.minQty || 1) - Number(b.minQty || 1));
}

function purchaseUnitLabel(product: AnyRecord) {
  return product?.saleMode === "BATCH" && product?.saleUnit ? product.saleUnit : (product?.unit || product?.baseUnit || "件");
}

function stockUnitForProduct(product: AnyRecord) {
  return product?.baseUnit || product?.unit || "件";
}

function quantityStepForProduct(product: AnyRecord) {
  if (product?.saleMode !== "BATCH") return 1;
  return Math.max(1, Number(product?.saleUnitRatio || 1));
}

function batchSaleTipForProduct(product: AnyRecord) {
  if (product?.saleMode !== "BATCH") return "";
  const saleUnit = product?.saleUnit || purchaseUnitLabel(product);
  const stockUnit = stockUnitForProduct(product);
  const ratio = Number(product?.saleUnitRatio || 0);
  if (saleUnit && ratio > 0) return `按${saleUnit}购买，每${saleUnit}${ratio}${stockUnit}`;
  if (saleUnit) return `按${saleUnit}购买`;
  return "";
}

function nextValidPurchaseQty(product: AnyRecord, qty: number) {
  const step = quantityStepForProduct(product);
  const min = Math.max(1, Number(qty || 1));
  return Math.max(step, Math.ceil(min / step) * step);
}

function selectedItems(ctx: AnyRecord) {
  return selectedItemsForProduct(ctx.selectedProduct, ctx.detailQty, ctx.message);
}

function selectedItemsForProduct(product: AnyRecord, qtyMap: AnyRecord, messageApi: AnyRecord) {
  const rows = Object.entries(qtyMap || {})
    .filter(([, qty]) => Number(qty) > 0)
    .map(([idx, qty]) => ({ specIndex: Number(idx), qty: Number(qty), spec: product?.specs?.[Number(idx)] }));
  const invalid = rows.find(row => row.qty < Number(row.spec?.min || 1));
  if (invalid) {
    messageApi.warning("未满足最小起订量");
    return null;
  }
  const overStock = rows.find(row => row.qty > Number(row.spec?.stock || 0));
  if (overStock) {
    messageApi.warning("采购数量不能超过库存");
    return null;
  }
  const step = quantityStepForProduct(product);
  const invalidStep = product?.saleMode === "BATCH" && step > 1 ? rows.find(row => row.qty % step !== 0) : null;
  if (invalidStep) {
    messageApi.warning(`采购数量需按 ${step}${stockUnitForProduct(product)} 的倍数填写`);
    return null;
  }
  return rows;
}

const mallCartSkuStateKey = "b2b-erp-mall-cart-sku-state";

function readCartSkuState() {
  try {
    const rows = JSON.parse(localStorage.getItem(mallCartSkuStateKey) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function persistCartSkuState(rows: AnyRecord[]) {
  try {
    localStorage.setItem(mallCartSkuStateKey, JSON.stringify(rows.map(row => ({
      productId: row.productId,
      specIndex: row.specIndex,
      qty: row.qty
    }))));
  } catch {
    // Ignore private-mode and storage quota failures.
  }
}

function cartSkuRowKey(row: AnyRecord) {
  return `${row.productId}:${row.specIndex}`;
}

function safeMallImageUrl(value: any) {
  const src = String(value || "").trim();
  return src && !src.toLowerCase().startsWith("data:image") ? src : "";
}

function SpecImageThumb({ src, className = "" }: { src?: any; className?: string }) {
  const safeSrc = safeMallImageUrl(src);
  return safeSrc
    ? <img className={className || undefined} src={safeSrc} alt="" loading="lazy" decoding="async" />
    : <span className={`mall-spec-image-placeholder ${className}`.trim()} aria-label="暂无规格图片"><PictureOutlined /></span>;
}

function shouldShowSpecOptionImage(groupIndex: number, group: AnyRecord) {
  return groupIndex === 0 || (group?.values || []).some((value: AnyRecord) => safeMallImageUrl(value.image));
}

function cartSpecText(spec: AnyRecord) {
  const values = (spec?.specValues || []).map((cell: AnyRecord) => String(cell.value || "").trim()).filter(Boolean);
  return values.length ? values.join("；") : spec?.name || "默认规格";
}

function cartRowInvalidReason(product: AnyRecord, row: AnyRecord) {
  const rawSaleStatus = String(product?.raw?.saleStatus || product?.raw?.productStatus || "").toUpperCase();
  if (!product?.name || (rawSaleStatus && rawSaleStatus !== "ON_SALE")) return "商品已下架";
  const spec = product?.specs?.[Number(row?.specIndex || 0)];
  if (!spec) return "规格已停用";
  if (String(spec.status || "ENABLED").toUpperCase() === "DISABLED") return "规格已停用";
  if (Number(spec.stock || 0) <= 0) return "库存为 0";
  return "";
}

function groupCartRows(rows: AnyRecord[]) {
  return Object.values(rows.reduce((groups: AnyRecord, row: AnyRecord) => {
    const key = String(row.productId);
    if (!groups[key]) groups[key] = { productId: row.productId, cartItemId: row.cartItemId, checked: row.checked !== false, rows: [] };
    groups[key].rows.push(row);
    groups[key].checked = groups[key].rows.every((item: AnyRecord) => item.checked !== false);
    return groups;
  }, {}));
}

function CartPage({ ctx, loading }: any) {
  const [cartRows, setCartRows] = useState<AnyRecord[]>([]);
  const [cartProducts, setCartProducts] = useState<Record<string, AnyRecord>>({});
  const [cartReady, setCartReady] = useState(false);
  const [specSelector, setSpecSelector] = useState<AnyRecord | null>(null);
  const [updatingQtyKeys, setUpdatingQtyKeys] = useState<Set<string>>(new Set());
  const defaultAddress = ctx.addresses.find((item: AnyRecord) => item.isDefault) || ctx.addresses[0];

  useEffect(() => {
    let cancelled = false;
    const hydrateCartDetails = async () => {
      const productEntries = await Promise.all(ctx.cart.map(async (item: AnyRecord) => {
        const listProduct = ctx.products.find((product: AnyRecord) => Number(product.id) === Number(item.productId))
          || (item.raw?.productName ? productFromApi(item.raw) : { id: item.productId });
        try {
          return [String(item.productId), await ctx.loadProductDetail(listProduct)];
        } catch {
          return [String(item.productId), listProduct];
        }
      }));
      if (cancelled) return;
      const productMap = Object.fromEntries(productEntries);
      const nextRows = ctx.cart.flatMap((item: AnyRecord) => {
        return [{
          cartItemId: item.cartItemId,
          productId: item.productId,
          specIndex: Number(item.specIndex || 0),
          qty: Number(item.qty || 1),
          checked: item.checked !== false
        }];
      });
      const normalizedRows = nextRows.map((row: AnyRecord) => ({
        ...row,
        checked: cartRowInvalidReason(productMap[String(row.productId)], row) ? false : row.checked !== false
      }));
      setCartProducts(productMap);
      setCartRows(normalizedRows);
      persistCartSkuState(normalizedRows);
      setCartReady(true);
    };
    hydrateCartDetails();
    return () => { cancelled = true; };
  }, [ctx.cart]);

  const validRows = cartRows.filter(row => !cartRowInvalidReason(cartProducts[String(row.productId)], row));
  const invalidRows = cartRows.filter(row => cartRowInvalidReason(cartProducts[String(row.productId)], row));
  const productGroups = groupCartRows(validRows);
  const invalidGroups = groupCartRows(invalidRows);

  const rowMatchesCartItem = (item: AnyRecord, row: AnyRecord) => {
    const itemCartId = item.cartItemId || item.id;
    if (itemCartId && row.cartItemId) return String(itemCartId) === String(row.cartItemId);
    return Number(item.productId) === Number(row.productId) && Number(item.specIndex || 0) === Number(row.specIndex || 0);
  };

  const commitRows = (nextRows: AnyRecord[]) => {
    setCartRows(nextRows);
    persistCartSkuState(nextRows);
    ctx.setCart((current: AnyRecord[]) => current
      .filter(item => nextRows.some(row => rowMatchesCartItem(item, row)))
      .map(item => {
        const matching = nextRows.find(row => rowMatchesCartItem(item, row));
        return matching ? {
          ...item,
          cartItemId: matching.cartItemId || item.cartItemId,
          productId: matching.productId,
          specIndex: Number(matching.specIndex || 0),
          qty: Number(matching.qty || 0),
          checked: matching.checked !== false
        } : item;
      }));
  };

  const updateRowQty = async (row: AnyRecord, value: number) => {
    const rowKey = cartSkuRowKey(row);
    if (updatingQtyKeys.has(rowKey)) return;
    const product = cartProducts[String(row.productId)];
    const spec = product?.specs?.[Number(row.specIndex || 0)] || {};
    const minimum = nextValidPurchaseQty(product, Number(spec.min || 1));
    const step = quantityStepForProduct(product);
    const next = Math.max(minimum, Number(value || minimum));
    if (next > Number(spec.stock || 0)) {
      ctx.message.warning("库存不足，无法继续增加");
      return;
    }
    const normalized = product?.saleMode === "BATCH" ? Math.ceil(next / step) * step : next;
    const previousQty = Number(row.qty || minimum);
    const optimisticRows = cartRows.map(item => cartSkuRowKey(item) === rowKey ? { ...item, qty: normalized } : item);
    setUpdatingQtyKeys(current => new Set(current).add(rowKey));
    setCartRows(optimisticRows);
    persistCartSkuState(optimisticRows);
    try {
      await request(`/api/mall/cart/items/${row.cartItemId}`, { method: "PUT", data: { quantity: normalized } });
      ctx.setCart((current: AnyRecord[]) => current.map(item => rowMatchesCartItem(item, row) ? { ...item, qty: normalized } : item));
    } catch (error: any) {
      setCartRows(current => {
        const revertedRows = current.map(item => cartSkuRowKey(item) === rowKey ? { ...item, qty: previousQty } : item);
        persistCartSkuState(revertedRows);
        return revertedRows;
      });
      ctx.message.error(error?.message || "数量更新失败，请稍后重试");
    } finally {
      setUpdatingQtyKeys(current => {
        const nextKeys = new Set(current);
        nextKeys.delete(rowKey);
        return nextKeys;
      });
    }
  };

  const toggleProduct = (group: AnyRecord, checked: boolean) => ctx.apiGuard(async () => {
    await Promise.all(group.rows.map((row: AnyRecord) => request(`/api/mall/cart/items/${row.cartItemId}`, { method: "PUT", data: { checked } })));
    commitRows(cartRows.map(row => Number(row.productId) === Number(group.productId) && !cartRowInvalidReason(cartProducts[String(row.productId)], row) ? { ...row, checked } : row));
  });

  const toggleAll = (checked: boolean) => ctx.apiGuard(async () => {
    await Promise.all(validRows.map((row: AnyRecord) => request(`/api/mall/cart/items/${row.cartItemId}`, { method: "PUT", data: { checked } })));
    commitRows(cartRows.map(row => cartRowInvalidReason(cartProducts[String(row.productId)], row) ? { ...row, checked: false } : { ...row, checked }));
  });

  const removeRow = (row: AnyRecord) => ctx.apiGuard(async () => {
    const nextRows = cartRows.filter(item => cartSkuRowKey(item) !== cartSkuRowKey(row));
    await request(`/api/mall/cart/items/${row.cartItemId}`, { method: "DELETE" });
    commitRows(nextRows);
    ctx.message.success("商品已删除");
  });

  const removeProduct = (group: AnyRecord) => ctx.apiGuard(async () => {
    const productRows = cartRows.filter(row => Number(row.productId) === Number(group.productId));
    const groupKeys = new Set(productRows.map(cartSkuRowKey));
    await Promise.all(productRows.map((row: AnyRecord) => request(`/api/mall/cart/items/${row.cartItemId}`, { method: "DELETE" })));
    commitRows(cartRows.filter(row => !groupKeys.has(cartSkuRowKey(row))));
    setSpecSelector(null);
    ctx.message.success("商品已从购物车删除");
  });

  const deleteSelected = () => ctx.apiGuard(async () => {
    await Promise.all(selectedRows.map((row: AnyRecord) => request(`/api/mall/cart/items/${row.cartItemId}`, { method: "DELETE" })));
    const selectedKeys = new Set(selectedRows.map(cartSkuRowKey));
    const nextRows = cartRows.filter(row => !selectedKeys.has(cartSkuRowKey(row)));
    commitRows(nextRows);
    ctx.message.success("已删除选中商品");
  });

  const applySpecSelection = (specIndex: number) => ctx.apiGuard(async () => {
    const target = specSelector;
    if (!target) return;
    const productId = Number(target.productId);
    let nextRows = [...cartRows];
    const existingIndex = nextRows.findIndex(row => Number(row.productId) === productId && Number(row.specIndex) === Number(specIndex));
    const sourceIndex = target.mode === "edit" ? nextRows.findIndex(row => cartSkuRowKey(row) === target.rowKey) : -1;
    const qty = Number(target.qty || nextRows[sourceIndex]?.qty || 1);
    const mergedQty = existingIndex >= 0 && existingIndex !== sourceIndex ? Number(nextRows[existingIndex].qty || 0) + qty : qty;
    const targetStock = Number(cartProducts[String(productId)]?.specs?.[specIndex]?.stock || 0);
    if (mergedQty > targetStock) {
      ctx.message.warning("所选规格库存不足");
      return;
    }
    if (target.mode === "edit") {
      if (sourceIndex < 0) return;
      if (existingIndex >= 0 && existingIndex !== sourceIndex) {
        const existingRow = nextRows[existingIndex];
        const sourceRow = nextRows[sourceIndex];
        await request(`/api/mall/cart/items/${existingRow.cartItemId}`, { method: "PUT", data: { quantity: mergedQty } });
        await request(`/api/mall/cart/items/${sourceRow.cartItemId}`, { method: "DELETE" });
      } else {
        const sourceRow = nextRows[sourceIndex];
        if (Number(sourceRow.specIndex) !== Number(specIndex)) {
          await request(`/api/mall/cart/items/${sourceRow.cartItemId}`, { method: "DELETE" });
          const created = await request("/api/mall/cart/items", { method: "POST", data: { productId, specIndex, quantity: qty } });
          if (sourceRow.checked === false) {
            await request(`/api/mall/cart/items/${created.cartItemId}`, { method: "PUT", data: { checked: false } });
          }
        }
      }
    } else if (existingIndex >= 0) {
      await request(`/api/mall/cart/items/${nextRows[existingIndex].cartItemId}`, { method: "PUT", data: { quantity: mergedQty } });
    } else {
      await request("/api/mall/cart/items", { method: "POST", data: { productId, specIndex, quantity: qty } });
    }
    await ctx.hydrateCart();
    setSpecSelector(null);
  });

  const applyAddedSpecs = (items: AnyRecord[]) => ctx.apiGuard(async () => {
    const target = specSelector;
    if (!target) return;
    const productId = Number(target.productId);
    const product = cartProducts[String(productId)];
    const qtyMap = Object.fromEntries(items.map(item => [item.specIndex, item.qty]));
    const selected = selectedItemsForProduct(product, qtyMap, ctx.message);
    if (!selected?.length) {
      if (selected) ctx.message.warning("请选择采购数量");
      return;
    }
    for (const item of selected) {
      const existing = cartRows.find(row => Number(row.productId) === productId && Number(row.specIndex) === Number(item.specIndex));
      const currentQty = existing ? Number(existing.qty || 0) : 0;
      const mergedQty = currentQty + Number(item.qty || 0);
      if (mergedQty > Number(product?.specs?.[item.specIndex]?.stock || 0)) {
        ctx.message.warning(`${cartSpecText(product?.specs?.[item.specIndex])}库存不足`);
        return;
      }
      if (existing) {
        await request(`/api/mall/cart/items/${existing.cartItemId}`, { method: "PUT", data: { quantity: mergedQty } });
      } else {
        await request("/api/mall/cart/items", { method: "POST", data: { productId, specIndex: item.specIndex, quantity: item.qty } });
      }
    }
    await ctx.hydrateCart();
    setSpecSelector(null);
  });

  const clearInvalidRows = () => ctx.apiGuard(async () => {
    const invalidKeys = new Set(invalidRows.map(cartSkuRowKey));
    const nextRows = cartRows.filter(row => !invalidKeys.has(cartSkuRowKey(row)));
    await Promise.all(invalidRows.map(row => request(`/api/mall/cart/items/${row.cartItemId}`, { method: "DELETE" })));
    commitRows(nextRows);
    setSpecSelector(null);
    ctx.message.success("失效商品已清理");
  });

  const selectedGroups = productGroups.filter((group: AnyRecord) => group.checked);
  const selectedRows = validRows.filter(row => row.checked !== false);
  const selectedQty = selectedRows.reduce((sum, row) => sum + Number(row.qty || 0), 0);
  const selectedAmount = selectedRows.reduce((sum, row) => {
    const product = cartProducts[String(row.productId)];
    const productQty = cartRows.filter(item => Number(item.productId) === Number(row.productId)).reduce((total, item) => total + Number(item.qty || 0), 0);
    return sum + detailUnitPrice(product, Number(row.specIndex || 0), productQty) * Number(row.qty || 0);
  }, 0);
  const allChecked = productGroups.length > 0 && productGroups.every((group: AnyRecord) => group.checked);

  const checkout = () => {
    if (!selectedRows.length) return;
    ctx.setCheckoutItems(selectedRows.map(row => ({ productId: row.productId, specIndex: row.specIndex, qty: row.qty, cartItemId: row.cartItemId, checked: true })));
    ctx.go("confirm");
  };

  return (
    <div className="mall-cart-page">
      <Card
        title="购物车"
        className="mall-cart-card"
        extra={defaultAddress ? (
          <div className="mall-cart-address"><EnvironmentOutlined /><span>发货至：{defaultAddress.address}</span><button type="button" onClick={() => openCartAddressModal(ctx, defaultAddress)}>修改</button></div>
        ) : (
          <button type="button" className="mall-cart-address mall-cart-address-empty" onClick={() => openCartAddressModal(ctx)}><EnvironmentOutlined />点击添加收货地址</button>
        )}
      >
        <div className="mall-cart-grid mall-cart-header">
          <div><Checkbox checked={allChecked} indeterminate={!allChecked && selectedGroups.length > 0} onChange={event => toggleAll(event.target.checked)} /> <span>全选</span></div>
          <div>商品信息</div><div>单价</div><div>数量</div><div>小计</div><div>操作</div>
        </div>
        {!cartReady || loading ? <div className="mall-cart-loading">购物车加载中...</div> : !productGroups.length ? <Empty description={invalidRows.length ? "暂无可结算商品" : "购物车暂无商品"} /> : (
          <div className="mall-cart-products">
            {productGroups.map((group: AnyRecord) => {
              const product = cartProducts[String(group.productId)] || ctx.products.find((item: AnyRecord) => Number(item.id) === Number(group.productId));
              const activeSelector = Number(specSelector?.productId) === Number(group.productId) ? specSelector : null;
              const editingRowIndex = activeSelector?.mode === "edit" ? group.rows.findIndex((row: AnyRecord) => cartSkuRowKey(row) === activeSelector.rowKey) : -1;
              const addPanelOpen = activeSelector?.mode === "add";
              const rowGridPosition = (index: number) => 1 + index;
              const addButtonGridPosition = 1 + group.rows.length;
              const panelTop = addPanelOpen ? 90 + Math.max(0, group.rows.length - 1) * 62 + 42 : editingRowIndex >= 0 ? 90 + editingRowIndex * 62 + 8 : 0;
              const gridRows = ["90px", ...group.rows.slice(1).map(() => "62px"), "40px"];
              return (
                <div className="mall-cart-product-group" key={group.productId} style={{ "--cart-row-count": gridRows.length, gridTemplateRows: gridRows.join(" ") } as React.CSSProperties}>
                  <div className="mall-cart-group-check"><Checkbox checked={group.checked} onChange={event => toggleProduct(group, event.target.checked)} /></div>
                  <div className="mall-cart-product-summary">
                    <button type="button" className="mall-cart-product-image-link" aria-label={`查看${product?.name || "商品"}详情`} onClick={() => ctx.go("detail", product)}>
                      {safeMallImageUrl(product?.cardImage || product?.image) ? <img src={safeMallImageUrl(product?.cardImage || product?.image)} alt={product?.name || "商品"} loading="lazy" decoding="async" /> : <span className="mall-cart-product-placeholder">商</span>}
                    </button>
                    <button type="button" className="mall-cart-product-name-link" onClick={() => ctx.go("detail", product)}><strong>{product?.name || "商品"}</strong></button>
                  </div>
                  {group.rows.map((row: AnyRecord, index: number) => {
                    const spec = product?.specs?.[Number(row.specIndex || 0)] || {};
                    const productQty = group.rows.reduce((sum: number, item: AnyRecord) => sum + Number(item.qty || 0), 0);
                    const unitPrice = detailUnitPrice(product, Number(row.specIndex || 0), productQty);
                    const tiers = tierRowsForSpec(product, spec);
                    return (
                      <React.Fragment key={cartSkuRowKey(row)}>
                        <button type="button" className={`mall-cart-spec-trigger ${editingRowIndex === index ? "is-open" : ""}`} style={{ gridRow: rowGridPosition(index) }} onClick={() => setSpecSelector(editingRowIndex === index ? null : { mode: "edit", productId: group.productId, rowKey: cartSkuRowKey(row), specIndex: row.specIndex, qty: row.qty })}>
                          <SpecImageThumb src={spec.image} /><span>{cartSpecText(spec)}</span><DownOutlined />
                        </button>
                        <div className="mall-cart-unit-price" style={{ gridRow: rowGridPosition(index) }}><strong>{money(unitPrice)}</strong>{tiers.length > 1 ? <div>{tiers.map((tier: AnyRecord) => <small key={`${tier.minQty}-${tier.price}`}>{tier.maxQty ? `${tier.minQty}-${tier.maxQty}${stockUnitForProduct(product)}` : `≥${tier.minQty}${stockUnitForProduct(product)}`}：{money(tier.price)}</small>)}</div> : null}</div>
                        <div className="mall-cart-quantity" style={{ gridRow: rowGridPosition(index) }}><CartQuantityStepper product={product} spec={spec} value={row.qty} disabled={updatingQtyKeys.has(cartSkuRowKey(row))} onChange={(value: number) => updateRowQty(row, value)} /></div>
                        <div className="mall-cart-subtotal" style={{ gridRow: rowGridPosition(index) }}>{money(unitPrice * Number(row.qty || 0))}</div>
                        <div className="mall-cart-actions" style={{ gridRow: rowGridPosition(index) }}><Popconfirm title="确认删除该规格商品？" okText="删除" cancelText="取消" onConfirm={() => removeRow(row)}><Button type="text" danger icon={<DeleteOutlined />} aria-label="删除该规格商品" title="删除该规格商品" /></Popconfirm></div>
                      </React.Fragment>
                    );
                  })}
                  <Button className={`mall-cart-add-spec ${addPanelOpen ? "is-open" : ""}`} style={{ gridRow: addButtonGridPosition }} onClick={() => setSpecSelector(addPanelOpen ? null : { mode: "add", productId: group.productId })}>再选一款</Button>
                  <div className="mall-cart-product-tools" style={{ gridRow: addButtonGridPosition }}>
                    <Button type="link" icon={<HeartOutlined />} onClick={() => ctx.message.success("已移入收藏")}>收藏</Button>
                    <Popconfirm title="确认删除该商品的全部规格？" okText="删除商品" cancelText="取消" onConfirm={() => removeProduct(group)}><Button type="link" danger icon={<DeleteOutlined />}>删除商品</Button></Popconfirm>
                  </div>
                  {activeSelector ? <div className="mall-cart-inline-panel-wrap" style={{ "--cart-panel-top": `${panelTop}px` } as React.CSSProperties}><CartSpecSelectorPanel product={product} initialSpecIndex={Number(activeSelector.specIndex || 0)} mode={activeSelector.mode} onCancel={() => setSpecSelector(null)} onConfirm={activeSelector.mode === "add" ? applyAddedSpecs : applySpecSelection} /></div> : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="mall-cart-settlement">
        <div className="mall-cart-settlement-actions"><Checkbox checked={allChecked} indeterminate={!allChecked && selectedGroups.length > 0} onChange={event => toggleAll(event.target.checked)}>全选</Checkbox><Popconfirm title="确认删除选中的商品？" disabled={!selectedGroups.length} onConfirm={deleteSelected}><Button disabled={!selectedGroups.length}>删除</Button></Popconfirm><Button disabled={!selectedGroups.length} onClick={() => ctx.message.success("已移入收藏")}>移入收藏夹</Button></div>
        <div className="mall-cart-settlement-counts"><span>已选 <b>{selectedGroups.length}</b> 种商品</span><span>数量总计 <b>{selectedQty}</b> 件</span></div>
        <div className="mall-cart-settlement-total">共计 <strong>{money(selectedAmount)}</strong></div>
        <Button type="primary" className="mall-cart-checkout" disabled={!selectedRows.length} onClick={checkout}>去结算</Button>
      </div>

      {invalidRows.length ? (
        <Card className="mall-cart-invalid-card" title="失效商品" extra={<Popconfirm title="确认清空全部失效商品？" okText="清空" cancelText="取消" onConfirm={clearInvalidRows}><Button type="text" icon={<DeleteOutlined />}>清空失效商品</Button></Popconfirm>}>
          <div className="mall-cart-invalid-list">
            {(invalidGroups as AnyRecord[]).map((group: AnyRecord) => {
              const product = cartProducts[String(group.productId)];
              return <div className="mall-cart-invalid-product" key={group.productId}>
                {safeMallImageUrl(product?.cardImage || product?.image) ? <img src={safeMallImageUrl(product?.cardImage || product?.image)} alt="" loading="lazy" decoding="async" /> : <div className="mall-cart-product-placeholder">商</div>}
                <div className="mall-cart-invalid-info"><strong>{product?.name || `商品 #${group.productId}`}</strong>{group.rows.map((row: AnyRecord) => {
                  const spec = product?.specs?.[Number(row.specIndex || 0)] || {};
                  return <div className="mall-cart-invalid-spec" key={cartSkuRowKey(row)}><SpecImageThumb src={spec.image} /><span>{cartSpecText(spec)}</span><em>{cartRowInvalidReason(product, row)}</em><Popconfirm title="确认删除该失效商品？" okText="删除" cancelText="取消" onConfirm={() => removeRow(row)}><Button type="text" danger icon={<DeleteOutlined />} aria-label="删除失效商品" /></Popconfirm></div>;
                })}</div>
              </div>;
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function CartQuantityStepper({ product, spec, value, disabled, onChange }: any) {
  const { message } = AntApp.useApp();
  const step = quantityStepForProduct(product);
  const minimum = nextValidPurchaseQty(product, Number(spec?.min || 1));
  const quantity = Number(value || minimum);
  const maximum = Number(spec?.stock || 0);
  const canDecrease = quantity > minimum;
  const canIncrease = maximum > 0;
  return (
    <div className="mall-cart-stepper">
      <Button icon={<MinusOutlined />} disabled={!canDecrease} aria-disabled={disabled || !canDecrease} onClick={() => !disabled && onChange(Math.max(minimum, quantity - step))} />
      <InputNumber value={quantity} min={minimum} max={maximum} step={step} precision={0} controls={false} onChange={next => !disabled && onChange(Number(next || minimum))} />
      <Button icon={<PlusOutlined />} disabled={!canIncrease} aria-disabled={disabled || !canIncrease} onClick={() => {
        if (disabled) return;
        quantity + step > maximum ? message.warning("库存不足，无法继续增加") : onChange(quantity + step);
      }} />
    </div>
  );
}

function specSelectionForIndex(product: AnyRecord, specIndex: number) {
  const spec = product?.specs?.[specIndex] || {};
  const selection: AnyRecord = {};
  selectionGroupsFor(product).forEach((group: AnyRecord) => {
    const cell = specCellForGroup(spec, group);
    if (cell) selection[group.key] = String(cell.valueId || cell.value);
  });
  return normalizeSpecSelection(product, selection);
}

function CartAddQuantityStepper({ product, spec, value, onChange }: any) {
  const step = quantityStepForProduct(product);
  const minimum = nextValidPurchaseQty(product, Number(spec?.min || 1));
  const quantity = Number(value || 0);
  const maximum = Number(spec?.stock || 0);
  const soldOut = String(spec?.status || "ENABLED").toUpperCase() === "DISABLED" || maximum <= 0;
  return (
    <div className="mall-cart-stepper mall-cart-add-stepper">
      <Button icon={<MinusOutlined />} disabled={quantity <= 0} onClick={() => onChange(quantity <= minimum ? 0 : Math.max(minimum, quantity - step))} />
      <InputNumber value={quantity} min={0} max={maximum} step={step} precision={0} controls={false} disabled={soldOut} onChange={next => onChange(Number(next || 0))} />
      <Button icon={<PlusOutlined />} disabled={soldOut || quantity + step > maximum} onClick={() => onChange(quantity <= 0 ? minimum : quantity + step)} />
    </div>
  );
}

function CartSpecSelectorPanel({ product, initialSpecIndex, mode, onCancel, onConfirm }: any) {
  const [selection, setSelection] = useState<AnyRecord>({});
  const [selectedSpecIndex, setSelectedSpecIndex] = useState(0);
  const [qtyMap, setQtyMap] = useState<AnyRecord>({});
  useEffect(() => {
    if (!product) return;
    const requestedIndex = Math.min(Math.max(0, Number(initialSpecIndex || 0)), Math.max(0, (product.specs || []).length - 1));
    const firstAvailableIndex = (product.specs || []).findIndex((spec: AnyRecord) => spec.status !== "DISABLED" && Number(spec.stock || 0) > 0);
    const specIndex = mode === "add" && firstAvailableIndex >= 0 ? firstAvailableIndex : requestedIndex;
    setSelection(specSelectionForIndex(product, specIndex));
    setSelectedSpecIndex(specIndex);
    setQtyMap(Object.fromEntries((product.specs || []).map((_: AnyRecord, index: number) => [index, 0])));
  }, [product?.id, initialSpecIndex, mode]);
  if (!product) return null;
  const groups = selectionGroupsFor(product);
  const visibleSpecs = product.specs.map((spec: AnyRecord, index: number) => ({ ...spec, originalIndex: index })).filter((spec: AnyRecord) => specMatchesSelection(spec, selection, groups, product));
  const chooseValue = (group: AnyRecord, value: AnyRecord) => {
    const next = normalizeSpecSelection(product, { ...selection, [group.key]: value.key });
    setSelection(next);
    const first = product.specs.findIndex((spec: AnyRecord) => specMatchesSelection(spec, next, groups, product) && spec.status !== "DISABLED" && Number(spec.stock || 0) > 0);
    if (first >= 0) {
      setSelectedSpecIndex(first);
    }
  };
  const selectedItems = Object.entries(qtyMap).filter(([, qty]) => Number(qty) > 0).map(([specIndex, qty]) => ({ specIndex: Number(specIndex), qty: Number(qty) }));
  const confirm = () => mode === "add" ? onConfirm(selectedItems) : onConfirm(selectedSpecIndex);
  const skuGroup = lastSkuGroupFor(product);
  return (
    <div className={`mall-cart-spec-panel is-${mode}`}>
      <div className="mall-cart-spec-title"><strong>{mode === "add" ? "再选一款" : "切换规格"}</strong><span>价格展示商品原价，优惠金额以购物车展示为准</span><button type="button" aria-label="关闭规格选择" onClick={onCancel}><CloseOutlined /></button></div>
      <div className="mall-cart-spec-choice-card">
        {groups.map((group: AnyRecord, groupIndex: number) => (
          <div className="mall-cart-spec-dimension" key={group.key}>
            <label>{group.name}</label>
            <div>
              {group.values.map((value: AnyRecord) => (
                <button type="button" key={value.key} className={selection[group.key] === value.key ? "is-active" : ""} disabled={!specOptionHasStock(product, group, value, selection, groups)} onClick={() => chooseValue(group, value)}>
                  {shouldShowSpecOptionImage(groupIndex, group) ? <SpecImageThumb src={value.image} /> : null}<span>{value.value}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className={`mall-cart-spec-skus is-${mode}`}>
          <label>{skuGroup?.name || "规格"}</label>
          <div className="mall-cart-spec-sku-list">
            {visibleSpecs.map((spec: AnyRecord) => {
              const index = Number(spec.originalIndex);
              const active = index === selectedSpecIndex;
              const disabled = spec.status === "DISABLED" || Number(spec.stock || 0) <= 0;
              return (
                <div
                  className={`mall-cart-spec-sku-row ${active ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
                  key={`${spec.code}-${index}`}
                  role={mode === "edit" ? "button" : undefined}
                  tabIndex={mode === "edit" && !disabled ? 0 : undefined}
                  onClick={() => mode === "edit" && !disabled ? setSelectedSpecIndex(index) : undefined}
                >
                  <span><strong>{skuRowLabel(spec, skuGroup, product)}</strong><small>SKU条码:{spec.barcode || "-"}</small></span>
                  <b>{money(detailUnitPrice(product, index, Number(qtyMap[index] || 1)))}</b>
                  <em>{Number(spec.stock || 0)} {stockUnitForProduct(product)}</em>
                  {mode === "add" ? <CartAddQuantityStepper product={product} spec={spec} value={qtyMap[index]} onChange={(qty: number) => setQtyMap((current: AnyRecord) => ({ ...current, [index]: qty }))} /> : <i>{active ? "已选择" : "选择"}</i>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mall-cart-spec-footer"><Button type="primary" disabled={mode === "add" && !selectedItems.length} onClick={confirm}>确定</Button><Button onClick={onCancel}>取消</Button></div>
    </div>
  );
}

function openCartAddressModal(ctx: AnyRecord, item?: AnyRecord) {
  Modal.confirm({
    title: item ? "修改收货地址" : "新增地址",
    icon: null,
    width: 520,
    className: "mall-cart-address-modal",
    content: <CartAddressForm ctx={ctx} item={item} />,
    footer: null
  });
}

function CartAddressForm({ ctx, item }: any) {
  return (
    <Form layout="vertical" initialValues={{ name: item?.name, phone: item?.phone, address: item?.detailAddress || item?.address, isDefault: item?.isDefault ?? true }} onFinish={async values => {
      await ctx.apiGuard(async () => {
        await request(item ? `/api/mall/addresses/${item.id}` : "/api/mall/addresses", {
          method: item ? "PUT" : "POST",
          data: { receiverName: values.name, receiverPhone: values.phone, region: item?.region || "-", detailAddress: values.address, isDefault: values.isDefault }
        });
        await ctx.hydrateAddresses();
        Modal.destroyAll();
        ctx.message.success("地址已保存");
      });
    }}>
      <Form.Item name="name" label="收货人" rules={[{ required: true }]}><Input /></Form.Item>
      <Form.Item name="phone" label="手机号" rules={phoneRules()}><Input maxLength={11} /></Form.Item>
      <Form.Item name="address" label="详细地址" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
      <Form.Item name="isDefault" valuePropName="checked"><Checkbox>设为默认</Checkbox></Form.Item>
      <div className="mall-cart-address-actions"><Button onClick={() => Modal.destroyAll()}>取消</Button><Button type="primary" htmlType="submit">保存</Button></div>
    </Form>
  );
}

function ConfirmPage({ ctx }: any) {
  const [remark, setRemark] = useState("");
  const rows = ctx.checkoutRows;
  const address = ctx.addresses.find((x: AnyRecord) => x.isDefault) || ctx.addresses[0];
  const productCount = new Set(rows.map((item: AnyRecord) => String(item.productId))).size;
  const quantityCount = rows.reduce((sum: number, item: AnyRecord) => sum + Number(item.qty || 0), 0);
  const productGroups = Object.values(rows.reduce((groups: AnyRecord, item: AnyRecord, rowIndex: number) => {
    const key = String(item.productId);
    if (!groups[key]) groups[key] = { productId: item.productId, rows: [] };
    groups[key].rows.push({ item, rowIndex });
    return groups;
  }, {})) as AnyRecord[];
  const updateQuantity = (rowIndex: number, nextQty: number) => {
    const currentRows = ctx.checkoutItems || rows;
    ctx.setCheckoutItems(currentRows.map((item: AnyRecord, index: number) => index === rowIndex ? { ...item, qty: nextQty } : item));
  };
  const submit = () => ctx.apiGuard(async () => {
    if (!rows.length) return ctx.message.warning("请先选择商品");
    if (!address) return ctx.message.warning("请先维护收货地址");
    const order = await request("/api/orders", {
      method: "POST",
      data: {
        customerId: 1,
        paymentMethod: "ONLINE_PAY",
        receiverName: address.name,
        receiverPhone: address.phone,
        receiverAddress: address.address,
        remark: remark.trim() || "网页商城下单",
        items: rows.map((item: AnyRecord) => ({ productId: item.productId, quantity: item.qty, specIndex: item.specIndex || 0 }))
      }
    });
    const submittedCartItemIds = Array.from(new Set(rows.map((item: AnyRecord) => item.cartItemId).filter(Boolean)));
    if (submittedCartItemIds.length) {
      await Promise.all(submittedCartItemIds.map(cartItemId => request(`/api/mall/cart/items/${cartItemId}`, { method: "DELETE" })));
      await ctx.hydrateCart();
    }
    const mapped = orderFromApi(order);
    ctx.setCurrentOrder(mapped);
    ctx.setCheckoutItems(null);
    ctx.message.success("订单已提交");
    ctx.go("pay");
  });
  return (
    <div className="mall-confirm-page">
      <div className="mall-confirm-main">
        <section className="mall-confirm-address-card">
          {address ? <>
            <EnvironmentOutlined className="mall-confirm-address-icon" />
            <div className="mall-confirm-address-content">
              <strong>{address.address}</strong>
              <span>{address.name} {address.phone}</span>
              <div><Button type="link" className="mall-confirm-change-address" onClick={() => ctx.go("addresses")}>更改地址<RightOutlined /></Button></div>
            </div>
          </> : <div className="mall-confirm-address-empty"><Empty description="暂无收货地址" /><Button type="primary" onClick={() => ctx.go("addresses")}>添加收货地址</Button></div>}
        </section>

        <section className="mall-confirm-order-card">
          <div className="mall-confirm-order-card-head">
            <h2>夏至商城自营</h2>
            <Button type="text" className="mall-confirm-cart-back" icon={<ArrowLeftOutlined />} onClick={() => ctx.go("cart")}>返回购物车</Button>
          </div>
          <div className="mall-confirm-products-head"><span>商品信息</span><span>数量</span><span>单价</span><span>小计</span></div>
          <div className="mall-confirm-products-list">
            {productGroups.map((group: AnyRecord) => {
              const firstItem = group.rows[0]?.item || {};
              const product = cartProduct(ctx.products, firstItem) || {};
              const productImage = safeMallImageUrl(product.cardImage || product.image);
              return <section className="mall-confirm-product-group" key={String(group.productId)}>
                <div className="mall-confirm-product-group-head">
                  {productImage ? <img src={productImage} alt={product.name || "商品"} loading="lazy" decoding="async" /> : <span className="mall-confirm-product-placeholder"><PictureOutlined /></span>}
                  <strong>{product.name || "商品"}</strong>
                </div>
                {group.rows.map(({ item, rowIndex }: AnyRecord) => {
                  const spec = cartSpec(ctx.products, item) || {};
                  const unitPrice = cartItemPrice(ctx.products, item);
                  const minimum = nextValidPurchaseQty(product, Number(spec.min || 1));
                  const quantity = Number(item.qty || minimum);
                  const image = safeMallImageUrl(spec.image);
                  return <div className="mall-confirm-product-row" key={`${item.productId}-${item.specIndex}-${rowIndex}`}>
                    <div className="mall-confirm-product-info">
                      <div className="mall-confirm-product-image">
                        {image ? <img src={image} alt={cartSpecText(spec)} loading="lazy" decoding="async" /> : <span className="mall-confirm-product-placeholder"><PictureOutlined /></span>}
                      </div>
                      <div className="mall-confirm-product-meta">
                        <div className="mall-confirm-product-spec" title={cartSpecText(spec)}>{cartSpecText(spec)}</div>
                        <div className="mall-confirm-product-barcode" title={String(spec.barcode || "-")}>SKU条码：{spec.barcode || "-"}</div>
                      </div>
                    </div>
                    <div className="mall-confirm-quantity">
                      <CartQuantityStepper product={product} spec={spec} value={quantity} disabled={false} onChange={(next: number) => updateQuantity(rowIndex, next)} />
                    </div>
                    <div className="mall-confirm-unit-price"><strong>{money(unitPrice)}</strong></div>
                    <div className="mall-confirm-subtotal">{money(unitPrice * quantity)}</div>
                  </div>;
                })}
              </section>;
            })}
          </div>
          <div className="mall-confirm-message"><label>留言</label><Input value={remark} placeholder="选填，请和商家协商一致" maxLength={200} onChange={event => setRemark(event.target.value)} /></div>
          <div className="mall-confirm-delivery"><label>配送方式</label><Radio checked>快递 ¥0.00</Radio></div>
          <div className="mall-confirm-store-summary">
            <label>店铺明细</label>
            <div><span>商品总计 {productCount}种{quantityCount}件</span><strong>{money(ctx.checkoutTotal)}</strong></div>
            <div><span>运费</span><strong>¥0.00</strong></div>
            <div><span>服务</span><strong>按平台售后规则执行</strong></div>
          </div>
        </section>
      </div>

      <aside className="mall-confirm-price-card">
        <h2>价格明细</h2>
        <div className="mall-confirm-price-lines">
          <div><span>商品总计 <em>{productCount}种{quantityCount}件</em></span><strong>{money(ctx.checkoutTotal)}</strong></div>
          <div><span>总运费</span><strong>¥0.00</strong></div>
        </div>
        <div className="mall-confirm-payable"><span>应付总额</span><strong>{money(ctx.checkoutTotal)}</strong></div>
        <Button type="primary" className="mall-confirm-submit" onClick={submit}>提交订单</Button>
      </aside>
    </div>
  );
}

function PayPage({ ctx }: any) {
  const order = ctx.currentOrder;
  const pay = () => ctx.apiGuard(async () => {
    if (!order?.apiId) return ctx.message.warning("未找到待支付订单");
    const paymentMethod = ctx.payMethod === "alipay" ? "ALIPAY" : "WECHAT";
    await request("/api/mall/payments", { method: "POST", data: { orderId: Number(order.apiId), paymentMethod } });
    await ctx.hydrateOrders();
    const paidOrder = {
      ...order,
      key: "pendingShipment",
      statusLabel: "待发货",
      shipLabel: "待发货",
      payLabel: "已支付",
      raw: {
        ...(order.raw || {}),
        orderStatus: "WAIT_SHIP",
        fulfillmentStatus: "WAIT_SHIP",
        paymentStatus: "PAID",
        paymentMethod,
        paymentMethodText: paymentMethodLabel(paymentMethod)
      }
    };
    ctx.setOrders((current: AnyRecord[]) => current.map(item => String(item.apiId || item.id) === String(paidOrder.apiId || paidOrder.id) ? paidOrder : item));
    ctx.message.success("支付成功");
    ctx.setCurrentOrder(paidOrder);
    ctx.go("orderDetail");
  });
  return (
    <Card title="订单支付" className="mall-pay-card">
      <div className="mall-pay-layout">
        <Descriptions bordered column={1} items={[
          { key: "order", label: "订单编号", children: order?.id || "-" },
          { key: "amount", label: "支付金额", children: order?.amount || money(ctx.checkoutTotal) }
        ]} />
        <div className="mall-pay-methods" role="radiogroup" aria-label="支付方式">
          <button type="button" role="radio" aria-checked={ctx.payMethod === "wechat"} className={`mall-pay-method ${ctx.payMethod === "wechat" ? "is-active" : ""}`} onClick={() => ctx.setPayMethod("wechat")}>
            <WechatOutlined className="mall-pay-method-icon is-wechat" />
            <span><strong>微信支付</strong><small>推荐使用微信扫码完成支付</small></span>
            {ctx.payMethod === "wechat" ? <CheckOutlined className="mall-pay-method-check" /> : null}
          </button>
          <button type="button" role="radio" aria-checked={ctx.payMethod === "alipay"} className={`mall-pay-method ${ctx.payMethod === "alipay" ? "is-active" : ""}`} onClick={() => ctx.setPayMethod("alipay")}>
            <AlipayCircleOutlined className="mall-pay-method-icon is-alipay" />
            <span><strong>支付宝支付</strong><small>支持支付宝账户或银行卡支付</small></span>
            {ctx.payMethod === "alipay" ? <CheckOutlined className="mall-pay-method-check" /> : null}
          </button>
        </div>
        <div className="mall-pay-actions"><Button onClick={() => ctx.go("orders")}>稍后支付</Button><Button type="primary" onClick={pay}>模拟支付成功</Button></div>
      </div>
    </Card>
  );
}

function OrdersPage({ ctx, loading }: any) {
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filters, setFilters] = useState({
    keyword: "",
    time: "all",
    receiver: "",
    phone: "",
    orderStatus: "all",
    payStatus: "all",
    buyer: "",
    minAmount: "",
    maxAmount: ""
  });
  const tabs = [
    { key: "all", label: "全部", count: ctx.orders.length },
    { key: "pendingPayment", label: "待付款", count: ctx.orders.filter((x: AnyRecord) => x.key === "pendingPayment").length },
    { key: "pendingShipment", label: "待发货", count: ctx.orders.filter((x: AnyRecord) => x.key === "pendingShipment").length },
    { key: "pendingReceipt", label: "待收货", count: ctx.orders.filter((x: AnyRecord) => x.key === "pendingReceipt").length },
    { key: "afterSale", label: "退款售后", count: 0 },
    { key: "completed", label: "已完成", count: ctx.orders.filter((x: AnyRecord) => x.key === "completed").length },
    { key: "cancelled", label: "已取消", count: ctx.orders.filter((x: AnyRecord) => x.key === "cancelled").length }
  ];
  const rows = ctx.orders.filter((order: AnyRecord) => {
    const raw = order.raw || {};
    if (tab !== "all" && tab !== "afterSale" && order.key !== tab) return false;
    if (tab === "afterSale") return false;
    const searchText = [
      order.id,
      order.orderTime,
      order.statusLabel,
      order.payLabel,
      raw.batchNo,
      raw.logisticsNo,
      ...(order.items || []).map((item: AnyRecord) => `${item.productName || ""} ${item.skuName || ""} ${item.skuBarcode || ""}`)
    ].join(" ").toLowerCase();
    if (filters.keyword.trim() && !searchText.includes(filters.keyword.trim().toLowerCase())) return false;
    if (filters.receiver.trim()) {
      const receiverText = `${order.receiverName || ""} ${order.receiverPhone || ""}`;
      if (!receiverText.includes(filters.receiver.trim())) return false;
    }
    if (filters.orderStatus !== "all" && order.key !== filters.orderStatus) return false;
    if (filters.payStatus !== "all" && orderPaymentMethodKey(order) !== filters.payStatus) return false;
    const minAmount = Number(filters.minAmount || 0);
    const maxAmount = Number(filters.maxAmount || 0);
    if (minAmount && Number(order.totalAmount || 0) < minAmount) return false;
    if (maxAmount && Number(order.totalAmount || 0) > maxAmount) return false;
    return true;
  });
  const currentPage = Math.max(1, Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize))));
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageOrderIds = pageRows.map((order: AnyRecord) => orderSelectionKey(order));
  const selectedPageCount = pageOrderIds.filter((id: string) => selectedOrderIds.has(id)).length;
  const pageAllSelected = pageOrderIds.length > 0 && selectedPageCount === pageOrderIds.length;
  const pagePartiallySelected = selectedPageCount > 0 && selectedPageCount < pageOrderIds.length;
  const toggleCurrentPageSelection = () => {
    setSelectedOrderIds(current => {
      const next = new Set(current);
      if (pageAllSelected) {
        pageOrderIds.forEach((id: string) => next.delete(id));
      } else {
        pageOrderIds.forEach((id: string) => next.add(id));
      }
      return next;
    });
  };
  const toggleOrderSelection = (order: AnyRecord, checked: boolean) => {
    const id = orderSelectionKey(order);
    setSelectedOrderIds(current => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const patchFilter = (patch: AnyRecord) => {
    setPage(1);
    setFilters(current => ({ ...current, ...patch }));
  };
  const resetFilters = () => {
    setPage(1);
    setFilters({
    keyword: "",
    time: "all",
    receiver: "",
    phone: "",
    orderStatus: "all",
    payStatus: "all",
    buyer: "",
    minAmount: "",
    maxAmount: ""
    });
  };
  const selectOptions = {
    all: [{ value: "all", label: "全部" }],
    status: [
      { value: "all", label: "全部" },
      { value: "pendingPayment", label: "待付款" },
      { value: "pendingShipment", label: "待发货" },
      { value: "pendingReceipt", label: "待收货" },
      { value: "completed", label: "已完成" },
      { value: "cancelled", label: "已取消" }
    ],
    pay: [
      { value: "all", label: "全部" },
      { value: "wechat", label: "微信支付" },
      { value: "alipay", label: "支付宝支付" }
    ]
  };
  const viewDetail = (order: AnyRecord) => {
    ctx.setCurrentOrder(order);
    ctx.go("orderDetail");
  };
  return (
    <div className="mall-orders-page">
      <section className="mall-orders-filter-card">
        <div className="mall-orders-tabs">
          {tabs.map(item => (
            <button key={item.key} type="button" className={tab === item.key ? "is-active" : ""} onClick={() => { setTab(item.key); setPage(1); }}>
              {item.label}{item.count ? <b>{item.count}</b> : null}
            </button>
          ))}
        </div>
        {filtersOpen ? (
          <div className="mall-orders-filters">
            <label className="is-wide"><span>订单关键词</span><Input value={filters.keyword} placeholder="商品名称/订单号" allowClear onChange={event => patchFilter({ keyword: event.target.value })} /></label>
            <label><span>下单时间</span><Select value={filters.time} options={selectOptions.all} onChange={value => patchFilter({ time: value })} /></label>
            <label className="mall-orders-receiver-filter"><span>收货人</span><Input value={filters.receiver} placeholder="收货人/手机号" allowClear onChange={event => patchFilter({ receiver: event.target.value })} /></label>
            <label><span>订单状态</span><Select value={filters.orderStatus} options={selectOptions.status} onChange={value => patchFilter({ orderStatus: value })} /></label>
            <label><span>支付方式</span><Select value={filters.payStatus} options={selectOptions.pay} onChange={value => patchFilter({ payStatus: value })} /></label>
            <label className="mall-orders-amount-filter"><span>订单金额</span><Input value={filters.minAmount} placeholder="¥ 最小金额" onChange={event => patchFilter({ minAmount: event.target.value.replace(/[^\d.]/g, "") })} /><em /> <Input value={filters.maxAmount} placeholder="¥ 最大金额" onChange={event => patchFilter({ maxAmount: event.target.value.replace(/[^\d.]/g, "") })} /></label>
            <div className="mall-orders-filter-actions">
              <button type="button" className="mall-orders-collapse" onClick={() => setFiltersOpen(false)}>收起 <DownOutlined /></button>
              <Button onClick={resetFilters}>清除选项</Button>
              <Button type="primary">搜索</Button>
            </div>
          </div>
        ) : (
          <button type="button" className="mall-orders-expand" onClick={() => setFiltersOpen(true)}>展开筛选 <DownOutlined /></button>
        )}
      </section>

      <section className="mall-orders-list-card">
        <div className="mall-orders-bulkbar">
          <Checkbox checked={pageAllSelected} indeterminate={pagePartiallySelected} disabled={!pageRows.length} onChange={toggleCurrentPageSelection} />
          <button type="button" disabled={!pageRows.length} onClick={toggleCurrentPageSelection}>全选</button>
          <Button disabled>导出所选订单</Button>
          <Button>导出当前条件</Button>
          <Button disabled>批量付款</Button>
        </div>
        <div className="mall-orders-list-head">
          <span>商品信息</span>
          <span>单价</span>
          <span>数量</span>
          <span>订单金额</span>
          <span>收货信息</span>
          <span>订单状态</span>
          <span>交易操作</span>
        </div>
        {loading ? <div className="mall-orders-empty">订单加载中...</div> : pageRows.length ? pageRows.map((order: AnyRecord) => (
          <OrderListCard key={order.id} order={order} selected={selectedOrderIds.has(orderSelectionKey(order))} onSelectedChange={(checked: boolean) => toggleOrderSelection(order, checked)} ctx={ctx} onDetail={() => viewDetail(order)} />
        )) : <Empty className="mall-orders-empty" description="暂无订单" />}
        <div className="mall-orders-pagination">
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={rows.length}
            showSizeChanger={{ showSearch: false }}
            pageSizeOptions={["10", "20", "50", "100"]}
            showTotal={(total) => `共 ${total} 条`}
            onChange={(nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            }}
          />
        </div>
      </section>
    </div>
  );
}

function orderSelectionKey(order: AnyRecord) {
  return String(order.apiId || order.id || "");
}

function OrderListCard({ order, selected, onSelectedChange, ctx, onDetail }: any) {
  const items = Array.isArray(order.items) && order.items.length ? order.items : [{ productName: "订单商品", quantity: order.goodsCount || 1, salePrice: order.totalAmount || 0 }];
  const firstItem = items[0] || {};
  const buyerName = order.receiverName || ctx.profile?.buyerName || "商城买家";
  const statusKey = order.key;
  const canPay = statusKey === "pendingPayment";
  const canReceive = statusKey === "pendingReceipt";
  const pay = () => {
    ctx.setCurrentOrder(order);
    ctx.go("pay");
  };
  const copyOrderNo = async () => {
    const orderNo = String(order.id || "").trim();
    if (!orderNo) return ctx.message.warning("订单号为空");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(orderNo);
      } else {
        const input = document.createElement("textarea");
        input.value = orderNo;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      ctx.message.success("订单号已复制");
    } catch {
      ctx.message.error("复制失败，请手动复制订单号");
    }
  };
  return (
    <article className="mall-orders-card">
      <header className="mall-orders-card-head">
        <Checkbox checked={selected} onChange={event => onSelectedChange(event.target.checked)} />
        <span className="mall-orders-order-no">订单号 <strong>{order.id}</strong><Button type="text" className="mall-orders-copy" icon={<CopyOutlined />} aria-label="复制订单号码" title="复制订单号码" onClick={copyOrderNo} /></span>
        <time>{order.orderTime || "-"}</time>
      </header>
      <div className="mall-orders-card-body">
        <div className="mall-orders-goods">
          {items.slice(0, 3).map((item: AnyRecord, index: number) => (
            <div className="mall-orders-goods-row" key={`${order.id}-${item.id || item.skuCode || index}`}>
              <OrderListProduct item={item} products={ctx.products} ctx={ctx} />
              <div className="mall-orders-unit-price">{money(orderItemUnitPrice(item))}</div>
              <div className="mall-orders-qty">{Number(item.quantity || item.qty || 0) || "-"}</div>
            </div>
          ))}
        </div>
        <div className="mall-orders-total">
          <strong>{order.amount || money(order.totalAmount)}</strong>
          <span>含运费 0.00</span>
        </div>
        <div className="mall-orders-buyer">
          <strong>{buyerName}</strong>
          <span className="mall-orders-buyer-phone">{order.receiverPhone || "查看买家信息"}</span>
          <span className="mall-orders-buyer-address" title={order.receiverAddress || ""}>{order.receiverAddress || "收货地址暂缺"}</span>
        </div>
        <div className="mall-orders-status">
          {orderStatusBadge(order)}
          <button type="button" onClick={onDetail}>订单详情 <RightOutlined /></button>
        </div>
        <div className="mall-orders-actions">
          {canPay ? <Button type="primary" onClick={pay}>付款</Button> : null}
          {canReceive ? <Button type="primary" ghost onClick={() => confirmReceipt(ctx, order)}>确认收货</Button> : null}
          <button type="button">再次购买</button>
        </div>
      </div>
    </article>
  );
}

function OrderListProduct({ item, products, ctx }: any) {
  const image = safeMallImageUrl(orderItemImage(item, products));
  const productPayload = orderItemProductPayload(item, products);
  const productName = item.productName || item.skuName || "订单商品";
  return (
    <div className="mall-orders-product">
      {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span><PictureOutlined /></span>}
      <div>
        <button type="button" disabled={!productPayload} onClick={() => productPayload && ctx.go("detail", productPayload)}>{productName}</button>
        <small>{orderItemSpecText(item)}</small>
        <em>SKU条码：{orderItemSkuBarcode(item)}</em>
      </div>
    </div>
  );
}

function orderPayStatusKey(order: AnyRecord) {
  const raw = String(order.raw?.paymentStatus || "").toUpperCase();
  if (raw === "PAID" || order.payLabel === "已支付") return "paid";
  if (raw === "NOT_REQUIRED_BEFORE_RECEIPT" || order.payLabel === "后付款") return "postpay";
  return "unpaid";
}

function orderPaymentMethodKey(order: AnyRecord) {
  const raw = [
    order.raw?.paymentMethodText,
    order.raw?.paymentChannel,
    order.raw?.payMethod,
    order.raw?.paymentMethod
  ].map(value => String(value || "")).join(" ").toUpperCase();
  if (raw.includes("ALIPAY") || raw.includes("支付宝")) return "alipay";
  if (raw.includes("WECHAT") || raw.includes("WX") || raw.includes("微信")) return "wechat";
  return "";
}

function orderStatusBadge(order: AnyRecord) {
  if (order.key === "cancelled") return <Tag color="red">已取消</Tag>;
  if (order.key === "pendingPayment") return <Tag color="orange">待付款</Tag>;
  if (order.key === "pendingShipment") return <Tag color="orange">待发货</Tag>;
  if (order.key === "pendingReceipt") return <Tag color="blue">待收货</Tag>;
  if (order.key === "completed") return <Tag color="green">已完成</Tag>;
  return tag(order.statusLabel);
}

function OrderDetailPage({ ctx }: any) {
  const order = ctx.currentOrder || ctx.orders[0];
  if (!order) return <Empty description="暂无订单详情" />;
  const rawOrder = order.raw || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const goodsQty = items.reduce((sum: number, item: AnyRecord) => sum + Number(item.quantity || item.qty || 0), 0);
  const goodsAmount = items.reduce((sum: number, item: AnyRecord) => sum + orderItemSubtotal(item), 0);
  const orderAmount = Number(order.totalAmount || rawOrder.totalAmount || rawOrder.payAmount || goodsAmount || 0);
  const freightAmount = Number(rawOrder.freightAmount || rawOrder.deliveryFee || rawOrder.shippingFee || 0);
  const paidAmount = Number(rawOrder.paidAmount || rawOrder.payAmount || orderAmount || 0);
  const paid = order.payLabel === "已支付" || rawOrder.paymentStatus === "PAID";
  const paidAt = dateText(rawOrder.paidAt || rawOrder.paymentTime || rawOrder.payTime || (paid ? rawOrder.updatedAt : ""));
  const shippedAt = dateText(rawOrder.shippedAt || rawOrder.deliveryTime || rawOrder.shipTime);
  const receivedAt = dateText(rawOrder.receivedAt || rawOrder.receiptTime || rawOrder.completedAt);
  const stepIndex = order.key === "pendingPayment" ? 2 : order.key === "pendingShipment" ? 3 : order.key === "pendingReceipt" ? 4 : order.key === "completed" ? 4 : 1;
  const steps = [
    { index: 1, title: "提交订单", time: order.orderTime || dateText(rawOrder.createdAt) },
    { index: 2, title: "付款成功", time: paid ? paidAt : "-" },
    { index: 3, title: "商城发货", time: shippedAt || "-" },
    { index: 4, title: "订单完成", time: receivedAt || "-" }
  ];
  const productColumns = [
    {
      title: "商品",
      dataIndex: "productName",
      render: (_: any, item: AnyRecord) => {
        const image = safeMallImageUrl(orderItemImage(item, ctx.products));
        const productName = item.productName || item.skuName || "商品";
        const productPayload = orderItemProductPayload(item, ctx.products);
        return (
          <div className="mall-order-product-cell">
            {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span className="mall-order-product-placeholder"><PictureOutlined /></span>}
            <div>
              {productPayload ? (
                <button type="button" className="mall-order-product-name" onClick={() => ctx.go("detail", productPayload)}>
                  <strong>{productName}</strong>
                </button>
              ) : <strong>{productName}</strong>}
              <span>{orderItemSpecText(item)}</span>
            </div>
          </div>
        );
      }
    },
    { title: "SKU条码", dataIndex: "skuBarcode", render: (_: any, item: AnyRecord) => orderItemSkuBarcode(item) },
    { title: "单价（元）", dataIndex: "salePrice", render: (_: any, item: AnyRecord) => orderItemUnitPrice(item).toFixed(2) },
    { title: "购买数量", dataIndex: "quantity", render: (_: any, item: AnyRecord) => Number(item.quantity || item.qty || 0) },
    { title: "小计（元）", render: (_: any, item: AnyRecord) => orderItemSubtotal(item).toFixed(2) }
  ];
  return (
    <div className="mall-order-detail-page">
      <section className="mall-order-section mall-order-track-section">
        <div className="mall-order-section-title">订单跟踪</div>
        <div className="mall-order-track">
          {steps.map((step, index) => {
            const isDone = step.index < stepIndex || (step.index === 4 && order.key === "completed");
            const isCurrent = step.index === stepIndex && order.key !== "completed";
            return (
              <React.Fragment key={step.index}>
                <div className={`mall-order-track-step ${isDone ? "is-done" : ""} ${isCurrent ? "is-current" : ""}`}>
                  <span className="mall-order-track-dot">{isDone ? <CheckOutlined /> : step.index}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <small>{step.time || "-"}</small>
                  </div>
                </div>
                {index < steps.length - 1 ? <span className={`mall-order-track-connector ${isDone || isCurrent ? "is-active" : ""}`} aria-hidden="true" /> : null}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      <section className="mall-order-section">
        <div className="mall-order-section-head">
          <div className="mall-order-section-title">订单概况</div>
          <Space>{order.key === "pendingPayment" ? <Button type="primary" onClick={() => ctx.go("pay")}>去支付</Button> : null}{order.key === "pendingReceipt" ? <Button type="primary" onClick={() => confirmReceipt(ctx, order)}>确认收货</Button> : null}<Button onClick={() => afterSaleModal(ctx, order)}>申请售后</Button>{order.key === "completed" ? <Button onClick={() => invoiceApplyModal(ctx, order)}>申请开票</Button> : null}</Space>
        </div>
        <div className="mall-order-overview">
          <div><span>订单状态：</span><strong className="is-orange">{order.statusLabel || "-"}</strong></div>
          <div><span>付款状态：</span><strong>{order.payLabel || "-"}</strong></div>
          <div><span>订单编号：</span><strong>{order.id || "-"}</strong></div>
          <div><span>支付方式：</span><strong>{paymentMethodLabel(rawOrder.paymentMethodText || rawOrder.paymentChannel || rawOrder.payMethod || (String(rawOrder.paymentMethod || "").toUpperCase() === "ONLINE_PAY" ? "" : rawOrder.paymentMethod) || (paid ? ctx.payMethod : ""))}</strong></div>
        </div>
        <div className="mall-order-receiver">
          <div className="mall-order-section-title">收货信息</div>
          <div className="mall-order-receiver-grid">
            <div><span>收货人：</span><strong>{order.receiverName || "-"}</strong></div>
            <div><span>手机号码：</span><strong>{order.receiverPhone || "-"}</strong></div>
            <div className="mall-order-receiver-address"><span>收货地址：</span><strong>{order.receiverAddress || "-"}</strong></div>
          </div>
        </div>
      </section>

      <section className="mall-order-section">
        <div className="mall-order-section-title">商品清单</div>
        <Table
          className="mall-order-products-table"
          rowKey={(item: AnyRecord, index?: number) => `${item.id || item.skuCode || item.skuName || "row"}-${index}`}
          dataSource={items}
          columns={productColumns}
          pagination={false}
        />
        <div className="mall-order-goods-footer">
          <div className="mall-order-buyer-message"><span>买家留言：</span><strong>{rawOrder.buyerMessage || rawOrder.remark || "-"}</strong></div>
          <div className="mall-order-total-lines">
            <div><span className="mall-order-total-label">共 {goodsQty} 件商品，商品总价：</span><strong>{money(goodsAmount || orderAmount)}</strong></div>
            <div><span className="mall-order-total-label">运费：</span><strong>+{money(freightAmount)}</strong></div>
            <div><span className="mall-order-total-label">订单实付：</span><strong className="is-highlight">{money(paidAmount || orderAmount + freightAmount)}</strong></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function paymentMethodLabel(value: any) {
  const raw = String(value || "").trim();
  const upper = raw.toUpperCase();
  if (!raw) return "-";
  if (raw === "wechat" || upper.includes("WECHAT") || upper.includes("WX")) return "微信支付";
  if (raw === "alipay" || upper.includes("ALIPAY")) return "支付宝支付";
  if (/微信/.test(raw)) return "微信支付";
  if (/支付宝/.test(raw)) return "支付宝支付";
  if (upper === "ONLINE_PAY") return "在线支付";
  return raw;
}

function orderItemImage(item: AnyRecord, products: AnyRecord[] = []) {
  const direct = item.productImageUrl || item.mainImageUrl || item.mainImageCardUrl || item.mainImageThumbnailUrl || item.thumbnailUrl || item.skuImageUrl || item.imageUrl || item.image || "";
  if (direct) return direct;
  const productId = orderItemProductId(item);
  const matched = products.find(product => String(product.id || product.apiId || "") === productId);
  return matched?.image || matched?.mainImageUrl || matched?.mainImageCardUrl || matched?.mainImageThumbnailUrl || matched?.thumbnailUrl || "";
}

function orderItemProductId(item: AnyRecord) {
  return String(item.productId || item.product_id || item.product?.id || item.productApiId || "");
}

function orderItemProductPayload(item: AnyRecord, products: AnyRecord[] = []) {
  const productId = orderItemProductId(item);
  if (!productId) return null;
  const matched = products.find(product => String(product.id || product.apiId || "") === productId);
  return matched || { id: Number(productId), name: item.productName || item.skuName || "商品" };
}

function orderItemSpecText(item: AnyRecord) {
  const raw = String(item.skuName || item.specName || item.spec || item.specification || "-").trim();
  if (!raw || raw === "-") return "-";
  return raw.replace(/\s*\/\s*/g, " ；");
}

function orderItemSkuBarcode(item: AnyRecord) {
  return item.skuBarcode || item.barCode || item.barcode || item.skuBarCode || item.skuCode || item.skuNo || "-";
}

function orderItemUnitPrice(item: AnyRecord) {
  return Number(item.salePrice ?? item.price ?? item.unitPrice ?? item.actualPrice ?? 0);
}

function orderItemSubtotal(item: AnyRecord) {
  const quantity = Number(item.quantity || item.qty || 0);
  const subtotal = Number(item.subtotalAmount ?? item.totalAmount ?? item.amount ?? item.payAmount ?? NaN);
  return Number.isFinite(subtotal) ? subtotal : orderItemUnitPrice(item) * quantity;
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
        { title: "电话", dataIndex: "phone" },
        { title: "地址", dataIndex: "address" },
        { title: "默认", dataIndex: "isDefault", render: (v) => v ? <Tag color="green">默认</Tag> : "-" },
        { title: "操作", render: (_, item) => <Space><Button type="link" onClick={() => addressModal(ctx, item)}>编辑</Button>{!item.isDefault ? <Button type="link" onClick={() => setDefaultAddress(ctx, item)}>设为默认</Button> : null}{!item.isDefault ? <Button type="link" danger onClick={() => deleteAddress(ctx, item)}>删除</Button> : null}</Space> }
      ]} />
    </Card>
  );
}

function addressModal(ctx: any, item?: AnyRecord) {
  Modal.confirm({
    title: item ? "编辑地址" : "新增地址",
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
      <Form.Item name="address" label="详细地址" rules={[{ required: true }]}><Input.TextArea /></Form.Item>
      <Form.Item name="isDefault" valuePropName="checked"><Checkbox>设为默认</Checkbox></Form.Item>
      <Space><Button onClick={() => Modal.destroyAll()}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
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
    <Card title="发票抬头" extra={<Button type="primary" onClick={() => invoiceTitleModal(ctx)}>新增抬头</Button>}>
      <Table loading={loading} rowKey="id" dataSource={ctx.invoiceTitles} columns={[
        { title: "抬头", dataIndex: "title" },
        { title: "类型", dataIndex: "type" },
        { title: "税号", dataIndex: "taxNo" },
        { title: "邮箱", dataIndex: "email" },
        { title: "默认", dataIndex: "isDefault", render: v => v ? <Tag color="green">默认</Tag> : "-" },
        { title: "操作", render: (_, item) => <Space><Button type="link" onClick={() => invoiceTitleModal(ctx, item)}>编辑</Button>{!item.isDefault ? <Button type="link" onClick={() => setDefaultTitle(ctx, item)}>设为默认</Button> : null}{!item.isDefault ? <Button type="link" danger onClick={() => deleteTitle(ctx, item)}>删除</Button> : null}</Space> }
      ]} />
    </Card>
  );
}

function invoiceTitleModal(ctx: any, item?: AnyRecord) {
  Modal.confirm({ title: item ? "编辑发票抬头" : "新增发票抬头", icon: null, width: 620, content: <InvoiceTitleForm ctx={ctx} item={item} />, footer: null });
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
      <Form.Item name="title" label="发票抬头" rules={[{ required: true }]}><Input /></Form.Item>
      <Form.Item name="taxNo" label="纳税人识别号"><Input /></Form.Item>
      <Form.Item name="email" label="接收邮箱" rules={[{ required: true }]}><Input /></Form.Item>
      <Form.Item name="isDefault" valuePropName="checked"><Checkbox>设为默认</Checkbox></Form.Item>
      <Space><Button onClick={() => Modal.destroyAll()}>取消</Button><Button type="primary" htmlType="submit">保存</Button></Space>
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

function MallLoginGuide({ ctx }: any) {
  return (
    <div className="mall-login-guide">
      <span>欢迎访问夏至商城，请登录后浏览，推荐商品更精确哦~</span>
      <Button className="mall-login-guide-action" type="primary" onClick={() => ctx.requireLogin("/mall")}>立即登录</Button>
      <button className="mall-login-guide-close" type="button" aria-label="关闭登录引导" onClick={() => ctx.setShowLoginGuide(false)}><CloseOutlined /></button>
    </div>
  );
}

function MallFloatingToolbar({ ctx }: any) {
  const protectedAction = (label: string, redirect: string, page?: Page) => {
    if (!ctx.isLoggedIn) {
      ctx.requireLogin(redirect);
      return;
    }
    if (page) ctx.go(page);
    else ctx.message.info(`${label}功能建设中`);
  };
  return (
    <div className="mall-floating-toolbar">
      <button type="button" onClick={() => protectedAction("个人中心", "/account", "profile")}><HomeOutlined />个人中心</button>
      <button type="button" className="mall-floating-cart-button" onClick={() => protectedAction("购物车", "/cart", "cart")}>
        <span className="mall-floating-cart-icon">
          <ShoppingCartOutlined />
          {Number(ctx.cartCount || 0) > 0 ? <span className="mall-floating-cart-badge">{Number(ctx.cartCount || 0) > 99 ? "99+" : Number(ctx.cartCount || 0)}</span> : null}
        </span>
        购物车
      </button>
      <button type="button" onClick={() => protectedAction("我的订单", "/orders", "orders")}><ProfileOutlined />我的订单</button>
      <button type="button" onClick={() => protectedAction("关注商品", "/account")}><ShoppingOutlined />关注商品</button>
      <button type="button" onClick={() => protectedAction("常购清单", "/account")}><AppstoreOutlined />常购清单</button>
      <button type="button" onClick={() => protectedAction("浏览历史", "/history", "history")}><ProfileOutlined />浏览历史</button>
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>返回顶部</button>
    </div>
  );
}

function MallAiAssistant({ ctx }: any) {
  const questions = ["帮我找办公室采购的饮用水", "怎么加入购物车？", "怎么申请发票？", "起批量是什么意思？", "如何注册账号？"];
  const [messages, setMessages] = useState<AnyRecord[]>([
    { role: "assistant", answer: "你好，我是 AI采购助手。可以帮你找商品、问采购规则、了解下单流程。" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ctx.aiAssistantOpen) {
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 30);
    }
  }, [messages, loading, ctx.aiAssistantOpen]);

  const sendQuestion = async (value?: string) => {
    const text = String(value ?? input).trim();
    if (!text) {
      ctx.message.warning("请输入问题");
      return;
    }
    if (text.length > 300) {
      ctx.message.warning("问题内容过长，请简化后再试");
      return;
    }
    setInput("");
    setMessages(prev => [...prev, { role: "user", answer: text }]);
    setLoading(true);
    try {
      const response = await request<AnyRecord>("/api/mall/ai/chat", {
        method: "POST",
        data: {
          message: text,
          pageType: ctx.selectedProduct ? "productDetail" : "mallHome",
          productId: ctx.selectedProduct?.id || null,
          keyword: ctx.listQuery?.keyword || ctx.searchText || null,
          categoryId: ctx.listQuery?.categoryId || null,
          isLoggedIn: ctx.isLoggedIn
        }
      });
      const data = response?.data || response;
      if (response?.code && response.code !== 0) {
        throw new Error(response.message || data?.answer || "AI助手暂时不可用，请稍后重试");
      }
      setMessages(prev => [...prev, {
        role: "assistant",
        answer: data?.answer || "我暂时没有理解你的问题，可以换个问法试试。",
        products: Array.isArray(data?.products) ? data.products : [],
        actions: Array.isArray(data?.actions) ? data.actions : []
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: "assistant", answer: error?.message || "AI助手暂时不可用，请稍后重试" }]);
    } finally {
      setLoading(false);
    }
  };

  const viewProduct = async (item: AnyRecord) => {
    const id = item.productId || item.id;
    if (!ctx.isLoggedIn) {
      ctx.requireLogin(`/product/${id}`);
      return;
    }
    let product = ctx.products.find((row: AnyRecord) => String(row.id) === String(id));
    if (!product) {
      product = productFromApi(await request<AnyRecord>(`/api/mall/products/${id}`));
    }
    ctx.go("detail", product);
    ctx.setAiAssistantOpen(false);
  };

  const addProductToCart = async (item: AnyRecord) => {
    const id = item.productId || item.id;
    if (!ctx.isLoggedIn) {
      ctx.requireLogin(window.location.pathname + window.location.search);
      return;
    }
    await ctx.apiGuard(async () => {
      const product = productFromApi(await request<AnyRecord>(`/api/mall/products/${id}`));
      const quantity = Math.max(1, Number(product.specs?.[0]?.min || product.raw?.minOrderQuantity || 1));
      await request("/api/mall/cart/items", { method: "POST", data: { productId: Number(id), quantity, specIndex: 0 } });
      await ctx.hydrateCart();
      ctx.message.success("已加入购物车");
    });
  };

  if (!ctx.aiAssistantOpen) return null;

  return (
    <div
      className="mall-ai-popup"
      style={{
        left: `${ctx.aiAssistantPosition?.left ?? 16}px`,
        top: `${ctx.aiAssistantPosition?.top ?? 90}px`,
        "--mall-ai-popup-left": `${ctx.aiAssistantPosition?.left ?? 16}px`,
        "--mall-ai-popup-top": `${ctx.aiAssistantPosition?.top ?? 90}px`
      }}
    >
      <div className="mall-ai-popup-header">
        <div className="mall-ai-popup-title">
          <RobotOutlined />
          <div>
            <div>AI助手</div>
            <small>帮你找商品、问采购规则、了解下单流程</small>
          </div>
        </div>
        <button type="button" aria-label="关闭AI助手" onClick={() => ctx.setAiAssistantOpen(false)}><CloseOutlined /></button>
      </div>
      <div className="mall-ai-assistant">
        <div className="mall-ai-prompts">
          {questions.map(question => <button key={question} type="button" onClick={() => sendQuestion(question)}>{question}</button>)}
        </div>
        <div className="mall-ai-messages" ref={listRef}>
          {messages.map((item, index) => (
            <div key={`${item.role}-${index}`} className={`mall-ai-message is-${item.role}`}>
              <div className="mall-ai-bubble">
                <div>{item.answer}</div>
                {item.actions?.filter((action: AnyRecord) => action.type !== "viewProduct").length ? (
                  <div className="mall-ai-actions">
                    {item.actions.filter((action: AnyRecord) => action.type !== "viewProduct").map((action: AnyRecord, actionIndex: number) => (
                      <Button key={actionIndex} size="small" type="primary" onClick={() => action.type === "login" ? ctx.requireLogin("/mall") : undefined}>{action.label}</Button>
                    ))}
                  </div>
                ) : null}
                {item.products?.length ? (
                  <div className="mall-ai-products">
                    {item.products.map((product: AnyRecord) => (
                      <div className="mall-ai-product" key={product.productId}>
                        {product.imageUrl ? <img src={product.imageUrl} /> : <div className="mall-ai-product-img">商</div>}
                        <div className="mall-ai-product-info">
                          <strong title={product.productName}>{product.productName}</strong>
                          <span>{money(product.price)} / {product.saleUnit || "件"}</span>
                          <small>库存：{product.stock ?? 0}{product.saleUnit || "件"}</small>
                          <Space size={6} className="mall-ai-product-actions">
                            <Button className="mall-ai-view-product" size="small" onClick={() => viewProduct(product)}>查看商品</Button>
                            <Button className="mall-ai-add-cart" size="small" type="primary" onClick={() => addProductToCart(product)}>加入购物车</Button>
                          </Space>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {loading ? <div className="mall-ai-message is-assistant"><div className="mall-ai-bubble">正在思考...</div></div> : null}
        </div>
        <div className="mall-ai-input">
          <Input
            value={input}
            placeholder="请输入采购问题"
            maxLength={300}
            onChange={event => setInput(event.target.value)}
            onPressEnter={() => sendQuestion()}
          />
          <Button type="primary" loading={loading} onClick={() => sendQuestion()}>发送</Button>
        </div>
      </div>
    </div>
  );
}

function BrowseHistoryPage({ ctx }: any) {
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await request<AnyRecord[]>("/api/mall/browse-history");
      setRows((Array.isArray(data) ? data : []).map(historyItemFromApi));
    } catch (error: any) {
      ctx.message.error(error?.message || "浏览历史加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const grouped = groupBrowseHistoryByDay(rows);

  const openProduct = (item: AnyRecord) => {
    const product = ctx.products.find((row: AnyRecord) => String(row.id) === String(item.productId)) || item;
    ctx.go("detail", product);
  };

  const removeItem = async (item: AnyRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    await request(`/api/mall/browse-history/${item.productId}`, { method: "DELETE" });
    setRows(current => current.filter(row => String(row.productId) !== String(item.productId)));
  };

  const clearAll = () => {
    if (!rows.length) return;
    Modal.confirm({
      title: "确认清空浏览历史？",
      content: "清空后当前账号下的浏览历史会被删除。",
      okText: "清空",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        await request("/api/mall/browse-history", { method: "DELETE" });
        setRows([]);
      }
    });
  };

  const addToCart = async (item: AnyRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    await ctx.apiGuard(async () => {
      const product = productFromApi(await request<AnyRecord>(`/api/mall/products/${item.productId}`));
      const quantity = Math.max(1, Number(product.specs?.[0]?.min || product.raw?.minOrderQuantity || 1));
      await request("/api/mall/cart/items", { method: "POST", data: { productId: Number(item.productId), quantity, specIndex: 0 } });
      await ctx.hydrateCart();
      ctx.message.success("已加入购物车");
    });
  };

  return (
    <div className="mall-history-page">
      <section className="mall-history-head">
        <h1>浏览过的商品</h1>
        <Button icon={<DeleteOutlined />} onClick={clearAll} disabled={!rows.length}>批量清空</Button>
      </section>
      {loading ? (
        <Card className="mall-history-empty" loading />
      ) : !rows.length ? (
        <Card className="mall-history-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无浏览历史" /></Card>
      ) : (
        grouped.map(group => (
          <section className="mall-history-section" key={group.key}>
            <header>
              <h2>{group.title}</h2>
              <span>看过{group.items.length}件商品</span>
            </header>
            <div className="mall-history-grid">
              {group.items.map(item => {
                const image = safeMallImageUrl(item.cardImage || item.image || item.raw?.mainImageCardUrl || item.raw?.mainImageThumbnailUrl);
                const stock = Number(item.specs?.[0]?.stock ?? item.raw?.stockQuantity ?? 0);
                const offSale = item.raw?.saleStatus && item.raw.saleStatus !== "ON_SALE";
                const unavailable = offSale || stock <= 0;
                const unavailableText = offSale ? "下架" : stock <= 0 ? "无货" : "";
                const price = Number(item.specs?.[0]?.price ?? item.raw?.salePrice ?? 0);
                return (
                  <article className="mall-history-item" key={`${group.key}-${item.productId}`} onClick={() => openProduct(item)}>
                    <button type="button" className="mall-history-remove" aria-label="删除浏览记录" onClick={(event) => removeItem(item, event)}><DeleteOutlined /></button>
                    <div className="mall-history-image">
                      {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span><PictureOutlined /></span>}
                      {unavailable ? <em>{unavailableText}</em> : null}
                    </div>
                    <strong title={item.name}>{item.name}</strong>
                    <div className="mall-history-price-row">
                      <span>{money(price)}</span>
                      <Button type="primary" size="small" className="mall-product-cart-icon" icon={<ShoppingCartOutlined />} disabled={unavailable} onClick={(event) => addToCart(item, event)} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function historyItemFromApi(row: AnyRecord) {
  const product = productFromApi({ ...row, id: row.productId });
  return {
    ...product,
    historyId: row.id,
    productId: Number(row.productId || product.id),
    viewedAt: row.viewedAt,
    viewCount: Number(row.viewCount || 1),
    raw: { ...product.raw, ...row }
  };
}

function groupBrowseHistoryByDay(rows: AnyRecord[]) {
  const groups: AnyRecord[] = [];
  const groupMap = new Map<string, AnyRecord>();
  rows.forEach(item => {
    const key = browseHistoryDayKey(item.viewedAt);
    if (!groupMap.has(key)) {
      const group = { key, title: browseHistoryDayTitle(key), items: [] as AnyRecord[] };
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key).items.push(item);
  });
  return groups;
}

function browseHistoryDayKey(value: any) {
  const date = new Date(value || Date.now());
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${safeDate.getFullYear()}-${month}-${day}`;
}

function browseHistoryDayTitle(key: string) {
  const [, month, day] = String(key).split("-");
  return `${month || "--"}月${day || "--"}日`;
}

function ProfilePage({ ctx }: any) {
  const profile = ctx.profile || {};
  const displayName = profile.buyerName || ctx.buyerName || "采购用户";
  const companyName = profile.companyName || "-";
  const phone = profile.phone || "-";
  const levelName = profile.levelName || "-";
  const defaultAddress = (ctx.addresses || []).find((item: AnyRecord) => item.isDefault) || (ctx.addresses || [])[0];
  const defaultTitle = (ctx.invoiceTitles || []).find((item: AnyRecord) => item.isDefault) || (ctx.invoiceTitles || [])[0];
  const latestOrder = (ctx.orders || [])[0];
  const latestOrderItem = latestOrder?.items?.[0] || null;
  const latestOrderImage = latestOrderItem ? safeMallImageUrl(orderItemImage(latestOrderItem, ctx.products)) : "";
  const latestOrderNo = latestOrder?.id ? `订单号：${latestOrder.id}` : "订单号：-";
  const cartPreview = (ctx.cart || []).slice(0, 4).map((item: AnyRecord) => {
    const product = cartProduct(ctx.products, item) || {};
    const spec = product?.specs?.[Number(item.specIndex || 0)] || {};
    return {
      key: cartSkuRowKey(item),
      item,
      product,
      spec,
      title: product.name || `商品 #${item.productId}`,
      image: safeMallImageUrl(spec.image || product.cardImage || product.image || product.mainImageUrl)
    };
  });
  const orderStats = [
    { key: "pendingPayment", label: "待付款", icon: <CreditCardOutlined />, count: ctx.orders.filter((item: AnyRecord) => item.key === "pendingPayment").length },
    { key: "pendingShipment", label: "待发货", icon: <ShoppingOutlined />, count: ctx.orders.filter((item: AnyRecord) => item.key === "pendingShipment").length },
    { key: "pendingReceipt", label: "待收货", icon: <ShoppingCartOutlined />, count: ctx.orders.filter((item: AnyRecord) => item.key === "pendingReceipt").length },
    { key: "completed", label: "已完成", icon: <CheckOutlined />, count: ctx.orders.filter((item: AnyRecord) => item.key === "completed").length }
  ];
  const openLatestOrder = () => {
    if (!latestOrder) {
      ctx.go("orders");
      return;
    }
    ctx.setCurrentOrder(latestOrder);
    ctx.go("orderDetail");
  };
  return (
    <div className="mall-account-page">
      <aside className="mall-account-side">
        <button type="button" className="mall-account-side-brand is-active" onClick={() => ctx.go("profile")}><UserOutlined />个人中心</button>
        <section>
          <h3><ProfileOutlined />订单中心</h3>
          <button type="button" onClick={() => ctx.go("orders")}>我的订单</button>
          <button type="button" onClick={() => ctx.go("cart")}>我的购物车</button>
        </section>
        <section>
          <h3><AppstoreOutlined />账户管理</h3>
          <button type="button" onClick={() => ctx.go("addresses")}>收货地址</button>
          <button type="button" onClick={() => ctx.go("invoiceTitles")}>发票抬头</button>
        </section>
      </aside>

      <section className="mall-account-content">
        <div className="mall-account-hero">
          <div className="mall-account-avatar" aria-hidden="true">{String(displayName).slice(0, 1) || "采"}</div>
          <div className="mall-account-identity">
            <h1>{displayName}</h1>
            <button type="button" onClick={() => ctx.go("addresses")}><EnvironmentOutlined />收货地址管理</button>
          </div>
          <Button className="mall-account-hero-action" onClick={() => ctx.go("invoiceTitles")}>管理发票抬头</Button>
        </div>

        <div className="mall-account-grid">
          <section className="mall-account-card mall-account-orders-card">
            <header>
              <h2>我的订单</h2>
              <button type="button" onClick={() => ctx.go("orders")}>全部订单 <RightOutlined /></button>
            </header>
            <div className="mall-account-order-stats">
              {orderStats.map(item => (
                <button type="button" key={item.key} onClick={() => ctx.go("orders")}>
                  <Badge count={item.count} size="small" offset={[2, 0]}>
                    <span>{item.icon}</span>
                  </Badge>
                  <em>{item.label}</em>
                </button>
              ))}
            </div>
            {latestOrder ? (
              <div className="mall-account-latest-order">
                {latestOrderImage ? <img src={latestOrderImage} alt="" loading="lazy" decoding="async" /> : <span><PictureOutlined /></span>}
                <div>
                  <strong title={latestOrderNo}>{latestOrderNo}</strong>
                  <p>{latestOrder.statusLabel || "-"} · {latestOrder.orderTime || "-"}</p>
                </div>
                <Button onClick={openLatestOrder}>查看详情</Button>
              </div>
            ) : (
              <Empty className="mall-account-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无订单" />
            )}
          </section>

          <section className="mall-account-card mall-account-info-card">
            <header>
              <h2>账户信息</h2>
            </header>
            <div className="mall-account-info-grid">
              <span>买家名称</span><strong>{displayName}</strong>
              <span>企业名称</span><strong>{companyName}</strong>
              <span>手机号</span><strong>{phone}</strong>
              <span>客户等级</span><strong>{levelName}</strong>
            </div>
          </section>

          <section className="mall-account-card mall-account-cart-card">
            <header>
              <h2>购物车</h2>
              <button type="button" onClick={() => ctx.go("cart")}>{ctx.cartCount || 0} 件商品 <RightOutlined /></button>
            </header>
            {cartPreview.length ? (
              <div className="mall-account-product-strip">
                {cartPreview.map(row => (
                  <button type="button" key={row.key} onClick={() => row.product?.id ? ctx.go("detail", row.product) : ctx.go("cart")}>
                    {row.image ? <img src={row.image} alt="" loading="lazy" decoding="async" /> : <span><PictureOutlined /></span>}
                    <strong title={row.title}>{row.title}</strong>
                    <em>×{Number(row.item.qty || 0)}</em>
                  </button>
                ))}
              </div>
            ) : (
              <Empty className="mall-account-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="购物车暂无商品" />
            )}
          </section>

          <section className="mall-account-card mall-account-management-card">
            <header>
              <h2>账户管理</h2>
            </header>
            <div className="mall-account-management-list">
              <button type="button" onClick={() => ctx.go("addresses")}>
                <EnvironmentOutlined />
                <span>
                  <strong>收货地址</strong>
                  <em>{defaultAddress ? `${defaultAddress.name || ""} ${defaultAddress.phone || ""}`.trim() || "已维护地址" : "暂无地址"}</em>
                </span>
                <RightOutlined />
              </button>
              <button type="button" onClick={() => ctx.go("invoiceTitles")}>
                <ProfileOutlined />
                <span>
                  <strong>发票抬头</strong>
                  <em>{defaultTitle?.title || "暂无抬头"}</em>
                </span>
                <RightOutlined />
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function AuthPage({ ctx, type }: any) {
  const isLogin = type === "login";
  const redirect = ctx.loginRedirect || getRedirectParam();
  const switchAuth = () => {
    const next = isLogin ? "register" : "login";
    ctx.setLoginRedirect(redirect);
    window.history.pushState({}, "", authPath(next, redirect));
    ctx.go(next, undefined, { skipAuth: true, skipUrl: true });
  };
  return (
    <main className="mall-auth-main">
      <section className={`mall-auth-panel ${isLogin ? "is-login" : "is-register"}`}>
        <h1>{isLogin ? "用户登录" : "用户注册"}</h1>
        <div className="mall-auth-title-line" />
        <Card className="mall-auth-card">
          <Form layout="vertical" requiredMark={false} onFinish={async values => {
            await ctx.apiGuard(async () => {
              const account = String(values.account || "").trim();
              if (isLogin) {
                const result = await request<AnyRecord>("/api/buyer/login", { method: "POST", data: buyerLoginPayload(account, values.password) });
                await ctx.completeLogin(result, account, redirect || "/mall");
                ctx.message.success("登录成功");
                return;
              }
              if (values.password !== values.confirmPassword) {
                ctx.message.error("两次输入的密码不一致");
                return;
              }
              const companyName = String(values.companyName || "").trim();
              const contactName = String(values.contactName || "").trim();
              const phone = String(values.phone || "").trim();
              await request("/api/buyer/register", { method: "POST", data: { phone, account: phone, password: values.password, buyerName: contactName, companyName, contactName } });
              await request("/api/customers", {
                method: "POST",
                data: {
                  companyName,
                  contactName,
                  contactPhone: phone,
                  salesmanName: "网页商城注册"
                }
              });
              const result = await request<AnyRecord>("/api/buyer/login", { method: "POST", data: buyerLoginPayload(phone, values.password) });
              await ctx.completeLogin(result, contactName, "/mall", phone, true);
              ctx.message.success("注册成功");
            });
          }}>
            {isLogin ? (
              <Form.Item name="account" rules={phoneRules()}>
                <Input maxLength={11} placeholder="手机号" />
              </Form.Item>
            ) : (
              <>
                <Form.Item name="companyName" rules={[{ required: true, message: "请输入企业名称" }]}>
                  <Input placeholder="企业名称" />
                </Form.Item>
                <Form.Item name="contactName" rules={[{ required: true, message: "请输入联系人" }]}>
                  <Input placeholder="联系人" />
                </Form.Item>
              </>
            )}
            {!isLogin ? (
              <Form.Item name="phone" rules={phoneRules()}>
                <Input maxLength={11} placeholder="手机号" />
              </Form.Item>
            ) : null}
            <Form.Item name="password" rules={passwordRules()}>
              <Input.Password placeholder="密码" />
            </Form.Item>
            {!isLogin ? (
              <Form.Item name="confirmPassword" rules={[{ required: true, message: "请确认密码" }]}>
                <Input.Password placeholder="确认密码" />
              </Form.Item>
            ) : null}
            <Button className="mall-auth-submit" block htmlType="submit">{isLogin ? "登录" : "注册"}</Button>
            <div className="mall-auth-links">
              {isLogin ? null : <span>已有账号？</span>}
              <button type="button" onClick={switchAuth}>{isLogin ? "立即注册" : "立即登录"}</button>
            </div>
          </Form>
        </Card>
      </section>
    </main>
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
          ctx.message.success("开票申请已提交");
        });
      }}>
        <Form.Item name="invoiceTitleId" label="发票抬头" rules={[{ required: true }]}><Select options={ctx.invoiceTitles.map((x: AnyRecord) => ({ value: x.id, label: x.title }))} /></Form.Item>
        <Form.Item name="email" label="接收邮箱" rules={[{ required: true }]}><Input /></Form.Item>
        <Button type="primary" htmlType="submit">提交申请</Button>
      </Form>
    ),
    footer: null
  });
}

function afterSaleModal(ctx: any, order: AnyRecord) {
  Modal.confirm({
    title: "申请售后",
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
        <Form.Item name="quantity" label="申请数量" initialValue={1}><InputNumber min={1} /></Form.Item>
        <Form.Item name="reason" label="原因"><Input.TextArea /></Form.Item>
        <Button type="primary" htmlType="submit">提交申请</Button>
      </Form>
    ),
    footer: null
  });
}

function firstPrice(p: AnyRecord) {
  const prices = (p.specs || []).map((spec: AnyRecord) => Number(spec.price || 0)).filter((price: number) => price > 0);
  return prices.length ? Math.min(...prices) : 0;
}

function detailUnitPrice(product: AnyRecord, specIndex: number, totalQty: number) {
  const spec = product.specs?.[specIndex] || {};
  const tiers = tierRowsForSpec(product, spec);
  if (!isTierQuote(product) || !tiers.length) return Number(spec.price || 0);
  const hit = [...tiers]
    .sort((a: AnyRecord, b: AnyRecord) => Number(b.minQty || 1) - Number(a.minQty || 1))
    .find((row: AnyRecord) => totalQty >= Number(row.minQty || 1) && (!row.maxQty || totalQty <= Number(row.maxQty)));
  return Number(hit?.price || spec.price || 0);
}

function isTierQuote(product: AnyRecord) {
  return product?.rawQuoteType === "TIER_PRICE" || product?.quoteType === "阶梯报价" || tierRowsForProduct(product).length > 0;
}

function tierRowsForSpec(product: AnyRecord, spec: AnyRecord) {
  const specRows = parseRows(spec?.tierPrices)
    .map((row: AnyRecord) => ({ minQty: Number(row.minQty || 1), maxQty: row.maxQty, price: Number(row.price || 0) }))
    .filter((row: AnyRecord) => row.minQty > 0 && row.price > 0);
  if (specRows.length) return specRows;
  return tierRowsForProduct(product);
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
    <ConfigProvider locale={zhCN} form={{ validateMessages: formValidateMessages }}>
      <AntApp>
        <MallRoot />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);



