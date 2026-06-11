import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isConvexServerImport } from "../../utils/convex/convex-ast.js";
import { findVariableInitializer } from "../../utils/find-variable-initializer.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import {
  getStaticMemberPropertyName,
  isPublicApiFunctionReference,
} from "./utils/generated-api-import.js";

const CRON_METHODS = new Set(["interval", "cron", "daily", "weekly", "monthly"]);

const MESSAGE =
  "Cron jobs that run `api.*` functions expose the scheduled work as a public API — any client can invoke it directly outside the schedule.";

// The receiver must be a binding initialized by `cronJobs()` where
// `cronJobs` was imported from "convex/server" — so a homegrown
// `obj.daily(...)` in an unrelated file can't false-fire.
const isCronJobsReceiver = (receiver: EsTreeNode): boolean => {
  const expression = stripParenExpression(receiver);
  if (!isNodeOfType(expression, "Identifier")) return false;
  const binding = findVariableInitializer(expression, expression.name);
  if (!binding || !binding.initializer) return false;
  const initializer = stripParenExpression(binding.initializer);
  if (!isNodeOfType(initializer, "CallExpression")) return false;
  const callee = stripParenExpression(initializer.callee as EsTreeNode);
  if (!isNodeOfType(callee, "Identifier")) return false;
  return isConvexServerImport(callee, callee.name);
};

export const convexCronsInternalOnly = defineRule<Rule>({
  id: "convex-crons-internal-only",
  title: "Cron registers a public function",
  severity: "error",
  recommendation:
    "Point the cron at an `internal.*` function instead so the scheduled work isn't callable by clients. See https://docs.convex.dev/scheduling/cron-jobs",
  create: (context: RuleContext) => ({
    // `crons.interval("name", { hours: 1 }, api.module.fn)` and the
    // `cron` / `daily` / `weekly` / `monthly` variants.
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const callee = stripParenExpression(node.callee as EsTreeNode);
      if (!isNodeOfType(callee, "MemberExpression")) return;
      const methodName = getStaticMemberPropertyName(callee);
      if (methodName === null || !CRON_METHODS.has(methodName)) return;
      if (!isCronJobsReceiver(callee.object as EsTreeNode)) return;
      for (const argument of node.arguments as ReadonlyArray<EsTreeNode>) {
        if (isPublicApiFunctionReference(argument)) {
          context.report({ node: argument, message: MESSAGE });
          return;
        }
      }
    },
  }),
});
