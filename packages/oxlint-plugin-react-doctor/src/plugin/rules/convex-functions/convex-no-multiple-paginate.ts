import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import {
  findEnclosingConvexFunction,
  getCtxBinding,
  getDbQueryChain,
} from "../../utils/convex/convex-ast.js";

const MESSAGE =
  "A query function may call `.paginate(...)` at most once — extra calls break the gap-less pagination protocol (cursor bookkeeping and page splitting assume a single paginated read).";

const isPaginateCall = (call: EsTreeNodeOfType<"CallExpression">): boolean => {
  const callee = stripParenExpression(call.callee as EsTreeNode);
  if (!isNodeOfType(callee, "MemberExpression") || callee.computed) return false;
  const property = callee.property as EsTreeNode;
  return isNodeOfType(property, "Identifier") && property.name === "paginate";
};

export const convexNoMultiplePaginate = defineRule<Rule>({
  id: "convex-no-multiple-paginate",
  title: "Multiple .paginate calls in one query",
  severity: "warn",
  recommendation:
    "Split each paginated read into its own query function and drive them with separate `usePaginatedQuery` calls on the client. See https://docs.convex.dev/database/pagination",
  create: (context: RuleContext) => {
    // First `.paginate` call seen per Convex registration (keyed by the
    // registrar CallExpression); any later one in the same function is
    // reported.
    const firstPaginatePerFunction = new Map<EsTreeNode, EsTreeNodeOfType<"CallExpression">>();
    return {
      CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
        if (!isPaginateCall(node)) return;
        const enclosing = findEnclosingConvexFunction(node);
        if (!enclosing || !enclosing.handler) return;
        const ctxBinding = getCtxBinding(enclosing.handler);
        if (!ctxBinding) return;
        if (getDbQueryChain(node, ctxBinding) === null) return;
        if (firstPaginatePerFunction.has(enclosing.call)) {
          context.report({ node, message: MESSAGE });
          return;
        }
        firstPaginatePerFunction.set(enclosing.call, node);
      },
    };
  },
});
