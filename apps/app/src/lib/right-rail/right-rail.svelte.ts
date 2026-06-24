import { getContext, setContext, type Component } from "svelte";

type RightRailOptions = {
  id: string;
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
  component: Component<any>;
  props: Record<string, unknown>;
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

  show = (
    options: RightRailOptions & {
      component: Component<any>;
      props?: Record<string, unknown>;
    },
  ) => {
    this.active = {
      id: options.id,
      ownerPath: this.#getPath(),
      persistOnNavigation: options.persistOnNavigation ?? false,
      widthClass: options.widthClass ?? "sm:max-w-3xl",
      className: options.class ?? "",
      component: options.component,
      props: options.props ?? {},
    };
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
export type { RightRailOptions };
