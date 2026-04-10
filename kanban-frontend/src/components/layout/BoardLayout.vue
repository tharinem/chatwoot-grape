<script setup lang="ts">
</script>

<template>
  <div class="flex flex-col h-screen bg-n-background">
    <slot name="topbar" />
    <div class="flex-1 overflow-x-auto overflow-y-hidden px-8 pb-4">
      <slot />
    </div>
  </div>
</template>
