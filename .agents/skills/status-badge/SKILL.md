---
name: status-badge
description: Add or debug StockFlow status values and badge colors through the canonical status map. Use when wiring status UI, adding a status, or diagnosing a wrong StatusBadge tone.
---

# StatusBadge and the canonical status map

The user's explicit instructions take precedence over this workflow.

`src/lib/status-map.ts` is canonical. It owns `TONE`, `toneOf()`, and `STATUS_LABEL_VI`.
`src/lib/domain/status-map.ts` only re-exports it. Never special-case a status inside
`src/components/shared/StatusBadge.tsx`.

When adding a status:

1. Copy the exact English status string from the matching business document under
   `D:\FPTU\Capstone\docs\docs\`; confirm the current union in `src/constants/statuses.ts` or
   mock data. Do not translate, normalize spacing, or change case.
2. Add it once to the correct `TONE` group in `src/lib/status-map.ts`.
3. Add its Vietnamese display label to `STATUS_LABEL_VI`; keep the original English value as the
   code/data contract.
4. Use `<StatusBadge domain="..." status={...} />` in UI and run relevant tests.

Tone priority is `special > danger > positive > warning > info > muted > neutral`:

- special: refund or production/print distinctions
- danger: failure, cancellation, rejection, out of stock
- positive: success, approval, completion, delivery
- warning: blocking wait, hold, quarantine, low stock
- info: active progress or transit
- muted: normally closed, inactive, archived, voided
- neutral: draft, created, generic pending, new

For wrong colors, check exact-string matching, missing entries, duplicate tone membership, and
semantic CSS variables. Do not create module-specific badges or apply green/red/yellow utility
classes directly to status text.
