<script setup lang="ts">
import Message from "@/lib/message/index.vue";
import MediaPicker from "./MediaPicker.vue";

const messageRef = ref();
const mediaPickerRef = ref<InstanceType<typeof MediaPicker>>();
const showMessage = (text: string, type: string) => {
  messageRef.value.add(text, type);
};

const onRuntimeMessage = async ({ data, type }: { data?: any; type?: string }) => {
  if (type === "toast") {
    showMessage(data.text, data.type);
  }
  if (type === "start-media-picker") {
    mediaPickerRef.value?.start();
    return { ok: true };
  }
};

onMounted(() => browser.runtime.onMessage.addListener(onRuntimeMessage));
onUnmounted(() => browser.runtime.onMessage.removeListener(onRuntimeMessage));
</script>

<template>
  <Message ref="messageRef" />
  <MediaPicker ref="mediaPickerRef" />
</template>
