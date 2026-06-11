import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { findEnclosingConvexFunction, getCtxBinding } from "../../utils/convex/convex-ast.js";
import { getCtxNamespaceMethodCall } from "./utils/get-ctx-namespace-method-call.js";
import { isFloatingCallResult } from "./utils/is-floating-call-result.js";

const MESSAGE =
  "`ctx.scheduler` calls return a promise — dropping it means scheduling failures vanish silently and the work may never be enqueued.";

const SCHEDULER_METHODS = new Set(["runAfter", "runAt"]);

export const convexNoFloatingScheduler = defineRule<Rule>({
  id: "convex-no-floating-scheduler",
  title: "Unawaited scheduler call",
  severity: "error",
  recommendation:
    "`await ctx.scheduler.runAfter(...)` (or `void` it explicitly when you truly don't care). See https://docs.convex.dev/scheduling/scheduled-functions",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const enclosing = findEnclosingConvexFunction(node);
      if (!enclosing || !enclosing.handler) return;
      const ctxBinding = getCtxBinding(enclosing.handler);
      if (!ctxBinding) return;
      const method = getCtxNamespaceMethodCall(node, ctxBinding, "scheduler");
      if (method === null || !SCHEDULER_METHODS.has(method)) return;
      if (!isFloatingCallResult(node)) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
