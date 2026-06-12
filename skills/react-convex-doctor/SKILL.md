---
name: react-convex-doctor
description: Use when finishing a feature, fixing a bug, before committing Convex or React code, after editing convex/ functions or schema, or when the user types `/convex-doctor` or `/doctor`, asks to scan, triage, or clean up Convex/React diagnostics. Covers Convex security (validators, auth, internal functions), db query performance, schema design, React client hooks, and general React health. Includes a regression check and a full local triage workflow.
version: "0.1.1"
---

# React Convex Doctor

Scans Convex backends (functions, schemas, scheduling, client hooks) and React
codebases for security, correctness, performance, and architecture issues.
Outputs a 0–100 health score. Fully offline by default: the score is computed
locally and no diagnostics leave the machine.

## After making Convex or React code changes:

Run `npx react-convex-doctor@latest --verbose --scope changed` and check the
score did not regress. If the score dropped, fix the regressions before
committing.

## Scan modes — pick deliberately

On a project with a `convex` dependency the default is **Convex-first**: the
39 `convex-*` rules plus framework-agnostic JS rules run, and React-runtime
rules stay off so the report focuses on the backend.

```bash
npx react-convex-doctor@latest --verbose                 # Convex-first (default)
npx react-convex-doctor@latest --verbose --react-rules   # Convex + full React rule set
```

Use `--react-rules` when the change touched React components/hooks, or when
the user asks for a full sweep. The report prints a reminder line whenever
React rules were skipped.

## /convex-doctor — full local triage workflow

When the user types `/convex-doctor` (or `/doctor`), says "run convex doctor",
or asks for a full triage / cleanup pass:

1. **Scan**: `npx react-convex-doctor@latest --verbose` (add `--react-rules`
   for full-stack passes). Capture the score.
2. **Triage** errors first, then warnings, grouping by rule. For each group
   decide: true positive, false positive, or needs-human-review, with
   high/medium/low confidence. Read the flagged code before deciding —
   confidence requires code context.
3. **Fix** true positives using the recommendation attached to each finding —
   every `convex-*` rule links the relevant https://docs.convex.dev page
   (validators, auth checks, `internal.*` scheduling, `.withIndex` over
   `.filter`, pagination over unbounded `.collect()`, `Id<"table">` typing,
   `"skip"` for conditional queries). Fix the underlying code; never suppress
   a rule without evidence from the file in question.
4. **Prioritize Convex security errors** — unvalidated public args, missing
   auth checks, `api.*` scheduled from crons/scheduler, client-supplied user
   IDs — these are exploitable, not stylistic.
5. **Validate**: re-run `npx react-convex-doctor@latest --verbose --scope changed`
   plus the project's tests after each focused batch. Confirm the score
   improved and no new findings appeared.
6. Edit the working tree directly — never commit or open PRs unless asked.
   For confirmed issues you cannot fix now, list them with rule, file:line,
   confidence, and proposed fix.

## Configuring or explaining rules

When the user wants to understand a rule, disagrees with one, or wants to
disable / tune which rules run (not fix code), read
[references/explain.md](references/explain.md) and follow it. Start with
`npx react-convex-doctor@latest rules explain <rule>`, then apply the
narrowest control via `npx react-convex-doctor@latest rules
disable|set|category|ignore-tag …`, which edits your `doctor.config.*` (or
`package.json#reactDoctor`).

## Command

```bash
npx react-convex-doctor@latest --verbose --scope changed
```

| Flag              | Purpose                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `.`               | Scan current directory (monorepo roots get a workspace picker)    |
| `--verbose`       | Show affected files and line numbers per rule                     |
| `--react-rules`   | Also run the full React rule set (default: Convex-first, off)     |
| `--scope changed` | Only report issues introduced vs the base branch (default: full)  |
| `--scope lines`   | Only report issues on the changed lines                           |
| `--score`         | Output only the numeric score                                     |
| `--json`          | Machine-readable report (includes per-finding `recommendation`)   |
| `--project <n>`   | Pick a workspace project non-interactively (e.g. `@taskr/convex`) |
