import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getDbQueryChain } from "../../utils/convex/convex-ast.js";
import { getCalleeMethodName, getEnclosingHandlerCtx } from "./utils/handler-ctx.js";

const MESSAGE =
  "`.filter(...)` does not narrow what the query reads — Convex still scans every document in the range and discards the misses, so cost grows with table size.";

export const convexNoFilterInQuery = defineRule<Rule>({
  id: "convex-no-filter-in-query",
  title: "`.filter` on a database query",
  severity: "warn",
  recommendation:
    "Define an index and use `.withIndex` so the database only reads matching documents, or filter in TypeScript after a bounded read (`.take(n)` / pagination). See https://docs.convex.dev/database/reading-data/indexes/ and https://stack.convex.dev/complex-filters-in-convex",
  create: (context: RuleContext) => ({
    // A `.filter(...)` link anywhere in a `ctx.db.query(...)` fluent chain.
    // Array `.filter` on an already-collected result is fine — the chain
    // root check (`getDbQueryChain`) rejects it because the receiver is an
    // awaited value, not the `ctx.db.query(...)` builder.
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      if (getCalleeMethodName(node) !== "filter") return;
      const enclosing = getEnclosingHandlerCtx(node);
      if (!enclosing) return;
      if (getDbQueryChain(node, enclosing.ctxBinding) === null) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
