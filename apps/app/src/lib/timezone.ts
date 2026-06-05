const getSupportedTimezones = () => {
	if (typeof Intl.supportedValuesOf !== 'function') {
		return ['UTC'];
	}

	return Array.from(new Set(['UTC', ...Intl.supportedValuesOf('timeZone')])).sort((a, b) =>
		a.localeCompare(b)
	);
};

const normalizeTimeZone = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	try {
		return new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).resolvedOptions().timeZone;
	} catch {
		return null;
	}
};

export { getSupportedTimezones, normalizeTimeZone };
