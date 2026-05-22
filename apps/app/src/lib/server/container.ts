import { createAuth, type Auth } from "$lib/server/auth";

export type ServerContainer = {
	authService: Auth;
};

export function createServerContainer(): ServerContainer {
	return {
		authService: createAuth()
	};
}
