import type { EsTreeNode } from "../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../utils/es-tree-node-of-type.js";
import { isConvexValuesImport } from "../../../utils/convex/convex-ast.js";
import { getImportedNameFromModule } from "../../../utils/find-import-source-for-name.js";
import { isNodeOfType } from "../../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../../utils/strip-paren-expression.js";

// Bucket-local AST helpers for the `convex-schema/` rules. Convex
// schemas are declared by composing builders imported from
// `convex/server` and `convex/values`:
//
//   import { defineSchema, defineTable } from "convex/server";
//   import { v } from "convex/values";
//   export default defineSchema({
//     messages: defineTable({ body: v.string() }).index("by_user", ["userId"]),
//   });
//
// Everything here keys off those imports (resolving renamed imports to
// their canonical exported name) so a homegrown `defineTable()` from a
// non-Convex module can't false-fire.

/**
 * When `call`'s callee is an identifier imported (possibly renamed)
 * from `convex/server`, returns the canonical exported name
 * (`"defineSchema"`, `"defineTable"`, …). `null` otherwise.
 */
export const getConvexServerCalleeName = (
  call: EsTreeNodeOfType<"CallExpression">,
): string | null => {
  const callee = stripParenExpression(call.callee as EsTreeNode);
  if (!isNodeOfType(callee, "Identifier")) return null;
  return getImportedNameFromModule(call, callee.name, "convex/server");
};

/** The call's first argument when it is an object literal, `null` otherwise. */
export const getFirstObjectArgument = (
  call: EsTreeNodeOfType<"CallExpression">,
): EsTreeNodeOfType<"ObjectExpression"> | null => {
  if (call.arguments.length === 0) return null;
  const first = stripParenExpression(call.arguments[0] as EsTreeNode);
  return isNodeOfType(first, "ObjectExpression") ? first : null;
};

/** Static name of an object property's key (identifier or string literal). */
export const getStaticPropertyKeyName = (property: EsTreeNodeOfType<"Property">): string | null => {
  const key = property.key as EsTreeNode;
  if (isNodeOfType(key, "Identifier") && !property.computed) return key.name;
  if (isNodeOfType(key, "Literal") && typeof key.value === "string") return key.value;
  return null;
};

/**
 * Resolves a table declaration — `defineTable({...})` possibly extended
 * by chained builder calls like `.index(...)` / `.searchIndex(...)` —
 * to the fields object literal passed to `defineTable`. Returns `null`
 * when the chain isn't rooted at a `defineTable` imported from
 * `convex/server`, or its first argument isn't an object literal.
 */
export const getDefineTableFieldsObject = (
  tableValue: EsTreeNode,
): EsTreeNodeOfType<"ObjectExpression"> | null => {
  let cursor: EsTreeNode = stripParenExpression(tableValue);
  while (isNodeOfType(cursor, "CallExpression")) {
    const callee = stripParenExpression(cursor.callee as EsTreeNode);
    if (isNodeOfType(callee, "MemberExpression")) {
      // `.index(...)` / `.searchIndex(...)` chain link — descend to its receiver.
      cursor = stripParenExpression(callee.object as EsTreeNode);
      continue;
    }
    if (getConvexServerCalleeName(cursor) !== "defineTable") return null;
    return getFirstObjectArgument(cursor);
  }
  return null;
};

/**
 * True when `node` is a `v.string()` call where `v` (any local name)
 * was imported from `convex/values`.
 */
export const isVStringCall = (node: EsTreeNode): boolean => {
  if (!isNodeOfType(node, "CallExpression")) return false;
  const callee = stripParenExpression(node.callee as EsTreeNode);
  if (!isNodeOfType(callee, "MemberExpression") || callee.computed) return false;
  const object = stripParenExpression(callee.object as EsTreeNode);
  const property = callee.property as EsTreeNode;
  if (!isNodeOfType(object, "Identifier") || !isNodeOfType(property, "Identifier")) return false;
  if (property.name !== "string") return false;
  return isConvexValuesImport(node, object.name);
};
