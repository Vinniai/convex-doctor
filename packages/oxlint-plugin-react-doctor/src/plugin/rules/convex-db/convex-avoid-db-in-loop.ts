import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import { getEnclosingHandlerCtx, isCtxDbRootedCall } from "./utils/handler-ctx.js";

const MESSAGE =
  "Awaiting `ctx.db` calls one-by-one inside a loop serializes the round-trips — N iterations take N times the latency of a single batched read/write.";

const LOOP_STATEMENT_TYPES = new Set([
  "ForStatement",
  "ForOfStatement",
  "ForInStatement",
  "WhileStatement",
  "DoWhileStatement",
]);

export const convexAvoidDbInLoop = defineRule<Rule>({
  id: "convex-avoid-db-in-loop",
  title: "Serial database calls in a loop",
  severity: "warn",
  recommendation:
    "Batch the work with `Promise.all(items.map((item) => ctx.db.get(item)))`, or restructure the read as a single indexed query. See https://docs.convex.dev/understanding/best-practices/",
  create: (context: RuleContext) => {
    // Report once per loop, on its first awaited db call.
    const reportedLoops = new WeakSet<EsTreeNode>();
    return {
      AwaitExpression(node: EsTreeNodeOfType<"AwaitExpression">) {
        const enclosing = getEnclosingHandlerCtx(node);
        if (!enclosing) return;
        const argument = stripParenExpression(node.argument as EsTreeNode);
        if (!isNodeOfType(argument, "CallExpression")) return;
        if (!isCtxDbRootedCall(argument, enclosing.ctxBinding)) return;
        // Nearest loop between the await and the handler function itself —
        // loops outside the handler don't make the handler's calls serial.
        let loop: EsTreeNode | null = null;
        let cursor: EsTreeNode | null | undefined = node.parent;
        while (cursor && cursor !== enclosing.handler) {
          if (LOOP_STATEMENT_TYPES.has(cursor.type)) {
            loop = cursor;
            break;
          }
          cursor = cursor.parent ?? null;
        }
        if (!loop || reportedLoops.has(loop)) return;
        reportedLoops.add(loop);
        context.report({ node, message: MESSAGE });
      },
    };
  },
});
