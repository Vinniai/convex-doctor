import type { EsTreeNode } from "../../../utils/es-tree-node.js";
import { isNodeOfType } from "../../../utils/is-node-of-type.js";

// Wrappers that can sit between a call and the statement consuming it
// without changing how the resulting promise is used.
const TRANSPARENT_WRAPPER_TYPES = new Set<string>([
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
  "ChainExpression",
]);

/**
 * True when `call`'s result is dropped on the floor — the call is used
 * directly as a bare `ExpressionStatement`. Awaited, `void`-ed,
 * assigned, returned, `.then`/`.catch`-chained, or argument-position
 * calls all have a non-`ExpressionStatement` effective parent and are
 * NOT floating.
 */
export const isFloatingCallResult = (call: EsTreeNode): boolean => {
  let parent: EsTreeNode | null | undefined = call.parent;
  while (parent && TRANSPARENT_WRAPPER_TYPES.has(parent.type)) {
    parent = parent.parent;
  }
  return parent != null && isNodeOfType(parent, "ExpressionStatement");
};
