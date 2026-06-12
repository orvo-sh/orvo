export const assistantSidebarState = $state({
  open: false,
  appId: "" as string,
  chatId: "" as string,
});

export function pushChatToSidebar(appId: string, chatId: string) {
  assistantSidebarState.appId = appId;
  assistantSidebarState.chatId = chatId;
  assistantSidebarState.open = true;
}
