<script setup lang="ts">
import Message from "@/lib/message/index.vue";

const messageRef = ref();
const showMessage = (text: string, type: string) => {
  messageRef.value.add(text, type);
};
browser.runtime.onMessage.addListener(({ data, type }) => {
  if (type === "toast") {
    showMessage(data.text, data.type);
  }
});
</script>

<template>
  <Message ref="messageRef" />
</template>
