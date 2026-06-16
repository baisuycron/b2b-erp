import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET || "http://124.223.21.76:8081";

  return {
    plugins: [react()],
    build: {
      outDir: "dist-web",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, "index.html"),
          mall: path.resolve(__dirname, "mall.html")
        }
      }
    },
    server: {
      proxy: {
        "/api": devProxyTarget
      }
    }
  };
});
