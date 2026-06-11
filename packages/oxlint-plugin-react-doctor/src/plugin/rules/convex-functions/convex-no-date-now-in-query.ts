import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import { findEnclosingConvexFunction } from "../../utils/convex/convex-ast.js";

const MESSAGE =
  "Queries are cached and re-run reactively — `Date.now()` / `new Date()` / `Math.random()` make the same query return different results on every execution.";

export const convexNoDateNowInQuery = defineRule<Rule>({
  id: "convex-no-date-now-in-query",
  title: "Nondeterministic value in a query",
  severity: "warn",
  recommendation:
    "Queries are cached and reactive, compute time client-side or pass it as an argument so results stay consistent. See https://docs.convex.dev/functions/query-functions#caching--reactivity",
  create: (context: RuleContext) => {
    const reportWhenInsideQuery = (node: EsTreeNode): void => {
      const enclosing = findEnclosingConvexFunction(node);
      if (!enclosing || enclosing.runtime !== "query") return;
      context.report({ node, message: MESSAGE });
    };
    const resolvesLocally = (identifier: EsTreeNode): boolean => {
      const reference = context.scopes.referenceFor(identifier);
      return reference !== null && reference.resolvedSymbol !== null;
    };
    return {
      // Date.now() and Math.random()
      CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
        const callee = stripParenExpression(node.callee as EsTreeNode);
        if (!isNodeOfType(callee, "MemberExpression") || callee.computed) return;
        const object = stripParenExpression(callee.object as EsTreeNode);
        const property = callee.property as EsTreeNode;
        if (!isNodeOfType(object, "Identifier") || !isNodeOfType(property, "Identifier")) return;
        const isDateNow = object.name === "Date" && property.name === "now";
        const isMathRandom = object.name === "Math" && property.name === "random";
        if (!isDateNow && !isMathRandom) return;
        if (resolvesLocally(object)) return;
        reportWhenInsideQuery(node);
      },
      // `new Date()` with no arguments — `new Date(args.ts)` is deterministic.
      NewExpression(node: EsTreeNodeOfType<"NewExpression">) {
        const callee = stripParenExpression(node.callee as EsTreeNode);
        if (!isNodeOfType(callee, "Identifier") || callee.name !== "Date") return;
        if (node.arguments.length > 0) return;
        if (resolvesLocally(callee)) return;
        reportWhenInsideQuery(node);
      },
    };
  },
});
