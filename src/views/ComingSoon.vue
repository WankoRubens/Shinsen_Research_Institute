<template>
  <PageStub :title="entry.title" subtitle="即將推出" :description="entry.description" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PageStub from '../components/layout/PageStub.vue'

const TOPICS: Record<string, { title: string; description: string }> = {
  'battle-sim': {
    title: '戰鬥模擬',
    description: '依照雙方陣容自動推演戰鬥流程；目前仍在開發中，預計於後續版本上線。',
  },
  'hero-pedia': {
    title: '武將圖鑑',
    description: '完整武將資料卡，含技能、戰法、配置建議；目前仍在開發中，預計於後續版本上線。',
  },
}
const FALLBACK = { title: '即將推出', description: '此功能尚未上線。' }

const route = useRoute()
const entry = computed(() => TOPICS[String(route.params.topic ?? '')] ?? FALLBACK)
</script>
