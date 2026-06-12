# React Convex Doctor

[![version](https://img.shields.io/npm/v/react-convex-doctor?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/react-convex-doctor)

A Convex-first code doctor: deterministically scans your [Convex](https://convex.dev)
backend — functions, schemas, scheduling, and the React client hooks — for
security, correctness, performance, and maintainability issues, and scores the
project 0–100. A fork of [react-doctor](https://github.com/millionco/react-doctor)
with 44 Convex rules grounded in [docs.convex.dev](https://docs.convex.dev) and
[stack.convex.dev](https://stack.convex.dev/tag/Patterns).

## Packages

| Package                                                                                                | What it is                                                                         |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [`react-convex-doctor`](https://www.npmjs.com/package/react-convex-doctor)                             | The CLI. Installs two bins: `react-convex-doctor` and the shorter `convex-doctor`. |
| [`oxlint-plugin-react-convex-doctor`](https://www.npmjs.com/package/oxlint-plugin-react-convex-doctor) | The rule engine (oxlint JS plugin) the CLI loads. Published alongside the CLI.     |

## Quick start

```bash
npx react-convex-doctor@latest          # scan the current project
npx react-convex-doctor@latest ./apps/web
npx react-convex-doctor@latest --verbose   # list every finding inline
npx react-convex-doctor@latest --json > report.json
```

From a clone of this repo (no install):

```bash
pnpm install && pnpm build
node packages/react-doctor/bin/react-doctor.js <path-to-project>
pnpm example:nextjs   # scan the vendored official Convex Next.js template
```

## What it checks

When a `convex` dependency is detected the scan is **Convex-first**: the 39
`convex-*` rules plus the framework-agnostic JavaScript rules run, and the
React-runtime rule families stay off so the report focuses on the backend.

- **Security** — public functions without argument validators or auth checks,
  client-supplied user IDs trusted without `ctx.auth`, scheduler/crons
  targeting `api.*` instead of `internal.*`, hardcoded secrets.
- **Correctness** — `ctx.db` in actions, unawaited db writes / scheduler calls /
  async maps, `fetch`/timers in queries, `Date.now()` in cached queries,
  `"use node"` runtime mismatches, legacy function syntax, misplaced
  `defineSchema`/`httpRouter`.
- **Performance** — `.filter()` on db queries, unbounded `.collect()`,
  collect-to-count, db calls in loops, sequential `ctx.run*` transactions,
  redundant indexes.
- **TypeScript & architecture** — untyped `ctx` helpers, `api.*` self-calls
  (circular types), `string` where `Id<"table">` belongs.
- **React client** — `undefined` instead of `"skip"`, conditional Convex hooks,
  query results used before the loading check, dropped mutation promises.

Every finding carries a fix recommendation linking the relevant
[docs.convex.dev](https://docs.convex.dev) page. See
[`examples/README.md`](https://github.com/Vinniai/convex-doctor/blob/main/examples/README.md)
for real output and a scoreboard of all 21 official Convex templates
(scores 88–100).

## Scan modes

```bash
# Convex only — the default, nothing to configure
npx react-convex-doctor .

# Convex + React together (full react-doctor rule set on the client code)
npx react-convex-doctor . --react-rules
# (or persist it: echo '{"reactRules": true}' > react-doctor.config.json)

# React only — every convex rule carries the "convex" tag
echo '{"reactRules": true, "ignore": {"tags": ["convex"]}}' > react-doctor.config.json
```

Individual rules can be re-enabled or silenced via the `rules` map in
`react-doctor.config.json`; per-rule overrides always win over the mode.

## Run in CI

There is no hosted CI action for this fork — run the CLI directly. It exits
non-zero when error-severity findings exist (tune with `--blocking
error|warning|none`), and `--scope changed` reports only the issues a change
introduced.

**GitHub Actions** (`.github/workflows/convex-doctor.yml`):

```yaml
name: Convex Doctor
on:
  pull_request:
jobs:
  convex-doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0 # full history so --scope changed can diff against the base
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      - run: npx react-convex-doctor@latest --verbose --scope changed --base origin/${{ github.base_ref }}
```

**GitLab CI** (`.gitlab-ci.yml`):

```yaml
convex-doctor:
  image: node:22
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - git fetch origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
    - npx react-convex-doctor@latest --verbose --scope changed --base "origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
```

For a full-project gate instead of changed-only, drop the `--scope`/`--base`
flags. Scans are fully offline by default (local score, no uploads), so no
secrets or tokens are needed.

## Privacy defaults

This fork is **fully offline by default**:

- The 0–100 score is computed locally (deterministic severity-weighted model);
  no diagnostics leave your machine. Set `"localScore": false` to opt into the
  upstream hosted score API instead.
- Crash telemetry is disabled unless you explicitly set
  `REACT_DOCTOR_TELEMETRY=1`.
- The Socket.dev supply-chain check is the one remaining network call (one
  request per direct dependency); disable with
  `{"supplyChain": {"enabled": false}}`.

## Development

```bash
pnpm install
pnpm build         # build all packages
pnpm test          # core + CLI + api + language-server suites
cd packages/oxlint-plugin-react-doctor && npx vp test run   # all 7k rule tests
pnpm example:nextjs
```

Rules live in `packages/oxlint-plugin-react-doctor/src/plugin/rules/convex-*/`,
one file per rule with a colocated test; run `pnpm gen` there after adding one.

Releasing: bump both package versions, then either run the **Release to npm**
GitHub Action (Actions tab → needs the `NPM_TOKEN` repo secret), or locally
`npm login` once and run `pnpm release` (builds, audits declared deps, then
publishes the plugin followed by the CLI).

## Credit & license

Forked from [react-doctor](https://github.com/millionco/react-doctor) by
Million Software, Inc — the engine, the React/Next.js/React Native rule set,
and the CLI architecture are theirs. MIT-licensed, as is this fork.

[Issues welcome!](https://github.com/Vinniai/convex-doctor/issues)
