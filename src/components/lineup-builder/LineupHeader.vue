<template>
  <el-header class="app-header bg-white border-b border-gray-200 flex items-center justify-between px-0 md:px-4 sticky top-0 z-50">
    <div class="flex items-center gap-1 md:gap-4">
      <el-button class="md:hidden !px-1 !mr-0" text @click="$emit('open-mobile-sidebar')">
        <el-icon :size="20"><Menu /></el-icon>
      </el-button>

      <div class="flex items-center gap-2">
        <el-icon :size="24" class="text-indigo-600 hidden md:block"><Flag /></el-icon>
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

      <div v-if="!isEditingInventory" class="text-xs font-bold bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 flex items-center hidden sm:flex">
        <span class="text-gray-500 mr-1">Cost:</span>
        <span :class="{ 'text-red-500': totalCost > 20, 'text-gray-800': totalCost <= 20 }" class="text-sm">{{ totalCost }}/20</span>
      </div>
      <div v-if="!isEditingInventory" class="text-xs font-bold bg-gray-100 px-2 py-1 rounded-full border border-gray-200 items-center gap-1 hidden sm:flex">
        <span class="text-gray-500 mr-0.5">兵:</span>
        <span
          v-for="tt in TROOP_TYPES"
          :key="tt"
          class="px-1 rounded text-[10px]"
          :class="troopLevels[tt] > 0 ? 'text-amber-700 bg-amber-50' : 'text-gray-400'"
        >{{ TROOP_LABELS[tt] }}{{ troopLevels[tt] }}</span>
      </div>
    </div>

    <div class="flex items-center gap-1 md:gap-0 pr-1 md:pr-0">
      <template v-if="!isEditingInventory">
        <el-button type="info" round plain @click="$emit('start-editing-inventory')" class="hidden sm:inline-flex">
          <el-icon class="mr-1"><Edit /></el-icon> 編輯庫存
        </el-button>
        <el-button type="info" circle plain @click="$emit('start-editing-inventory')" class="sm:hidden">
          <el-icon><Edit /></el-icon>
        </el-button>

        <el-button type="primary" round plain @click="$emit('open-share')" class="hidden sm:inline-flex">
          <el-icon class="mr-1"><Share /></el-icon> 分享
        </el-button>
        <el-button type="primary" circle plain @click="$emit('open-share')" class="sm:hidden">
          <el-icon><Share /></el-icon>
        </el-button>

        <el-button type="danger" round plain @click="$emit('open-reset')" class="hidden sm:inline-flex">
          <el-icon class="mr-1"><Delete /></el-icon> 重置
        </el-button>
        <el-button type="danger" circle plain @click="$emit('open-reset')" class="sm:hidden">
          <el-icon><Delete /></el-icon>
        </el-button>

        <template v-if="!isLoggedIn">
          <el-button text class="help-btn !px-2" :title="'更新紀錄'" @click="$emit('open-changelog')">
            <el-icon><Bell /></el-icon>
            <span v-if="hasUnseenChangelog" class="help-btn-dot" />
          </el-button>
          <el-button text @click="$emit('open-auth')" class="hidden sm:inline-flex !ml-1">
            <el-icon class="mr-1"><User /></el-icon> 登入
          </el-button>
          <el-button text @click="$emit('open-auth')" class="sm:hidden !px-2">
            <el-icon><User /></el-icon>
          </el-button>
        </template>
        <el-dropdown v-else trigger="click" @command="(cmd: UserMenuCmd) => $emit('user-menu', cmd)" placement="bottom-end">
          <button class="user-pill">
            <el-icon><User /></el-icon>
            <span class="hidden sm:inline truncate max-w-[120px]">{{ displayName }}</span>
            <span v-if="hasUnseenChangelog" class="user-pill-badge" />
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
                <el-icon class="mr-1"><Bell /></el-icon>
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
        <el-button round @click="$emit('cancel-editing-inventory')">
          <el-icon class="mr-1"><Close /></el-icon> <span class="hidden sm:inline">不儲存離開</span>
        </el-button>
        <el-button type="success" round @click="$emit('save-inventory')">
          <el-icon class="mr-1"><Check /></el-icon> <span class="hidden sm:inline">儲存庫存</span>
        </el-button>
      </template>
    </div>
  </el-header>
</template>

<script setup lang="ts">
import { Flag, Edit, Share, Delete, Menu, User, Bell, ArrowDown, Coin, Close, Check } from '@element-plus/icons-vue'
import { TROOP_TYPES, TROOP_LABELS } from '../../constants/traits'
import type { TroopType } from '../../constants/traits'

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
</script>
