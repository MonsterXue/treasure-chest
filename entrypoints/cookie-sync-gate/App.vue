<script setup lang="ts">
import { onMounted, ref } from "vue";
import { syncRequest, type GateResult } from "@/utils/cookie-sync";

const running = ref(true);
const result = ref<GateResult>();
const error = ref("");
async function run(skip = false) {
  running.value = true;
  error.value = "";
  try {
    result.value = await syncRequest<GateResult>(skip ? "gate-skip" : "gate");
    if (result.value.proceed) {
      // The backend grants a temporary pass for this tab, URL and extension initiator.
      window.location.replace(result.value.targetUrl);
      return;
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "同步失败";
  }
  running.value = false;
}
onMounted(() => {
  void run();
});
</script>

<template>
  <main aria-live="polite">
    <div class="symbol" :class="{ running }">⇄</div>
    <p class="brand">百宝箱 · Cookie 同步</p>
    <h1>{{ running ? "正在同步，即将继续…" : "暂时无法完成同步" }}</h1>
    <p v-if="result?.ruleName" class="rule">{{ result.ruleName }}</p>
    <template v-if="!running">
      <p class="error">{{ error || result?.report?.message }}</p>
      <p v-for="detail in result?.report?.details" :key="detail" class="detail">
        {{ detail }}
      </p>
      <div class="actions">
        <button class="primary" @click="run()">重新同步</button>
        <button
          @click="
            browser.tabs.create({
              url: browser.runtime.getURL('/cookie-sync.html'),
            })
          "
        >
          编辑规则
        </button>
        <button @click="run(true)">跳过本次同步</button>
      </div>
    </template>
    <p v-if="result?.targetUrl" class="target">{{ result.targetUrl }}</p>
  </main>
</template>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f4f7fb;
  color: #243449;
  font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
}

main {
  width: min(560px, calc(100% - 32px));
  text-align: center;
  padding: 42px 30px;
  background: #fff;
  border: 1px solid #dfe7f1;
  border-radius: 12px;
}

.symbol {
  font-size: 36px;
  color: #1677ff;
  margin-bottom: 22px;
}

.brand {
  font-size: 12px;
  color: #6b7b8f;
}

h1 {
  font-size: 22px;
  font-weight: 600;
  margin: 14px 0;
}

.rule {
  font-size: 14px;
  color: #506582;
}

.error {
  font-size: 14px;
  color: #b33b3b;
  line-height: 1.8;
}

.detail {
  font-size: 12px;
  color: #6b7b8f;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
}

button {
  cursor: pointer;
  padding: 9px 12px;
  border: 1px solid #dfe7f1;
  border-radius: 6px;
  background: #fff;
  color: #354761;
  font: 13px inherit;
}

button.primary {
  background: #1677ff;
  color: #fff;
  border-color: #1677ff;
}

button:focus-visible {
  outline: 3px solid #91c4ff;
  outline-offset: 2px;
}

.target {
  font:
    11px/1.8 Consolas,
    monospace;
  color: #8794a6;
  overflow-wrap: anywhere;
  margin-top: 24px;
}

.running {
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .running {
    animation: none;
  }
}
</style>
