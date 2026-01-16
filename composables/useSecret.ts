import { AES, enc } from "crypto-js";

export const useSecret = () => {
  const secretKey = "qrcode-helper";

  const encrypt = (text: string) => {
    return AES.encrypt(text, secretKey).toString();
  };
  const decrypt = (text: string) => {
    return AES.decrypt(text, secretKey).toString(enc.Utf8);
  };

  return {
    encrypt,
    decrypt,
  };
};
