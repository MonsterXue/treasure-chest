import { message } from "@/composables/useMessmage";

export const copy = async (text: string) => {
  await navigator.clipboard.writeText(text);
  message("复制成功");
};

export const isRemoteUrl = (text: string) => {
  return /^https?\:\/\//.test(text);
};
