import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-vue", "@wxt-dev/unocss"],
  webExt: {
    chromiumArgs: ['https://cli.im/text'],
  },
  vite: () => ({
    server: {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  }),
});
