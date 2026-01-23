import type { sendMessage } from "webext-bridge/content-script";

declare global {
  interface Window {
    messageUtils: {
      sendMessage: typeof sendMessage;
    };
  }
}

export {};
