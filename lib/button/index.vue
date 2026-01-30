<script setup lang="ts">
interface IProps {
  type?: "primary" | "default";
  link?: boolean;
}

const props = withDefaults(defineProps<IProps>(), {
  type: "default",
});
</script>

<template>
  <button
    class="ant-btn"
    :class="{
      'ant-btn-link': props.link,
      [`ant-btn-${props.type}`]: true,
    }"
  >
    <slot></slot>
  </button>
</template>

<style lang="less" scoped>
.ant-btn {
  position: relative;
  display: inline-block;
  height: 32px;
  padding: 4px 15px;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  text-align: center;
  white-space: nowrap;
  user-select: none;
  touch-action: manipulation;
  outline: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
  &.ant-btn-primary {
    color: #fff;
    background-color: #1677ff;
    box-shadow: 0 2px 0 rgba(5, 145, 255, 0.1);
    &:hover {
      background-color: #4096ff;
    }
    &:active {
      background-color: #0958d9;
    }
  }
  &.ant-btn-default {
    background-color: #ffffff;
    border-color: #d9d9d9;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.02);
    &:hover {
      border-color: #4096ff;
      color: #4096ff;
    }
  }
  &.ant-btn-link {
    display: inline-block;
    height: auto;
    background-color: transparent;
    color: #1677ff;
    box-shadow: none;
    &:hover {
      background-color: transparent;
      color: #4096ff;
    }
  }
}
</style>
