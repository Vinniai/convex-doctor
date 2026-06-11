import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getConvexReactHookName } from "../../utils/convex/convex-react-hooks.js";
import { findVariableInitializer } from "../../utils/find-variable-initializer.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";

const MUTATION_HOOKS: ReadonlySet<string> = new Set(["useMutation", "useAction"]);

export const convexMutationFloatingPromise = defineRule<Rule>({
  id: "convex-mutation-floating-promise",
  title: "Mutation result promise dropped",
  severity: "warn",
  recommendation:
    "Await the mutation in an async handler (`await send(...)`) or chain `.catch(...)` so failures surface, a dropped promise swallows server errors silently. See https://docs.convex.dev/client/react#mutations",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      // A bare `send(...)` statement: not awaited, not void-ed, no
      // .then/.catch chain, not assigned or returned.
      if (!isNodeOfType(node.callee, "Identifier")) return;
      if (!node.parent || !isNodeOfType(node.parent, "ExpressionStatement")) return;
      const binding = findVariableInitializer(node, node.callee.name);
      if (!binding?.initializer || !isNodeOfType(binding.initializer, "CallExpression")) return;
      const hookName = getConvexReactHookName(binding.initializer, MUTATION_HOOKS);
      if (!hookName) return;
      context.report({
        node,
        message: `The promise returned by \`${node.callee.name}(...)\` (a ${hookName} function) is dropped — errors from the server will be swallowed.`,
      });
    },
  }),
});
