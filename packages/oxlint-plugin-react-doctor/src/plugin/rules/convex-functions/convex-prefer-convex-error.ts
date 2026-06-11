import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import { findEnclosingConvexFunction } from "../../utils/convex/convex-ast.js";

const MESSAGE =
  'Generic errors thrown from public Convex functions reach clients as an opaque "Server Error" — the message and data are stripped.';

export const convexPreferConvexError = defineRule<Rule>({
  id: "convex-prefer-convex-error",
  title: "Generic Error thrown in a public function",
  severity: "warn",
  recommendation:
    '`throw new ConvexError({...})` from "convex/values" for expected failures the client should handle, generic errors reach clients as an opaque "Server Error". See https://docs.convex.dev/functions/error-handling/application-errors',
  create: (context: RuleContext) => ({
    ThrowStatement(node: EsTreeNodeOfType<"ThrowStatement">) {
      const thrown = stripParenExpression(node.argument as EsTreeNode);
      if (!isNodeOfType(thrown, "NewExpression")) return;
      const callee = stripParenExpression(thrown.callee as EsTreeNode);
      if (!isNodeOfType(callee, "Identifier") || callee.name !== "Error") return;
      const enclosing = findEnclosingConvexFunction(node);
      if (!enclosing || enclosing.isInternal) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
