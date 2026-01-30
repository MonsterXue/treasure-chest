<script lang="ts" setup>
import QrCode from "@/components/QrCode/index.vue";
import Cookie from "@/components/Cookie/index.vue";
import LeftIcon from "@/assets/left.svg?component";
import QrcodeIcon from "@/assets/qrcode.svg?url";
import CookieIcon from "@/assets/cookie.svg?url";

const toolList = [
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
const activeTool = ref<(typeof toolList)[0]>();
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
          @click="activeTool = item"
        >
          <img class="tool-item-icon" :src="item.icon" />
          <div>{{ item.title }}</div>
        </div>
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
      width: 160px;
    }
    .tool-item {
      width: 50%;
      padding: 8px 0;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      &:hover {
        background-color: #f5f5f5;
      }
      .tool-item-icon {
        width: 32px;
        height: 32px;
      }
    }
  }
}
</style>
