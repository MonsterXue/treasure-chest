import { onMessage } from "webext-bridge/content-script";
import App from "./App.vue";
import "@/styles/reset.css";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "treasure-chest",
      position: "inline",
      anchor: "body",
      onMount: (container) => {
        const app = createApp(App);
        app.mount(container);
        return app;
      },
      onRemove: (app) => {
        app?.unmount();
      },
    });

    ui.mount();
  },
});
