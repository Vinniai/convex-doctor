import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import type { RuleVisitors } from "../../utils/rule-visitors.js";
import { findProgramRoot } from "../../utils/find-program-root.js";
import { hasUseNodeDirective, isConvexDirectoryFile } from "../../utils/convex/convex-ast.js";

const MESSAGE =
  'This Convex file imports a Node builtin but has no "use node" directive — the default Convex runtime doesn\'t ship Node APIs, so the import fails at push time.';

const NODE_BUILTIN_MODULES = new Set([
  "fs",
  "path",
  "child_process",
  "os",
  "net",
  "http",
  "https",
  "worker_threads",
  "stream",
  "zlib",
  "dns",
  "tls",
]);

const isNodeBuiltinSource = (source: string): boolean =>
  source.startsWith("node:") || NODE_BUILTIN_MODULES.has(source);

export const convexNodeImportWithoutUseNode = defineRule<Rule>({
  id: "convex-node-import-without-use-node",
  title: "Node builtin imported in the default Convex runtime",
  severity: "error",
  // Test files under convex/ (`__tests__/*.test.ts`) execute in vitest's
  // Node runtime, not Convex's — the test-noise wrapper skips them.
  tags: ["test-noise"],
  recommendation:
    'Add "use node" at the top of the file (and make it actions-only), or drop the Node dependency, the default runtime doesn\'t ship Node APIs. See https://docs.convex.dev/functions/runtimes',
  create: (context: RuleContext): RuleVisitors => {
    if (!isConvexDirectoryFile(context.filename)) return {};
    return {
      ImportDeclaration(node: EsTreeNodeOfType<"ImportDeclaration">) {
        const source = (node.source as { value?: unknown } | undefined)?.value;
        if (typeof source !== "string" || !isNodeBuiltinSource(source)) return;
        const programRoot = findProgramRoot(node);
        if (!programRoot || hasUseNodeDirective(programRoot)) return;
        context.report({ node, message: MESSAGE });
      },
    };
  },
});
