import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isConvexServerImport } from "../../utils/convex/convex-ast.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";

const MESSAGE =
  "This index's fields are a strict prefix of another index on the same table — the compound index already serves every query on the prefix fields, so this one only adds write overhead.";

interface IndexLink {
  call: EsTreeNodeOfType<"CallExpression">;
  fields: string[];
}

/** The string elements of `.index(name, ["a", "b"])`'s field array, or `null` when not statically readable. */
const getStaticIndexFields = (call: EsTreeNodeOfType<"CallExpression">): string[] | null => {
  if (call.arguments.length < 2) return null;
  const fieldsArgument = stripParenExpression(call.arguments[1] as EsTreeNode);
  if (!isNodeOfType(fieldsArgument, "ArrayExpression")) return null;
  const fields: string[] = [];
  for (const element of fieldsArgument.elements as ReadonlyArray<EsTreeNode | null>) {
    if (!element) return null;
    const value = stripParenExpression(element);
    if (!isNodeOfType(value, "Literal") || typeof value.value !== "string") return null;
    fields.push(value.value);
  }
  return fields;
};

/** Collects every `.index(name, [fields])` link in the fluent chain hanging off a `defineTable(...)` call. */
const collectIndexLinks = (defineTableCall: EsTreeNodeOfType<"CallExpression">): IndexLink[] => {
  const links: IndexLink[] = [];
  let cursor: EsTreeNode = defineTableCall;
  for (;;) {
    const member: EsTreeNode | null | undefined = cursor.parent;
    if (!member || !isNodeOfType(member, "MemberExpression")) break;
    const call: EsTreeNode | null | undefined = member.parent;
    if (!call || !isNodeOfType(call, "CallExpression") || call.callee !== member) break;
    const property = member.property as EsTreeNode;
    const methodName =
      !member.computed && isNodeOfType(property, "Identifier") ? property.name : null;
    if (methodName === "index") {
      const fields = getStaticIndexFields(call);
      if (fields) links.push({ call, fields });
    }
    cursor = call;
  }
  return links;
};

const isStrictPrefix = (shorter: string[], longer: string[]): boolean =>
  shorter.length < longer.length && shorter.every((field, i) => field === longer[i]);

export const convexAvoidRedundantIndexes = defineRule<Rule>({
  id: "convex-avoid-redundant-indexes",
  title: "Index is a prefix of another index",
  severity: "warn",
  recommendation:
    'A compound index already serves queries on its prefix fields, `.index("by_user", ["userId"])` is redundant next to `.index("by_user_channel", ["userId", "channel"])`; drop the shorter one. See https://docs.convex.dev/database/indexes/indexes-and-query-perf',
  create: (context: RuleContext) => ({
    // The `defineTable(...)` root of a schema fluent chain (the real
    // builder from "convex/server" — not a same-named local helper).
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const callee = stripParenExpression(node.callee as EsTreeNode);
      if (!isNodeOfType(callee, "Identifier") || callee.name !== "defineTable") return;
      if (!isConvexServerImport(node, callee.name)) return;
      const links = collectIndexLinks(node);
      if (links.length < 2) return;
      const reported = new Set<IndexLink>();
      for (const shorter of links) {
        for (const longer of links) {
          if (shorter === longer || reported.has(shorter)) continue;
          if (!isStrictPrefix(shorter.fields, longer.fields)) continue;
          reported.add(shorter);
          context.report({ node: shorter.call, message: MESSAGE });
        }
      }
    },
  }),
});
