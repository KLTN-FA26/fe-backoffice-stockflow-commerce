---
name: zod-br-schema
description: Build StockFlow zod DTO/input schemas and lifecycle transition tables with traceable BR citations and tests. Use for schema validation, business-rule encoding, or lifecycle work.
---

# Traceable zod schemas and business rules

The user's explicit instructions take precedence over this workflow.

Read the matching module document under `D:\FPTU\Capstone\docs\docs\`, list every relevant
`BR-xx`, and confirm exact field/status names from the existing domain constants and
`src/lib/mock-data.ts` without editing that file.

Keep two layers separate:

- `XDto`: backend response shape only.
- `XCreateInput`/`XUpdateInput`: outgoing form input, including applicable business-rule refine or
  superRefine logic.

Export types through `z.infer`; do not maintain handwritten duplicate interfaces. Reuse
`src/lib/validation/primitives.ts` for money, dates, barcodes, and location codes. Parse responses
once in the feature API boundary before data enters React Query.

Every encoded rule must have a nearby source comment in this form:

```ts
// BR-05 (docs 02-purchase-order §4): PO đã có Receipt thì không được huỷ
```

If the source is ambiguous, use `// ASSUMPTION (open-question Xn): ...` rather than inventing a
rule, and surface the open question to the user.

Copy lifecycle transitions exactly from the documented table. Represent every terminal state as
an empty array and ensure terminal UI exposes no mutating action. Prefer exhaustive matching when
the existing feature uses it.

Write tests for every documented state and each encoded BR, including terminal states and invalid
transitions. Target at least 90% coverage for feature selectors, schemas, and lifecycle modules.
