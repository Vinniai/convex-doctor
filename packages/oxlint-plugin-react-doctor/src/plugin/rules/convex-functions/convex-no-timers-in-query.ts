import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import { findEnclosingConvexFunction } from "../../utils/convex/convex-ast.js";

const MESSAGE =
  "Queries and mutations are deterministic transactions that finish synchronously with their promise — timers either never fire or break determinism.";

const TIMER_NAMES = new Set(["setTimeout", "setInterval"]);

export const convexNoTimersInQuery = defineRule<Rule>({
  id: "convex-no-timers-in-query",
  title: "Timer in a query/mutation",
  severity: "error",
  recommendation:
    "Queries/mutations are deterministic transactions; use ctx.scheduler.runAfter for delayed work. See https://docs.convex.dev/scheduling/scheduled-functions",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const callee = stripParenExpression(node.callee as EsTreeNode);
      if (!isNodeOfType(callee, "Identifier") || !TIMER_NAMES.has(callee.name)) return;
      // Skip a locally imported / declared helper — only the global counts.
      const reference = context.scopes.referenceFor(callee);
      if (reference !== null && reference.resolvedSymbol !== null) return;
      const enclosing = findEnclosingConvexFunction(node);
      if (!enclosing || (enclosing.runtime !== "query" && enclosing.runtime !== "mutation")) {
        return;
      }
      context.report({ node, message: MESSAGE });
    },
  }),
});
