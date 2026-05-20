<script lang="ts">
  const { children } = $props();
</script>

<div class="flex min-h-screen flex-col items-center justify-center px-6 py-10">
  <div class="w-full max-w-sm">
    {@render children()}
  </div>
</div>
