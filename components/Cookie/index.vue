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
  url: string;
}

const cookieList = ref<CookieItem[]>([]);
const getDomain = (hostname: string) => {
  const splitHostName = hostname.split(".");
  const level = splitHostName.length;
  if (level > 2) {
    splitHostName.shift();
    return splitHostName.join(".");
  }
  return hostname;
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
      url: item.domain,
      id: MD5(`${item.name}_${item.value}_${item.domain}`).toString(),
    }));
  } catch (err) {
    console.log(err)
  }
};

const cookieForm = reactive({
  name: "",
  value: "",
  url: "",
});

const onDelete = async (item: CookieItem) => {
  const flag = window.confirm("确认删除吗?");
  if (!flag) return;
  const findIdx = cookieList.value.findIndex((p) => p.id === item.id);
  if (findIdx === -1) return;
  try {
    // @ts-ignore
    const tab = await sendMessage<Browser.tabs.Tab>(
      "get-current-tab",
      null,
      "background",
    );
    if (!tab) return;
    await browser.cookies.remove({
      name: item.name,
      url: tab.url!,
    });
    cookieList.value.splice(findIdx, 1);
    message.success("删除成功");
  } catch (err) {
    console.log(err);
  }
};
const onSave = async () => {
  if (!cookieForm.name.trim()) {
    message.error("请输入名称");
    return;
  }
  if (!cookieForm.value.trim()) {
    message.error("请输入名称");
    return;
  }
  if (!cookieForm.url.trim()) {
    message.error("请输入名称");
    return;
  }
  if (!/^https?:\/\//.test(cookieForm.url)) {
    message.error("请输入完整的域名");
    return;
  }
  try {
    const { hostname } = new URL(cookieForm.url);
    await browser.cookies.set({
      name: cookieForm.name,
      value: cookieForm.value,
      url: cookieForm.url,
      domain: getDomain(hostname),
      expirationDate:
        Math.floor(new Date().getTime() / 1000) + 30 * 24 * 60 * 60,
    });
    message.success("操作成功");
    addCookieVisible.value = false;
    getAllCookies();
  } catch (err) {
    message.error("操作失败, 请检查域是否正确");
    console.log(err);
  }
};

onMounted(() => {
  getAllCookies();
});

const addCookieVisible = ref(false);
</script>

<template>
  <div class="cookie-wrapper">
    <div class="text-end">
      <Button type="primary" link @click="addCookieVisible = true">
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
          <div class="table-cell">{{ item.url }}</div>
          <div class="table-cell">
            <CopyIcon class="action-icon" @click="copy(item.value)" />
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
      <span>名称</span>
      <Input v-model:value="cookieForm.name" />
    </div>
    <div class="form-item">
      <span>值</span>
      <Input v-model:value="cookieForm.value" />
    </div>
    <div class="form-item">
      <span>域</span>
      <Input v-model:value="cookieForm.url" placeholder="请输入完整的域名" />
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
  display: flex;
  align-items: center;
  & + .form-item {
    margin-top: 8px;
  }
  & > span {
    width: 40px;
    flex-shrink: 0;
  }
  input {
    flex: 1;
    min-width: 0;
  }
}
</style>
