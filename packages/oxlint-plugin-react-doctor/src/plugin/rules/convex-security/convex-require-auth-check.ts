import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import {
  getConvexFunctionConfig,
  getCtxBinding,
  referencesCtxProperty,
} from "../../utils/convex/convex-ast.js";

const MESSAGE =
  "This public function can write or run side effects for ANY caller — its handler never consults `ctx.auth` to identify the user.";

const destructuresAuthFromCtx = (handler: Parameters<typeof getCtxBinding>[0]): boolean => {
  const ctxBinding = getCtxBinding(handler);
  if (!ctxBinding) return false;
  for (const ctxProperty of ctxBinding.destructuredProperties.values()) {
    if (ctxProperty === "auth") return true;
  }
  return false;
};

export const convexRequireAuthCheck = defineRule<Rule>({
  id: "convex-require-auth-check",
  title: "Public mutation without an auth check",
  severity: "warn",
  recommendation:
    "Check `ctx.auth.getUserIdentity()` (or a shared auth helper) before mutating. See https://docs.convex.dev/auth/functions-auth and https://docs.convex.dev/understanding/best-practices/",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const config = getConvexFunctionConfig(node);
      if (!config || config.isInternal) return;
      // Queries are read-only and too noisy to flag; http actions do
      // their own request-level auth.
      if (config.runtime !== "mutation" && config.runtime !== "action") return;
      if (config.usesLegacyFunctionSyntax || !config.handler) return;
      if (destructuresAuthFromCtx(config.handler)) return;
      // `referencesCtxProperty` counts ctx escapes by default — a
      // handler that hands the whole `ctx` to a helper is assumed
      // to be auth-checked by that helper.
      if (referencesCtxProperty(config.handler, "auth")) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
