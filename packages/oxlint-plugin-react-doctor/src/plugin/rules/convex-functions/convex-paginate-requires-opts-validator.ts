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
  "This function calls `.paginate(...)` but its `args` do not validate the pagination options — the client's gap-less pagination protocol (cursors, page splits) needs the exact `paginationOptsValidator` shape to work.";

const isPaginateCall = (call: EsTreeNodeOfType<"CallExpression">): boolean => {
  const callee = stripParenExpression(call.callee as EsTreeNode);
  if (!isNodeOfType(callee, "MemberExpression") || callee.computed) return false;
  const property = callee.property as EsTreeNode;
  return isNodeOfType(property, "Identifier") && property.name === "paginate";
};

// True when the args validator object plausibly carries the pagination
// options: a `paginationOpts` property (the key `usePaginatedQuery`
// injects), or any property referencing `paginationOptsValidator`.
const hasPaginationOptsProperty = (argsValidator: EsTreeNode): boolean => {
  const unwrapped = stripParenExpression(argsValidator);
  if (!isNodeOfType(unwrapped, "ObjectExpression")) {
    // A referenced/shared validator we can't see into — assume it's fine.
    return true;
  }
  for (const property of unwrapped.properties as ReadonlyArray<EsTreeNode>) {
    // A spread may carry the option in from elsewhere — assume it does.
    if (isNodeOfType(property, "SpreadElement")) return true;
    if (!isNodeOfType(property, "Property")) continue;
    const key = property.key as EsTreeNode;
    const keyName = isNodeOfType(key, "Identifier")
      ? key.name
      : isNodeOfType(key, "Literal") && typeof key.value === "string"
        ? key.value
        : null;
    if (keyName === "paginationOpts") return true;
    const value = stripParenExpression(property.value as EsTreeNode);
    if (isNodeOfType(value, "Identifier") && value.name === "paginationOptsValidator") return true;
  }
  return false;
};

export const convexPaginateRequiresOptsValidator = defineRule<Rule>({
  id: "convex-paginate-requires-opts-validator",
  title: "Paginated query without paginationOptsValidator",
  severity: "warn",
  recommendation:
    'Add `paginationOpts: paginationOptsValidator` (imported from "convex/server") to the function\'s `args` and pass it through: `.paginate(args.paginationOpts)`. See https://docs.convex.dev/database/pagination',
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      if (!isPaginateCall(node)) return;
      const enclosing = findEnclosingConvexFunction(node);
      if (!enclosing || !enclosing.handler) return;
      const ctxBinding = getCtxBinding(enclosing.handler);
      if (!ctxBinding) return;
      // Only `.paginate` links of a `ctx.db.query(...)` fluent chain —
      // a same-named method on some other object can't false-fire.
      if (getDbQueryChain(node, ctxBinding) === null) return;
      if (enclosing.argsValidator && hasPaginationOptsProperty(enclosing.argsValidator)) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
