import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import { findEnclosingConvexFunction } from "../../utils/convex/convex-ast.js";

const MESSAGE =
  "Queries and mutations are deterministic database transactions — `fetch()` is unavailable there and network results can't be cached or replayed.";

export const convexNoFetchInQuery = defineRule<Rule>({
  id: "convex-no-fetch-in-query",
  title: "fetch() in a query/mutation",
  severity: "error",
  recommendation:
    "Move network calls into an action and write results back via ctx.runMutation. See https://docs.convex.dev/functions/actions",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const callee = stripParenExpression(node.callee as EsTreeNode);
      if (!isNodeOfType(callee, "Identifier") || callee.name !== "fetch") return;
      // Skip a locally imported / declared `fetch` — only the global counts.
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
