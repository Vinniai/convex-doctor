import { getConvexModulePath } from "../../utils/convex/convex-ast.js";
import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getConvexServerCalleeName } from "./utils/schema-ast.js";

const MESSAGE =
  "`defineSchema(...)` only takes effect in `convex/schema.ts` — a schema defined in any other module is silently ignored by Convex.";

export const convexSchemaDefineInSchemaFile = defineRule<Rule>({
  id: "convex-schema-define-in-schema-file",
  title: "defineSchema outside convex/schema.ts",
  severity: "error",
  recommendation:
    "Move the schema to `convex/schema.ts` and default-export it, Convex only reads that file when validating and typing tables. See https://docs.convex.dev/database/schemas",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      if (getConvexServerCalleeName(node) !== "defineSchema") return;
      // Only fire when the file demonstrably maps to a Convex module
      // other than `schema` — unknown filenames and files outside
      // `convex/` are skipped rather than guessed at. The LAST path
      // segment is compared (not the whole module path) because
      // `convex.json` can relocate the functions root (e.g.
      // `"functions": "functions"`), which makes the real schema file
      // resolve to a module path like `functions/schema`.
      const modulePath = getConvexModulePath(context.filename);
      if (modulePath === null) return;
      const moduleBasename = modulePath.split("/").at(-1);
      if (moduleBasename === "schema") return;
      context.report({ node, message: MESSAGE });
    },
  }),
});
