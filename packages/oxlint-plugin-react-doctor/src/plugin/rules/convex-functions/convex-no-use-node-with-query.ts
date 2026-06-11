import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { findProgramRoot } from "../../utils/find-program-root.js";
import { getConvexRegistrarInfo, hasUseNodeDirective } from "../../utils/convex/convex-ast.js";

const MESSAGE =
  'Files with "use node" run in the Node.js runtime, which can only host actions — registering a query or mutation here fails at push time.';

export const convexNoUseNodeWithQuery = defineRule<Rule>({
  id: "convex-no-use-node-with-query",
  title: 'Query/mutation in a "use node" file',
  severity: "error",
  recommendation:
    "Move queries/mutations to a default-runtime file, only actions can run in Node. See https://docs.convex.dev/functions/runtimes#nodejs-runtime",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const info = getConvexRegistrarInfo(node);
      if (!info || (info.runtime !== "query" && info.runtime !== "mutation")) return;
      const programRoot = findProgramRoot(node);
      if (!programRoot || !hasUseNodeDirective(programRoot)) return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
