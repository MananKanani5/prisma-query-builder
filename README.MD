# Prisma Query Builder

A **Lightweight** but powerful query builder that removes the need to manually write **sorting, searching, and filtering logic** in backend services.

You configure **what is allowed per API/service**, and the package builds **safe Prisma queries** from HTTP query parameters.


> ✅ **Listed in the Prisma Ecosystem**  
> https://www.prisma.io/ecosystem

---

## 📌 What This Package Does

This package converts HTTP query parameters into Prisma-compatible:

- `where`
- `orderBy`

So you don’t have to manually write:
- filtering logic
- sorting logic
- searching logic
- query validation logic
- nested Prisma query construction

---

## 🤔 Why Use This?

Without this package, every service usually:
- reimplements filtering logic
- reimplements sorting logic
- reimplements search logic
- handles edge cases differently
- silently ignores invalid input

With this package:
- logic is centralized
- behavior is consistent
- invalid input fails early
- services stay clean and readable

---

## 🧠 Important Design Principle

> **Query rules are defined per service.**

Each endpoint decides:
- which fields are filterable
- which fields are searchable
- which fields are sortable

This is intentional and makes the package:
- safer
- flexible
- suitable for large codebases

---

## ✨ Key Features

- ✅ No manual filter logic
- ✅ No manual sort logic
- ✅ No manual search logic
- ✅ Strict mode enabled by default
- ✅ Nested relation support
- ✅ Works with any Prisma model
- ✅ JavaScript & TypeScript support
- ❌ Does not execute queries

---

## 📦 Installation

```bash
npm install prisma-qb
```

---

## 🚀 Basic Usage

```ts
import { buildPrismaQuery } from "prisma-qb";

const { where, orderBy } = buildPrismaQuery({
  query: req.query,
  filterFields: [
    { key: "isActive", field: "isActive", type: "boolean" }
  ]
});

await prisma.user.findMany({
  where,
  orderBy
});
```

---

## 🔍 Search

Search is type-aware and OR-based.

- All configured search fields are combined using OR
- If some fields are incompatible, they are skipped
- If all fields are incompatible, an error is thrown
- By default, fields are treated as string unless a type is provided

This ensures:

- flexible searching
- no broken queries
- no silent failures

### Supported Search Types

- Case-insensitive text search
- Multiple fields
- Nested relation fields
- Custom operators per field

### Supported Data Types

- `string` (default)
- `number`
- `boolean`
- `enum`

### Supported Operators (string only)

- `contains` (default)
- `startsWith`
- `endsWith`
- `equals`

Search operators cannot be used with `number`, `boolean`, or `enum` fields. Doing so throws an error in strict mode.

---

### Search Configuration

```ts
searchFields: [
  { field: "firstName" },                       // string (default)
  { field: "email", operator: "startsWith" },   // string with operator
  { field: "id", type: "number" },              // number search
  { field: "isActive", type: "boolean" },       // boolean search
  { field: "status", type: "enum", enumValues: ["ACTIVE", "INACTIVE"] }
]
```

---

### Search Query Example

```http
GET /users?search=john
```

---

### Generated Prisma Query

```ts
{
  OR: [
    { firstName: { contains: "john", mode: "insensitive" } },
    { email: { startsWith: "john", mode: "insensitive" } }
  ]
}
```
> Only compatible fields participate in the query.

---

### Mixed-Type Search Behavior

If a search value is incompatible with some fields:
- compatible fields are applied
- incompatible fields are skipped
- skipped fields are reported via `meta`

If all fields are incompatible, the query fails early.

Example `meta` output:

```
{
  meta: {
    ignoredSearchFields: [
      {
        field: "id",
        value: "john",
        reason: "INVALID_SEARCH_NUMBER"
      }
    ]
  }
}

```
> `meta` is returned alongside `where` and `orderBy` from `buildPrismaQuery`.

---

## 🎛 Filters

### Supported Filter Operations

This package supports the following **filter operations**:

