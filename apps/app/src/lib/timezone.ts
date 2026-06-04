const TIMEZONE_METADATA_KEY = 'defaultTimezone';

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

const getOrganizationTimezone = (metadata: unknown) => {
	if (!metadata || typeof metadata !== 'object') {
		return null;
	}

	const value = (metadata as Record<string, unknown>)[TIMEZONE_METADATA_KEY];
	if (typeof value !== 'string') {
		return null;
	}

	return normalizeTimeZone(value);
};

const withOrganizationTimezone = (metadata: unknown, timezone: string) => {
	const nextMetadata =
		metadata && typeof metadata === 'object' && !Array.isArray(metadata)
			? { ...(metadata as Record<string, unknown>) }
			: {};

	nextMetadata[TIMEZONE_METADATA_KEY] = timezone;
	return nextMetadata;
};

export {
	getOrganizationTimezone,
	getSupportedTimezones,
	normalizeTimeZone,
	withOrganizationTimezone
};
