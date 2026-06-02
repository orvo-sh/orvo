import type { ServiceResult } from './result.js';

const err = <T = never>(error: string): ServiceResult<T> => ({
	success: false,
	error
});

export { err };
