<template>
  <el-header class="app-header bg-white border-b border-divider flex items-center justify-between px-0 md:px-4 sticky top-0 z-50">
    <div class="flex items-center gap-1 md:gap-3">
      <el-button class="md:hidden !px-1 !mr-0" text @click="$emit('open-mobile-sidebar')">
        <el-icon :size="20"><Menu /></el-icon>
      </el-button>

      <!-- Group selector — dropdown with current group name. Switch is wired;
           rename / delete defer to a later follow-up. -->
      <el-dropdown
        v-if="!isEditingInventory"
        trigger="click"
        @command="onGroupCommand"
        placement="bottom-start"
      >
        <button class="group-pill" type="button">
          <span class="font-bold text-ink">編組</span>
          <span class="font-bold text-focus truncate max-w-[100px]">{{ currentGroup.name }}</span>
          <el-icon :size="12" class="opacity-60"><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu class="min-w-[180px]">
            <el-dropdown-item
              v-for="(g, idx) in groups"
              :key="g.id"
              :command="`switch:${idx}`"
              :class="{ '!font-bold !text-focus': idx === currentGroupIndex }"
            >
              <span class="text-xs text-ink-mute mr-1.5">{{ idx + 1 }}</span>
              {{ g.name }}
            </el-dropdown-item>
            <el-dropdown-item command="add" divided>
              <el-icon class="mr-1"><Plus /></el-icon> 新增編組
            </el-dropdown-item>
            <el-dropdown-item command="rename">
              <el-icon class="mr-1"><Edit /></el-icon> 重新命名
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <div class="flex items-center gap-2">
        <div v-if="!isEditingInventory" class="flex items-center gap-2">
          <el-input
            :model-value="teamName"
            @update:model-value="(v: string) => $emit('update:teamName', v)"
            placeholder="輸入隊伍名稱"
            class="w-32 sm:w-48 font-bold"
            size="default"
          >
            <template #suffix>
              <el-icon class="el-input__icon"><Edit /></el-icon>
            </template>
          </el-input>
        </div>
        <div v-else class="font-bold text-gray-800 text-lg">
          庫存編輯模式
        </div>
      </div>

      <div v-if="!isEditingInventory" class="text-xs font-bold bg-gray-100 px-3 py-1.5 rounded-sm border border-gray-200 flex items-center hidden sm:flex">
        <span class="text-gray-500 mr-1">Cost:</span>
        <span :class="{ 'text-red-500': totalCost > 20, 'text-gray-800': totalCost <= 20 }" class="text-sm">{{ totalCost }}/20</span>
      </div>
      <div v-if="!isEditingInventory" class="text-xs font-bold bg-gray-100 px-2 py-1 rounded-sm border border-gray-200 items-center gap-1 hidden sm:flex">
        <span class="text-gray-500 mr-0.5">兵:</span>
        <span
          v-for="tt in TROOP_TYPES"
          :key="tt"
          class="px-1 rounded-sm"
          :class="troopLevels[tt] > 0 ? 'text-focus bg-highlight' : 'text-gray-400'"
        >{{ TROOP_LABELS[tt] }}{{ troopLevels[tt] }}</span>
      </div>
    </div>

    <div class="flex items-center gap-1 md:gap-1 pr-1 md:pr-0">
      <template v-if="!isEditingInventory">
        <el-button type="info" plain @click="$emit('start-editing-inventory')" class="hidden sm:inline-flex !rounded-sm">
          <el-icon class="mr-1"><Edit /></el-icon> 編輯庫存
        </el-button>
        <el-button type="info" plain @click="$emit('start-editing-inventory')" class="sm:hidden !rounded-sm !w-9 !h-9 !p-0">
          <el-icon><Edit /></el-icon>
        </el-button>

        <el-button type="primary" plain @click="$emit('open-share')" class="hidden sm:inline-flex !rounded-sm">
          <el-icon class="mr-1"><Share /></el-icon> 分享
        </el-button>
        <el-button type="primary" plain @click="$emit('open-share')" class="sm:hidden !rounded-sm !w-9 !h-9 !p-0">
          <el-icon><Share /></el-icon>
        </el-button>

        <el-button type="danger" plain @click="$emit('open-reset')" class="hidden sm:inline-flex !rounded-sm">
          <el-icon class="mr-1"><Delete /></el-icon> 重置
        </el-button>
        <el-button type="danger" plain @click="$emit('open-reset')" class="sm:hidden !rounded-sm !w-9 !h-9 !p-0">
          <el-icon><Delete /></el-icon>
        </el-button>

        <!-- Bell — always shown; placeholder for future notifications, currently opens changelog -->
        <el-button text class="help-btn !rounded-sm !px-2" :title="'更新紀錄'" @click="$emit('open-changelog')">
          <el-icon><Bell /></el-icon>
          <span v-if="hasUnseenChangelog" class="help-btn-dot" />
        </el-button>

        <template v-if="!isLoggedIn">
          <el-button text @click="$emit('open-auth')" class="hidden sm:inline-flex !rounded-sm">
            <el-icon class="mr-1"><User /></el-icon> 登入
          </el-button>
          <el-button text @click="$emit('open-auth')" class="sm:hidden !rounded-sm !px-2">
            <el-icon><User /></el-icon>
          </el-button>
        </template>
        <el-dropdown v-else trigger="click" @command="(cmd: UserMenuCmd) => $emit('user-menu', cmd)" placement="bottom-end">
          <button class="user-pill">
            <el-icon><User /></el-icon>
            <span class="hidden sm:inline truncate max-w-[120px]">{{ displayName }}</span>
            <el-icon class="opacity-70"><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu class="min-w-[220px]">
              <el-dropdown-item disabled class="!cursor-default !opacity-100">
                <div class="flex items-baseline gap-1 min-w-0">
                  <span class="text-xs text-gray-500 flex-shrink-0">角色：</span>
                  <span class="text-sm font-bold text-emerald-700 truncate">
                    {{ activeProfileName ?? '預設' }}
                  </span>
                </div>
              </el-dropdown-item>
              <el-dropdown-item command="my-profiles">
                <el-icon class="mr-1"><User /></el-icon> 管理角色配置
              </el-dropdown-item>
              <el-dropdown-item command="gacha-log">
                <el-icon class="mr-1"><Coin /></el-icon> 抽卡紀錄
              </el-dropdown-item>
              <el-dropdown-item command="my-shares" divided>
                <el-icon class="mr-1"><Share /></el-icon> 我的分享
              </el-dropdown-item>
              <el-dropdown-item command="changelog" divided>
                <el-icon class="mr-1"><Notebook /></el-icon>
                <span>更新紀錄</span>
                <span
                  v-if="hasUnseenChangelog"
                  class="ml-auto pl-2 text-[10px] font-bold text-emerald-600"
                >NEW</span>
              </el-dropdown-item>
              <el-dropdown-item command="rename" divided>
                <el-icon class="mr-1"><Edit /></el-icon> 編輯名稱
              </el-dropdown-item>
              <el-dropdown-item command="signout">
                <el-icon class="mr-1"><Close /></el-icon> 登出
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
      <template v-else>
        <el-button @click="$emit('cancel-editing-inventory')" class="!rounded-sm">
          <el-icon class="mr-1"><Close /></el-icon> <span class="hidden sm:inline">不儲存離開</span>
        </el-button>
        <el-button type="success" @click="$emit('save-inventory')" class="!rounded-sm">
          <el-icon class="mr-1"><Check /></el-icon> <span class="hidden sm:inline">儲存庫存</span>
        </el-button>
      </template>
    </div>
  </el-header>
