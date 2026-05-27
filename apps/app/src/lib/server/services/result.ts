export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export const ok = <T>(data: T): ServiceResult<T> => ({
	success: true,
	data
});

export const err = <T = never>(error: string): ServiceResult<T> => ({
	success: false,
	error
});
