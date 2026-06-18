import { browser } from "$app/environment";

const kbdShortcut = (callbacks: Record<string, () => any>) => {
  if (!browser) return;

  const cb = (event: KeyboardEvent) => {
    const targetElement = event.target as HTMLElement;
    const shortcut = callbacks[event.key.toLowerCase()];

    if (!targetElement?.tagName || ignoredElements.has(targetElement.tagName))
      return;
    if (ignoredRoles.has(targetElement.getAttribute("role") ?? "")) return;
    if (targetElement.isContentEditable) return;

    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)
      return;
    if (!shortcut) return;

    event.preventDefault();
    shortcut();
  };

  document.addEventListener("keydown", cb);
  return () => {
    document.removeEventListener("keydown", cb);
  };
};

export { kbdShortcut };

const ignoredRoles = new Set([
  "dialog",
  "menu",
  "listbox",
  "option",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "radiogroup",
  "tablist",
  "tree",
  "treeitem",
]);

const ignoredElements = new Set([
  "INPUT",
  "SELECT",
  "BUTTON",
  "TEXTAREA",
  "OPTION",
  "A",
  "SUMMARY",
  "IFRAME",
  "VIDEO",
  "AUDIO",
]);
