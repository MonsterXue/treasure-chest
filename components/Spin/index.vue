<template>
  <div class="ant-spin-spinning">
    <span class="ant-spin-dot">
      <i class="ant-spin-dot-item"></i>
      <i class="ant-spin-dot-item"></i>
      <i class="ant-spin-dot-item"></i>
      <i class="ant-spin-dot-item"></i>
    </span>
  </div>
</template>

<style lang="less" scoped>
@keyframes Spinning {
  100% {
    transform: rotate(405deg);
  }
}
@keyframes FadeIn {
  100% {
    opacity: 1;
  }
}
.ant-spin-spinning {
  position: static;
  display: inline-block;
  opacity: 1;
  font-size: 14px;
  text-align: center;
  vertical-align: middle;
  padding: 12px 0;
  transition: transform 0.3s cubic-bezier(0.78, 0.14, 0.15, 0.86);
  .ant-spin-dot {
    position: relative;
    display: inline-block;
    font-size: 32px;
    width: 1em;
    height: 1em;
    transform: rotate(45deg);
    animation-name: Spinning;
    animation-duration: 1.2s;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
    .ant-spin-dot-item {
      position: absolute;
      display: block;
      width: 14px;
      height: 14px;
      background-color: #1677ff;
      border-radius: 100%;
      transform: scale(0.75);
      transform-origin: 50% 50%;
      opacity: 0.3;
      animation-name: FadeIn;
      animation-duration: 1s;
      animation-iteration-count: infinite;
      animation-timing-function: linear;
      animation-direction: alternate;
      &:nth-child(1) {
        top: 0;
        inset-inline-start: 0;
      }
      &:nth-child(2) {
        top: 0;
        inset-inline-end: 0;
        animation-delay: 0.4s;
      }
      &:nth-child(3) {
        inset-inline-end: 0;
        bottom: 0;
        animation-delay: 0.8s;
      }
      &:nth-child(4) {
        bottom: 0;
        inset-inline-start: 0;
        animation-delay: 1.2s;
      }
    }
  }
}
</style>
