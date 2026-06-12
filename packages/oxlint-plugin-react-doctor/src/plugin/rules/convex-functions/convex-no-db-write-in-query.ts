import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { findEnclosingConvexFunction, getCtxBinding } from "../../utils/convex/convex-ast.js";
import { getCtxNamespaceMethodCall } from "./utils/get-ctx-namespace-method-call.js";

const DB_WRITE_METHODS: ReadonlySet<string> = new Set(["insert", "patch", "replace", "delete"]);

export const convexNoDbWriteInQuery = defineRule<Rule>({
  id: "convex-no-db-write-in-query",
  title: "Database write inside a query",
  severity: "error",
  recommendation:
    "Move the write into a `mutation` (or `internalMutation`) and call that from the client or scheduler instead. Queries are read-only by design so results stay cacheable and reactive. See https://docs.convex.dev/functions/query-functions",
  create: (context: RuleContext) => ({
    // `ctx.db.insert/patch/replace/delete` anywhere inside a query
    // handler (including nested closures). The query ctx's `db` has no
    // write methods, so this throws at runtime; TypeScript only catches
    // it when ctx is precisely typed, which `any`-typed helpers and JS
    // files defeat.
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const enclosing = findEnclosingConvexFunction(node);
      if (!enclosing || enclosing.runtime !== "query" || !enclosing.handler) return;
      const ctxBinding = getCtxBinding(enclosing.handler);
      if (!ctxBinding) return;
      const method = getCtxNamespaceMethodCall(node, ctxBinding, "db");
      if (method === null || !DB_WRITE_METHODS.has(method)) return;
      context.report({
        node,
        message: `Queries are read-only: \`ctx.db.${method}(...)\` does not exist on a query's ctx and throws at runtime.`,
      });
    },
  }),
});
