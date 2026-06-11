import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getDbQueryChain } from "../../utils/convex/convex-ast.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import { getCalleeMethodName, getEnclosingHandlerCtx } from "./utils/handler-ctx.js";

const MESSAGE =
  "Reading `.length` off `.collect()` pulls every document into memory just to produce a number — the count costs a full table/range scan on every call.";

const getStaticPropertyName = (member: EsTreeNodeOfType<"MemberExpression">): string | null => {
  const property = member.property as EsTreeNode;
  if (member.computed) {
    return isNodeOfType(property, "Literal") && typeof property.value === "string"
      ? property.value
      : null;
  }
  return isNodeOfType(property, "Identifier") ? property.name : null;
};

export const convexPreferTakeOverCollectLength = defineRule<Rule>({
  id: "convex-prefer-take-over-collect-length",
  title: "Collecting a whole table just to count it",
  severity: "warn",
  recommendation:
    "Store a denormalized counter document you update on insert/delete, or read a bounded page (`.take(n)`) when an approximate / capped count is enough. See https://docs.convex.dev/understanding/best-practices/",
  create: (context: RuleContext) => ({
    // `(await ctx.db.query(...)….collect()).length` — only the count is
    // used, never the documents.
    MemberExpression(node: EsTreeNodeOfType<"MemberExpression">) {
      if (getStaticPropertyName(node) !== "length") return;
      let object = stripParenExpression(node.object as EsTreeNode);
      if (isNodeOfType(object, "AwaitExpression")) {
        object = stripParenExpression(object.argument as EsTreeNode);
      }
      if (!isNodeOfType(object, "CallExpression")) return;
      if (getCalleeMethodName(object) !== "collect") return;
      const enclosing = getEnclosingHandlerCtx(node);
      if (!enclosing) return;
      if (getDbQueryChain(object, enclosing.ctxBinding) === null) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