</template>

<script setup lang="ts">
import { Edit, Share, Delete, Menu, User, Bell, ArrowDown, Coin, Close, Check, Plus, Notebook } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { TROOP_TYPES, TROOP_LABELS } from '../../constants/traits'
import type { TroopType } from '../../constants/traits'
import { useGroups } from '../../composables/useGroups'

export type UserMenuCmd = 'my-profiles' | 'gacha-log' | 'my-shares' | 'changelog' | 'rename' | 'signout'

defineProps<{
  teamName: string
  totalCost: number
  troopLevels: Record<TroopType, number>
  isEditingInventory: boolean
  isLoggedIn: boolean
  hasUnseenChangelog: boolean
  displayName: string | null
  activeProfileName: string | null
}>()
defineEmits<{
  (e: 'update:teamName', v: string): void
  (e: 'open-mobile-sidebar'): void
  (e: 'start-editing-inventory'): void
  (e: 'cancel-editing-inventory'): void
  (e: 'save-inventory'): void
  (e: 'open-share'): void
  (e: 'open-reset'): void
  (e: 'open-changelog'): void
  (e: 'open-auth'): void
  (e: 'user-menu', cmd: UserMenuCmd): void
}>()

const { groups, currentGroup, currentGroupIndex, setCurrentGroup, addGroup } = useGroups()

const onGroupCommand = (cmd: string) => {
  if (cmd.startsWith('switch:')) {
    const idx = Number(cmd.slice(7))
    if (idx !== currentGroupIndex.value) setCurrentGroup(idx)
  } else if (cmd === 'add') {
    const newIdx = addGroup()
    setCurrentGroup(newIdx)
    ElMessage.success(`已建立並切換到 ${groups[newIdx].name}`)
  } else if (cmd === 'rename') {
    ElMessage.info('重新命名功能將於後續版本啟用')
  }
}
</script>

<style scoped>
.group-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: 2px;
  background: rgb(var(--color-surface-muted));
  border: 1px solid rgb(var(--color-divider));
  color: #1F2937;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
  line-height: 1;
  box-sizing: border-box;
}
.group-pill:hover {
  background: rgb(var(--color-highlight));
  border-color: rgb(var(--color-focus));
}
.group-pill:focus-visible {
  outline: 2px solid rgb(var(--color-focus));
  outline-offset: 2px;
}
.user-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  margin-left: 4px;
  border-radius: 2px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  color: #4338ca;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  line-height: 1;
  box-sizing: border-box;
}
.user-pill:hover {
  background: #e0e7ff;
  border-color: #a5b4fc;
}
.user-pill:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}
@media (max-width: 767px) {
  .user-pill {
    padding: 0 6px;
    gap: 2px;
  }
}
.help-btn {
  position: relative;
}
.help-btn-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ef4444;
  box-shadow: 0 0 0 2px #ffffff;
  pointer-events: none;
}
</style>
