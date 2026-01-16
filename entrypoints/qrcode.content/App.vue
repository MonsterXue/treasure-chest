<script setup lang="ts">
import { sendMessage } from "webext-bridge/content-script";
import { createPopper, VirtualElement } from "@popperjs/core/lib/popper-lite";
import { useSecret } from "@/composables/useSecret";
import flip from "@popperjs/core/lib/modifiers/flip";
import preventOverflow from "@popperjs/core/lib/modifiers/preventOverflow";

interface IProps {
  decodeImg(url: string): Promise<string>;
}
const props = defineProps<IProps>();

const popoverRef = ref();
const popoverVisible = ref(false);
const decodeResult = ref<string>();
const isIframe = computed(() => isRemoteUrl(decodeResult.value || ""));

const cache = new Map();
const { decrypt, encrypt } = useSecret();

function generateGetBoundingClientRect(x = 0, y = 0) {
  return () => ({
    width: 0,
    height: 0,
    top: y,
    right: x,
    bottom: y,
    left: x,
  });
}

const virtualElement = {
  getBoundingClientRect: generateGetBoundingClientRect(),
};

onMounted(() => {
  // @ts-ignore
  const instance = createPopper(virtualElement, popoverRef.value, {
    modifiers: [
      {
        ...flip,
        options: {
          padding: 16,
        },
      },
      {
        ...preventOverflow,
        options: {
          padding: 8,
        },
      },
    ],
  });

  const updatePopover = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    virtualElement.getBoundingClientRect = generateGetBoundingClientRect(
      rect.x + rect.width / 2,
      rect.y + rect.height
    );
    instance.update();
    popoverVisible.value = true;
  };

  document.addEventListener("mouseover", async (e) => {
    const target = e.target as HTMLImageElement;
    if (target.tagName !== "IMG") return;

    const cacheKey = encrypt(target.src);
    if (cache.has(cacheKey)) {
      decodeResult.value = cache.get(cacheKey);
      updatePopover(target);
      return;
    }

    const url = await sendMessage<string>(
      "get-base64",
      target.src,
      "background"
    );
    if (!url) return;

    decodeResult.value = await props.decodeImg(url);
    cache.set(cacheKey, decodeResult.value);
    if (!decodeResult.value) return;

    updatePopover(target);

    target.addEventListener("mouseleave", () => {
      popoverVisible.value = false;
    });
  });
});
</script>

<template>
  <div
    ref="popoverRef"
    class="qrcode-helper-popover"
    :class="{
      'qrcode-helper-popover--show': popoverVisible,
      'qrcode-helper-popover-iframe': isIframe,
    }"
    @mouseenter="popoverVisible = true"
    @mouseleave="popoverVisible = false"
  >
    <div class="qrcode-helper-content">
      <div class="qrcode-helper-arrow"></div>
      <div class="qrcode-helper-inner">
        <template v-if="isIframe">
          <div class="qrcode-helper-inner-title">
            <span>{{ decodeResult }}</span>
            <span class="copy-btn" @click="copy(decodeResult!)">复制</span>
          </div>
          <iframe :src="decodeResult"></iframe>
        </template>
        <div v-else class="qrcode-helper-inner-text">{{ decodeResult }}</div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.qrcode-helper-popover {
  position: absolute;
  border-radius: 4px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s;
  z-index: 9999;

  &.qrcode-helper-popover-iframe {
    width: 400px;

    .qrcode-helper-inner {
      padding: 0 !important;
    }
  }

  &.qrcode-helper-popover--show {
    visibility: visible;
    opacity: 1;
  }

  &[data-popper-placement^="top"] {
    padding-bottom: 12px;

    .qrcode-helper-arrow {
      left: 50%;
      transform: translateX(-50%) translateY(100%) rotate(180deg);
    }
  }

  &[data-popper-placement^="bottom"] {
    padding-top: 12px;

    .qrcode-helper-arrow {
      top: 0;
      left: 50%;
      transform: translateX(-50%) translateY(-100%);
    }
  }

  &[data-popper-placement^="left"] {
    padding-right: 12px;

    .qrcode-helper-arrow {
      top: 50%;
      right: 0;
      transform: translateY(-50%) translateX(100%) rotate(90deg);
    }
  }

  &[data-popper-placement^="right"] {
    padding-left: 12px;

    .qrcode-helper-arrow {
      top: 50%;
      left: 0;
      transform: translateY(-50%) translateX(-100%) rotate(-90deg);
    }
  }

  .qrcode-helper-content {
    position: relative;
    font-size: 14px;

    .qrcode-helper-arrow {
      position: absolute;
      bottom: 0;
      z-index: 1;
      display: block;
      pointer-events: none;
      width: 16px;
      height: 16px;
      overflow: hidden;
      &::before {
        position: absolute;
        bottom: 0;
        inset-inline-start: 0;
        width: 16px;
        height: 8px;
        background: #ffffff;
        clip-path: polygon(
          1.6568542494923806px 100%,
          50% 1.6568542494923806px,
          14.34314575050762px 100%,
          1.6568542494923806px 100%
        );
        content: "";
      }
    }

    .qrcode-helper-inner {
      background-color: #ffffff;
      background-clip: padding-box;
      border-radius: 8px;
      box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08),
        0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05);
      padding: 12px;

      .copy-btn {
        margin-left: 4px;
        cursor: pointer;
        &:hover {
          opacity: 0.8;
        }
      }

      &-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px;
        margin-bottom: 8px;
        background-color: #edf2fa;
        color: #1f1f1f;
        border-radius: 4px 4px 0 0;
        word-break: break-all;
      }

      iframe {
        border: 0;
        width: 100%;
        height: 225px;
      }
    }
  }
}
</style>
