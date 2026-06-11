import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { findEnclosingConvexFunction, getCtxBinding } from "../../utils/convex/convex-ast.js";
import { getCtxNamespaceMethodCall } from "./utils/get-ctx-namespace-method-call.js";
import { isFloatingCallResult } from "./utils/is-floating-call-result.js";

const MESSAGE =
  "`ctx.db` writes return a promise — dropping it hides write failures and reorders the transaction unpredictably.";

const DB_WRITE_METHODS = new Set(["insert", "patch", "replace", "delete"]);

export const convexNoFloatingDbWrite = defineRule<Rule>({
  id: "convex-no-floating-db-write",
  title: "Unawaited database write",
  severity: "error",
  recommendation:
    "Await every db write (`await ctx.db.insert(...)`) so failures surface in the transaction. See https://docs.convex.dev/database/writing-data",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const enclosing = findEnclosingConvexFunction(node);
      if (!enclosing || !enclosing.handler) return;
      const ctxBinding = getCtxBinding(enclosing.handler);
      if (!ctxBinding) return;
      const method = getCtxNamespaceMethodCall(node, ctxBinding, "db");
      if (method === null || !DB_WRITE_METHODS.has(method)) return;
      if (!isFloatingCallResult(node)) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
