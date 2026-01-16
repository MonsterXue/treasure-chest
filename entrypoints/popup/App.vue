<script lang="ts" setup>
import QrCode from "@/components/QrCode/index.vue";
</script>

<template>
  <div class="treasure-chest__wrapper">
    <div class="treasure-chest__header">
      <div>返回</div>
      <div>二维码</div>
    </div>
    <div class="treasure-chest__content">
      <QrCode />
    </div>
  </div>
</template>

<style lang="less" scoped>
.treasure-chest__wrapper {
  display: flex;
  flex-direction: column;
  width: 350px;
  max-height: 400px;
  .treasure-chest__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
    padding: 8px;
    border-bottom: 1px solid #f0f0f0;
  }
  .treasure-chest__content {
    flex: 1;
    min-height: 0;
    overflow: hidden auto;
    scrollbar-width: thin;
  }
}
</style>
