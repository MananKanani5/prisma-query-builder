/**
 * prisma-query-builder
 * 
 * Converts HTTP query parameters into Prisma-compatible where and orderBy objects.
 */

// Main function
export { buildPrismaQuery } from "./queryBuilder";

// Error class
export { QueryBuilderError } from "./queryBuilder";

// Types
export type {
    SearchField,
    SearchOperator,
    FilterField,
    SortField,
    BuildQueryOptions,
} from "./queryBuilder";
