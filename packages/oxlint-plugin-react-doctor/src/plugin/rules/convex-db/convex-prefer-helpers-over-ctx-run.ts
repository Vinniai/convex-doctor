import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getCtxMethodCallName, getEnclosingHandlerCtx } from "./utils/handler-ctx.js";

const MESSAGE =
  "Queries and mutations run in the same JavaScript runtime — `ctx.runQuery` / `ctx.runMutation` here adds function-call overhead (and, in mutations, a sub-transaction) for no isolation benefit.";

export const convexPreferHelpersOverCtxRun = defineRule<Rule>({
  id: "convex-prefer-helpers-over-ctx-run",
  title: "runQuery/runMutation used where a plain helper works",
  severity: "warn",
  recommendation:
    "Extract the shared logic into a plain TypeScript helper that takes `ctx` and call it directly, same transaction, no extra hop. See https://docs.convex.dev/understanding/best-practices/",
  create: (context: RuleContext) => ({
    // `ctx.runQuery(...)` / `ctx.runMutation(...)` inside a query or
    // mutation handler. Actions are exempt — they have no `ctx.db`, so
    // `runQuery`/`runMutation` is the only way in (covered by
    // `convex-no-sequential-ctx-run` instead).
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const enclosing = getEnclosingHandlerCtx(node);
      if (!enclosing) return;
      const { runtime } = enclosing.config;
      if (runtime !== "query" && runtime !== "mutation") return;
      const method = getCtxMethodCallName(node, enclosing.ctxBinding);
      if (method !== "runQuery" && method !== "runMutation") return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
