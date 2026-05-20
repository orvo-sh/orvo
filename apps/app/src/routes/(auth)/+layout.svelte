<script lang="ts">
  const { children } = $props();
</script>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
  <div class="w-full max-w-md">
    {@render children()}
  </div>
</div>
