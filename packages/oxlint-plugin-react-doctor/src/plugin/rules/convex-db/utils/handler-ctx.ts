import type { EsTreeNode } from "../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../utils/es-tree-node-of-type.js";
import { isNodeOfType } from "../../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../../utils/strip-paren-expression.js";
import {
  findEnclosingConvexFunction,
  getCtxBinding,
  getCtxPropertyAccess,
  type ConvexFunctionConfig,
  type CtxBinding,
} from "../../../utils/convex/convex-ast.js";

export interface EnclosingHandlerCtx {
  config: ConvexFunctionConfig;
  /** The registration's handler function (always non-null here). */
  handler: EsTreeNode;
  ctxBinding: CtxBinding;
}

/**
 * Resolves the Convex function registration enclosing `node` together
 * with its handler's `ctx` binding. `null` when `node` is outside any
 * Convex handler, or the handler / its first parameter can't be
 * resolved statically.
 */
export const getEnclosingHandlerCtx = (node: EsTreeNode): EnclosingHandlerCtx | null => {
  const config = findEnclosingConvexFunction(node);
  if (!config || !config.handler) return null;
  const ctxBinding = getCtxBinding(config.handler);
  if (!ctxBinding) return null;
  return { config, handler: config.handler, ctxBinding };
};

/**
 * The method a call invokes on the handler's ctx — `"runQuery"` for
 * `ctx.runQuery(...)` (or a destructured `runQuery(...)`). `null` when
 * the callee isn't a ctx property access.
 */
export const getCtxMethodCallName = (
  call: EsTreeNodeOfType<"CallExpression">,
  ctxBinding: CtxBinding,
): string | null =>
  getCtxPropertyAccess(stripParenExpression(call.callee as EsTreeNode), ctxBinding);

/**
 * True when `call` is a method call rooted — possibly through a fluent
 * chain — at the handler ctx's `db` property: `ctx.db.get(id)`,
 * `ctx.db.insert(...)`, `ctx.db.query("t").withIndex(...).collect()`,
 * or a destructured `db.patch(...)`.
 */
export const isCtxDbRootedCall = (
  call: EsTreeNodeOfType<"CallExpression">,
  ctxBinding: CtxBinding,
): boolean => {
  let cursor: EsTreeNode = call;
  while (isNodeOfType(cursor, "CallExpression")) {
    const callee = stripParenExpression(cursor.callee as EsTreeNode);
    if (!isNodeOfType(callee, "MemberExpression")) return false;
    const receiver = stripParenExpression(callee.object as EsTreeNode);
    if (getCtxPropertyAccess(receiver, ctxBinding) === "db") return true;
    cursor = receiver;
  }
  return false;
};

/** The static (non-computed identifier or string-literal) method name of a call's callee, if any. */
export const getCalleeMethodName = (call: EsTreeNodeOfType<"CallExpression">): string | null => {
  const callee = stripParenExpression(call.callee as EsTreeNode);
  if (!isNodeOfType(callee, "MemberExpression")) return null;
  const property = callee.property as EsTreeNode;
  if (callee.computed) {
    return isNodeOfType(property, "Literal") && typeof property.value === "string"
      ? property.value
      : null;
  }
  return isNodeOfType(property, "Identifier") ? property.name : null;
};
