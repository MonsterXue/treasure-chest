import { onMessage, sendMessage } from "webext-bridge/content-script";
import { BrowserQRCodeReader } from "@zxing/browser";
import App from "./App.vue";
import "./reset.css";

const qrCodeDecoder = new BrowserQRCodeReader();
const decodeImg = async (url: string) => {
  try {
    const res = await qrCodeDecoder.decodeFromImageUrl(url);
    return res.getText();
  } catch (err) {
    console.log(err);
  }
};

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",
  async main(ctx) {
    onMessage("get-all-imgs", async () => {
      const urls = Array.from(
        document.querySelectorAll(
          "img:not(img[src=''])"
        ) as NodeListOf<HTMLImageElement>
      ).map((img) => img.src);
      const result = [];
      for (const url of urls) {
        const base64 = await sendMessage<string>(
          "get-base64",
          url,
          "background"
        );
        if (!base64) continue;
        const content = await decodeImg(base64);
        if (!content) continue;
        result.push({
          url,
          content,
        });
      }
      return result;
    });

    const ui = await createShadowRootUi(ctx, {
      name: "qrcode-helper",
      position: "inline",
      anchor: "body",
      onMount: (container) => {
        const app = createApp(App, {
          decodeImg,
        });
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
