const BYTES_PER_GB = 1_000_000_000;

const billingSignals = ['logs', 'metrics', 'traces'] as const;

const billingUsageThresholds = [70, 85, 100] as const;

const billingStatusesWithAccess = ['active', 'trialing'] as const;

type BillingSignal = (typeof billingSignals)[number];
type BillingThreshold = (typeof billingUsageThresholds)[number];
type BillingAccessStatus = (typeof billingStatusesWithAccess)[number];

type BillingPlanKey = 'none' | 'starter' | 'pro' | 'enterprise';

const billingPlanConfig = {
	none: {
		key: 'none',
		name: 'No plan',
		priceLabel: null,
		retentionDays: {
			logs: 30,
			metrics: 30,
			traces: 30
		},
		includedGbPerSignal: {
			logs: 0,
			metrics: 0,
			traces: 0
		},
		overagePricePerGb: null
	},
	starter: {
		key: 'starter',
		name: 'Starter',
		priceLabel: '$19 / month',
		retentionDays: {
			logs: 30,
			metrics: 30,
			traces: 30
		},
		includedGbPerSignal: {
			logs: 50,
			metrics: 50,
			traces: 50
		},
		overagePricePerGb: null
	},
	pro: {
		key: 'pro',
		name: 'Pro',
		priceLabel: '$49 / month',
		retentionDays: {
			logs: 30,
			metrics: 30,
			traces: 30
		},
		includedGbPerSignal: {
			logs: 250,
			metrics: 250,
			traces: 250
		},
		overagePricePerGb: 0.32
	},
	enterprise: {
		key: 'enterprise',
		name: 'Enterprise',
		priceLabel: 'Custom',
		retentionDays: {
			logs: 30,
			metrics: 30,
			traces: 30
		},
		includedGbPerSignal: {
			logs: 0,
			metrics: 0,
			traces: 0
		},
		overagePricePerGb: null
	}
} as const satisfies Record<
	BillingPlanKey,
	{
		key: BillingPlanKey;
		name: string;
		priceLabel: string | null;
		retentionDays: Record<BillingSignal, number>;
		includedGbPerSignal: Record<BillingSignal, number>;
		overagePricePerGb: number | null;
	}
>;

const billingStatusHasAccess = (status: string | null | undefined): status is BillingAccessStatus =>
	typeof status === 'string' &&
	(billingStatusesWithAccess as readonly string[]).includes(status);

const getIncludedBytesForPlan = (planKey: BillingPlanKey, signal: BillingSignal) =>
	billingPlanConfig[planKey].includedGbPerSignal[signal] * BYTES_PER_GB;

export {
	BYTES_PER_GB,
	billingPlanConfig,
	billingSignals,
	billingStatusHasAccess,
	billingUsageThresholds,
	getIncludedBytesForPlan
};
export type { BillingAccessStatus, BillingPlanKey, BillingSignal, BillingThreshold };
