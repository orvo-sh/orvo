const getMetricAttributeColumns = (trace: boolean): Record<string, string> => ({
  "service.name": "service_name",
  "deployment.environment": "deployment_environment",
  "scope.name": "scope_name",
  "scope.version": "scope_version",
  ...(trace
    ? { "operation.name": "name" }
    : { "container.name": "container_name", "container.id": "container_id" }),
});

export { getMetricAttributeColumns };
