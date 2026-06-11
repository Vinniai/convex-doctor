import type { EsTreeNode } from "../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../utils/es-tree-node-of-type.js";
import { isNodeOfType } from "../../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../../utils/strip-paren-expression.js";
import { getCtxPropertyAccess, type CtxBinding } from "../../../utils/convex/convex-ast.js";

/**
 * When `call` is `<ctx>.<namespace>.<method>(...)` — or the destructured
 * `<namespace>.<method>(...)` — for the handler's `ctxBinding`, returns
 * the method name (e.g. `"runAfter"` for `ctx.scheduler.runAfter(...)`).
 * `null` otherwise.
 */
export const getCtxNamespaceMethodCall = (
  call: EsTreeNodeOfType<"CallExpression">,
  ctxBinding: CtxBinding,
  namespace: string,
): string | null => {
  const callee = stripParenExpression(call.callee as EsTreeNode);
  if (!isNodeOfType(callee, "MemberExpression") || callee.computed) return null;
  const property = callee.property as EsTreeNode;
  if (!isNodeOfType(property, "Identifier")) return null;
  const receiver = stripParenExpression(callee.object as EsTreeNode);
  if (getCtxPropertyAccess(receiver, ctxBinding) !== namespace) return null;
  return property.name;
};
