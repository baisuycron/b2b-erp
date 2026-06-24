import axios, { AxiosRequestConfig } from "axios";

export const adminTokenKey = "b2b-erp-admin-token";
export const adminAccountKey = "b2b-erp-admin-account-name";
export const adminPermissionKey = "b2b-erp-admin-permissions";
export const adminSuperRoleKey = "b2b-erp-admin-is-super-role";
export const buyerTokenKey = "b2b-erp-buyer-token";
export const buyerAccountKey = "b2b-erp-buyer-account-name";
const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");

export type AnyRecord = Record<string, any>;

function resolveRequestUrl(url: string) {
  if (!apiBaseUrl || /^https?:\/\//i.test(url)) return url;
  return `${apiBaseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function request<T = any>(url: string, options: AxiosRequestConfig = {}): Promise<T> {
  const buyerApi = /^\/api\/(buyer|mall)\b/.test(url) || /^\/api\/orders\b/.test(url);
  const token = localStorage.getItem(buyerApi ? buyerTokenKey : adminTokenKey) || "";
  const isFormData = typeof FormData !== "undefined" && options.data instanceof FormData;
  try {
    const response = await axios.request<T>({
      url: resolveRequestUrl(url),
      timeout: 12000,
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 401 && token) {
      if (buyerApi) {
        localStorage.removeItem(buyerTokenKey);
        localStorage.removeItem(buyerAccountKey);
        window.dispatchEvent(new CustomEvent("b2b-erp-buyer-auth-expired"));
      } else {
        localStorage.removeItem(adminTokenKey);
        localStorage.removeItem(adminAccountKey);
        localStorage.removeItem(adminPermissionKey);
        localStorage.removeItem(adminSuperRoleKey);
        window.setTimeout(() => window.location.reload(), 0);
      }
    }
    const message = error?.response?.data?.message || error?.message || "接口请求失败";
    throw new Error(message);
  }
}

export const money = (value: any) => `¥${Number(value || 0).toFixed(2)}`;

export const dateText = (value: any) => {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
};

export function parseRows(value: any): AnyRecord[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const rows = JSON.parse(value);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function parseDetailContent(raw: any): { text: string; imageUrl: string; plainText: string; carouselImages: string[] } {
  if (raw && String(raw).trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      const text = parsed.html || parsed.text || parsed.detailText || "";
      const carouselImages = Array.isArray(parsed.carouselImages)
        ? parsed.carouselImages.map((url: any) => String(url || "").trim()).filter(Boolean).slice(0, 5)
        : [];
      return {
        text,
        imageUrl: parsed.imageUrl || parsed.detailImageUrl || "",
        plainText: parsed.plainText || parsed.summary || parsed.text || parsed.detailText || "",
        carouselImages
      };
    } catch {
      return { text: String(raw || ""), imageUrl: "", plainText: String(raw || ""), carouselImages: [] };
    }
  }
  return { text: String(raw || ""), imageUrl: "", plainText: String(raw || ""), carouselImages: [] };
}

function dataUrlBytes(dataUrl: string) {
  return Math.ceil(String(dataUrl || "").length * 3 / 4);
}

export function imageToCompressedDataUrl(file: File, options: { maxInputBytes?: number; maxOutputBytes?: number } = {}): Promise<string> {
  const maxInputBytes = options.maxInputBytes || 1024 * 1024;
  const maxOutputBytes = options.maxOutputBytes || 260 * 1024;
  if (file.size > maxInputBytes) {
    const limitMb = Math.max(1, Math.floor(maxInputBytes / 1024 / 1024));
    return Promise.reject(new Error(`图片大小不得超过 ${limitMb}MB`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片解析失败"));
      image.onload = () => {
        const maxBytes = maxOutputBytes;
        let maxSide = Math.min(900, Math.max(image.width, image.height));
        let best = "";
        for (let pass = 0; pass < 6; pass += 1) {
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("浏览器不支持图片压缩"));
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            best = dataUrl;
            if (dataUrlBytes(dataUrl) <= maxBytes) return resolve(dataUrl);
          }
          maxSide = Math.floor(maxSide * 0.75);
        }
        resolve(best);
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export function imageToFixedCanvasDataUrl(
  file: File,
  options: { width: number; height: number; maxInputBytes?: number; maxOutputBytes?: number; background?: string } = { width: 800, height: 1900 }
): Promise<string> {
  const targetWidth = Math.max(1, Math.round(options.width));
  const targetHeight = Math.max(1, Math.round(options.height));
  const maxInputBytes = options.maxInputBytes || 5 * 1024 * 1024;
  const maxOutputBytes = options.maxOutputBytes || 900 * 1024;
  const background = options.background || "#fff";
  if (file.size > maxInputBytes) {
    const limitMb = Math.max(1, Math.floor(maxInputBytes / 1024 / 1024));
    return Promise.reject(new Error(`图片大小不得超过 ${limitMb}MB`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片解析失败"));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("浏览器不支持图片处理"));
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const scale = Math.min(targetWidth / image.width, targetHeight / image.height);
        const drawWidth = Math.max(1, Math.round(image.width * scale));
        const drawHeight = Math.max(1, Math.round(image.height * scale));
        const drawX = Math.round((targetWidth - drawWidth) / 2);
        const drawY = Math.round((targetHeight - drawHeight) / 2);
        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

        let best = "";
        for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          best = dataUrl;
          if (dataUrlBytes(dataUrl) <= maxOutputBytes) return resolve(dataUrl);
        }
        resolve(best);
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export const statusText = (value: any) => {
  const map: AnyRecord = {
    ENABLED: "启用",
    DISABLED: "停用",
    ON_SALE: "已上架",
    OFF_SALE: "已下架",
    WAIT_PAY: "待支付",
    WAIT_SHIP: "待发货",
    WAIT_RECEIVE: "待收货",
    COMPLETED: "已完成",
    CANCELLED: "已取消",
    PAID: "已支付",
    UNPAID: "未支付",
    WAIT_AUDIT: "待审核",
    PENDING_REVIEW: "待审核",
    IN_STOCK: "已入库",
    REJECTED: "已驳回",
    WAIT_RETURN_RECEIVE: "待退货收货",
    WAIT_REFUND: "待退款",
    WAIT_INVOICE: "待开票",
    REFUNDED: "已退款",
    SUCCESS: "成功"
  };
  return map[value] || value || "-";
};
