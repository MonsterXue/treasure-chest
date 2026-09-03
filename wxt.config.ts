import { defineConfig } from "wxt";
import svgLoader from "vite-svg-loader";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-vue", "@wxt-dev/unocss"],
  webExt: {
    startUrls: ["https://cli.im/text"],
    chromiumArgs: ["--auto-open-devtools-for-tabs", "--start-maximized"],
  },
  manifest: {
    name: '百宝箱',
    icons: {
      16: "icon/icon-16.png",
      32: "icon/icon-32.png",
      48: "icon/icon-48.png",
      96: "icon/icon-96.png",
      128: "icon/icon-128.png",
    },
    permissions: ["cookies", "tabs"],
    host_permissions: ["<all_urls>"],
  },
  vite: () => ({
    plugins: [svgLoader()],
    server: {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  }),
});
