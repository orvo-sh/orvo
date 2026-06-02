const alertSignalOptions = [
	{ value: 'error_rate', label: 'Error rate' },
	{ value: 'latency_p95_ms', label: 'P95 latency' },
	{ value: 'latency_p99_ms', label: 'P99 latency' },
	{ value: 'apdex', label: 'Apdex' },
	{ value: 'throughput_per_min', label: 'Throughput' },
	{ value: 'availability_percent', label: 'Availability' }
] as const;

const alertComparatorOptions = [
	{ value: 'gt', label: 'Greater than' },
	{ value: 'gte', label: 'Greater than or equal to' },
	{ value: 'lt', label: 'Less than' },
	{ value: 'lte', label: 'Less than or equal to' }
] as const;

const alertSignalDescriptions: Record<(typeof alertSignalOptions)[number]['value'], string> = {
	error_rate: 'Percent of entry spans with an error status.',
	latency_p95_ms: '95th percentile latency across matching entry spans.',
	latency_p99_ms: '99th percentile latency across matching entry spans.',
	apdex: 'Apdex score using the configured target latency.',
	throughput_per_min: 'Matching entry spans per minute across the rule window.',
	availability_percent: '100 minus the error rate percentage.'
};

type AlertSignalValue = (typeof alertSignalOptions)[number]['value'];
type AlertComparatorValue = (typeof alertComparatorOptions)[number]['value'];

type AlertRuleFormValue = {
	name: string;
	signalType: AlertSignalValue;
	comparator: AlertComparatorValue;
	threshold: number;
	windowMinutes: number;
	renotifyMinutes: number | null;
	apdexTargetMs: number | null;
	scope: {
		services: { include: string[]; exclude: string[] };
		spanNames: { include: string[]; exclude: string[] };
		environments: { include: string[]; exclude: string[] };
		scopes: { include: string[]; exclude: string[] };
	};
	destinationIds: string[];
};

const createEmptyAlertRuleForm = (): AlertRuleFormValue => ({
	name: '',
	signalType: 'error_rate',
	comparator: 'gt',
	threshold: 5,
	windowMinutes: 5,
	renotifyMinutes: 15,
	apdexTargetMs: null,
	scope: {
		services: { include: [], exclude: [] },
		spanNames: { include: [], exclude: [] },
		environments: { include: [], exclude: [] },
		scopes: { include: [], exclude: [] }
	},
	destinationIds: []
});

export {
	alertComparatorOptions,
	alertSignalDescriptions,
	alertSignalOptions,
	createEmptyAlertRuleForm
};
export type { AlertComparatorValue, AlertRuleFormValue, AlertSignalValue };
