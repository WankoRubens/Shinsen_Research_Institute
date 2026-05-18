<template>
  <div class="sort-pills" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      class="sort-pill"
      :class="{ 'sort-pill--active': modelValue === opt.value }"
      role="radio"
      :aria-checked="modelValue === opt.value"
      @click="$emit('update:modelValue', opt.value)"
    >
      <el-icon v-if="opt.icon" :size="11">
        <component :is="opt.icon" />
      </el-icon>
      <span>{{ opt.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
// Generic segmented-control. iOS/macOS-inspired: a slightly darker track
// surrounds a white "lifted" thumb that marks the active option. Used by
// every sort surface in the variants flow so all controls read as one
// design system rather than ad-hoc radio buttons per page.
import type { Component } from 'vue'

interface SortOption {
  value: T
  label: string
  icon?: Component
}

defineProps<{
  modelValue: T
  options: SortOption[]
  ariaLabel?: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()
</script>

<style scoped>
.sort-pills {
  display: inline-flex;
  padding: 3px;
  background: rgba(17, 24, 39, 0.04);
  border: 1px solid rgba(17, 24, 39, 0.06);
  border-radius: 9px;
  gap: 2px;
}
.sort-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: none;
  background: transparent;
  color: rgb(var(--color-ink-mute));
  font-size: 12px;
  font-weight: 600;
  border-radius: 7px;
  cursor: pointer;
  letter-spacing: 0.3px;
  transition: color 0.15s, background 0.15s, box-shadow 0.2s;
}
.sort-pill:hover:not(.sort-pill--active) {
  color: rgb(var(--color-ink));
  background: rgba(17, 24, 39, 0.03);
}
/* Active state lifts: white fill + soft drop-shadow + thin amber outline
   ring. Reads as a "raised" segment without filling with strong color. */
.sort-pill--active {
  background: #ffffff;
  color: #92400e;
  font-weight: 700;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(180, 83, 9, 0.18);
}
.sort-pill--active:hover { color: #92400e; }
</style>
