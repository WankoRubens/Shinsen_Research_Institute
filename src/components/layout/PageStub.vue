<template>
  <div class="flex-1 overflow-y-auto p-6 md:p-10">
    <div class="max-w-2xl">
      <div class="text-xs text-ink-mute tracking-widest uppercase">{{ subtitle }}</div>
      <h1 class="font-brand text-2xl md:text-3xl font-bold text-ink mt-1">{{ title }}</h1>
      <div class="mt-6 p-6 rounded-xl border border-dashed border-divider bg-white text-ink-soft text-sm leading-relaxed">
        {{ description }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle: string; description: string }>()
</script>
