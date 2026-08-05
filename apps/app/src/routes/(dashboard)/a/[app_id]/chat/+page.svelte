<script lang="ts">
  import * as Chat from "$lib/chat";
  import PageContainer from "../_components/page-container/page-container.svelte";
</script>

<PageContainer title="Scout" contentClass="p-0!">
  <Chat.Shell mode="page" />
</PageContainer>
