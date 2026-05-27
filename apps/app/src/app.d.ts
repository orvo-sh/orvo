import type { ServerContainer } from '$lib/server/container';
import type { Session, User } from 'better-auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			container: ServerContainer;
			auth?: {
				session: Session & {
					activeOrganizationId?: string | null;
				};
				user: User;
			};
		}
	}
}

export { };
