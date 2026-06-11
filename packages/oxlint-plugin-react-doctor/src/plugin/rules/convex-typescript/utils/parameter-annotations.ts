import type { EsTreeNode } from "../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../utils/es-tree-node-of-type.js";
import { isNodeOfType } from "../../../utils/is-node-of-type.js";

// Bucket-local helpers for the convex-typescript rules: reading the
// TypeScript annotation off a function parameter. The oxc TS-ESTree AST
// puts the annotation on the binding identifier itself —
// `messageId: string` parses to an `Identifier` whose `typeAnnotation`
// is a `TSTypeAnnotation` wrapping the inner type node
// (`TSStringKeyword`, `TSAnyKeyword`, `TSTypeReference`, …); an
// unannotated parameter carries `typeAnnotation: null`.

/**
 * Resolves a function parameter down to its binding `Identifier`,
 * unwrapping `TSParameterProperty` and default-value `AssignmentPattern`
 * wrappers. `null` for destructured (object/array pattern) and rest
 * parameters.
 */
export const unwrapParameterIdentifier = (
  param: EsTreeNode | null | undefined,
): EsTreeNodeOfType<"Identifier"> | null => {
  if (!param) return null;
  let cursor: EsTreeNode = param;
  if (cursor.type === "TSParameterProperty") {
    cursor = (cursor as { parameter?: EsTreeNode }).parameter ?? cursor;
  }
  if (isNodeOfType(cursor, "AssignmentPattern")) cursor = cursor.left as EsTreeNode;
  return isNodeOfType(cursor, "Identifier") ? cursor : null;
};

/**
 * The inner TS type node of an annotated binding identifier
 * (`ctx: any` → the `TSAnyKeyword` node). `null` when the parameter has
 * no annotation.
 */
export const getParameterTypeNode = (
  identifier: EsTreeNodeOfType<"Identifier">,
): EsTreeNode | null => {
  const annotation = (identifier as { typeAnnotation?: EsTreeNode | null }).typeAnnotation;
  if (!annotation || annotation.type !== "TSTypeAnnotation") return null;
  return (annotation as { typeAnnotation?: EsTreeNode | null }).typeAnnotation ?? null;
};
