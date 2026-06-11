import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import { getConvexFunctionConfig } from "../../utils/convex/convex-ast.js";

const MESSAGE =
  "Public Convex functions without a `returns` validator ship unvalidated, untyped output to every client.";

export const convexRequireReturnsValidator = defineRule<Rule>({
  id: "convex-require-returns-validator",
  title: "Public function without a returns validator",
  severity: "warn",
  defaultEnabled: false,
  recommendation:
    "Declare `returns:` on the function config so output stays typed and validated. See https://docs.convex.dev/functions/validation#return-value-validators",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const config = getConvexFunctionConfig(node);
      if (!config || config.isInternal || config.runtime === "http") return;
      // The legacy shorthand has no place for `returns:` —
      // `convex-no-old-function-syntax` already flags it.
      if (config.usesLegacyFunctionSyntax) return;
      // Only object-syntax registrations: a referenced config identifier
      // can't be inspected here.
      const firstArgument = node.arguments.length
        ? stripParenExpression(node.arguments[0] as EsTreeNode)
        : null;
      if (!firstArgument || !isNodeOfType(firstArgument, "ObjectExpression")) return;
      if (config.returnsValidator) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
