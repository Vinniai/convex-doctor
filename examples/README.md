# Examples

Real-world projects to run `react-convex-doctor` against while developing rules.

## convex-nextjs (vendored)

The official Convex Next.js starter, vendored verbatim from
[get-convex/templates/template-nextjs](https://github.com/get-convex/templates/tree/main/template-nextjs)
(the same code `npm create convex@latest -- -t nextjs` scaffolds). Refresh it with:

```bash
npx degit get-convex/templates/template-nextjs examples/convex-nextjs --force
```

Scan it from the repo root:

```bash
pnpm example:nextjs
# or directly:
node packages/react-doctor/bin/react-doctor.js examples/convex-nextjs
```

Current score: **94 / 100 (Good)** — 6 findings, 5 from the `convex-*` rules,
all true positives (verified against the source).

## Scoreboard: every official Convex template

All 21 templates from [get-convex/templates](https://github.com/get-convex/templates),
scanned with the local default settings (local score, React rules off). Reproduce with:

```bash
git clone --depth 1 https://github.com/get-convex/templates /tmp/convex-templates
for d in /tmp/convex-templates/template-*/; do
  node packages/react-doctor/bin/react-doctor.js "$d" --score
done
```

| Score | Template                     | Findings | Convex findings                                                                         |
| ----: | ---------------------------- | -------: | --------------------------------------------------------------------------------------- |
|   100 | nextjs-shadcn                |        1 | require-auth-check                                                                      |
|   100 | react-vite-shadcn            |        1 | require-auth-check                                                                      |
|    99 | nextjs-convexauth-shadcn     |        4 | 3× prefer-convex-error                                                                  |
|    99 | react-vite-convexauth-shadcn |        3 | prefer-convex-error                                                                     |
|    98 | bare                         |        1 | no-sequential-ctx-run                                                                   |
|    96 | nextjs-authkit               |        5 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    96 | tanstack-start-authkit       |        7 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    96 | tanstack-start-clerk         |        5 | unbounded-collect, auth-check, api-self-call                                            |
|    95 | nextjs-clerk                 |        6 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    95 | nextjs-convexauth            |        7 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    95 | react-vite-authkit           |        5 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    95 | react-vite-clerk             |        5 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    95 | react-vite-convexauth        |        6 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    95 | tanstack-start               |        5 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    94 | nextjs (vendored above)      |        6 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    94 | react-vite                   |        5 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    92 | astro                        |        3 | auth-check, **no-unvalidated-args (error)**, unbounded-collect                          |
|    92 | component                    |       19 | auth-check ×3, helpers-over-ctx-run ×2, untrusted-user-id, mutation-floating-promise, … |
|    92 | nextjs-lucia-shadcn          |       41 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    91 | nextjs-clerk-shadcn          |       44 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |
|    88 | react-vite-clerk-shadcn      |       44 | auth-check ×2, api-self-call ×2, sequential-ctx-run                                     |

The repeating `auth-check ×2 / api-self-call ×2 / sequential-ctx-run` cluster is the
demo `myAction` copied across templates — it calls
`ctx.runQuery(api.myFunctions.listNumbers)` then
`ctx.runMutation(api.myFunctions.addNumber)` from its own module, the exact
patterns the Convex best-practices docs tell you to avoid. Useful calibration:
the tool reproduces the same fingerprint wherever the same code appears.

## What the high-value recommendations look like

Real output excerpts — the `→` line is the fix, with the official docs reference:

```
⚠ Security: Public mutation without an auth check
  This public function can write or run side effects for ANY caller —
  its handler never consults `ctx.auth` to identify the user.
  → Check `ctx.auth.getUserIdentity()` (or a shared auth helper) before
    mutating. See https://docs.convex.dev/auth/functions-auth and
    https://docs.convex.dev/understanding/best-practices/
  convex/myFunctions.ts:32
```

```
✖ Security: Public function without argument validators        (template-astro)
  → Declare an `args` object with `v.*` validators on every public query,
    mutation, and action so client input is validated before the handler
    runs. See https://docs.convex.dev/functions/validation
  convex/comments.ts:17
```

```
⚠ Performance: Unbounded .collect() scans the whole table      (template-astro)
  → Bound the read: narrow it with `.withIndex(...)`, cap it with
    `.take(n)`, or page through it with `.paginate(...)`.
    See https://docs.convex.dev/understanding/best-practices/ and
    https://docs.convex.dev/database/pagination
  convex/comments.ts:19
```

```
⚠ Maintainability: Function references its own module via api.*
  → Reference sibling functions through `internal.*` from
    "./_generated/api" and add explicit return type annotations to break
    the circular type inference.
    See https://docs.convex.dev/understanding/best-practices/typescript
    and https://docs.convex.dev/functions/internal-functions
  convex/myFunctions.ts:68
```

```
⚠ Performance: Sequential runQuery/runMutation calls from an action
  → Combine the reads/writes into one internal query or mutation and call
    it once — a single call runs in a single consistent transaction.
    See https://docs.convex.dev/understanding/best-practices/
  convex/myFunctions.ts:74
```

React-runtime rules stay off by default (Convex-first mode); add
`{"reactRules": true}` to a `react-doctor.config.json` in any example to scan
the client code with the full React rule set too. The shadcn templates'
extra ~40 findings are framework-agnostic `unused-file` dead-code hits on
vendored shadcn/ui components that the starter never imports.
