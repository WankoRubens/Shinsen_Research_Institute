<template>
  <PageStub :description="t('developingFeature')" />
</template>

<script setup lang="ts">
import PageStub from '../components/layout/PageStub.vue'
import { useLocale } from '../composables/useLocale'

const { t } = useLocale()
</script>
