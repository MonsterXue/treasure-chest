<script setup lang="ts">
import { collectMediaCandidates, type MediaCandidate } from "@/utils/media";

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const rootRef = ref<HTMLElement>();
const active = ref(false);
const locked = ref(false);
const candidates = shallowRef<MediaCandidate[]>([]);
const activeIndex = ref(0);
const highlightRect = ref<HighlightRect>();
const cursor = reactive({ x: 0, y: 0 });
const tip = ref("移动鼠标寻找媒体元素");
const copied = ref(false);

let candidateSignature = "";
let previousCursor = "";
let moveFrame: number | undefined;
let copyTimer: ReturnType<typeof setTimeout> | undefined;

const currentCandidate = computed(() => candidates.value[activeIndex.value]);
const isInlineSvg = computed(() => currentCandidate.value?.contentType === "svg");

const highlightStyle = computed(() => {
  const rect = highlightRect.value;
  if (!rect) return {};
  return {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
});

const panelStyle = computed(() => {
  const panelWidth = 360;
  const panelHeight = 196;
  const gap = 14;
  const left = Math.max(
    12,
    Math.min(cursor.x + gap, window.innerWidth - panelWidth - 12),
  );
  const preferredTop = cursor.y + gap;
  const top =
    preferredTop + panelHeight > window.innerHeight
      ? Math.max(12, cursor.y - panelHeight - gap)
      : preferredTop;

  return {
    left: `${left}px`,
    top: `${top}px`,
  };
});

const refreshHighlight = () => {
  const candidate = currentCandidate.value;
  if (!candidate) {
    highlightRect.value = undefined;
    return;
  }

  const rect = candidate.element.getBoundingClientRect();
  highlightRect.value = {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

const setCandidates = (nextCandidates: MediaCandidate[]) => {
  const signature = nextCandidates.map((item) => item.id).join("|");
  candidates.value = nextCandidates;

  if (signature !== candidateSignature) {
    candidateSignature = signature;
    activeIndex.value = 0;
  } else if (activeIndex.value >= nextCandidates.length) {
    activeIndex.value = 0;
  }

  tip.value = nextCandidates.length
    ? `发现 ${nextCandidates.length} 个媒体候选`
    : "当前位置没有可提取的媒体";
  refreshHighlight();
};

const inspectPoint = (x: number, y: number) => {
  cursor.x = x;
  cursor.y = y;
  const elements = document.elementsFromPoint(x, y);
  setCandidates(collectMediaCandidates(elements));
};

const onPointerMove = (event: PointerEvent) => {
  if (!active.value || locked.value) return;
  if (moveFrame) cancelAnimationFrame(moveFrame);
  moveFrame = requestAnimationFrame(() => inspectPoint(event.clientX, event.clientY));
};

const isPickerUiEvent = (event: Event) => {
  return Boolean(rootRef.value && event.composedPath().includes(rootRef.value));
};

const onPageClick = (event: MouseEvent) => {
  if (!active.value || isPickerUiEvent(event)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  inspectPoint(event.clientX, event.clientY);

  if (!candidates.value.length) {
    locked.value = false;
    return;
  }

  locked.value = true;
  tip.value = "已锁定媒体，Tab 可切换候选";
};

const switchCandidate = (step: number) => {
  const count = candidates.value.length;
  if (count <= 1) return;
  activeIndex.value = (activeIndex.value + step + count) % count;
  copied.value = false;
  refreshHighlight();
};

const unlock = () => {
  locked.value = false;
  copied.value = false;
  tip.value = "移动鼠标寻找媒体元素";
};

const stop = () => {
  active.value = false;
  locked.value = false;
  candidates.value = [];
  activeIndex.value = 0;
  highlightRect.value = undefined;
  candidateSignature = "";
  document.documentElement.style.cursor = previousCursor;
  window.removeEventListener("pointermove", onPointerMove, true);
  window.removeEventListener("click", onPageClick, true);
  window.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("resize", refreshHighlight, true);
  window.removeEventListener("scroll", refreshHighlight, true);
  if (moveFrame) cancelAnimationFrame(moveFrame);
  if (copyTimer) clearTimeout(copyTimer);
};

const onKeyDown = (event: KeyboardEvent) => {
  if (!active.value) return;

  if (event.key === "Escape") {
    event.preventDefault();
    stop();
    return;
  }

  if (isPickerUiEvent(event)) return;

  if (event.key === "Tab" || event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    switchCandidate(event.key === "ArrowUp" || event.shiftKey ? -1 : 1);
    return;
  }

  if (event.key === "Enter" && candidates.value.length) {
    event.preventDefault();
    locked.value = true;
    tip.value = "已锁定媒体，Tab 可切换候选";
  }
};

const start = () => {
  if (active.value) stop();
  active.value = true;
  previousCursor = document.documentElement.style.cursor;
  document.documentElement.style.cursor = "crosshair";
  tip.value = "移动鼠标寻找媒体元素";
  window.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("click", onPageClick, true);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("resize", refreshHighlight, true);
  window.addEventListener("scroll", refreshHighlight, true);
};

const copyCurrentValue = async () => {
  const candidate = currentCandidate.value;
  if (!candidate) return;

  try {
    await navigator.clipboard.writeText(candidate.value);
    copied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 1600);
  } catch {
    tip.value = "复制失败，请手动选择内容";
  }
};

const exportCurrentSvg = () => {
  const candidate = currentCandidate.value;
  if (!candidate || candidate.contentType !== "svg") return;

  const elementName = candidate.element.id.trim().replace(/[^a-zA-Z0-9_-]+/g, "-");
  const fileName = `${elementName || "inline-svg"}.svg`;
  const blob = new Blob([candidate.value], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  tip.value = `已导出 ${fileName}`;
};

onUnmounted(stop);

defineExpose({ start, stop });
</script>

<template>
  <div v-if="active" ref="rootRef" class="media-picker-layer">
    <div class="media-picker-hud">
      <span class="hud-dot"></span>
      <span>{{ tip }}</span>
      <span class="hud-shortcut">按 <kbd>Esc</kbd> 退出</span>
      <button type="button" class="hud-exit" aria-label="退出媒体拾取" @click="stop">
        退出
      </button>
    </div>

    <div
      v-if="highlightRect"
      class="media-picker-highlight"
      :class="{ locked }"
      :style="highlightStyle"
    >
      <span v-if="candidates.length" class="highlight-count">
        {{ activeIndex + 1 }}/{{ candidates.length }}
      </span>
    </div>

    <div v-if="locked && currentCandidate" class="media-picker-panel" :style="panelStyle">
      <div class="panel-head">
        <div>
          <div class="panel-title">{{ currentCandidate.kind }}</div>
          <div class="panel-meta">
            {{ currentCandidate.element.tagName.toLowerCase() }} · {{ currentCandidate.source }}
          </div>
        </div>
        <div class="candidate-count">{{ activeIndex + 1 }} / {{ candidates.length }}</div>
      </div>

      <div
        class="media-value"
        :class="{ 'svg-code': isInlineSvg }"
        :title="isInlineSvg ? undefined : currentCandidate.value"
      >
        {{ currentCandidate.value }}
      </div>

      <div class="panel-actions">
        <div class="switch-actions">
          <button type="button" :disabled="candidates.length <= 1" @click="switchCandidate(-1)">
            上一个
          </button>
          <button type="button" :disabled="candidates.length <= 1" @click="switchCandidate(1)">
            下一个
          </button>
        </div>
        <button type="button" class="secondary-action" @click="unlock">重新选择</button>
        <button v-if="isInlineSvg" type="button" @click="exportCurrentSvg">
          导出 SVG
        </button>
        <button type="button" class="copy-action" @click="copyCurrentValue">
          {{ copied ? "已复制" : isInlineSvg ? "复制代码" : "复制地址" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.media-picker-layer {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  pointer-events: none;
}

.media-picker-hud {
  position: fixed;
  top: 16px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  padding: 0 12px;
  color: #ffffff;
  font-size: 13px;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.24);
  transform: translateX(-50%);
  backdrop-filter: blur(8px);
  pointer-events: auto;

  .hud-dot {
    width: 7px;
    height: 7px;
    background: #69b1ff;
    border-radius: 50%;
    box-shadow: 0 0 0 3px rgba(105, 177, 255, 0.2);
  }

  kbd {
    margin-left: 5px;
    padding: 1px 5px;
    color: #dbeafe;
    font: 11px/18px ui-monospace, SFMono-Regular, Consolas, monospace;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 4px;
  }

  .hud-shortcut {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #94a3b8;
  }

  .hud-exit {
    height: 24px;
    margin-left: 3px;
    padding: 0 8px;
    color: #ffffff;
    font-size: 12px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 5px;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.18);
    }

    &:focus-visible {
      outline: 2px solid rgba(105, 177, 255, 0.7);
      outline-offset: 2px;
    }
  }
}

.media-picker-highlight {
  position: fixed;
  border: 2px solid #1677ff;
  background: rgba(22, 119, 255, 0.08);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.85) inset,
    0 0 0 1px rgba(22, 119, 255, 0.22);
  transition:
    top 60ms ease,
    left 60ms ease,
    width 60ms ease,
    height 60ms ease;

  &.locked {
    border-color: #0958d9;
    background: rgba(22, 119, 255, 0.13);
  }

  .highlight-count {
    position: absolute;
    top: -24px;
    right: -2px;
    height: 22px;
    padding: 0 7px;
    color: #ffffff;
    font: 600 11px/22px ui-monospace, SFMono-Regular, Consolas, monospace;
    background: #1677ff;
    border-radius: 5px 5px 0 0;
  }
}

.media-picker-panel {
  position: fixed;
  width: 360px;
  padding: 14px;
  background: #ffffff;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  box-shadow:
    0 18px 48px rgba(15, 23, 42, 0.2),
    0 2px 8px rgba(15, 23, 42, 0.08);
  pointer-events: auto;

  .panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .panel-title {
    font-size: 14px;
    font-weight: 650;
    line-height: 20px;
  }

  .panel-meta {
    margin-top: 1px;
    color: #64748b;
    font: 11px/16px ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .candidate-count {
    flex: 0 0 auto;
    padding: 2px 7px;
    color: #0958d9;
    font: 600 11px/18px ui-monospace, SFMono-Regular, Consolas, monospace;
    background: #e6f4ff;
    border-radius: 999px;
  }

  .media-value {
    max-height: 64px;
    margin-top: 12px;
    padding: 9px 10px;
    overflow: auto;
    color: #334155;
    font: 12px/18px ui-monospace, SFMono-Regular, Consolas, monospace;
    word-break: break-all;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    scrollbar-width: thin;

    &.svg-code {
      white-space: pre-wrap;
    }
  }

  .panel-actions {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 12px;
  }

  .switch-actions {
    display: flex;
    gap: 4px;
    margin-right: auto;
  }

  button {
    height: 30px;
    padding: 0 9px;
    color: #475569;
    font-size: 12px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    cursor: pointer;

    &:hover:not(:disabled) {
      color: #1677ff;
      border-color: #69b1ff;
    }

    &:focus-visible {
      outline: 2px solid rgba(22, 119, 255, 0.35);
      outline-offset: 2px;
    }

    &:disabled {
      color: #cbd5e1;
      background: #f8fafc;
      cursor: not-allowed;
    }
  }

  .secondary-action {
    border-color: transparent;
  }

  .copy-action {
    color: #ffffff;
    background: #1677ff;
    border-color: #1677ff;

    &:hover:not(:disabled) {
      color: #ffffff;
      background: #4096ff;
      border-color: #4096ff;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .media-picker-highlight {
    transition: none;
  }
}
</style>
