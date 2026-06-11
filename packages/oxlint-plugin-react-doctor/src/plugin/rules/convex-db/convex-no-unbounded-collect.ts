import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getDbQueryChain } from "../../utils/convex/convex-ast.js";
import { getCalleeMethodName, getEnclosingHandlerCtx } from "./utils/handler-ctx.js";

const MESSAGE =
  "`.collect()` without `.withIndex` / `.withSearchIndex` reads the entire table into memory — it works on seed data and degrades (then hits document limits) as the table grows.";

export const convexNoUnboundedCollect = defineRule<Rule>({
  id: "convex-no-unbounded-collect",
  title: "Unbounded .collect() scans the whole table",
  severity: "warn",
  recommendation:
    "Bound the read: narrow it with `.withIndex(...)`, cap it with `.take(n)`, or page through it with `.paginate(...)`. See https://docs.convex.dev/understanding/best-practices/ and https://docs.convex.dev/database/pagination",
  create: (context: RuleContext) => ({
    // `.collect()` terminating a `ctx.db.query(...)` chain that never
    // narrowed the scan with an index. `.order(...)` does not bound
    // anything — `query("t").order("desc").collect()` still scans it all.
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      if (getCalleeMethodName(node) !== "collect") return;
      const enclosing = getEnclosingHandlerCtx(node);
      if (!enclosing) return;
      const chain = getDbQueryChain(node, enclosing.ctxBinding);
      if (chain === null) return;
      if (chain.includes("withIndex") || chain.includes("withSearchIndex")) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
