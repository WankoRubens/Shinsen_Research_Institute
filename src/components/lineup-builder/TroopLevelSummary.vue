<template>
  <div class="troop-level-summary" role="group" aria-label="兵種レベル">
    <span class="summary-label">兵:</span>
    <component
      :is="selectable ? 'button' : 'span'"
      v-for="troopType in TROOP_TYPES"
      :key="troopType"
      :type="selectable ? 'button' : undefined"
      class="troop-level"
      :class="{
        'is-active': levels[troopType] > 0,
        'is-selected': selected === troopType,
        'is-selectable': selectable,
      }"
      :title="selectable
        ? `${troopType}レベル ${levels[troopType]}（${selected === troopType ? 'クリックで指定解除' : 'クリックで兵種を指定'}）`
        : `${troopType}レベル ${levels[troopType]}`"
      :aria-pressed="selectable ? selected === troopType : undefined"
      @click="selectTroopType(troopType)"
    >
      <span>{{ TROOP_LABELS[troopType] }}</span>
      <strong>{{ levels[troopType] }}</strong>
    </component>
  </div>
</template>

<script setup lang="ts">
import { TROOP_LABELS, TROOP_TYPES, type TroopType } from '../../constants/traits'

const props = withDefaults(defineProps<{
  levels: Record<TroopType, number>
  selected?: TroopType | null
  selectable?: boolean
}>(), {
  selected: null,
  selectable: false,
})

const emit = defineEmits<{
  select: [value: TroopType | null]
}>()

const selectTroopType = (troopType: TroopType): void => {
  if (!props.selectable) return
  emit('select', props.selected === troopType ? null : troopType)
}
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
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font: inherit;
}

.troop-level strong {
  font-size: 12px;
}

.troop-level.is-active {
  background: rgb(var(--color-highlight));
  color: rgb(var(--color-focus));
}

.troop-level.is-selectable {
  cursor: pointer;
}

.troop-level.is-selectable:hover {
  border-color: rgb(var(--color-focus));
}

.troop-level.is-selected {
  border-color: #d97706;
  background: #fff7d6;
  color: #9a4d00;
  box-shadow: inset 0 0 0 1px rgba(217, 119, 6, 0.16);
}

.troop-level:focus-visible {
  outline: 2px solid rgb(var(--color-focus));
  outline-offset: 1px;
}
</style>
