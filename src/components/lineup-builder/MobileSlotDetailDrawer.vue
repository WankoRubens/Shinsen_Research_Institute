<template>
  <el-drawer
    :model-value="modelValue"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
    direction="btt"
    size="60%"
    :with-header="false"
    class="rounded-t-xl overflow-hidden"
  >
    <MobileSlotDetail
      v-if="role"
      :role-name="role === 'main' ? '大將' : '副將'"
      :hero="role ? roleData.hero : null"
      :stats="role ? roleData.stats : undefined"
      :equip-traits="role ? roleData.equipTraits : []"
      @update:hero="(h: Hero | null) => $emit('update:hero', h)"
      @open-equip="(idx: number) => $emit('open-equip', idx)"
    />
  </el-drawer>
</template>

<script setup lang="ts">
import MobileSlotDetail from '../MobileSlotDetail.vue'
import type { Hero } from '../../composables/useData'
import type { RoleData } from '../../composables/useLineups'

defineProps<{
  modelValue: boolean
  role: 'main' | 'vice1' | 'vice2' | null
  roleData: RoleData
}>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:hero', h: Hero | null): void
  (e: 'open-equip', idx: number): void
}>()
</script>
