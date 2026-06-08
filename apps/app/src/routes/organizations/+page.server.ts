import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  const { organizations, user } = await event.parent();

  return {
    organizations,
    user,
  };
}) satisfies PageServerLoad;
