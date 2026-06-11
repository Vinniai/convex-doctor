import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getConvexReactHookName } from "../../utils/convex/convex-react-hooks.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";

const CONVEX_HOOKS: ReadonlySet<string> = new Set([
  "useQuery",
  "useMutation",
  "useAction",
  "usePaginatedQuery",
]);

export const convexNoStringFunctionRefs = defineRule<Rule>({
  id: "convex-no-string-function-refs",
  title: "String function reference",
  severity: "error",
  recommendation:
    'Import the generated API object with `import { api } from "../convex/_generated/api"` and pass `api.messages.list` instead. String paths like "messages:list" are unchecked at compile time and were removed in Convex 0.19. See https://docs.convex.dev/generated-api/api',
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      const hookName = getConvexReactHookName(node, CONVEX_HOOKS);
      if (!hookName) return;
      const functionReference = node.arguments?.[0];
      if (
        !functionReference ||
        !isNodeOfType(functionReference, "Literal") ||
        typeof functionReference.value !== "string"
      ) {
        return;
      }
      context.report({
        node: functionReference,
        message: `${hookName}() is called with the string "${functionReference.value}" instead of a function reference from the generated \`api\` object.`,
      });
    },
  }),
});
