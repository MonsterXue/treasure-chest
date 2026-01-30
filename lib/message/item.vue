<script setup lang="ts">
import SuccessIcon from "@/assets/success.svg?component";
import ErrorIcon from "@/assets/error.svg?component";
import { MessageType } from "@/composables/useMessmage";

interface IProps {
  text?: string;
  duration?: number;
  icon?: MessageType;
}

const props = withDefaults(defineProps<IProps>(), {
  duration: 3,
  icon: "success",
});
const emits = defineEmits(["close"]);

const defaultIcons: Record<MessageType, ReturnType<typeof h>> = {
  success: h(SuccessIcon, { style: "color: #52c41a" }),
  error: h(ErrorIcon, { style: "color: #ff4d4f" }),
};

let closeTimer: NodeJS.Timeout | null;
let isUnMounted = false;
const startCloseTimer = () => {
  if (props.duration && !isUnMounted) {
    closeTimer = setTimeout(() => {
      emits("close");
    }, props.duration * 1000);
  }
};
const clearCloseTimer = () => {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
};
onMounted(() => {
  startCloseTimer();
});
onUnmounted(() => {
  isUnMounted = true;
  clearCloseTimer();
});
</script>

<template>
  <div class="message-notice">
    <div
      class="message-notice-content"
      @mouseenter="clearCloseTimer"
      @mouseleave="startCloseTimer"
    >
      <component
        class="message-notice-content-icon"
        :is="defaultIcons[props.icon]"
      />
      <span>{{ props.text }}</span>
    </div>
  </div>
</template>

<style lang="less" scoped>
:deep(.message-notice-content-icon) {
  vertical-align: text-bottom;
  margin-inline-end: 8px;
  font-size: 16px;
}
</style>
