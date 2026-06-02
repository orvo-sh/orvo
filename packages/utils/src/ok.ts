import type { ServiceResult } from './result.js';

const ok = <T>(data: T): ServiceResult<T> => ({
	success: true,
	data
});

export { ok };
