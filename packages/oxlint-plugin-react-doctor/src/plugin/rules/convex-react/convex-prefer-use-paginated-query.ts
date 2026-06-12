import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getConvexReactHookName } from "../../utils/convex/convex-react-hooks.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";

const USE_QUERY_HOOK: ReadonlySet<string> = new Set(["useQuery"]);

const MESSAGE =
  "Passing `paginationOpts` to useQuery() hand-rolls pagination — page sizes in Convex can change as data changes, and useQuery has no cursor bookkeeping, so pages drift, overlap, or leave gaps.";

const hasPaginationOptsProperty = (argsArgument: EsTreeNode): boolean => {
  const unwrapped = stripParenExpression(argsArgument);
  if (!isNodeOfType(unwrapped, "ObjectExpression")) return false;
  for (const property of unwrapped.properties as ReadonlyArray<EsTreeNode>) {
    if (!isNodeOfType(property, "Property")) continue;
    const key = property.key as EsTreeNode;
    const keyName = isNodeOfType(key, "Identifier")
      ? key.name
      : isNodeOfType(key, "Literal") && typeof key.value === "string"
        ? key.value
        : null;
    if (keyName === "paginationOpts") return true;
  }
  return false;
};

export const convexPreferUsePaginatedQuery = defineRule<Rule>({
  id: "convex-prefer-use-paginated-query",
  title: "Manual pagination through useQuery",
  severity: "warn",
  recommendation:
    "Use `usePaginatedQuery(api.foo.list, args, { initialNumItems: n })` instead. It manages cursors and gap-less pages for you and exposes `loadMore` / `status`. See https://docs.convex.dev/database/pagination#paginating-within-react-components",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      if (!getConvexReactHookName(node, USE_QUERY_HOOK)) return;
      const argsArgument = node.arguments?.[1];
      if (!argsArgument) return;
      if (!hasPaginationOptsProperty(argsArgument as EsTreeNode)) return;
      context.report({ node: argsArgument as EsTreeNode, message: MESSAGE });
    },
  }),
});
