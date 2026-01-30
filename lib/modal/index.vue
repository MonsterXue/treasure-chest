<script setup lang="ts">
import { getTransitionProps } from "../_utils/transition";
import Button from "../button/index.vue";

interface IProps {
  open: boolean;
  title?: string;
  width?: string | number;
}

const props = defineProps<IProps>();
const emits = defineEmits(["update:open", "ok"]);
</script>

<template>
  <div class="ant-modal">
    <Transition name="fade">
      <div
        class="ant-modal-mask"
        v-show="props.open"
        @click="emits('update:open', false)"
      ></div>
    </Transition>
    <Transition v-bind="getTransitionProps('zoom')">
      <div
        v-show="props.open"
        class="ant-modal-wrap"
        :style="{
          width:
            typeof props.width === 'number' ? `${props.width}px` : props.width,
        }"
      >
        <div class="ant-modal-content">
          <div class="ant-modal-title">{{ props.title }}</div>
          <div class="ant-modal-body">
            <slot></slot>
          </div>
          <div class="ant-modal-footer">
            <Button @click="emits('update:open', false)">关闭</Button>
            <Button type="primary" @click="emits('ok')">保存</Button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="less" scoped>
@keyframes ZoomIn {
  0% {
    transform: scale(0.2);
    opacity: 0;
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes ZoomOut {
  0% {
    transform: scale(1);
  }

  100% {
    transform: scale(0.2);
    opacity: 0;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s linear;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.zoom-enter,
.zoom-appear {
  transform: none;
  opacity: 0;
  animation-duration: 0.3s;
  user-select: none;
  animation-timing-function: cubic-bezier(0.08, 0.82, 0.17, 1);
}
.zoom-enter-active,
.zoom-appear-active {
  animation-name: ZoomIn;
}
.zoom-leave-active {
  animation-name: ZoomOut;
  pointer-events: none;
}
.zoom-leave {
  animation-timing-function: cubic-bezier(0.78, 0.14, 0.15, 0.86);
  animation-duration: 0.2s;
}

.ant-modal-mask {
  position: fixed;
  top: 0;
  inset-inline-end: 0;
  bottom: 0;
  inset-inline-start: 0;
  z-index: 1000;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.45);
}

.ant-modal-wrap {
  position: fixed;
  top: 100px;
  inset-inline-end: 0;
  bottom: 0;
  inset-inline-start: 0;
  overflow: auto;
  outline: 0;
  width: auto;
  max-width: calc(100vw - 32px);
  margin: 0 auto;
  padding-bottom: 24px;
  z-index: 1000;
  pointer-events: none;
  .ant-modal-content {
    position: relative;
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow:
      0 6px 16px 0 rgba(0, 0, 0, 0.08),
      0 3px 6px -4px rgba(0, 0, 0, 0.12),
      0 9px 28px 8px rgba(0, 0, 0, 0.05);
    pointer-events: auto;
    .ant-modal-body {
      padding: 16px;
    }
  }
  .ant-modal-title {
    font-size: 15px;
    font-weight: 600;
    padding: 8px 16px;
    border-bottom: 1px solid #f0f0f0;
  }
  .ant-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px 16px;
    border-top: 1px solid #f0f0f0;
  }
}
</style>
