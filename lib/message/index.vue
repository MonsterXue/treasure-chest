<script setup lang="ts">
import { getTransitionProps } from "../_utils/transition";
import Notice from "./item.vue";

interface NoticeItem {
  id: number;
  text?: string;
  type?: MessageType;
}

let idx = 0;
const notices = ref<NoticeItem[]>([]);

const add = (text?: string, type: MessageType = "success") => {
  notices.value.push({
    id: idx++,
    text,
    type,
  });
};
const remove = (id: number) => {
  const findIdx = notices.value.findIndex((item) => item.id === id);
  if (findIdx === -1) return;
  notices.value.splice(findIdx, 1);
};

defineExpose({
  add,
});
</script>

<template>
  <div class="ant-message">
    <TransitionGroup
      tag="div"
      v-bind="getTransitionProps('message-notice-move-up')"
    >
      <Notice
        v-for="item in notices"
        :key="item.id"
        :text="item.text"
        :icon="item.type"
        @close="remove(item.id)"
      />
    </TransitionGroup>
  </div>
</template>

<style lang="less" scoped>
@keyframes messageMoveIn {
  0% {
    padding: 0;
    transform: translateY(-100%);
    opacity: 0;
  }

  100% {
    padding: 8px;
    transform: translateY(0);
    opacity: 1;
  }
}
@keyframes messageMoveOut {
  0% {
    max-height: 150px;
    padding: 8px;
    opacity: 1;
  }
  100% {
    max-height: 0;
    padding: 0;
    opacity: 0;
  }
}

.message-notice-move-up {
  animation-fill-mode: forwards;
}

.message-notice-move-up-appear,
.message-notice-move-up-enter {
  animation-name: messageMoveIn;
  animation-duration: 0.3s;
  animation-play-state: paused;
  animation-timing-function: cubic-bezier(0.78, 0.14, 0.15, 0.86);
}
.message-notice-move-up-appear,
.message-notice-move-up-appear-active,
.message-notice-move-up-enter,
.message-notice-move-up-enter-active {
  animation-play-state: running;
}
.message-notice-move-up-leave {
  animation-name: messageMoveOut;
  animation-duration: 0.3s;
  animation-play-state: paused;
  animation-timing-function: cubic-bezier(0.78, 0.14, 0.15, 0.86);
}
.message-notice-move-up-leave,
.message-notice-move-up-leave-active {
  animation-play-state: running;
}

.ant-message {
  position: fixed;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.88);
  z-index: 3000;
  box-sizing: border-box;
  pointer-events: none;
  :deep(.message-notice) {
    padding: 8px;
    text-align: center;
    .message-notice-content {
      display: inline-block;
      padding: 9px 12px;
      background: #ffffff;
      border-radius: 8px;
      box-shadow:
        0 6px 16px 0 rgba(0, 0, 0, 0.08),
        0 3px 6px -4px rgba(0, 0, 0, 0.12),
        0 9px 28px 8px rgba(0, 0, 0, 0.05);
      pointer-events: all;
    }
  }
}
</style>
