export type MessageType = "success" | "error";

export const message = async (
  text: string = "",
  type: MessageType = "success",
) => {
  try {
    // popup 模块导入时会建立连接，只在发送提示时按需加载。
    const { sendMessage } = browser.windows
      ? await import("webext-bridge/popup")
      : window.messageUtils;
    await sendMessage("toast-to-background", { text, type }, "background");
  } catch {
    // 插件重载或页面关闭后，提示消息可能无法送达。
  }
};
message.success = (text: string) => message(text, "success");
message.error = (text: string) => message(text, "error");
