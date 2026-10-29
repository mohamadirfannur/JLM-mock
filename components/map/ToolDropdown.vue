<script setup lang="ts">
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/vue";
import IcArrow from "~/assets/icons/ic-arrow-reg.svg";

export interface ToolItem {
  id: string;
  label: string;
  icon?: any;
  uicon?: string;
  hint?: string;
  danger?: boolean;
}
defineProps<{ label: string; icon?: any; title?: string; description?: string; items?: ToolItem[]; width?: string }>();
const emit = defineEmits<{ (e: "select", id: string): void }>();
</script>

<template>
  <Menu v-slot="{ open }" as="div" class="relative inline-block text-left">
    <MenuButton
      :class="[
        open ? 'bg-gradient-to-r from-blue-200/80 to-blue-600 text-white' : 'bg-transparent hover:bg-gradient-to-r hover:from-blue-200/80 hover:to-blue-600 hover:text-white text-grey-700',
        'inline-flex items-center h-9 gap-3 rounded-xxs px-3 py-2 text-sm font-normal focus:outline-none whitespace-nowrap',
      ]"
    >
      <component :is="icon" v-if="icon" class="w-4 h-4" :font-controlled="false" />
      {{ label }}
      <IcArrow class="w-4 h-4 transition-transform" :class="open ? '' : 'rotate-180'" :font-controlled="false" />
    </MenuButton>
    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <MenuItems :class="[width || 'w-60', 'absolute left-0 bottom-12 p-3 flex flex-col gap-2 origin-bottom-left rounded-xs bg-white shadow-lg ring-1 ring-grey-800 focus:outline-none z-40']">
        <div v-if="title || description">
          <p class="text-xs text-grey-900 mb-1">{{ title }}</p>
          <p class="text-2xs text-grey-600">{{ description }}</p>
        </div>
        <UDivider v-if="title || description" />
        <slot />
        <MenuItem v-for="item in items" :key="item.id" v-slot="{ active }">
          <button
            :class="[
              active ? 'bg-gradient-to-r from-blue-200/80 to-blue-600 text-white' : item.danger ? 'text-red-500' : 'text-grey-900',
              'group flex w-full items-center gap-3 rounded-xxs p-2 text-xs text-left',
            ]"
            @click="emit('select', item.id)"
          >
            <component :is="item.icon" v-if="item.icon" class="w-[14px] h-[14px] shrink-0" :font-controlled="false" />
            <UIcon v-else-if="item.uicon" :name="item.uicon" class="w-[14px] h-[14px] shrink-0" />
            <span class="flex-1">{{ item.label }}</span>
            <span v-if="item.hint" class="text-[9px] px-1.5 py-0.5 rounded-full" :class="active ? 'bg-white/25' : 'bg-blue-100 text-blue-600'">{{ item.hint }}</span>
          </button>
        </MenuItem>
      </MenuItems>
    </transition>
  </Menu>
</template>
