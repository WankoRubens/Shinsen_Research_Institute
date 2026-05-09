<template>
  <div class="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
    {{ label }}
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
</script>
