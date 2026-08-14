<script setup>
import { ref } from "vue";

defineProps({
  modelValue: { type: String, default: "" },
  placeholder: { type: String, default: "查询缩写 / 协议 / 术语…" },
});
const emit = defineEmits(["update:modelValue", "focus"]);

const input = ref(null);

function focus() {
  input.value?.focus();
  input.value?.select();
}

defineExpose({ focus });
</script>

<template>
  <input
    ref="input"
    class="search-input"
    type="text"
    :value="modelValue"
    :placeholder="placeholder"
    spellcheck="false"
    autocomplete="off"
    autofocus
    @input="emit('update:modelValue', $event.target.value)"
    @focus="emit('focus')"
    @click="emit('focus')"
  />
</template>

<style scoped>
.search-input {
  flex: 1;
  height: 34px;
  padding: 0 10px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 16px;
  color: #1f2937;
  user-select: text;
}

.search-input::placeholder {
  color: #a3aebc;
}
</style>
