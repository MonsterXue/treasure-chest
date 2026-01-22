import { sendMessage as sendMessageFromContent } from "webext-bridge/content-script";
import { sendMessage as sendMessageFromPopup } from "webext-bridge/popup";

export const message = async (text: string = "", type = "success") => {
  const sendMessage = browser.windows
    ? sendMessageFromPopup
    : sendMessageFromContent;
  sendMessage("toast-to-background", { text, type }, "background");
};
