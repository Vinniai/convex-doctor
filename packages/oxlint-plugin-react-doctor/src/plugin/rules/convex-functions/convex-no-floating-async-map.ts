import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import { walkAst } from "../../utils/walk-ast.js";
import {
  findEnclosingConvexFunction,
  getCtxBinding,
  getCtxPropertyAccess,
  type CtxBinding,
} from "../../utils/convex/convex-ast.js";
import { isFloatingCallResult } from "./utils/is-floating-call-result.js";

const MESSAGE =
  "`.map(async ...)` returns an array of promises — discarding it means the ctx work inside may still be running when the handler returns.";

const isAsyncFunctionNode = (
  node: EsTreeNode,
): node is EsTreeNodeOfType<"ArrowFunctionExpression"> | EsTreeNodeOfType<"FunctionExpression"> =>
  (isNodeOfType(node, "ArrowFunctionExpression") || isNodeOfType(node, "FunctionExpression")) &&
  node.async === true;

// True when the callback's body awaits an expression that touches the
// handler's ctx (e.g. `await ctx.db.get(id)` / destructured `db.get(id)`).
const awaitsCtxRootedCall = (callback: EsTreeNode, ctxBinding: CtxBinding): boolean => {
  const body = (callback as { body?: EsTreeNode }).body;
  if (!body) return false;
  let found = false;
  walkAst(body, (node) => {
    if (found) return false;
    if (!isNodeOfType(node, "AwaitExpression")) return;
    walkAst(node.argument as EsTreeNode, (inner) => {
      if (found) return false;
      if (getCtxPropertyAccess(inner, ctxBinding) !== null) {
        found = true;
        return false;
      }
    });
    if (found) return false;
  });
  return found;
};

export const convexNoFloatingAsyncMap = defineRule<Rule>({
  id: "convex-no-floating-async-map",
  title: "async .map drops its promises",
  severity: "warn",
  recommendation:
    "Wrap in `await Promise.all(items.map(async ...))` so the handler waits for every iteration. See https://docs.convex.dev/understanding/best-practices/",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const callee = stripParenExpression(node.callee as EsTreeNode);
      if (!isNodeOfType(callee, "MemberExpression") || callee.computed) return;
      const property = callee.property as EsTreeNode;
      if (!isNodeOfType(property, "Identifier") || property.name !== "map") return;
      if (node.arguments.length === 0) return;
      const callback = stripParenExpression(node.arguments[0] as EsTreeNode);
      if (!isAsyncFunctionNode(callback)) return;
      const enclosing = findEnclosingConvexFunction(node);
      if (!enclosing || !enclosing.handler) return;
      const ctxBinding = getCtxBinding(enclosing.handler);
      if (!ctxBinding) return;
      if (!awaitsCtxRootedCall(callback, ctxBinding)) return;
      // Promise.all(...) wrapping, a direct await, assignment, and
      // return all give the call a non-ExpressionStatement parent.
      if (!isFloatingCallResult(node)) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
