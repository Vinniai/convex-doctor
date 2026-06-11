import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getConvexFunctionConfig } from "../../utils/convex/convex-ast.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";

const MESSAGE =
  "Public Convex functions without `args` validators accept any payload a client sends — arguments reach the handler unchecked.";

export const convexNoUnvalidatedArgs = defineRule<Rule>({
  id: "convex-no-unvalidated-args",
  title: "Public function without argument validators",
  severity: "error",
  recommendation:
    "Declare an `args` object with `v.*` validators on every public query, mutation, and action so client input is validated before the handler runs. See https://docs.convex.dev/functions/validation",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const config = getConvexFunctionConfig(node);
      if (!config) return;
      // Internal functions aren't callable by clients; http actions take
      // a raw Request and have no args validators by design.
      if (config.isInternal || config.runtime === "http") return;
      // Only the object syntax is in scope — the legacy function
      // shorthand is covered by a separate rule.
      if (config.usesLegacyFunctionSyntax) return;
      const firstArgument = node.arguments.length
        ? stripParenExpression(node.arguments[0] as EsTreeNode)
        : null;
      if (!firstArgument || !isNodeOfType(firstArgument, "ObjectExpression")) return;
      if (config.argsValidator !== null) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
