import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import type { RuleVisitors } from "../../utils/rule-visitors.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import { getConvexModulePath, isConvexServerImport } from "../../utils/convex/convex-ast.js";

const MESSAGE =
  "Convex only serves HTTP routes from the router default-exported by `convex/http.ts` — a router built anywhere else is never mounted.";

export const convexHttpRouterInHttpFile = defineRule<Rule>({
  id: "convex-http-router-in-http-file",
  title: "httpRouter outside convex/http.ts",
  severity: "error",
  recommendation:
    "Define the router in convex/http.ts and default-export it, Convex only serves routes from there. See https://docs.convex.dev/functions/http-actions",
  create: (context: RuleContext): RuleVisitors => {
    // Skip when the filename is unknown or the file is outside convex/.
    // Compare the LAST path segment because `convex.json` can relocate
    // the functions root, making the real router file resolve to a
    // module path like `functions/http`.
    const modulePath = getConvexModulePath(context.filename);
    if (modulePath === null || modulePath.split("/").at(-1) === "http") return {};
    return {
      CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
        const callee = stripParenExpression(node.callee as EsTreeNode);
        if (!isNodeOfType(callee, "Identifier") || callee.name !== "httpRouter") return;
        if (!isConvexServerImport(node, callee.name)) return;
        context.report({ node, message: MESSAGE });
      },
    };
  },
});
