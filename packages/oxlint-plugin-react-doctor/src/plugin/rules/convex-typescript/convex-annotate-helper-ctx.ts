import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import type { RuleVisitors } from "../../utils/rule-visitors.js";
import {
  getConvexConfigForHandlerFunction,
  isConvexDirectoryFile,
} from "../../utils/convex/convex-ast.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { getParameterTypeNode, unwrapParameterIdentifier } from "./utils/parameter-annotations.js";

const MESSAGE =
  "Module-level Convex helper takes `ctx` without a type — it degrades to `any` and every `ctx.db` / `ctx.auth` access inside loses type checking.";

// `function f(...)` directly at module scope, or behind a single
// `export` / `export default`.
const isTopLevelStatementContainer = (node: EsTreeNode | null | undefined): boolean => {
  if (!node) return false;
  if (isNodeOfType(node, "Program")) return true;
  if (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") {
    return isNodeOfType(node.parent, "Program");
  }
  return false;
};

// `const helper = (ctx) => ...` (any declaration kind) at module scope,
// unwrapping parens / TS assertion wrappers between the function and
// its variable declarator.
const isModuleLevelVariableInitializer = (functionNode: EsTreeNode): boolean => {
  let parent: EsTreeNode | null | undefined = functionNode.parent;
  // Compared as plain strings because `ParenthesizedExpression` isn't
  // part of the EsTreeNodeType union.
  while (parent) {
    const parentType: string = parent.type;
    if (
      parentType !== "ParenthesizedExpression" &&
      parentType !== "TSAsExpression" &&
      parentType !== "TSSatisfiesExpression"
    ) {
      break;
    }
    parent = parent.parent;
  }
  if (!parent || !isNodeOfType(parent, "VariableDeclarator")) return false;
  const declaration = parent.parent;
  if (!declaration || !isNodeOfType(declaration, "VariableDeclaration")) return false;
  return isTopLevelStatementContainer(declaration.parent);
};

export const convexAnnotateHelperCtx = defineRule<Rule>({
  id: "convex-annotate-helper-ctx",
  title: "Untyped ctx parameter in a Convex helper",
  severity: "warn",
  recommendation:
    'Annotate the helper\'s `ctx` parameter with `QueryCtx`, `MutationCtx`, or `ActionCtx` imported from "./_generated/server" so helpers stay typed end to end. See https://docs.convex.dev/understanding/best-practices/typescript',
  create: (context: RuleContext): RuleVisitors => {
    // Only meaningful inside the deployment's `convex/` directory; with
    // no filename we can't tell, so stay silent.
    if (!isConvexDirectoryFile(context.filename)) return {};
    const checkHelperFunction = (functionNode: EsTreeNode): void => {
      const params = (functionNode as { params?: ReadonlyArray<EsTreeNode> }).params ?? [];
      const firstParam = unwrapParameterIdentifier(params[0]);
      if (!firstParam || firstParam.name !== "ctx") return;
      const typeNode = getParameterTypeNode(firstParam);
      // Annotated with anything other than `any` is fine.
      if (typeNode && typeNode.type !== "TSAnyKeyword") return;
      // Registrar handlers (`mutation({ handler: async (ctx) => ... })`)
      // are contextually typed by the builder — only standalone helpers
      // need an explicit annotation.
      if (getConvexConfigForHandlerFunction(functionNode) !== null) return;
      context.report({ node: firstParam, message: MESSAGE });
    };
    return {
      FunctionDeclaration(node: EsTreeNodeOfType<"FunctionDeclaration">) {
        if (isTopLevelStatementContainer(node.parent)) checkHelperFunction(node);
      },
      FunctionExpression(node: EsTreeNodeOfType<"FunctionExpression">) {
        if (isModuleLevelVariableInitializer(node)) checkHelperFunction(node);
      },
      ArrowFunctionExpression(node: EsTreeNodeOfType<"ArrowFunctionExpression">) {
        if (isModuleLevelVariableInitializer(node)) checkHelperFunction(node);
      },
    };
  },
});
