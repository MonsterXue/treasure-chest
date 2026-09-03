<script lang="ts" setup>
import QrCode from "@/components/QrCode/index.vue";
import Cookie from "@/components/Cookie/index.vue";
import LeftIcon from "@/assets/left.svg?component";
import QrcodeIcon from "@/assets/qrcode.svg?url";
import CookieIcon from "@/assets/cookie.svg?url";
import MediaIcon from "@/assets/media.svg?url";
import type { Component } from "vue";

interface ToolItem {
  title: string;
  icon: string;
  component?: Component;
  action?: () => void | Promise<void>;
}

const actionError = ref("");

const startMediaPicker = async () => {
  actionError.value = "";
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    actionError.value = "无法获取当前页面";
    return;
  }

  try {
    const response = await browser.tabs.sendMessage(tab.id, {
      type: "start-media-picker",
    });
    if (!response?.ok) throw new Error("Media picker did not acknowledge");
    window.close();
  } catch (error) {
    console.log(error);
    actionError.value = "页面脚本尚未加载，请刷新后重试";
  }
};

const toolList: ToolItem[] = [
  {
    title: "媒体拾取",
    icon: MediaIcon,
    action: startMediaPicker,
  },
  {
    title: "二维码",
    icon: QrcodeIcon,
    component: markRaw(QrCode),
  },
  {
    title: "cookie",
    icon: CookieIcon,
    component: markRaw(Cookie),
  },
];
const activeTool = ref<ToolItem>();

const selectTool = (item: ToolItem) => {
  if (item.action) {
    item.action();
    return;
  }
  activeTool.value = item;
};
</script>

<template>
  <div class="treasure-chest__wrapper">
    <div class="treasure-chest__header">
      <template v-if="activeTool">
        <div class="header-back" @click="activeTool = undefined">
          <LeftIcon class="back-icon" />
          <span>返回</span>
        </div>
        <div>{{ activeTool.title }}</div>
      </template>
      <template v-else> 工具箱 </template>
    </div>
    <div class="treasure-chest__content">
      <template v-if="activeTool">
        <component :is="activeTool.component" />
      </template>
      <div v-else class="tool-item-wrapper">
        <div
          class="tool-item"
          v-for="(item, index) in toolList"
          :key="index"
          role="button"
          tabindex="0"
          @click="selectTool(item)"
          @keydown.enter.prevent="selectTool(item)"
          @keydown.space.prevent="selectTool(item)"
        >
          <img class="tool-item-icon" :src="item.icon" />
          <div>{{ item.title }}</div>
        </div>
        <div v-if="actionError" class="tool-action-error">{{ actionError }}</div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.treasure-chest__wrapper {
  .treasure-chest__header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-bottom: 1px solid #f0f0f0;
    .header-back {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      cursor: pointer;
      &:hover {
        opacity: 0.8;
      }
    }
  }
  .treasure-chest__content {
    min-height: 0;
    margin: 6px 0;
    overflow: hidden auto;
    scrollbar-width: thin;
    &:has(.move-in) {
      overflow: hidden;
    }
    .tool-item-wrapper {
      display: flex;
      flex-wrap: wrap;
      width: 240px;
    }
    .tool-item {
      width: 33.3333%;
      padding: 8px 0;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      &:hover {
        background-color: #f5f5f5;
      }
      &:focus-visible {
        outline: 2px solid rgba(22, 119, 255, 0.35);
        outline-offset: -2px;
      }
      .tool-item-icon {
        width: 32px;
        height: 32px;
      }
    }
    .tool-action-error {
      width: 100%;
      padding: 6px 8px 2px;
      color: #ff4d4f;
      font-size: 12px;
      text-align: center;
    }
  }
}
</style>
