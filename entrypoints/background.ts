import { onMessage } from "webext-bridge/background";

const getImgBase64 = (url: string) => {
  return new Promise((r) => {
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result);
        reader.onerror = () => r(null);
        reader.readAsDataURL(blob);
      })
      .catch(() => r(null));
  });
};

const getCurrentTab = async () => {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  } catch {}
};

export default defineBackground(() => {
  onMessage("get-current-tab", async () => {
    const tab = await getCurrentTab();
    return tab;
  });

  onMessage("toast-to-background", async ({ data }) => {
    const tab = await getCurrentTab();
    if (!tab) return;
    browser.tabs.sendMessage(tab.id!, {
      type: "toast",
      data,
    });
  });

  onMessage<string>("get-base64", async ({ data }) => {
    const res = await getImgBase64(data);
    return res;
  });

  onMessage("*", () => {
    console.log("test");
  });
});
