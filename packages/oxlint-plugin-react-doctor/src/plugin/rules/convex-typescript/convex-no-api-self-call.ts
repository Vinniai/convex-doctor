import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import type { RuleVisitors } from "../../utils/rule-visitors.js";
import { getConvexModulePath } from "../../utils/convex/convex-ast.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import {
  getStaticMemberPropertyName,
  isGeneratedApiNamedImport,
} from "../convex-security/utils/generated-api-import.js";

const MESSAGE =
  "Referencing this file's own module through the public `api` object creates circular type inference (the module's types depend on themselves) and routes the call through the public surface.";

export const convexNoApiSelfCall = defineRule<Rule>({
  id: "convex-no-api-self-call",
  title: "Function references its own module via api.*",
  severity: "warn",
  recommendation:
    'Reference sibling functions through `internal.*` from "./_generated/api" and add explicit return type annotations to break the circular type inference. See https://docs.convex.dev/understanding/best-practices/typescript and https://docs.convex.dev/functions/internal-functions',
  create: (context: RuleContext): RuleVisitors => {
    const modulePath = getConvexModulePath(context.filename);
    if (!modulePath) return {};
    // Simplification: for nested modules like `users/profile` the
    // generated reference is `api.users.profile.fn`, but we only compare
    // the FIRST path segment — so any `api.users.*` reference from
    // `convex/users/profile.ts` is treated as a self-reference.
    const firstModuleSegment = modulePath.split("/")[0];
    return {
      // Match only the innermost link of the chain (`api.<segment>`) so
      // each `api.messages.list` chain reports exactly once; `internal.*`
      // never matches because the import check is keyed to the named
      // `api` export of `_generated/api`.
      MemberExpression(node: EsTreeNodeOfType<"MemberExpression">) {
        const object = stripParenExpression(node.object as EsTreeNode);
        if (!isNodeOfType(object, "Identifier")) return;
        if (getStaticMemberPropertyName(node) !== firstModuleSegment) return;
        if (!isGeneratedApiNamedImport(node, object.name)) return;
        // Report the full chain (`api.messages.list`, not just
        // `api.messages`) for a more useful diagnostic span.
        let target: EsTreeNode = node;
        while (
          target.parent &&
          isNodeOfType(target.parent, "MemberExpression") &&
          stripParenExpression(target.parent.object as EsTreeNode) === target
        ) {
          target = target.parent;
        }
        context.report({ node: target, message: MESSAGE });
      },
    };
  },
});
