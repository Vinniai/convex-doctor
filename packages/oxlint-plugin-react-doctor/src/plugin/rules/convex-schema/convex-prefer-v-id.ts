import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import {
  getConvexServerCalleeName,
  getDefineTableFieldsObject,
  getFirstObjectArgument,
  getStaticPropertyKeyName,
  isVStringCall,
} from "./utils/schema-ast.js";

// `userId` / `user_id` → base `user`. The lazy group keeps the base
// minimal so `user_id` strips `_id` (not just `Id` casing).
const ID_SUFFIX_PATTERN = /^(.+?)(?:_id|Id)$/;

// `userId` → ["users", "user"]: the field references a sibling table
// when either the pluralized or the bare base name is a table key.
// External-service IDs (`stripeCustomerId`, …) imply no existing table
// and stay unflagged.
const getImpliedTableNames = (fieldName: string): string[] => {
  const match = ID_SUFFIX_PATTERN.exec(fieldName);
  if (!match) return [];
  const base = match[1];
  return [`${base}s`, base];
};

export const convexPreferVId = defineRule<Rule>({
  id: "convex-prefer-v-id",
  title: "String field where a document ID belongs",
  severity: "warn",
  recommendation:
    'Use `v.id("users")` instead of `v.string()` for reference fields so values are typed `Id<"users">` and validated as real document IDs. See https://docs.convex.dev/database/types#ids and https://docs.convex.dev/understanding/best-practices/typescript',
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      if (getConvexServerCalleeName(node) !== "defineSchema") return;
      const tablesObject = getFirstObjectArgument(node);
      if (!tablesObject) return;
      const tableProperties = (tablesObject.properties as ReadonlyArray<EsTreeNode>).filter(
        (property): property is EsTreeNodeOfType<"Property"> => isNodeOfType(property, "Property"),
      );
      const tableNames = new Set<string>();
      for (const tableProperty of tableProperties) {
        const tableName = getStaticPropertyKeyName(tableProperty);
        if (tableName !== null) tableNames.add(tableName);
      }
      for (const tableProperty of tableProperties) {
        const fields = getDefineTableFieldsObject(tableProperty.value as EsTreeNode);
        if (!fields) continue;
        for (const field of fields.properties as ReadonlyArray<EsTreeNode>) {
          if (!isNodeOfType(field, "Property")) continue;
          const fieldName = getStaticPropertyKeyName(field);
          if (!fieldName) continue;
          const impliedTable = getImpliedTableNames(fieldName).find((name) => tableNames.has(name));
          if (impliedTable === undefined) continue;
          if (!isVStringCall(field.value as EsTreeNode)) continue;
          context.report({
            node: field,
            message: `\`${fieldName}\` is declared \`v.string()\` but this schema has a \`${impliedTable}\` table — plain strings are neither validated nor typed as document IDs.`,
          });
        }
      }
    },
  }),
});
