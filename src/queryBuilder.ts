// ----------------------------------
// ERROR
// ----------------------------------
export class QueryBuilderError extends Error {
    code: string;
    details?: any;

    constructor(message: string, code: string, details?: any) {
        super(message);
        this.code = code;
        this.details = details;
    }
}

// ----------------------------------
// TYPES (OPTIONAL FOR JS USERS)
// ----------------------------------
export type SearchOperator = "contains" | "startsWith" | "endsWith" | "equals";

export type SearchField = {
    field: string;
    model?: string;
    operator?: SearchOperator;
    type?: "string" | "number" | "boolean" | "enum";
    enumValues?: string[];
};

export type FilterField = {
    key: string;
    field: string;
    model?: string;
    type?: "string" | "number" | "boolean" | "date" | "enum";
    enumValues?: string[];
};

export type SortField = {
    key: string;
    field: string;
    model?: string;
};

export interface BuildQueryOptions {
    query: Record<string, any>;

    searchFields?: SearchField[];
    filterFields?: FilterField[];
    sortFields?: SortField[];

    defaultSort?: { key: string; order: "asc" | "desc" };

    softDelete?: {
        field: string;
        value: any;
    };

    strict?: boolean;
    allowedQueryKeys?: string[];
    dateParser?: (value: string) => Date;
}

