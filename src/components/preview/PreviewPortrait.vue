<template>
  <div class="preview-portrait" :style="{ '--render': `${render}px` }">
    <img
      v-if="src"
      :src="src"
      :alt="alt ?? ''"
      class="portrait-img"
      loading="lazy"
      referrerpolicy="no-referrer"
    />
    <span v-else class="empty-mark">{{ fallbackText }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  src?: string | null
  /** Output square size in px. */
  render?: number
  alt?: string
  fallbackText?: string
}>(), {
  render: 96,
  fallbackText: '?',
})
</script>

<style scoped>
/* Square container; the <img> inside uses object-fit:cover so any source
   aspect ratio gracefully cropfills. object-position aims the visible window
   at the upper portion of the portrait — game8 sprites put the cost overlay
   in the top-left ~10% strip and the face/head in the upper-middle, so
   shifting 25% down past the excess hides the cost label and centers the
   face. Works for the 295×475 sprites we currently get, and degrades sanely
   for any future source size. */
.preview-portrait {
  width: var(--render);
  height: var(--render);
  background: rgb(var(--color-surface-muted));
  border-radius: 6px;
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 25%;
  display: block;
}
.empty-mark {
  font-size: calc(var(--render) * 0.32);
  font-weight: 700;
  color: rgb(var(--color-ink-mute));
  line-height: 1;
}
.preview-portrait:not(:has(.portrait-img)) {
  border: 1px dashed rgb(var(--color-divider));
}
</style>
