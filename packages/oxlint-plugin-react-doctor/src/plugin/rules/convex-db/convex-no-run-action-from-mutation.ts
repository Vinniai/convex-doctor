import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getCtxMethodCallName, getEnclosingHandlerCtx } from "./utils/handler-ctx.js";

const MESSAGE =
  "`MutationCtx` has no `runAction` — this throws at runtime, and running side effects inside a transaction would break its atomicity anyway.";

export const convexNoRunActionFromMutation = defineRule<Rule>({
  id: "convex-no-run-action-from-mutation",
  title: "Action called from a mutation",
  severity: "error",
  category: "Correctness",
  recommendation:
    "Schedule the action from the mutation instead: `await ctx.scheduler.runAfter(0, internal.foo.bar, args)`, it only runs if the mutation commits. See https://docs.convex.dev/scheduling/scheduled-functions",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const enclosing = getEnclosingHandlerCtx(node);
      if (!enclosing || enclosing.config.runtime !== "mutation") return;
      if (getCtxMethodCallName(node, enclosing.ctxBinding) !== "runAction") return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
