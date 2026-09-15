---
name: stockflow-validate
description: Run and report StockFlowCommerce's required build, lint, typecheck, and test validation. Use when the user asks to validate, verify, check readiness, or prove a code task is complete.
---

# Validate StockFlowCommerce

The user's explicit instructions take precedence over this workflow.

Run `pnpm run validate`, which executes typecheck, lint, tests, and build. If the combined command
obscures a failure, run these commands separately to isolate it:

```text
pnpm run build
pnpm run lint
pnpm run typecheck
pnpm run test
```

Never infer a pass. Preserve and summarize real command output, including test counts, warnings,
and the first useful error for any failed stage.

If validation fails, determine whether the failure is caused by the current task before editing
anything. Use the current diff and history first. Do not run `git stash`, reset files, or mutate
the user's worktree merely to construct a clean baseline without explicit permission. If a clean
baseline comparison is genuinely needed, explain why and request permission for the safest
isolated method.

Fix only failures introduced by the requested work when the task includes implementation. Report
pre-existing or out-of-scope failures without silently repairing them. Do not bypass checks with
`any`, `eslint-disable`, `@ts-ignore`, or unjustified casts.

Report each stage as pass/fail and state clearly whether the requested change is verified.
