import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import {
  getConvexFunctionConfig,
  getCtxBinding,
  referencesCtxProperty,
} from "../../utils/convex/convex-ast.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";

const USER_ID_ARG_NAMES = new Set(["userId", "user_id"]);

const MESSAGE =
  "A client can pass ANY user ID here — without an `ctx.auth` check the handler acts on behalf of whoever the caller claims to be.";

const findUserIdArgProperty = (argsValidator: EsTreeNode | null): EsTreeNode | null => {
  if (!argsValidator) return null;
  const objectExpression = stripParenExpression(argsValidator);
  if (!isNodeOfType(objectExpression, "ObjectExpression")) return null;
  for (const property of objectExpression.properties as ReadonlyArray<EsTreeNode>) {
    if (!isNodeOfType(property, "Property")) continue;
    const key = property.key as EsTreeNode;
    const name = isNodeOfType(key, "Identifier")
      ? key.name
      : isNodeOfType(key, "Literal") && typeof key.value === "string"
        ? key.value
        : null;
    if (name !== null && USER_ID_ARG_NAMES.has(name)) return property;
  }
  return null;
};

const destructuresAuthFromCtx = (handler: EsTreeNode): boolean => {
  const ctxBinding = getCtxBinding(handler);
  if (!ctxBinding) return false;
  for (const ctxProperty of ctxBinding.destructuredProperties.values()) {
    if (ctxProperty === "auth") return true;
  }
  return false;
};

export const convexNoUntrustedUserId = defineRule<Rule>({
  id: "convex-no-untrusted-user-id",
  title: "Client-supplied user ID trusted without auth",
  severity: "warn",
  recommendation:
    "Derive the acting user from `ctx.auth.getUserIdentity()` server-side instead of trusting a client-passed ID. See https://docs.convex.dev/understanding/best-practices/",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const config = getConvexFunctionConfig(node);
      if (!config || config.isInternal || config.runtime === "http") return;
      if (config.usesLegacyFunctionSyntax || !config.handler) return;
      const userIdProperty = findUserIdArgProperty(config.argsValidator);
      if (!userIdProperty) return;
      if (destructuresAuthFromCtx(config.handler)) return;
      if (referencesCtxProperty(config.handler, "auth")) return;
      context.report({ node: userIdProperty, message: MESSAGE });
    },
  }),
});
