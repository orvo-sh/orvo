export type LogRecord = {
	timestamp: string;
	observed_timestamp: string;
	severity_number: number;
	severity_text: string;
	body: string;
	trace_id: string;
	span_id: string;
	trace_flags: number;
	resource_attributes: Record<string, string>;
	resource_schema_url: string;
	scope_name: string;
	scope_version: string;
	scope_attributes: Record<string, string>;
	scope_schema_url: string;
	log_attributes: Record<string, string>;
	service_name: string;
	deployment_environment: string;
};

export type LogFilters = {
	search: string;
	levels: string[];
	services: string[];
	scopes: string[];
	environments: string[];
	traceId: string;
};
