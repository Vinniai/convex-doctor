import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { hasUseNodeDirective } from "../../utils/convex/convex-ast.js";
import { findProgramRoot } from "../../utils/find-program-root.js";
import { getCtxMethodCallName, getEnclosingHandlerCtx } from "./utils/handler-ctx.js";

const MESSAGE =
  "`ctx.runAction` from an action spins up a whole separate function execution — extra latency and resources for code already running in the same runtime.";

export const convexNoUnnecessaryRunAction = defineRule<Rule>({
  id: "convex-no-unnecessary-run-action",
  title: "runAction from an action adds overhead",
  severity: "warn",
  recommendation:
    'Call a plain TypeScript helper instead, crossing into the "use node" runtime is the only good reason for an action-to-action call. See https://docs.convex.dev/understanding/best-practices/',
  create: (context: RuleContext) => ({
    // `ctx.runAction(...)` inside an action handler in a file WITHOUT a
    // "use node" directive. In a "use node" file the call may legitimately
    // target the default runtime (and vice versa), so we stay quiet there.
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const enclosing = getEnclosingHandlerCtx(node);
      if (!enclosing || enclosing.config.runtime !== "action") return;
      if (getCtxMethodCallName(node, enclosing.ctxBinding) !== "runAction") return;
      const program = findProgramRoot(node);
      if (!program || hasUseNodeDirective(program)) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
