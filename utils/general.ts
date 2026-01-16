export const copy = async (text: string) => {
  await navigator.clipboard.writeText(text);
};

export const isRemoteUrl = (text: string) => {
  return /^https?\:\/\//.test(text);
};
