import { ulid } from 'ulid';

export const genId = (prefix: string) => {
	const id = ulid().toLowerCase();
	return prefix ? `${prefix.toLowerCase()}_${id}` : id;
};
