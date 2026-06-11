import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import {
  findEnclosingConvexFunction,
  getConvexFunctionConfig,
  getCtxBinding,
  getCtxPropertyAccess,
} from "../../utils/convex/convex-ast.js";

const MESSAGE =
  "Actions run outside the database transaction and their `ctx` has no `db` — this throws at runtime.";

export const convexNoCtxDbInAction = defineRule<Rule>({
  id: "convex-no-ctx-db-in-action",
  title: "Database accessed from an action",
  severity: "error",
  recommendation:
    "Read and write through `ctx.runQuery` / `ctx.runMutation` calling an internal function instead — actions have no direct database access. See https://docs.convex.dev/functions/actions#action-context",
  create: (context: RuleContext) => ({
    // `ctx.db.…` member access anywhere inside an action handler
    // (including nested closures like `.map(async (id) => ctx.db.get(id))`).
    MemberExpression(node: EsTreeNodeOfType<"MemberExpression">) {
      const enclosing = findEnclosingConvexFunction(node);
      if (!enclosing || enclosing.runtime !== "action" || !enclosing.handler) return;
      const ctxBinding = getCtxBinding(enclosing.handler);
      if (!ctxBinding || ctxBinding.identifierName === null) return;
      if (getCtxPropertyAccess(node, ctxBinding) !== "db") return;
      context.report({ node, message: MESSAGE });
    },
    // Destructuring `db` straight out of the action's ctx parameter:
    // `action({ handler: async ({ db }) => ... })`.
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const config = getConvexFunctionConfig(node);
      if (!config || config.runtime !== "action" || !config.handler) return;
      const ctxBinding = getCtxBinding(config.handler);
      if (!ctxBinding) return;
      for (const ctxProperty of ctxBinding.destructuredProperties.values()) {
        if (ctxProperty === "db") {
          context.report({ node: config.handler, message: MESSAGE });
          return;
        }
      }
    },
  }),
});
