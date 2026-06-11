import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import {
  getConvexServerCalleeName,
  getFirstObjectArgument,
  getStaticPropertyKeyName,
} from "./utils/schema-ast.js";

export const convexSchemaNoReservedFields = defineRule<Rule>({
  id: "convex-schema-no-reserved-fields",
  title: "Reserved system field in schema",
  severity: "error",
  recommendation:
    "Drop the leading underscore, `_id` and `_creationTime` are added to every document automatically, and `_`-prefixed field names are reserved for Convex system fields. See https://docs.convex.dev/database/types#system-fields",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      if (getConvexServerCalleeName(node) !== "defineTable") return;
      const fields = getFirstObjectArgument(node);
      if (!fields) return;
      for (const property of fields.properties as ReadonlyArray<EsTreeNode>) {
        if (!isNodeOfType(property, "Property")) continue;
        const fieldName = getStaticPropertyKeyName(property);
        if (!fieldName || !fieldName.startsWith("_")) continue;
        context.report({
          node: property,
          message: `\`${fieldName}\` is a reserved field name — \`_\`-prefixed fields are managed by Convex and cannot be declared in \`defineTable\`.`,
        });
      }
    },
  }),
});
