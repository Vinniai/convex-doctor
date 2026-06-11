import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import {
  findEnclosingConvexFunction,
  getCtxBinding,
  getCtxPropertyAccess,
} from "../../utils/convex/convex-ast.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import {
  getStaticMemberPropertyName,
  isPublicApiFunctionReference,
} from "./utils/generated-api-import.js";

const SCHEDULER_METHODS = new Set(["runAfter", "runAt"]);

const MESSAGE =
  "Scheduling an `api.*` function makes the scheduled work part of the public API — any client can call it directly, bypassing the scheduling flow.";

export const convexSchedulerInternalOnly = defineRule<Rule>({
  id: "convex-scheduler-internal-only",
  title: "Scheduled function targets the public API",
  severity: "error",
  recommendation:
    "Schedule an `internal.*` function instead so the scheduled work isn't callable by clients. See https://docs.convex.dev/scheduling/scheduled-functions and https://docs.convex.dev/understanding/best-practices/",
  create: (context: RuleContext) => ({
    // `ctx.scheduler.runAfter(delay, api.module.fn, args)` /
    // `ctx.scheduler.runAt(timestamp, api.module.fn, args)` inside a
    // Convex handler (including nested closures).
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const callee = stripParenExpression(node.callee as EsTreeNode);
      if (!isNodeOfType(callee, "MemberExpression")) return;
      const methodName = getStaticMemberPropertyName(callee);
      if (methodName === null || !SCHEDULER_METHODS.has(methodName)) return;
      const enclosing = findEnclosingConvexFunction(node);
      if (!enclosing || !enclosing.handler) return;
      const ctxBinding = getCtxBinding(enclosing.handler);
      if (!ctxBinding) return;
      const receiver = stripParenExpression(callee.object as EsTreeNode);
      if (getCtxPropertyAccess(receiver, ctxBinding) !== "scheduler") return;
      const functionReference =
        node.arguments.length > 1 ? (node.arguments[1] as EsTreeNode) : null;
      if (!functionReference || !isPublicApiFunctionReference(functionReference)) return;
      context.report({ node: functionReference, message: MESSAGE });
    },
  }),
});
