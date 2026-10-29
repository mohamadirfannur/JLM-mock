<template>
  <div class="h-screen flex flex-col bg-j-bg overflow-hidden">
    <JNavbar />
    <div class="flex flex-1 min-h-0">
      <JSidebar />
      <main class="flex-1 min-w-0 relative overflow-hidden"><slot /></main>
    </div>
  </div>
</template>
