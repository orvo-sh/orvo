import type { createServerContainer } from "$lib/server/container";
import type { Session, User } from "better-auth";

declare global {

  interface Window {
    sey?: {
      identify: (payload: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
      }) => void;
    };
  }

  type Nullable<T> = T | null;

  namespace App {
    interface Locals {
      container: ReturnType<typeof createServerContainer>;
      auth?: {
        session: Session & {
          activeOrganizationId?: string | null;
        };
        user: User;
      };
    }
  }
}

declare module "d3-force";
declare module "d3-scale";

export { };

