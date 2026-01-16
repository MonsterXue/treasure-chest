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

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  onMessage<string>("get-base64", async ({ data }) => {
    const res = await getImgBase64(data);
    return res;
  });

  onMessage("*", () => {
    console.log("test");
  });
});
