<script lang="ts">
  const { children } = $props();
</script>

<div
  class="flex min-h-svh flex-col items-center gap-6 p-6 not-sm:pt-20 sm:justify-center md:p-10"
>
  <div class="w-full max-w-sm">
    {@render children()}
  </div>
</div>
