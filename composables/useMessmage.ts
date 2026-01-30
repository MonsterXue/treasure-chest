import { sendMessage as sendMessageFromPopup } from "webext-bridge/popup";

export type MessageType = "success" | "error";

export const message = async (
  text: string = "",
  type: MessageType = "success",
) => {
  const sendMessage = browser.windows
    ? sendMessageFromPopup
    : window.messageUtils.sendMessage;
  sendMessage("toast-to-background", { text, type }, "background");
};
message.success = (text: string) => message(text, "success");
message.error = (text: string) => message(text, "error");
