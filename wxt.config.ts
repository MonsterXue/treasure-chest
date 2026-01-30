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