// ----------------------------------
// HELPERS
// ----------------------------------
function isPlainObject(v: any): v is Record<string, any> {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isNullString(v: any) {
    return typeof v === "string" && v.trim().toLowerCase() === "null";
}

function buildNestedObject(path: string, field: string, value: any) {
    const parts = path.split(".");
    let obj: any = { [field]: value };
    for (let i = parts.length - 1; i >= 0; i--) {
        obj = { [parts[i]]: obj };
    }
    return obj;
}

function deepMerge(target: any, source: any) {
    for (const key of Object.keys(source)) {
        if (isPlainObject(source[key]) && isPlainObject(target[key])) {
            target[key] = deepMerge({ ...target[key] }, source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

function parseSort(sort?: string) {
    if (!sort) return [];
    return sort.split(",").map((s) => {
        const [key, order] = s.split(":").map(v => v.trim());
        return { key, order: order === "desc" ? "desc" : "asc" };
    });
}

function parseSearchValue(raw: string, field: SearchField) {
    switch (field.type) {
        case "number": {
            const n = Number(raw);
            if (isNaN(n)) {
                throw new QueryBuilderError(
                    `Search value '${raw}' is not a valid number for field '${field.field}'`,
                    "INVALID_SEARCH_NUMBER"
                );
            }
            return n;
        }

        case "boolean":
            if (raw === "true" || raw === "1") return true;
            if (raw === "false" || raw === "0") return false;
            throw new QueryBuilderError(
                `Search value '${raw}' is not a valid boolean for field '${field.field}'`,
                "INVALID_SEARCH_BOOLEAN"
            );

        case "enum":
            if (field.enumValues && !field.enumValues.includes(raw)) {
                throw new QueryBuilderError(
                    `Invalid enum value '${raw}' for search field '${field.field}'`,
                    "INVALID_SEARCH_ENUM",
                    { allowed: field.enumValues }
                );
            }
            return raw;

        default:
            return raw;
    }
}

function parseFilterValue(
    raw: any,
    field: FilterField,
    dateParser?: (v: string) => Date
) {
    if (isNullString(raw)) return null;

    switch (field.type) {
        case "number":
            return Number(raw);

        case "boolean":
            if (raw === true || raw === false) return raw;
            if (raw === "1" || raw === "0") return raw === "1";
            if (raw === "true" || raw === "false") return raw === "true";
            throw new QueryBuilderError(
                `Invalid boolean value '${raw}' for filter '${field.key}'`,
                "INVALID_BOOLEAN"
            );

        case "date": {
            const d = dateParser ? dateParser(raw) : new Date(raw);
            if (isNaN(d.getTime())) {
                throw new QueryBuilderError(
                    `Invalid date value '${raw}' for filter '${field.key}'`,
                    "INVALID_DATE"
                );
            }
            return d;
        }

        case "enum":
            if (field.enumValues && !field.enumValues.includes(raw)) {
                throw new QueryBuilderError(
                    `Invalid enum value '${raw}' for filter '${field.key}'`,
                    "INVALID_ENUM",
                    { allowed: field.enumValues }
                );
            }
            return raw;

        default:
            return raw;
    }
}

// ----------------------------------
// MAIN
// ----------------------------------
export function buildPrismaQuery({
    query,
    searchFields = [],
    filterFields = [],
    sortFields = [],
    defaultSort,
    softDelete,
    strict = true,
    allowedQueryKeys = [],
    dateParser,
}: BuildQueryOptions) {

    // ----------------------------------
    // STRICT QUERY KEY VALIDATION
    // ----------------------------------
    if (strict) {
        const allowedKeys = new Set<string>([
            "search",
            "sort",
            ...filterFields.map(f => f.key),
            ...filterFields.map(f => `${f.key}_min`),
            ...filterFields.map(f => `${f.key}_max`),
            ...allowedQueryKeys,
        ]);

        for (const key of Object.keys(query)) {
            if (!allowedKeys.has(key)) {
                throw new QueryBuilderError(
                    `Invalid filter key '${key}'`,
                    "INVALID_FILTER_KEY",
                    { allowed: Array.from(allowedKeys) }
                );
            }
        }
    }

    // ----------------------------------
    // SEARCH (OR SAFE + META WARNINGS)
    // ----------------------------------
    const OR: any[] = [];
    const ignoredSearchFields: any[] = [];
    const allowedOperators: SearchOperator[] = [
        "contains",
        "startsWith",
        "endsWith",
        "equals"
    ];

    if (query.search && searchFields.length) {
        const q = String(query.search).trim();

        if (q) {
            for (const s of searchFields) {

                if (strict && s.type && s.type !== "string" && s.operator) {
                    throw new QueryBuilderError(
                        `Search operator '${s.operator}' cannot be used with non-string field '${s.field}'`,
                        "INVALID_SEARCH_OPERATOR_USAGE"
                    );
                }

                let parsed: any;

                try {
                    parsed = parseSearchValue(q, s);
                } catch (err: any) {
                    ignoredSearchFields.push({
                        field: s.field,
                        value: q,
                        reason: err.code ?? "INVALID_SEARCH_VALUE"
                    });
                    continue; // OR-safe skip
                }

                const operator = s.operator ?? "contains";

                if (s.type && s.type !== "string") {
                    OR.push(
                        s.model
                            ? buildNestedObject(s.model, s.field, parsed)
                            : { [s.field]: parsed }
                    );
                    continue;
                }

                if (strict && !allowedOperators.includes(operator)) {
                    throw new QueryBuilderError(
                        `Invalid search operator '${operator}'`,
                        "INVALID_SEARCH_OPERATOR"
                    );
                }

                const value =
                    operator === "equals"
                        ? parsed
                        : { [operator]: parsed, mode: "insensitive" };

                OR.push(
                    s.model
                        ? buildNestedObject(s.model, s.field, value)
                        : { [s.field]: value }
                );
            }

            if (OR.length === 0 && ignoredSearchFields.length) {
                throw new QueryBuilderError(
                    "Search value is incompatible with all configured search fields",
                    "INVALID_SEARCH_VALUE",
                    { ignoredSearchFields }
                );
            }
        }
    }

    // ----------------------------------
    // FILTERS
    // ----------------------------------
    let filters: any = {};

    for (const f of filterFields) {
        const exactValue = query[f.key];
        const minValue = query[`${f.key}_min`];
        const maxValue = query[`${f.key}_max`];

        if (strict && exactValue !== undefined && (minValue !== undefined || maxValue !== undefined)) {
            throw new QueryBuilderError(
                `Cannot use '${f.key}' together with '${f.key}_min' or '${f.key}_max'`,
                "INVALID_RANGE_USAGE"
            );
        }

        if (minValue !== undefined || maxValue !== undefined) {
            if (minValue !== undefined) {
                const val = parseFilterValue(minValue, f, dateParser);
                filters = deepMerge(
                    filters,
                    f.model
                        ? buildNestedObject(f.model, f.field, { gte: val })
                        : { [f.field]: { ...(filters[f.field] || {}), gte: val } }
                );
            }

            if (maxValue !== undefined) {
                const val = parseFilterValue(maxValue, f, dateParser);
                filters = deepMerge(
                    filters,
                    f.model
                        ? buildNestedObject(f.model, f.field, { lte: val })
                        : { [f.field]: { ...(filters[f.field] || {}), lte: val } }
                );
            }
            continue;
        }

        if (exactValue !== undefined && exactValue !== "" && exactValue !== null) {
            if (typeof exactValue === "string" && exactValue.includes(",")) {
                const arr = exactValue
                    .split(",")
                    .map(v => parseFilterValue(v.trim(), f, dateParser));

                filters = deepMerge(
                    filters,
                    f.model
                        ? buildNestedObject(f.model, f.field, { in: arr })
                        : { [f.field]: { in: arr } }
                );
            } else {
                const parsed = parseFilterValue(exactValue, f, dateParser);
                filters = deepMerge(
                    filters,
                    f.model
                        ? buildNestedObject(f.model, f.field, parsed)
                        : { [f.field]: parsed }
                );
            }
        }
    }

    // ----------------------------------
    // SORT
    // ----------------------------------
    let orderBy: any[] = [];
    const sortItems = parseSort(query.sort);

    const finalSort =
        sortItems.length > 0
            ? sortItems
            : defaultSort
                ? [defaultSort]
                : [];

    for (const s of finalSort) {
        const cfg = sortFields.find(sf => sf.key === s.key);
        if (!cfg) {
            throw new QueryBuilderError(
                `Invalid sort key '${s.key}'`,
                "INVALID_SORT_KEY",
                { allowed: sortFields.map(sf => sf.key) }
            );
        }

        orderBy.push(
            cfg.model
                ? buildNestedObject(cfg.model, cfg.field, s.order)
                : { [cfg.field]: s.order }
        );
    }

    // ----------------------------------
    // WHERE COMPOSITION
    // ----------------------------------
    const AND: any[] = [];

    if (softDelete) {
        AND.push({ [softDelete.field]: softDelete.value });
    }

    if (Object.keys(filters).length) AND.push(filters);
    if (OR.length) AND.push({ OR });

    return {
        where: AND.length ? { AND } : {},
        orderBy,
        meta: ignoredSearchFields.length
            ? { ignoredSearchFields }
            : undefined,
    };
}
