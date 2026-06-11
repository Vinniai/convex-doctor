import {
  componentOrHookDisplayNameForFunction,
  nearestEnclosingFunction,
} from "../../utils/component-or-hook-display-name.js";
import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getConvexReactHookName } from "../../utils/convex/convex-react-hooks.js";
import { isFunctionLike } from "../../utils/is-function-like.js";

const CONVEX_HOOKS: ReadonlySet<string> = new Set([
  "useQuery",
  "useMutation",
  "useAction",
  "usePaginatedQuery",
  "useQueries",
]);

const LOOP_TYPES: ReadonlySet<string> = new Set([
  "ForStatement",
  "ForOfStatement",
  "ForInStatement",
  "WhileStatement",
  "DoWhileStatement",
]);

// Is the hook call in a conditionally-evaluated position between itself
// and its nearest enclosing function? A call sitting in the *test* of an
// `if` / ternary, or the *left* side of `&&` / `||` / `??`, evaluates on
// every render and is left alone — only branch/loop positions flag.
const conditionalAncestorBeforeFunction = (callNode: EsTreeNode): EsTreeNode | null => {
  let child: EsTreeNode = callNode;
  let cursor: EsTreeNode | null | undefined = callNode.parent;
  while (cursor && !isFunctionLike(cursor)) {
    if (cursor.type === "IfStatement" && child !== cursor.test) return cursor;
    if (cursor.type === "ConditionalExpression" && child !== cursor.test) return cursor;
    if (cursor.type === "LogicalExpression" && child === cursor.right) return cursor;
    if (LOOP_TYPES.has(cursor.type)) return cursor;
    child = cursor;
    cursor = cursor.parent ?? null;
  }
  return null;
};

export const convexNoConditionalConvexHooks = defineRule<Rule>({
  id: "convex-no-conditional-convex-hooks",
  title: "Convex hook called conditionally",
  severity: "error",
  recommendation:
    'React hooks must run on every render in the same order. Hoist the hook to the top level of the component or custom hook and pass "skip" as the args when the query should be inactive. See https://docs.convex.dev/client/react#skipping-queries',
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const hookName = getConvexReactHookName(node, CONVEX_HOOKS);
      if (!hookName) return;
      if (conditionalAncestorBeforeFunction(node)) {
        context.report({
          node,
          message: `${hookName}() is called inside a condition or loop — hooks must run unconditionally on every render.`,
        });
        return;
      }
      // Nested non-component / non-hook callback (event handler, `.map`
      // callback, effect body, …): the hook doesn't run during render.
      const enclosingFunction = nearestEnclosingFunction(node);
      if (!enclosingFunction) return;
      if (
        nearestEnclosingFunction(enclosingFunction) &&
        componentOrHookDisplayNameForFunction(enclosingFunction) === null
      ) {
        context.report({
          node,
          message: `${hookName}() is called inside a nested callback, not at the top level of a component or custom hook.`,
        });
      }
    },
  }),
});
