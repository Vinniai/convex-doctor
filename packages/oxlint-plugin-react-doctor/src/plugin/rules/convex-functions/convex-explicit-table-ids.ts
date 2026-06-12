import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { findEnclosingConvexFunction, getCtxBinding } from "../../utils/convex/convex-ast.js";
import { getCtxNamespaceMethodCall } from "./utils/get-ctx-namespace-method-call.js";

// The `ctx.db` operations that accept (and per current Convex best
// practices should always receive) an explicit table name as their first
// argument: `ctx.db.get("movies", movieId)` instead of
// `ctx.db.get(movieId)`. `insert` already requires the table name and
// `query` takes nothing else, so neither needs checking.
const ID_TAKING_DB_METHODS: ReadonlySet<string> = new Set(["get", "patch", "replace", "delete"]);

const isStringLiteral = (node: EsTreeNode): boolean =>
  isNodeOfType(node, "Literal") && typeof node.value === "string";

export const convexExplicitTableIds = defineRule<Rule>({
  id: "convex-explicit-table-ids",
  title: "Database call without an explicit table name",
  severity: "warn",
  recommendation:
    'Pass the table name as the first argument, for example `ctx.db.get("movies", movieId)` instead of `ctx.db.get(movieId)`, and likewise for `patch`, `replace`, and `delete`. The explicit form rejects ids from the wrong table and makes call sites self-documenting (requires a recent `convex` version). See https://docs.convex.dev/understanding/best-practices/',
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const enclosing = findEnclosingConvexFunction(node);
      if (!enclosing || !enclosing.handler) return;
      const ctxBinding = getCtxBinding(enclosing.handler);
      if (!ctxBinding) return;
      const method = getCtxNamespaceMethodCall(node, ctxBinding, "db");
      if (method === null || !ID_TAKING_DB_METHODS.has(method)) return;
      const firstArgument = node.arguments?.[0];
      if (!firstArgument || isStringLiteral(firstArgument as EsTreeNode)) return;
      context.report({
        node,
        message: `\`ctx.db.${method}(...)\` is called without an explicit table name as the first argument, so a mismatched id from another table is silently accepted.`,
      });
    },
  }),
});
