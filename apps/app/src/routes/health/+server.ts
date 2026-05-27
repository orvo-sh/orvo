import { json } from '@sveltejs/kit';

export const GET = async () => json({ status: 'ok' });
