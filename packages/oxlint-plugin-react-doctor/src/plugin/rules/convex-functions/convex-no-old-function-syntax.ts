import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getConvexFunctionConfig } from "../../utils/convex/convex-ast.js";

const MESSAGE =
  "Passing a bare function to a Convex registrar skips argument validators — any client can call this function with arbitrary arguments.";

export const convexNoOldFunctionSyntax = defineRule<Rule>({
  id: "convex-no-old-function-syntax",
  title: "Legacy function syntax without validators",
  severity: "error",
  recommendation:
    "Use the object syntax `query({ args: {...}, handler: async (ctx, args) => {...} })` so argument validators apply. See https://docs.convex.dev/functions/query-functions",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const config = getConvexFunctionConfig(node);
      if (!config || !config.usesLegacyFunctionSyntax) return;
      // `httpAction(async (ctx, request) => ...)` legitimately takes a
      // bare function — HTTP actions have no args validators at all.
      if (config.runtime === "http") return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
