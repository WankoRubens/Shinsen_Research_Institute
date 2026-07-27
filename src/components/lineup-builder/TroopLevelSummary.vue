<template>
  <div class="troop-level-summary" role="group" aria-label="兵種レベル">
    <span class="summary-label">兵:</span>
    <span
      v-for="troopType in TROOP_TYPES"
      :key="troopType"
      class="troop-level"
      :class="{ 'is-active': levels[troopType] > 0 }"
      :title="`${troopType}レベル ${levels[troopType]}`"
    >
      <span>{{ TROOP_LABELS[troopType] }}</span>
      <strong>{{ levels[troopType] }}</strong>
    </span>
  </div>
</template>

<script setup lang="ts">
import { TROOP_LABELS, TROOP_TYPES, type TroopType } from '../../constants/traits'

defineProps<{
  levels: Record<TroopType, number>
}>()
</script>

<style scoped>
.troop-level-summary {
  display: inline-grid;
  grid-template-columns: auto repeat(5, minmax(22px, auto));
  align-items: center;
  gap: 2px;
  min-height: 28px;
  padding: 3px 6px;
  border: 1px solid #d8dee8;
  border-radius: 4px;
  background: #f7f8fa;
  color: #9ca3af;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.summary-label {
  margin-right: 2px;
  color: #64748b;
}

.troop-level {
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
  min-width: 22px;
  padding: 2px;
  border-radius: 3px;
  font-variant-numeric: tabular-nums;
}

.troop-level strong {
  font-size: 12px;
}

.troop-level.is-active {
  background: rgb(var(--color-highlight));
  color: rgb(var(--color-focus));
}
</style>
