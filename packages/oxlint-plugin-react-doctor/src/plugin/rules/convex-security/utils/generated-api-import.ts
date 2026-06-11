import type { EsTreeNode } from "../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../utils/es-tree-node-of-type.js";
import { findProgramRoot } from "../../../utils/find-program-root.js";
import { isGeneratedApiSource } from "../../../utils/convex/convex-ast.js";
import { isNodeOfType } from "../../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../../utils/strip-paren-expression.js";

// Shared helpers for the convex-security bucket: recognizing function
// references rooted at the generated PUBLIC `api` object —
// `api.messages.send` after `import { api } from "./_generated/api"`.
// The `internal` object from the same module is the safe counterpart,
// so the check is keyed to the *imported* name `api` (rename-safe),
// never to bare identifier names.

/** The non-computed (or string-literal computed) property name of a member expression. */
export const getStaticMemberPropertyName = (
  member: EsTreeNodeOfType<"MemberExpression">,
): string | null => {
  const property = member.property as EsTreeNode;
  if (member.computed) {
    return isNodeOfType(property, "Literal") && typeof property.value === "string"
      ? property.value
      : null;
  }
  return isNodeOfType(property, "Identifier") ? property.name : null;
};

/** Walks `a.b.c.d` down to its root identifier (`a`). `null` for non-identifier roots. */
export const getMemberChainRootIdentifier = (
  member: EsTreeNodeOfType<"MemberExpression">,
): EsTreeNodeOfType<"Identifier"> | null => {
  let cursor: EsTreeNode = stripParenExpression(member.object as EsTreeNode);
  while (isNodeOfType(cursor, "MemberExpression")) {
    cursor = stripParenExpression(cursor.object as EsTreeNode);
  }
  return isNodeOfType(cursor, "Identifier") ? cursor : null;
};

/**
 * True when `localName` is bound by a NAMED import of `api` from a
 * Convex `_generated/api` module (any relative depth, optional `.js` /
 * `.ts` extension), handling renames like `import { api as publicApi }`.
 */
export const isGeneratedApiNamedImport = (contextNode: EsTreeNode, localName: string): boolean => {
  const programRoot = findProgramRoot(contextNode);
  if (!programRoot) return false;
  for (const statement of programRoot.body as ReadonlyArray<EsTreeNode>) {
    if (!isNodeOfType(statement, "ImportDeclaration")) continue;
    const source = (statement.source as { value?: unknown } | undefined)?.value;
    if (typeof source !== "string" || !isGeneratedApiSource(source)) continue;
    const specifiers = (statement as { specifiers?: ReadonlyArray<EsTreeNode> }).specifiers ?? [];
    for (const specifier of specifiers) {
      if (specifier.type !== "ImportSpecifier") continue;
      const local = (specifier as { local?: { name?: unknown } }).local;
      if (local?.name !== localName) continue;
      const imported = (specifier as { imported?: { name?: unknown; value?: unknown } }).imported;
      const importedName =
        imported?.name ?? (typeof imported?.value === "string" ? imported.value : null);
      if (importedName === "api") return true;
    }
  }
  return false;
};

/**
 * True when `node` is a member chain rooted at the generated public
 * `api` object — i.e. a public function reference like `api.messages.send`.
 */
export const isPublicApiFunctionReference = (node: EsTreeNode): boolean => {
  const expression = stripParenExpression(node);
  if (!isNodeOfType(expression, "MemberExpression")) return false;
  const root = getMemberChainRootIdentifier(expression);
  if (!root) return false;
  return isGeneratedApiNamedImport(expression, root.name);
};
