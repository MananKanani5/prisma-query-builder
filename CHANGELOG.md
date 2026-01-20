# Changelog

## [1.0.1] – 2026-01-16

### ✨ Added

- **Allowed Query Keys Support**
  - Introduced `allowedQueryKeys` option.
  - Enables strict-mode compatibility with pagination and custom query parameters (e.g. `page`, `limit`, `cursor`).
  - Allowed keys pass validation but are ignored by the query builder.

- **Type-aware Search**
  - Search fields now support explicit types:
    - `string` (default)
    - `number`
    - `boolean`
    - `enum`
  - Prevents invalid Prisma queries and runtime errors.

- **Search Meta Feedback**
  - The query builder now returns a `meta` object.
  - When search fields are skipped due to type incompatibility, details are reported instead of failing silently.

---

### 🔄 Changed

- **Search Logic Is Now Type-safe**
  - Search operators (`contains`, `startsWith`, etc.) are restricted to string fields only.
  - Using operators with non-string search fields throws an error in strict mode.

- **Improved Mixed-type Search Behavior**
  - Search remains OR-based.
  - If some search fields are incompatible with the input value, they are skipped.
  - Compatible fields still participate in the query.
  - Queries no longer fail due to partial incompatibility.

- **Strict Mode Refinements**
  - Maintains early failure for invalid input.
  - Avoids breaking valid OR-based searches when mixed field types are used.

---

### 🛠 Internal Improvements

- Clear separation between:
  - search parsing
  - filter parsing
  - query validation
- Improved error signaling for search-related issues.
- More predictable and debuggable query construction.

---

### ⚠️ Notes

- No breaking changes.
- Fully backward-compatible with `v1.0.0`.
- Pagination logic remains completely unaffected by the query builder.
