import { z } from "zod";

import { alertRuleInputSchema } from "./schema";

const validateRuleConfig = (input: z.infer<typeof alertRuleInputSchema>) => {
  if (input.signalType === "apdex" && !input.apdexTargetMs) {
    return "Apdex rules require an apdex target.";
  }

  if (input.signalType !== "apdex" && input.apdexTargetMs) {
    return "Only apdex rules can set an apdex target.";
  }

  if (
    (input.signalType === "error_rate" ||
      input.signalType === "availability_percent" ||
      input.signalType === "apdex" ||
      input.signalType === "host_cpu_utilization" ||
      input.signalType === "host_memory_utilization" ||
      input.signalType === "host_filesystem_utilization" ||
      input.signalType === "container_cpu_utilization" ||
      input.signalType === "container_memory_utilization") &&
    (input.threshold < 0 || input.threshold > 100)
  ) {
    return "This signal expects a threshold between 0 and 100.";
  }

  return null;
};

const uniqueValues = (values: string[]) => Array.from(new Set(values));

const defaultAlertRules = [
  {
    name: "High error rate",
    signalType: "error_rate",
    comparator: "gt",
    threshold: 5,
    windowMinutes: 5,
    renotifyMinutes: 15,
    apdexTargetMs: null,
  },
  {
    name: "High p95 latency",
    signalType: "latency_p95_ms",
    comparator: "gt",
    threshold: 1000,
    windowMinutes: 15,
    renotifyMinutes: 30,
    apdexTargetMs: null,
  },
  {
    name: "High p99 latency",
    signalType: "latency_p99_ms",
    comparator: "gt",
    threshold: 2000,
    windowMinutes: 15,
    renotifyMinutes: 30,
    apdexTargetMs: null,
  },
  {
    name: "Low apdex",
    signalType: "apdex",
    comparator: "lt",
    threshold: 0.9,
    windowMinutes: 15,
    renotifyMinutes: 30,
    apdexTargetMs: 300,
  },
] as const;

export { defaultAlertRules, uniqueValues, validateRuleConfig };
