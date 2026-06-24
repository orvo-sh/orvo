import { getContext, setContext, type Snippet } from "svelte";

type RightRailPortalConfig = {
  id: string;
  open: boolean;
  persistOnNavigation?: boolean;
  widthClass?: string;
  class?: string;
};

type RightRailPanel = {
  id: string;
  ownerPath: string;
  persistOnNavigation: boolean;
  widthClass: string;
  className: string;
  children: Snippet;
};

class RightRailState {
  active = $state<RightRailPanel | null>(null);
  #getPath: () => string;

  constructor(getPath: () => string) {
    this.#getPath = getPath;
  }

  get isOpen() {
    return this.active !== null;
  }

  props = (config: RightRailPortalConfig) => config;

  mount = (
    config: Omit<RightRailPortalConfig, "open"> & {
      children: Snippet;
    },
  ) => {
    this.active = {
      id: config.id,
      ownerPath: this.#getPath(),
      persistOnNavigation: config.persistOnNavigation ?? false,
      widthClass: config.widthClass ?? "w-96 min-w-96",
      className: config.class ?? "",
      children: config.children,
    };
  };

  unmount = (id: string) => {
    if (this.active?.id === id) {
      this.active = null;
    }
  };

  close = (id?: string) => {
    if (!id || this.active?.id === id) {
      this.active = null;
    }
  };

  setOpen = (open: boolean, id?: string) => {
    if (!open) {
      this.close(id);
    }
  };

  handlePathChange = (path: string) => {
    if (
      this.active &&
      !this.active.persistOnNavigation &&
      this.active.ownerPath !== path
    ) {
      this.active = null;
    }
  };
}

const RIGHT_RAIL_CONTEXT_KEY = Symbol("app-right-rail");

const setRightRail = (getPath: () => string) =>
  setContext(RIGHT_RAIL_CONTEXT_KEY, new RightRailState(getPath));

const useRightRail = () => getContext<RightRailState>(RIGHT_RAIL_CONTEXT_KEY);

export { setRightRail, useRightRail };
export type { RightRailPortalConfig };
