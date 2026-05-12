<template>
  <div class="flex-1 overflow-y-auto p-4 md:p-6">
    <div class="max-w-2xl">
      <div class="p-6 rounded-xl border border-dashed border-divider bg-white text-ink-soft text-sm leading-relaxed">
        {{ description }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ description: string }>()
</script>
