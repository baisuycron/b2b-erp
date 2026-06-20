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
  AppstoreOutlined,
  CameraOutlined,
  CloseOutlined,
  ExclamationCircleFilled,
  HomeOutlined,
  SearchOutlined,
  MinusOutlined,
  PlusOutlined,
  ProfileOutlined,
  RobotOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  UserOutlined
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

type Page = "home" | "list" | "detail" | "cart" | "confirm" | "pay" | "orders" | "orderDetail" | "addresses" | "invoiceTitles" | "profile" | "login" | "register";
const authPages: Page[] = ["login", "register"];
const protectedPages: Page[] = ["detail", "cart", "confirm", "pay", "orders", "orderDetail", "addresses", "invoiceTitles", "profile"];

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
  const detailRequestSeqRef = useRef(0);
  const imageSearchRequestRef = useRef(false);
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
      "/account": "profile"
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
      if (payload?.raw?.detailContent) productDetailCacheRef.current.set(productKey, payload);
      const readyDetail = cachedDetail || (payload?.raw?.detailContent ? payload : null);
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
        const detailPayload = productFromApi(await request<AnyRecord>(`/api/mall/products/${payload.id}`));
        productDetailCacheRef.current.set(productKey, detailPayload);
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
            <button type="button" onClick={() => go("orders")}><ProfileOutlined />订单</button>
            <button type="button" onClick={() => go("profile")}><UserOutlined />账户</button>
          </div>
        </div>
      </div>
      <div className="mall-header">
        <div className="mall-logo" onClick={() => go("home")}><div className="admin-logo" style={{ width: 36, height: 36, fontSize: 16 }}>B</div>夏至商城</div>
        <MallSearchBar ctx={ctx} />
        <Button ref={aiButtonRef} className="mall-ai-header-button" type="primary" icon={<RobotOutlined />} onClick={openAiAssistant}>AI助手</Button>
      </div>
      <main className="mall-main">
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
    status: row.skuStatus || "ENABLED",
    specValues: normalizeSkuSpecValues(row.specValues),
    tierPrices: parseRows(row.tierPrices)
  })) : [{
    code: item.skuCode,
    name: item.skuName || "默认规格",
    image: item.mainImageUrl,
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
  const carouselImages = uniqueTruthy([item.mainImageUrl, ...(detail.carouselImages || [])]).slice(0, 5);
  const gallery = carouselImages.length ? carouselImages : uniqueTruthy([item.mainImageUrl]);
  return {
    id: Number(item.id),
    apiId: Number(item.id),
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
    image: item.mainImageUrl,
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

function normalizeSkuSpecValues(value: any) {
  if (!Array.isArray(value)) return [];
  return value
    .map((cell, index) => ({
      groupId: String(cell?.groupId || cell?.groupName || `group_${index}`),
      groupName: String(cell?.groupName || `规格${index + 1}`),
      valueId: String(cell?.valueId || cell?.value || ""),
      value: String(cell?.value || ""),
      image: String(cell?.image || "")
    }))
    .filter(cell => cell.value);
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
  const [addingProductIds, setAddingProductIds] = useState<Set<string>>(new Set());
  const addToCart = async (event: any, product: AnyRecord) => {
    event.stopPropagation();
    if (!ctx.isLoggedIn) {
      ctx.requireLogin(`/product/${product.id}`);
      return;
    }
    const addingKey = String(product.id);
    if (addingProductIds.has(addingKey)) return;
    setAddingProductIds(prev => new Set(prev).add(addingKey));
    try {
      const qty = Math.max(1, Number(product.specs?.[0]?.min || product.raw?.minOrderQuantity || 1));
      await request("/api/mall/cart/items", { method: "POST", data: { productId: product.id, quantity: qty, specIndex: 0 } });
      await ctx.hydrateCart();
      ctx.message.open({ type: "success", content: "已加入购物车", key: "mall-cart-add", duration: 1.2 });
    } catch (error: any) {
      ctx.message.open({ type: "error", content: error?.message || "加入购物车失败", key: "mall-cart-add", duration: 2 });
    } finally {
      setAddingProductIds(prev => {
        const next = new Set(prev);
        next.delete(addingKey);
        return next;
      });
    }
  };
  return (
    <div className="product-grid-shell" aria-busy={loading}>
      {!products.length ? (
        <Empty description="暂无匹配商品，请调整搜索关键词或筛选条件" />
      ) : (
        <div className="product-grid">
          {products.map((p: AnyRecord) => {
          const isAdding = addingProductIds.has(String(p.id));
          return (
            <Card
              key={p.id}
              className="mall-product-card"
              hoverable
              onClick={() => ctx.isLoggedIn ? ctx.go("detail", p) : ctx.requireLogin(`/product/${p.id}`)}
              cover={p.image ? <img className="product-card-img" src={p.image} loading="lazy" decoding="async" /> : <div className="product-card-img" style={{ display: "grid", placeItems: "center", fontWeight: 800, color: "#4e7cff" }}>{p.brand?.[0] || "商"}</div>}
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
                    loading={isAdding}
                    aria-busy={isAdding}
                    aria-label="加入购物车"
                    title="加入购物车"
                    onClick={(event) => addToCart(event, p)}
                  />
                </div>
              </div>
            </Card>
          );
          })}
        </div>
      )}
    </div>
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
  const lastGroup = lastSkuGroupFor(p);
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

            <div className="mall-detail-spec-area">
              {selectionGroups.map((group: AnyRecord, groupIndex: number) => (
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
                            {groupIndex === 0 && value.image ? <img src={value.image} alt="" /> : null}
                            <span>{value.value}</span>
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className={`mall-detail-sku-box ${batchSaleTip ? "" : "is-plain"}`}>
                <div className="mall-detail-sku-top">
                  <div className="mall-detail-sku-group-name">{lastGroup?.name || "规格"}</div>
                  {batchSaleTip ? (
                    <div className="mall-detail-batch-tip">
                      <ExclamationCircleFilled />
                      <span>{batchSaleTip}</span>
                    </div>
                  ) : null}
                </div>
                <div className="mall-detail-sku-list">
                  {visibleSpecs.length ? visibleSpecs.map((spec: AnyRecord) => {
                    const specIndex = Number(spec.originalIndex);
                    const qty = Number(ctx.detailQty[specIndex] || 0);
                    const soldOut = spec.status === "DISABLED" || Number(spec.stock || 0) <= 0;
                    return (
                      <div className={`mall-detail-sku-row ${soldOut ? "is-sold-out" : ""}`} key={`${spec.code}-${specIndex}`}>
                        <div className="mall-detail-sku-name">
                          <span>{skuRowLabel(spec, lastGroup, p)}</span>
                          <em>规格ID:{spec.code || "-"}</em>
                          {soldOut ? <Tag color="default">售罄</Tag> : null}
                        </div>
                        <div className="mall-detail-sku-price">{money(detailUnitPrice(p, specIndex, totalQty))}</div>
                        <div className="mall-detail-sku-stock">{Number(spec.stock || 0)} {stockUnitLabel}</div>
                        <div className="mall-detail-stepper">
                          <Button icon={<MinusOutlined />} disabled={qty <= 0} onClick={() => setSkuQty(specIndex, qty - quantityStep)} />
                          <InputNumber min={0} max={Number(spec.stock || 0)} step={quantityStep} controls={false} precision={0} value={qty} disabled={soldOut} onChange={value => setSkuQty(specIndex, value)} />
                          <Button icon={<PlusOutlined />} disabled={soldOut || qty + quantityStep > Number(spec.stock || 0)} onClick={() => increaseQty(specIndex)} />
                        </div>
                      </div>
                    );
                  }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前规格暂无可购 SKU" />}
                </div>
              </div>
            </div>

            <div className="mall-detail-summary">
              <span>已选 <b>{selected.length}</b> 款 <b>{totalQty}</b> {stockUnitLabel}</span>
              <span>商品金额：<b>{money(totalAmount)}</b></span>
              <span>运费：待确认</span>
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
  const p = ctx.selectedProduct;
  const rows = Object.entries(ctx.detailQty)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([idx, qty]) => ({ specIndex: Number(idx), qty: Number(qty), spec: p.specs[Number(idx)] }));
  const invalid = rows.find(row => row.qty < Number(row.spec?.min || 1));
  if (invalid) {
    ctx.message.warning("未满足最小起订量");
    return null;
  }
  const overStock = rows.find(row => row.qty > Number(row.spec?.stock || 0));
  if (overStock) {
    ctx.message.warning("采购数量不能超过库存");
    return null;
  }
  const step = quantityStepForProduct(p);
  const invalidStep = p.saleMode === "BATCH" && step > 1 ? rows.find(row => row.qty % step !== 0) : null;
  if (invalidStep) {
    ctx.message.warning(`采购数量需按 ${step}${stockUnitForProduct(p)} 的倍数填写`);
    return null;
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
          { title: "选择", render: (_, item) => <Checkbox checked={item.checked !== false} onChange={e => updateCart(item, { checked: e.target.checked })} /> },
          { title: "商品", render: (_, item) => cartProduct(ctx.products, item)?.name || "-" },
          { title: "规格", render: (_, item) => cartSpec(ctx.products, item)?.name || "-" },
          { title: "单价", render: (_, item) => money(cartItemPrice(ctx.products, item)) },
          { title: "数量", render: (_, item) => <InputNumber min={Number(cartSpec(ctx.products, item)?.min || 1)} precision={0} step={1} value={item.qty} onChange={v => updateCart(item, { quantity: Number(v || cartSpec(ctx.products, item)?.min || 1) })} /> },
          { title: "小计", render: (_, item) => money(cartItemPrice(ctx.products, item) * item.qty) },
          { title: "操作", render: (_, item) => <Button type="link" danger onClick={() => remove(item)}>删除</Button> }
        ]} />
      </Card>
      <div className="cart-summary">
        <Typography.Text>已选 {ctx.cart.filter((x: AnyRecord) => x.checked !== false).length} 种商品</Typography.Text>
        <Space><b>合计：{money(total)}</b><Button type="primary" onClick={() => { ctx.setCheckoutItems(null); ctx.go("confirm"); }}>去结算</Button></Space>
      </div>
    </Space>
  );
}

function ConfirmPage({ ctx }: any) {
  const rows = ctx.checkoutRows;
  const address = ctx.addresses.find((x: AnyRecord) => x.isDefault) || ctx.addresses[0];
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
        remark: "网页商城下单",
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
      <Card title="商品明细">
        <Table pagination={false} rowKey={(_, idx) => String(idx)} dataSource={rows} columns={[
          { title: "商品", render: (_, item) => cartProduct(ctx.products, item)?.name || "-" },
          { title: "规格", render: (_, item) => cartSpec(ctx.products, item)?.name || "-" },
          { title: "单价", render: (_, item) => money(cartItemPrice(ctx.products, item)) },
          { title: "数量", dataIndex: "qty" },
          { title: "小计", render: (_, item) => money(cartItemPrice(ctx.products, item) * item.qty) }
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
          <Radio.Button value="alipay">支付宝支付</Radio.Button>
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
        { title: "金额", dataIndex: "amount" },
        { title: "支付", dataIndex: "payLabel", render: tag },
        { title: "状态", dataIndex: "statusLabel", render: tag },
        { title: "下单时间", dataIndex: "orderTime" },
        { title: "操作", render: (_, item) => <Space><Button type="link" onClick={() => { ctx.setCurrentOrder(item); ctx.go("orderDetail"); }}>详情</Button>{item.key === "pendingPayment" ? <Button type="link" onClick={() => { ctx.setCurrentOrder(item); ctx.go("pay"); }}>去支付</Button> : null}{item.key === "pendingReceipt" ? <Button type="link" onClick={() => confirmReceipt(ctx, item)}>确认收货</Button> : null}</Space> }
      ]} />
    </Card>
  );
}

function OrderDetailPage({ ctx }: any) {
  const order = ctx.currentOrder || ctx.orders[0];
  if (!order) return <Empty description="暂无订单详情" />;
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card title={`订单详情 ${order.id}`} extra={<Space>{order.key === "pendingPayment" ? <Button type="primary" onClick={() => ctx.go("pay")}>去支付</Button> : null}{order.key === "pendingReceipt" ? <Button type="primary" onClick={() => confirmReceipt(ctx, order)}>确认收货</Button> : null}<Button onClick={() => afterSaleModal(ctx, order)}>申请售后</Button>{order.key === "completed" ? <Button onClick={() => invoiceApplyModal(ctx, order)}>申请开票</Button> : null}</Space>}>
        <Descriptions bordered column={2} items={[
          { key: "status", label: "订单状态", children: tag(order.statusLabel) },
          { key: "pay", label: "支付状态", children: tag(order.payLabel) },
          { key: "amount", label: "订单金额", children: order.amount },
          { key: "time", label: "下单时间", children: order.orderTime },
          { key: "address", label: "收货地址", span: 2, children: `${order.receiverName || ""} ${order.receiverPhone || ""}，${order.receiverAddress || ""}` }
        ]} />
      </Card>
      <Card title="商品明细">
        <List dataSource={order.items || []} renderItem={(item: AnyRecord) => <List.Item><List.Item.Meta title={item.productName || item.skuName} description={`数量 ${item.quantity} / 单价 ${money(item.salePrice || item.price)}`} /></List.Item>} />
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
      <button type="button" onClick={() => protectedAction("商家中心", "/account")}><HomeOutlined />商家中心</button>
      <button type="button" onClick={() => protectedAction("购物车", "/cart", "cart")}><ShoppingCartOutlined />购物车</button>
      <button type="button" onClick={() => protectedAction("优惠券", "/account")}><ProfileOutlined />优惠券</button>
      <button type="button" onClick={() => protectedAction("关注商品", "/account")}><ShoppingOutlined />关注商品</button>
      <button type="button" onClick={() => protectedAction("常购清单", "/account")}><AppstoreOutlined />常购清单</button>
      <button type="button" onClick={() => protectedAction("浏览历史", "/account")}><ProfileOutlined />浏览历史</button>
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

function ProfilePage({ ctx }: any) {
  return (
    <Card title="账户信息" extra={<Space><Button onClick={() => ctx.go("invoiceTitles")}>管理发票抬头</Button></Space>}>
      <Descriptions bordered column={2} items={[
        { key: "buyerName", label: "买家名称", children: ctx.profile.buyerName || "-" },
        { key: "companyName", label: "企业名称", children: ctx.profile.companyName || "-" },
        { key: "phone", label: "手机号", children: ctx.profile.phone || "-" },
        { key: "level", label: "客户等级", children: ctx.profile.levelName || "-" }
      ]} />
    </Card>
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



