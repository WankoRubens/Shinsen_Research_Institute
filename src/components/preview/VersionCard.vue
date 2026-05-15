<template>
  <section class="version-card">
    <header class="version-card__head">
      <span
        v-if="tag"
        class="version-card__tag"
        :class="{ 'version-card__tag--highlight': tagVariant === 'highlight' }"
      >{{ tag }}</span>
      <span class="version-card__name font-brand truncate">{{ name }}</span>
      <span v-if="warning" class="version-card__warn">{{ warning }}</span>
    </header>
    <div v-if="$slots.meta" class="version-card__meta">
      <slot name="meta" />
    </div>
    <div v-if="$slots.default" class="version-card__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  name: string
  tag?: string
  tagVariant?: 'default' | 'highlight'
  warning?: string
}>()
</script>

<style scoped>
.version-card {
  background: #ffffff;
  border: 1px solid rgb(var(--color-divider));
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.version-card__head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}
.version-card__tag {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 1px 6px;
  border-radius: 2px;
  color: rgb(var(--color-ink-soft, 71 85 105));
  background: rgb(var(--color-surface-muted));
  border: 1px solid rgb(var(--color-divider));
}
.version-card__tag--highlight {
  color: rgb(var(--color-focus));
  background: rgb(var(--color-highlight));
  border-color: rgb(var(--color-focus) / 0.55);
}
.version-card__warn {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 1px 6px;
  border-radius: 2px;
  color: rgb(180 83 9);
  background: rgb(254 243 199);
  border: 1px solid rgb(252 211 77);
}
.version-card__name {
  font-size: 14px;
  font-weight: 700;
  color: rgb(var(--color-ink));
  min-width: 0;
}
.version-card__meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: rgb(var(--color-ink-soft, 71 85 105));
  font-variant-numeric: tabular-nums;
}
.version-card__meta :deep(strong) {
  color: rgb(var(--color-ink));
  font-weight: 700;
}
.version-card__body {
  margin-top: 4px;
  border-top: 1px dashed rgb(var(--color-divider));
  padding-top: 8px;
}
</style>
