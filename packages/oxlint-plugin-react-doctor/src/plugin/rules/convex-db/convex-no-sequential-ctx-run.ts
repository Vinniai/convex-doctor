import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getConvexFunctionConfig, getCtxBinding } from "../../utils/convex/convex-ast.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import { walkAst } from "../../utils/walk-ast.js";
import { getCtxMethodCallName } from "./utils/handler-ctx.js";

const MESSAGE =
  "Each `ctx.runQuery` / `ctx.runMutation` from an action is its own transaction — the data can change between this call and the previous one, so the action observes an inconsistent snapshot.";

export const convexNoSequentialCtxRun = defineRule<Rule>({
  id: "convex-no-sequential-ctx-run",
  title: "Sequential runQuery/runMutation calls from an action",
  severity: "warn",
  recommendation:
    "Combine the reads/writes into one internal query or mutation and call it once, a single call runs in a single consistent transaction. See https://docs.convex.dev/understanding/best-practices/",
  create: (context: RuleContext) => ({
    // An action handler with 2+ awaited `ctx.runQuery` / `ctx.runMutation`
    // calls. Reported once, on the second call.
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const config = getConvexFunctionConfig(node);
      if (!config || config.runtime !== "action" || !config.handler) return;
      const ctxBinding = getCtxBinding(config.handler);
      if (!ctxBinding) return;
      const body = (config.handler as { body?: EsTreeNode }).body;
      if (!body) return;
      let awaitedRunCalls = 0;
      walkAst(body, (child) => {
        if (awaitedRunCalls >= 2) return false;
        if (!isNodeOfType(child, "AwaitExpression")) return;
        const argument = stripParenExpression(child.argument as EsTreeNode);
        if (!isNodeOfType(argument, "CallExpression")) return;
        const method = getCtxMethodCallName(argument, ctxBinding);
        if (method !== "runQuery" && method !== "runMutation") return;
        awaitedRunCalls += 1;
        if (awaitedRunCalls === 2) {
          context.report({ node: argument, message: MESSAGE });
          return false;
        }
      });
    },
  }),
});
