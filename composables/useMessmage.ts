import { sendMessage as sendMessageFromPopup } from "webext-bridge/popup";

export const message = async (text: string = "", type = "success") => {
  const sendMessage = browser.windows
    ? sendMessageFromPopup
    : window.messageUtils.sendMessage;
  sendMessage("toast-to-background", { text, type }, "background");
};
