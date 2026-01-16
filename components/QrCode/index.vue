<script setup lang="ts">
import { copy } from "@/utils/general";
import { onMessage, sendMessage } from "webext-bridge/popup";
import Spin from "@/components/Spin/index.vue";

interface QrResult {
  url: string;
  content: string;
  [key: string]: string;
}

const list = ref<QrResult[]>([]);
const loading = ref(false);

onMounted(async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return;

  try {
    loading.value = true;
    list.value = await sendMessage<QrResult[]>("get-all-imgs", null, {
      context: "content-script",
      tabId: tab.id,
    });
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <Spin v-if="loading" />
    <div class="flex qrcode-item" v-for="item in list" :key="item.url">
      <img :src="item.url" alt="" width="100px" />
      <div class="flex-1 flex flex-items-start flex-justify-between">
        <span class="break-all">{{ item.content }}</span>
        <span
          class="ml-0.5 cursor-pointer hover-op-80 flex-shrink-0"
          @click="copy(item.content)"
        >
          复制
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.qrcode-item {
  padding: 0 4px;
  border-bottom: 1px solid #f0f0f0;
  &:last-child {
    border-bottom: none;
  }
}
</style>