- **Exact match**
- **IN (comma-separated values)**
- **Range (`_min` / `_max`)**

These operations are automatically applied based on the query parameters.

---

### Supported Data Types

Filters can be applied on fields of the following types:

- `string`
- `number`
- `boolean`
- `date`
- `enum`

---

### Filter Configuration

```ts
filterFields: [
  { key: "status", field: "status", type: "enum", enumValues: ["ACTIVE", "INACTIVE"] },
  { key: "age", field: "age", type: "number" },
  { key: "isActive", field: "isActive", type: "boolean" },
  { key: "created_at", field: "createdAt", type: "date" }
]
```

---

### Exact Match Filter

```http
GET /users?isActive=true
```

```ts
{ isActive: true }
```

---

### IN Filter (comma-separated values)

```http
GET /users?status=ACTIVE,INACTIVE
```

```ts
{ status: { in: ["ACTIVE", "INACTIVE"] } }
```

---

### Range Filters (`_min` / `_max`)

```http
GET /users?created_at_min=2024-01-01&created_at_max=2024-01-31
```

```ts
{
  createdAt: {
    gte: new Date("2024-01-01"),
    lte: new Date("2024-01-31")
  }
}
```

> Exact value and range filters **cannot** be used together.

---

## 🔃 Sorting

### Supported Sort Features

- Single field sorting
- Multiple field sorting
- Ascending / descending order
- Nested relation sorting
- Default sort support

---

### Sort Configuration

```ts
sortFields: [
  { key: "firstName", field: "firstName" },
  { key: "createdAt", field: "createdAt" },
  { key: "departmentName", model: "department", field: "departmentName" }
]
```

---

### Sort Query Example

```http
GET /users?sort=createdAt:desc,firstName:asc
```

---

### Default Sort

```ts
defaultSort: { key: "createdAt", order: "desc" }
```

---

## 🧬 Nested Relations

Nested relations work across **search**, **filter**, and **sort**.

```ts
filterFields: [
  { key: "departmentId", model: "department", field: "id", type: "number" }
]
```

```http
GET /users?departmentId=3
```

Automatically generates nested Prisma queries.

---

## 🔑 Allowed Query Keys

By default, strict mode only allows known query parameters.

To allow additional parameters (e.g. pagination):

```
buildPrismaQuery({
  query,
  allowedQueryKeys: ["page", "limit"]
});
```

>These keys are ignored by the builder but allowed to pass validation.

---

## 🔒 Strict Mode (Default)

Strict mode is enabled by default.

It prevents:
- ❌ Unknown query parameters
- ❌ Invalid filter keys
- ❌ Invalid sort keys
- ❌ Invalid search operators
- ❌ Invalid enum / date / boolean values
- ❌ Conflicting range usage

Disable only if absolutely required:

```ts
buildPrismaQuery({ query, strict: false });
```

---

## 🧪 Error Handling

All errors are thrown as `QueryBuilderError`.

Example error:

```json
{
  "code": "INVALID_SORT_KEY",
  "message": "Invalid sort key 'cretaedAt'",
  "details": {
    "allowed": ["firstName", "createdAt"]
  }
}
```

---

## 🧠 Design Philosophy

- Explicit configuration
- Fail early
- No silent behavior
- Prisma-first
- Service-level control

---

## ⚠️ Limitations

- Prisma only
- Not an ORM replacement
- Does not execute database queries

---

## 👨🏽‍💻 About the Developer

I’m a **Full Stack Developer** building reliable and scalable web applications since 2020. I enjoy working across the entire stack—from UI design to backend logic—with a strong focus on clean architecture, performance, and maintainability. I regularly practice DSA to sharpen problem-solving skills and stay technically strong. Always open to meaningful collaborations and interesting projects.

**Profiles:**  
🌐 Portfolio: https://manankanani.in  
💻 GitHub: https://github.com/MananKanani5  
🔗 LinkedIn: https://www.linkedin.com/in/manan-kanani/
