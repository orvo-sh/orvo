import { redirect } from '@sveltejs/kit';

export const load = (() => {
  throw redirect(302, "/docs/getting-started/introduction");
});

