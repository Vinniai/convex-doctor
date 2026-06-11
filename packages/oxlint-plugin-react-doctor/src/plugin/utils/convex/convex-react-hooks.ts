import type { EsTreeNodeOfType } from "../es-tree-node-of-type.js";
import { getImportedNameFromModule } from "../find-import-source-for-name.js";
import { isNodeOfType } from "../is-node-of-type.js";

// The React client entry point every `convex-react` rule keys off. Hooks
// are matched by their *import source* (never bare identifier names) so a
// same-named hook from another library — e.g. TanStack Query's `useQuery`
// — can't false-fire.
export const CONVEX_REACT_MODULE = "convex/react";

// Resolves the canonical `convex/react` hook name for a call expression —
// `"useQuery"` for `useQuery(...)` and also for a renamed import like
// `import { useQuery as useConvexQuery } from "convex/react"`. Returns
// null when the callee isn't a plain identifier, wasn't imported from
// `convex/react`, or isn't one of `allowedHooks`.
export const getConvexReactHookName = (
  node: EsTreeNodeOfType<"CallExpression">,
  allowedHooks: ReadonlySet<string>,
): string | null => {
  if (!isNodeOfType(node.callee, "Identifier")) return null;
  const importedName = getImportedNameFromModule(
    node.callee,
    node.callee.name,
    CONVEX_REACT_MODULE,
  );
  if (!importedName || !allowedHooks.has(importedName)) return null;
  return importedName;
};
