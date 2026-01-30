<script setup lang="ts">
interface IProps {
  value: string;
}

const props = defineProps<IProps>();
const emits = defineEmits(["update:value"]);
</script>

<template>
  <input
    class="ant-input"
    :value="props.value"
    @change="(e) => emits('update:value', (e.target as HTMLInputElement).value)"
  />
</template>

<style lang="less" scoped>
.ant-input {
  position: relative;
  display: inline-block;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 4px 11px;
  font-size: 14px;
  background-color: #ffffff;
  border-width: 1px;
  border-style: solid;
  border-color: #d9d9d9;
  border-radius: 6px;
  transition: all 0.2s;
  &::placeholder {
    font-size: 12px;
  }
  &:placeholder-shown {
    text-overflow: ellipsis;
  }
  &:hover {
    border-color: #4096ff;
    border-inline-end-width: 1px;
  }
  &:focus {
    border-color: #4096ff;
    box-shadow: 0 0 0 2px rgba(5, 145, 255, 0.1);
    border-inline-end-width: 1px;
    outline: 0;
  }
}
</style>
