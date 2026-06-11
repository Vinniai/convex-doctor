import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getConvexReactHookName } from "../../utils/convex/convex-react-hooks.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";

const QUERY_HOOKS: ReadonlySet<string> = new Set(["useQuery", "usePaginatedQuery"]);

const isUndefinedOrNull = (node: EsTreeNode): boolean => {
  if (isNodeOfType(node, "Identifier") && node.name === "undefined") return true;
  return isNodeOfType(node, "Literal") && node.value === null;
};

export const convexUseQuerySkipPattern = defineRule<Rule>({
  id: "convex-usequery-skip-pattern",
  title: 'Conditional query args use undefined instead of "skip"',
  severity: "warn",
  recommendation:
    'Pass `cond ? args : "skip"` instead, `undefined` args means "call the query with no arguments", not "skip this query", so the query still runs (and likely fails validation). See https://docs.convex.dev/client/react#skipping-queries',
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const hookName = getConvexReactHookName(node, QUERY_HOOKS);
      if (!hookName) return;
      const argsArgument = node.arguments?.[1];
      if (!argsArgument || !isNodeOfType(argsArgument, "ConditionalExpression")) return;
      if (!isUndefinedOrNull(argsArgument.consequent) && !isUndefinedOrNull(argsArgument.alternate))
        return;
      context.report({
        node: argsArgument,
        message: `Conditional args to ${hookName}() use undefined/null in one branch — the query is NOT skipped, it runs with no arguments. Use the string "skip" to skip it.`,
      });
    },
  }),
});
