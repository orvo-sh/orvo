import type { MetricAggregation } from "./metric-definitions";

const alertComparatorOptions = [
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater than or equal to" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less than or equal to" },
] as const;

type AlertComparatorValue = (typeof alertComparatorOptions)[number]["value"];

type AlertRuleFormValue = {
  name: string;
  metricName: string | null;
  metricAggregation: MetricAggregation | null;
  metricType: string | null;
  metricIsMonotonic: boolean;
  metricUnit: string | null;
  metricAttributeFilters: Record<
    string,
    { include: string[]; exclude: string[] }
  >;
  comparator: AlertComparatorValue;
  threshold: number;
  windowMinutes: number;
  renotifyMinutes: number | null;
  scope: {
    services: { include: string[]; exclude: string[] };
    spanNames: { include: string[]; exclude: string[] };
    environments: { include: string[]; exclude: string[] };
    scopes: { include: string[]; exclude: string[] };
    containerNames: { include: string[]; exclude: string[] };
  };
  destinationIds: string[];
};

const createEmptyAlertRuleForm = (): AlertRuleFormValue => ({
  name: "",
  metricName: null,
  metricType: null,
  metricIsMonotonic: false,
  metricAggregation: null,
  metricUnit: null,
  metricAttributeFilters: {},
  comparator: "gt",
  threshold: 5,
  windowMinutes: 5,
  renotifyMinutes: 15,
  scope: {
    services: { include: [], exclude: [] },
    spanNames: { include: [], exclude: [] },
    environments: { include: [], exclude: [] },
    scopes: { include: [], exclude: [] },
    containerNames: { include: [], exclude: [] },
  },
  destinationIds: [],
});

const getAlertRuleFormFingerprint = (form: AlertRuleFormValue) => {
  const sortedFilters = (
    filters: Record<string, { include: string[]; exclude: string[] }>,
  ) =>
    Object.keys(filters)
      .sort()
      .map((key) => [
        key,
        [...filters[key].include].sort(),
        [...filters[key].exclude].sort(),
      ]);
  return JSON.stringify([
    form.name,
    form.metricName,
    form.metricAggregation,
    form.metricUnit,
    form.metricType,
    form.metricIsMonotonic,
    form.comparator,
    form.threshold,
    form.windowMinutes,
    form.renotifyMinutes,
    sortedFilters(form.scope),
    sortedFilters(form.metricAttributeFilters),
    [...form.destinationIds].sort(),
  ]);
};

export {
  alertComparatorOptions,
  createEmptyAlertRuleForm,
  getAlertRuleFormFingerprint,
};
export type { AlertComparatorValue, AlertRuleFormValue };
