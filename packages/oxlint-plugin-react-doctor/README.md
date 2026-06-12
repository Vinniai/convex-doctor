# oxlint-plugin-react-convex-doctor

[![version](https://img.shields.io/npm/v/oxlint-plugin-react-convex-doctor?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/oxlint-plugin-react-convex-doctor)

[oxlint](https://oxc.rs/docs/guide/usage/linter) plugin for
[React Convex Doctor](https://github.com/Vinniai/convex-doctor). Diagnoses
[Convex](https://convex.dev) backends — and the React clients around them —
for security, performance, correctness, accessibility, and architecture issues.

This package owns the rule implementations: **44 `convex-*` rules** (grounded in
[docs.convex.dev](https://docs.convex.dev) and
[stack.convex.dev](https://stack.convex.dev/tag/Patterns)) plus the full
react-doctor rule set it forked from (~290 React/Next.js/React Native/a11y
rules, including the OXC `react/*` + `jsx-a11y/*` ports and the
"You Might Not Need an Effect" family). The diagnostic CLI lives in
[`react-convex-doctor`](https://npmjs.com/package/react-convex-doctor).

## Convex rule buckets

| Bucket              | Examples                                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex-security`   | `convex-no-unvalidated-args`, `convex-require-auth-check`, `convex-scheduler-internal-only`, `convex-crons-internal-only`, `convex-no-untrusted-user-id`, `convex-no-hardcoded-secrets` |
| `convex-db`         | `convex-no-filter-in-query`, `convex-no-unbounded-collect`, `convex-avoid-db-in-loop`, `convex-no-sequential-ctx-run`, `convex-avoid-redundant-indexes`                                 |
| `convex-functions`  | `convex-no-ctx-db-in-action`, `convex-no-db-write-in-query`, `convex-explicit-table-ids`, `convex-paginate-requires-opts-validator`, `convex-no-multiple-paginate`, `convex-no-floating-db-write`, `convex-prefer-convex-error` |
| `convex-schema`     | `convex-schema-no-reserved-fields`, `convex-schema-define-in-schema-file`, `convex-prefer-v-id`                                                                                         |
| `convex-typescript` | `convex-annotate-helper-ctx`, `convex-no-api-self-call`, `convex-prefer-id-type`                                                                                                        |
| `convex-react`      | `convex-usequery-skip-pattern`, `convex-no-conditional-convex-hooks`, `convex-usequery-undefined-check`, `convex-mutation-floating-promise`, `convex-prefer-use-paginated-query`        |

All Convex rules detect registrations by **import** (builders imported from
`convex/_generated/server`), never by bare identifier names, so same-named
helpers from other libraries never false-fire.

## Install

```bash
npm install --save-dev oxlint oxlint-plugin-react-convex-doctor
# or: pnpm add -D / yarn add -D
```

## Usage

In `.oxlintrc.json` (rules stay namespaced `react-doctor/*` for config
compatibility with the upstream ecosystem):

```jsonc
{
  "jsPlugins": [{ "name": "react-doctor", "specifier": "oxlint-plugin-react-convex-doctor" }],
  "rules": {
    "react-doctor/convex-no-unvalidated-args": "error",
    "react-doctor/convex-no-filter-in-query": "warn",
  },
}
```

Then run oxlint as normal: `npx oxlint .`

The full rule list lives in
[`rule-registry.ts`](https://github.com/Vinniai/convex-doctor/blob/main/packages/oxlint-plugin-react-doctor/src/plugin/rule-registry.ts).

## Want the CLI too?

This package only ships the oxlint plugin. For the full scan — Convex project
detection, Convex-first rule gating, local 0–100 scoring, JSON reports — use
the CLI:

```bash
npx react-convex-doctor@latest
```

See the [React Convex Doctor README](https://github.com/Vinniai/convex-doctor#readme).

## Credit & license

Forked from [`oxlint-plugin-react-doctor`](https://npmjs.com/package/oxlint-plugin-react-doctor)
(Million Software, Inc / Aiden Bai). The OXC rule ports and the
"You Might Not Need an Effect" family retain their original attributions —
see [`SOURCE.md`](https://github.com/Vinniai/convex-doctor/blob/main/packages/oxlint-plugin-react-doctor/src/plugin/rules/state-and-effects/effect/SOURCE.md).
MIT.
