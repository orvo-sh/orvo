type TraceDisplayNameSource =
    | "original"
    | "derived_http_route"
    | "derived_http_path"
    | "derived_http_url"
    | "unknown";

type TraceDisplayNameRow = {
    id: string;
    trace_id: string;
    name?: string | null;
    root_span_id?: string | null;
    kind?: string | null;
    span_attributes?: Record<string, unknown> | string | null;
};

type TraceDisplayNameResult = {
    display_name: string;
    display_name_source: TraceDisplayNameSource;
    display_name_span_id?: string;
    original_name?: string;
};

const HTTP_METHODS = new Set([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
]);

const parseJsonObject = (value: unknown): Record<string, unknown> => {
    if (!value) return {};

    if (typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    if (typeof value !== "string") return {};

    try {
        const parsed = JSON.parse(value);

        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }

        return {};
    } catch {
        return {};
    }
};

const getAttr = (
    row: TraceDisplayNameRow,
    key: string,
): string | undefined => {
    const attributes = parseJsonObject(row.span_attributes);
    const value = attributes[key];

    if (value === null || value === undefined) return undefined;

    const stringValue = String(value).trim();

    return stringValue.length > 0 ? stringValue : undefined;
};

const getFirstAttr = (
    row: TraceDisplayNameRow,
    keys: string[],
): string | undefined => {
    for (const key of keys) {
        const value = getAttr(row, key);
        if (value) return value;
    }

    return undefined;
};

const isHttpMethod = (value: string | undefined) =>
    value ? HTTP_METHODS.has(value.toUpperCase()) : false;

const isGenericHttpName = (name: string | undefined, method?: string) => {
    const rawName = name?.trim();

    if (!rawName) return true;

    const upperName = rawName.toUpperCase();
    const upperMethod = method?.toUpperCase();

    if (upperMethod && upperName === upperMethod) return true;
    if (upperMethod && upperName === `HTTP ${upperMethod}`) return true;
    if (HTTP_METHODS.has(upperName)) return true;

    return (
        upperName === "HTTP" ||
        upperName === "HTTP REQUEST" ||
        upperName === "HTTP SERVER" ||
        upperName === "REQUEST"
    );
};

const normalizePath = (value: string) => {
    const [pathname] = value.split("?");

    return pathname
        .replace(/\/app_[a-z0-9]+/gi, "/:app_id")
        .replace(/\/org_[a-z0-9]+/gi, "/:org_id")
        .replace(/\/user_[a-z0-9]+/gi, "/:user_id")
        .replace(/\/trace_[a-z0-9]+/gi, "/:trace_id")
        .replace(/\/span_[a-z0-9]+/gi, "/:span_id")
        .replace(
            /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
            "/:id",
        )
        .replace(/\/[0-9a-f]{32}/gi, "/:id")
        .replace(/\/[0-9a-f]{16}/gi, "/:id")
        .replace(/\/\d{4,}(?=\/|$)/g, "/:id");
};

const pathFromUrl = (value: string) => {
    try {
        return new URL(value).pathname;
    } catch {
        return undefined;
    }
};

const getHttpParts = (row: TraceDisplayNameRow) => {
    const method = getFirstAttr(row, [
        "http.request.method",
        "http.method",
    ])?.toUpperCase();

    const route = getFirstAttr(row, ["http.route"]);

    const path = getFirstAttr(row, [
        "url.path",
        "http.target",
        "http.path",
    ]);

    const url = getFirstAttr(row, ["url.full", "http.url"]);

    return {
        method,
        route,
        path,
        url,
    };
};

const getTraceDisplayName = (
    row: TraceDisplayNameRow,
): TraceDisplayNameResult => {
    const originalName = row.name?.trim() || "Unnamed trace";
    const { method, route, path, url } = getHttpParts(row);

    if (!isHttpMethod(method)) {
        return {
            display_name: originalName,
            display_name_source: originalName ? "original" : "unknown",
            display_name_span_id: row.root_span_id ?? undefined,
            original_name: originalName,
        };
    }

    if (route) {
        return {
            display_name: `${method} ${normalizePath(route)}`,
            display_name_source: "derived_http_route",
            display_name_span_id: row.root_span_id ?? undefined,
            original_name: originalName,
        };
    }

    if (path && isGenericHttpName(originalName, method)) {
        return {
            display_name: `${method} ${normalizePath(path)}`,
            display_name_source: "derived_http_path",
            display_name_span_id: row.root_span_id ?? undefined,
            original_name: originalName,
        };
    }

    if (url && isGenericHttpName(originalName, method)) {
        const parsedPath = pathFromUrl(url);

        if (parsedPath) {
            return {
                display_name: `${method} ${normalizePath(parsedPath)}`,
                display_name_source: "derived_http_url",
                display_name_span_id: row.root_span_id ?? undefined,
                original_name: originalName,
            };
        }
    }

    return {
        display_name: originalName,
        display_name_source: "original",
        display_name_span_id: row.root_span_id ?? undefined,
        original_name: originalName,
    };
};

export { getTraceDisplayName, type TraceDisplayNameResult };
