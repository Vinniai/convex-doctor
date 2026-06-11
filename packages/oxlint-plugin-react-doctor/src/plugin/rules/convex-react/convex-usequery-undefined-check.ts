import { nearestEnclosingFunction } from "../../utils/component-or-hook-display-name.js";
import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getConvexReactHookName } from "../../utils/convex/convex-react-hooks.js";
import { isFunctionLike } from "../../utils/is-function-like.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { walkAst } from "../../utils/walk-ast.js";

const QUERY_HOOKS: ReadonlySet<string> = new Set(["useQuery"]);

// `msgs?.map(...)` — the reference is itself loading-safe.
const isOptionalMemberObject = (identifier: EsTreeNode): boolean => {
  const parent = identifier.parent;
  return Boolean(
    parent &&
    isNodeOfType(parent, "MemberExpression") &&
    parent.object === identifier &&
    parent.optional,
  );
};

// `msgs.map(...)` / `msgs.length` — a dereference that throws while the
// query is still loading (the result is `undefined`).
const isDereference = (identifier: EsTreeNode): boolean => {
  const parent = identifier.parent;
  return Boolean(
    parent &&
    isNodeOfType(parent, "MemberExpression") &&
    parent.object === identifier &&
    !parent.optional,
  );
};

// A reference that acknowledges the loading state: the identifier appears
// in an `if` / ternary / `while` test, in any logical expression
// (`msgs && …`, `msgs ?? …`), or under a `!`.
const isGuardReference = (identifier: EsTreeNode): boolean => {
  if (isOptionalMemberObject(identifier)) return true;
  let child: EsTreeNode = identifier;
  let cursor: EsTreeNode | null | undefined = identifier.parent;
  while (cursor && !isFunctionLike(cursor)) {
    if (cursor.type === "LogicalExpression") return true;
    if (cursor.type === "UnaryExpression" && cursor.operator === "!") return true;
    if (cursor.type === "IfStatement") return child === cursor.test;
    if (cursor.type === "ConditionalExpression") return child === cursor.test;
    if (cursor.type === "WhileStatement" || cursor.type === "DoWhileStatement") {
      return child === cursor.test;
    }
    // Statement / declarator boundary — no guarding construct above the
    // expression this reference lives in.
    if (cursor.type.endsWith("Statement") || cursor.type === "VariableDeclarator") return false;
    child = cursor;
    cursor = cursor.parent ?? null;
  }
  return false;
};

export const convexUseQueryUndefinedCheck = defineRule<Rule>({
  id: "convex-usequery-undefined-check",
  title: "Query result used before its loading check",
  severity: "warn",
  recommendation:
    "useQuery returns `undefined` while the query is loading, guard with `if (data === undefined) return …` (or optional-chain `data?.…`) before dereferencing the result. See https://docs.convex.dev/client/react#loading-and-error-states",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const hookName = getConvexReactHookName(node, QUERY_HOOKS);
      if (!hookName) return;
      const declarator = node.parent;
      if (
        !declarator ||
        !isNodeOfType(declarator, "VariableDeclarator") ||
        declarator.init !== node ||
        !isNodeOfType(declarator.id, "Identifier")
      ) {
        return;
      }
      const resultName = declarator.id.name;
      const enclosingFunction = nearestEnclosingFunction(declarator);
      if (!enclosingFunction) return;

      // Source-order walk over the enclosing function, classifying each
      // reference to the query result. Any guard seen before a dereference
      // suppresses it; the first unguarded dereference is reported.
      let guarded = false;
      let reported = false;
      walkAst(enclosingFunction, (child: EsTreeNode) => {
        if (reported) return false;
        if (child === declarator.id || child === node) return false;
        if (!isNodeOfType(child, "Identifier") || child.name !== resultName) return;
        if (isGuardReference(child)) {
          guarded = true;
          return;
        }
        if (!guarded && isDereference(child)) {
          reported = true;
          context.report({
            node: child.parent ?? child,
            message: `\`${resultName}\` is dereferenced before checking for undefined — ${hookName}() returns undefined while the query is loading.`,
          });
        }
      });
    },
  }),
});
