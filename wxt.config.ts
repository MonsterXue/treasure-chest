import { defineConfig } from "wxt";
import svgLoader from "vite-svg-loader";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-vue", "@wxt-dev/unocss"],
  webExt: {
    chromiumArgs: ["https://cli.im/text", "--auto-open-devtools-for-tabs", "--start-maximized"],
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
