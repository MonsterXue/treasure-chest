<script setup lang="ts">
import { sendMessage } from "webext-bridge/popup";
import { MD5 } from "crypto-js";
import Input from "@/lib/input/index.vue";
import Button from "@/lib/button/index.vue";
import Modal from "@/lib/modal/index.vue";
import CopyIcon from "@/assets/copy.svg?component";
import DeleteIcon from "@/assets/delete.svg?component";

interface CookieItem {
  id: string;
  name: string;
  value: string;
  host: string;
  path: string;
}

interface CookieInput {
  name: string;
  value: string;
  host: string;
  path: string;
}

const cookieList = ref<CookieItem[]>([]);

const serializeCookie = ({ name, value, host, path }: CookieInput) => {
  return `${name}=${value}; Domain=${host}; Path=${path}`;
};

const parseCookie = (text: string): CookieInput => {
  const parts = text
    .trim()
    .replace(/^set-cookie:\s*/i, "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const nameValue = parts.shift();
  const separatorIndex = nameValue?.indexOf("=") ?? -1;
  if (!nameValue || separatorIndex <= 0) {
    throw new Error("Invalid cookie input");
  }

  const name = nameValue.slice(0, separatorIndex).trim();
  const value = nameValue.slice(separatorIndex + 1).trim();
  const attributes = new Map<string, string>();
  parts.forEach((part) => {
    const attributeSeparatorIndex = part.indexOf("=");
    if (attributeSeparatorIndex === -1) return;
    const key = part.slice(0, attributeSeparatorIndex).trim().toLowerCase();
    const attributeValue = part.slice(attributeSeparatorIndex + 1).trim();
    attributes.set(key, attributeValue);
  });

  const host = attributes.get("domain") ?? attributes.get("host") ?? "";
  const path = attributes.get("path") ?? "";
  if (!name || !host || !path.startsWith("/")) {
    throw new Error("Invalid cookie input");
  }

  return { name, value, host, path };
};

const getCookieUrl = (host: string, path: string) => {
  const hostname = host.replace(/^\./, "");
  const url = new URL(`https://${hostname}${path}`);
  if (url.hostname.toLowerCase() !== hostname.toLowerCase()) {
    throw new Error("Invalid cookie host");
  }
  return url.toString();
};

const getAllCookies = async () => {
  try {
    // @ts-ignore
    const tab = await sendMessage<Browser.tabs.Tab>(
      "get-current-tab",
      null,
      "background",
    );
    if (!tab) return;
    const res = await browser.cookies.getAll({
      url: tab.url!,
    });
    cookieList.value = res.map((item) => ({
      name: item.name,
      value: item.value,
      host: item.domain,
      path: item.path,
      id: MD5(
        `${item.name}_${item.value}_${item.domain}_${item.path}`,
      ).toString(),
    }));
  } catch (err) {
    console.log(err);
  }
};

const cookieInput = ref("");

const onDelete = async (item: CookieItem) => {
  const flag = window.confirm("确认删除吗?");
  if (!flag) return;
  const findIdx = cookieList.value.findIndex((p) => p.id === item.id);
  if (findIdx === -1) return;
  try {
    await browser.cookies.remove({
      name: item.name,
      url: getCookieUrl(item.host, item.path),
    });
    cookieList.value.splice(findIdx, 1);
    message.success("删除成功");
  } catch (err) {
    console.log(err);
  }
};
const onSave = async () => {
  let cookie: CookieInput;
  try {
    cookie = parseCookie(cookieInput.value);
  } catch {
    message.error("Cookie 格式错误，请输入复制得到的完整内容");
    return;
  }

  try {
    const url = getCookieUrl(cookie.host, cookie.path);
    await browser.cookies.set({
      name: cookie.name,
      value: cookie.value,
      url,
      ...(cookie.host.startsWith(".") ? { domain: cookie.host } : {}),
      path: cookie.path,
      expirationDate:
        Math.floor(new Date().getTime() / 1000) + 30 * 24 * 60 * 60,
    });
    message.success("操作成功");
    cookieInput.value = "";
    addCookieVisible.value = false;
    getAllCookies();
  } catch (err) {
    message.error("操作失败，请检查 host 和 path 是否正确");
    console.log(err);
  }
};

const openAddCookie = () => {
  cookieInput.value = "";
  addCookieVisible.value = true;
};

onMounted(() => {
  getAllCookies();
});

const addCookieVisible = ref(false);
</script>

<template>
  <div class="cookie-wrapper">
    <div class="text-end">
      <Button type="primary" link @click="openAddCookie">
        添加cookie
      </Button>
    </div>
    <div class="table-wrapper">
      <div class="table-header">
        <div class="table-cell">名称</div>
        <div class="table-cell">值</div>
        <div class="table-cell">域</div>
        <div class="table-cell"></div>
      </div>
      <div class="table-body">
        <div class="table-body__row" v-for="item in cookieList" :key="item.id">
          <div class="table-cell">{{ item.name }}</div>
          <div class="table-cell">{{ item.value }}</div>
          <div class="table-cell">{{ item.host }}</div>
          <div class="table-cell">
            <CopyIcon
              class="action-icon"
              title="复制 Cookie"
              @click="copy(serializeCookie(item))"
            />
            <DeleteIcon class="action-icon" @click="onDelete(item)" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <Modal
    v-model:open="addCookieVisible"
    title="添加"
    width="400px"
    @ok="onSave"
  >
    <div class="form-item">
      <Input
        v-model:value="cookieInput"
        placeholder="请输入 Cookie，例如 token=xxx; Domain=.example.com; Path=/"
      />
    </div>
  </Modal>
</template>

<style lang="less" scoped>
.cookie-wrapper {
  width: 600px;
  max-height: 500px;
  min-height: 300px;
  padding: 8px;
  .action-icon {
    color: #666666;
    font-size: 16px;
    margin-left: 6px;
    transition: color 0.2s;
    cursor: pointer;
    &:hover {
      color: #1677ff;
    }
  }
  .table-wrapper {
    width: 100%;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
    .table-cell {
      flex: 1;
      padding: 8px;
      border-bottom: 1px solid #f0f0f0;
      word-break: break-all;
      &:last-child {
        flex: 0 0 80px;
      }
    }
    .table-header {
      position: sticky;
      top: 0;
      display: flex;
      border: 1px solid #f0f0f0;
      border-bottom: none;
      .table-cell {
        background-color: #fafafa;
        font-weight: 600;
      }
    }
    .table-body {
      border: 1px solid #f0f0f0;
      border-bottom: none;
      border-top: none;
      .table-body__row {
        display: flex;
      }
    }
  }
}

.form-item {
  input {
    width: 100%;
  }
}
</style>
