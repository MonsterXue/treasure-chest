<script setup lang="ts">
import { copy } from "@/utils/general";
import { onMessage, sendMessage } from "webext-bridge/popup";
import Spin from "@/lib/spin/index.vue";

interface QrResult {
  url: string;
  content: string;
  [key: string]: string;
}

const list = ref<QrResult[]>([]);
const decodeProgress = reactive({
  current: 0,
  total: 0,
});
const loading = ref(false);

const onDownload = (src: string) => {
  browser.downloads.download({
    url: src,
  });
};

onMessage<typeof decodeProgress>("decode-progress", ({ data }) => {
  decodeProgress.current = data.current;
  decodeProgress.total = data.total;
});

onMounted(async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return;

  try {
    loading.value = true;
    decodeProgress.current = 0;
    decodeProgress.total = 0;
    list.value = await sendMessage<QrResult[]>("decode-all-imgs", null, {
      context: "content-script",
      tabId: tab.id,
    });
  } catch (err) {
    console.log(err);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="qrcode-wrapper">
    <Spin v-if="loading">
      <template #text>
        <div class="text-xs">
          正在进行图片解析
          <span>{{ decodeProgress.current }}</span>
          /
          <span>{{ decodeProgress.total }}</span>
        </div>
      </template>
    </Spin>
    <template v-else>
      <div class="flex qrcode-item" v-for="item in list" :key="item.url">
        <img :src="item.url" alt="" width="100px" />
        <div class="flex-1 flex flex-items-start flex-justify-between">
          <span class="break-all">{{ item.content }}</span>
          <div class="ml-0.5 flex-shrink-0">
            <div class="cursor-pointer hover-op-80" @click="copy(item.content)">
              复制
            </div>
            <div
              class="mt-1 cursor-pointer hover-op-80"
              @click="onDownload(item.url)"
            >
              下载
            </div>
          </div>
        </div>
      </div>
      <div v-if="!list.length" class="text-center my-10">
        当前页面未检测到二维码
      </div>
    </template>
  </div>
</template>

<style lang="less" scoped>
.qrcode-wrapper {
  width: 350px;
}
.qrcode-item {
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
  & > img {
    border: 1px solid #f0f0f0;
    border-radius: 4px;
    margin-right: 4px;
  }
  &:last-child {
    border-bottom: none;
  }
}
</style>
