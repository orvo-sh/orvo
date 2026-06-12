const ok = <T>(data: T): Result<T> => ({
	success: true,
	data
});

const err = <T = never>(error: string): Result<T> => ({
	success: false,
	error
});

type Result<T> = { success: true; data: T } | { success: false; error: string };

const allOk = <T extends Result<any>>(arr: T[]): arr is Extract<T, { success: true }>[] => {
  return arr.every(item => item != null && item.success === true);
};

export { allOk, err, ok, type Result };

