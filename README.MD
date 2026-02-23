# Prisma Query Builder

![TypeScript](https://img.shields.io/badge/TypeScript-Supported-blue)
![Prisma](https://img.shields.io/badge/Prisma-Compatible-2D3748)

A lightweight, opinionated utility that converts HTTP query parameters into **safe, validated Prisma `where` and `orderBy` objects**.

It eliminates repetitive filtering, searching, sorting, and validation logic across backend services.

> ✅ Listed in the Prisma Ecosystem  
> https://www.prisma.io/ecosystem

---

# 🚀 What Problem Does This Solve?

Most backend services repeatedly implement:

- Manual filter parsing
- Manual sort parsing
- Search logic
- Nested relation handling
- Query validation
- Type conversions (date, boolean, enum, number)
- Edge-case handling

This often leads to:

- Duplicate logic
- Silent failures
- Inconsistent behavior
- Hard-to-maintain services

This package centralizes and standardizes that logic.

---

# 🧠 What This Package Does

It converts HTTP query parameters into:

- `where`
- `orderBy`
- optional `meta` (search warnings)

It does NOT:

- Execute Prisma queries
- Replace Prisma
- Act as an ORM

It is strictly a query builder.

---

# 📦 Installation

```bash
npm install prisma-qb
```

---

# ⚡ Quick Start

```ts
import { buildPrismaQuery } from "prisma-qb";

const { where, orderBy } = buildPrismaQuery({
  query: req.query,
  filterFields: [{ key: "isActive", field: "isActive", type: "boolean" }],
});

await prisma.user.findMany({
  where,
  orderBy,
});
```

That’s it.

---

# 🎛 Core Design Principle

Each endpoint explicitly defines:

- Which fields are filterable
- Which fields are searchable
- Which fields are sortable

The builder enforces those rules.

This ensures:

- Safe APIs
- Predictable behavior
- Clean services
- No accidental data exposure

---

# 🔍 Search

Search is:

- OR-based
- Type-aware
- Strict by default
- Fail-safe

If a search value is incompatible with a field:

- That field is skipped
- The skip is reported in `meta`

If all fields are incompatible:

- The query fails early

---

## Supported Search Types

- `string` (default)
- `number`
- `boolean`
- `enum`

---

## Supported String Operators

- `contains` (default)
- `startsWith`
- `endsWith`
- `equals`

Operators cannot be used on non-string fields.

---

## Search Configuration

```ts
searchFields: [
  { field: "firstName" }, // string (default)
  { field: "email", operator: "startsWith" }, // string with operator
  { field: "id", type: "number" }, // number
  { field: "isActive", type: "boolean" }, // boolean
  { field: "status", type: "enum", enumValues: ["ACTIVE", "INACTIVE"] },
];
```

---

## Example Request

```
GET /users?search=john
```

---

## Generated Prisma

```ts
{
  where: {
    AND: [
      {
        OR: [
          { firstName: { contains: "john", mode: "insensitive" } },
          { email: { startsWith: "john", mode: "insensitive" } },
        ],
      },
    ];
  }
}
```

---

## `meta` Return Structure

If some fields are incompatible:

```json
{
  "meta": {
    "ignoredSearchFields": [
      {
        "field": "id",
        "value": "john",
        "reason": "INVALID_SEARCH_NUMBER"
      }
    ]
  }
}
```

---

# 🎛 Filters

Filters support:

- Exact match
- IN (comma-separated values)
- Range (`_min`, `_max`)

---

## Supported Types

- `string`
- `number`
- `boolean`
- `date`
- `enum`

---

## Filter Configuration

```ts
filterFields: [
  {
    key: "status",
    field: "status",
    type: "enum",
    enumValues: ["ACTIVE", "INACTIVE"],
  },
  { key: "age", field: "age", type: "number" },
  { key: "isActive", field: "isActive", type: "boolean" },
  { key: "created_at", field: "createdAt", type: "date" },
];
```

---

## Exact Match

```
GET /users?isActive=true
```

```ts
{
  isActive: true
}
```

---

## IN Filter

```
GET /users?status=ACTIVE,INACTIVE
```

```ts
{ status: { in: ["ACTIVE", "INACTIVE"] } }
```

---

## Range Filter

```
GET /users?age_min=18&age_max=30
```

```ts
{
  age: {
    gte: 18,
    lte: 30
  }
}
```

Exact value and range filters cannot be used together.

---

# 🔃 Sorting

Supports:

- Single field
- Multiple fields
- Ascending / Descending
- Nested relations
- Default sort

---

## Sort Configuration

```ts
sortFields: [
  { key: "firstName", field: "firstName" },
  { key: "createdAt", field: "createdAt" },
  { key: "departmentName", model: "department", field: "departmentName" },
]
```

---

## Sort Request

```
GET /users?sort=createdAt:desc,firstName:asc
```

---

## Default Sort

```ts
defaultSort: { key: "createdAt", order: "desc" }
```

If no sort is provided, default sort is applied.

---

# 🧬 Nested Relations

Nested relations are supported in:

- Search
- Filters
- Sorting

Use `model` to define relation path.

```ts
filterFields: [
  { key: "departmentId", model: "department", field: "id", type: "number" },
];
```

Automatically generates:

```ts
{
  department: {
    id: 3
  }
}
```

Nested paths also support dot notation internally.

---

# 🗑 Soft Delete Support

You can automatically enforce soft delete conditions.

```ts
softDelete: {
  field: "isDeleted",
  value: false
}
```

This condition is always added to the final `AND` clause.

---

# 🔒 Strict Mode (Default)

Strict mode prevents:

- Unknown query parameters
- Invalid filter keys
- Invalid sort keys
- Invalid search operators
- Invalid enum values
- Invalid boolean values
- Invalid date values
- Conflicting range usage

Disable only if absolutely required:

```ts
buildPrismaQuery({
  query,
  strict: false,
});
```

---

# 🔑 Allowed Query Keys

Allow extra query parameters without failing strict validation.

```ts
buildPrismaQuery({
  query,
  allowedQueryKeys: ["page", "limit"],
});
```

These keys are allowed but ignored by the builder.

---

# 🧩 Return Structure

`buildPrismaQuery` returns:

```ts
{
  where,
  orderBy,
  meta? // optional
}
```

Where structure is composed as:

```ts
{
  AND: [
    softDeleteCondition?,
    filters?,
    { OR: searchConditions }?
  ]
}
```

---

# 🧪 Error Handling

All errors throw `QueryBuilderError`.

Example:

```json
{
  "code": "INVALID_SORT_KEY",
  "message": "Invalid sort key 'cretaedAt'",
  "details": {
    "allowed": ["firstName", "createdAt"]
  }
}
```

The system always fails early and never silently ignores invalid input.

---

# 🏗 Design Philosophy

- Explicit configuration
- Fail early
- No silent behavior
- Prisma-first
- Minimal abstraction
- Service-level control
- No feature bloat

---

# ⚠️ Limitations

- Prisma only
- Does not execute database queries

---

# 📘 Full Example

```ts
import { buildPrismaQuery } from "prisma-qb";

const { where, orderBy } = buildPrismaQuery({
  query: req.query,

  searchFields: [{ field: "firstName" }, { field: "email" }],

  filterFields: [
    {
      key: "status",
      field: "status",
      type: "enum",
      enumValues: ["ACTIVE", "INACTIVE"],
    },
    { key: "age", field: "age", type: "number" },
  ],

  sortFields: [{ key: "createdAt", field: "createdAt" }],

  defaultSort: { key: "createdAt", order: "desc" },

  softDelete: {
    field: "isDeleted",
    value: false,
  },
});
```

---

# 👨🏽‍💻 Author

Full Stack Developer building scalable applications since 2020 with a strong focus on clean architecture, performance, and maintainability.

🌐 https://manankanani.in
💻 https://github.com/MananKanani5
🔗 https://www.linkedin.com/in/manan-kanani/

```

```
