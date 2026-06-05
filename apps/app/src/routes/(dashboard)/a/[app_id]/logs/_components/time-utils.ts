import type { LogTimeFilter, LogTimePreset } from '../types';

const resolvePresetRange = (preset: LogTimePreset) => {
	const end = new Date();

	switch (preset) {
		case 'last_hour':
			return { start: new Date(end.getTime() - 60 * 60 * 1000), end };
		case 'today': {
			const start = new Date(end);
			start.setHours(0, 0, 0, 0);
			return { start, end };
		}
		case 'last_24_hours':
			return { start: new Date(end.getTime() - 24 * 60 * 60 * 1000), end };
		case 'last_3_days':
			return {
				start: new Date(end.getTime() - 3 * 24 * 60 * 60 * 1000),
				end
			};
		case 'last_7_days':
			return {
				start: new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000),
				end
			};
		case 'last_2_weeks':
			return {
				start: new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000),
				end
			};
		case 'last_month':
			return {
				start: new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000),
				end
			};
	}
};

const resolveTimeRange = (time: LogTimeFilter) =>
	time.kind === 'range'
		? {
				start: new Date(time.startAtUtc),
				end: new Date(time.endAtUtc)
			}
		: resolvePresetRange(time.preset);

export { resolveTimeRange };
