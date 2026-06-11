import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import type { RuleVisitors } from "../../utils/rule-visitors.js";
import { isConvexDirectoryFile } from "../../utils/convex/convex-ast.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { stripParenExpression } from "../../utils/strip-paren-expression.js";
import { walkAst } from "../../utils/walk-ast.js";
import { getStaticMemberPropertyName } from "../convex-security/utils/generated-api-import.js";
import { getParameterTypeNode, unwrapParameterIdentifier } from "./utils/parameter-annotations.js";

const MESSAGE =
  'Parameter is typed `string` but flows into `ctx.db` as a document ID — `string` accepts any value and loses the table association `Id<"table">` carries.';

// `ctx.db.get/patch/replace/delete` — the document-ID-taking methods.
const ID_TAKING_DB_METHODS = new Set(["get", "patch", "replace", "delete"]);

const isIdLikeName = (name: string): boolean => name === "id" || name.endsWith("Id");

export const convexPreferIdType = defineRule<Rule>({
  id: "convex-prefer-id-type",
  title: "string type where Id<table> belongs",
  severity: "warn",
  recommendation:
    'Type document IDs as `Id<"tableName">` imported from "./_generated/dataModel" instead of `string` so the table association is checked at compile time. See https://docs.convex.dev/understanding/best-practices/typescript',
  create: (context: RuleContext): RuleVisitors => {
    if (!isConvexDirectoryFile(context.filename)) return {};
    const checkFunction = (functionNode: EsTreeNode): void => {
      const params = (functionNode as { params?: ReadonlyArray<EsTreeNode> }).params ?? [];
      // Matching is name-based on the FIRST parameter's identifier
      // (`<ctx>.db.<method>(...)`); a destructured `db` binding
      // (`({ db }) => ...`) is out of scope.
      const ctxParam = unwrapParameterIdentifier(params[0]);
      if (!ctxParam) return;
      const ctxName = ctxParam.name;
      const stringIdParams = params
        .map((param) => unwrapParameterIdentifier(param))
        .filter(
          (identifier): identifier is EsTreeNodeOfType<"Identifier"> =>
            identifier !== null &&
            identifier !== ctxParam &&
            isIdLikeName(identifier.name) &&
            getParameterTypeNode(identifier)?.type === "TSStringKeyword",
        );
      if (stringIdParams.length === 0) return;
      const body = (functionNode as { body?: EsTreeNode }).body;
      if (!body) return;
      // Collect every identifier passed as the FIRST argument to an
      // ID-taking `ctx.db` method anywhere in the body (nested closures
      // included — name-based, no scope analysis).
      const identifiersPassedAsDocumentId = new Set<string>();
      walkAst(body, (node) => {
        if (!isNodeOfType(node, "CallExpression")) return;
        const callee = stripParenExpression(node.callee as EsTreeNode);
        if (!isNodeOfType(callee, "MemberExpression")) return;
        const methodName = getStaticMemberPropertyName(callee);
        if (methodName === null || !ID_TAKING_DB_METHODS.has(methodName)) return;
        const dbMember = stripParenExpression(callee.object as EsTreeNode);
        if (!isNodeOfType(dbMember, "MemberExpression")) return;
        if (getStaticMemberPropertyName(dbMember) !== "db") return;
        const root = stripParenExpression(dbMember.object as EsTreeNode);
        if (!isNodeOfType(root, "Identifier") || root.name !== ctxName) return;
        const firstArgument = node.arguments.length
          ? stripParenExpression(node.arguments[0] as EsTreeNode)
          : null;
        if (firstArgument && isNodeOfType(firstArgument, "Identifier")) {
          identifiersPassedAsDocumentId.add(firstArgument.name);
        }
      });
      for (const identifier of stringIdParams) {
        if (identifiersPassedAsDocumentId.has(identifier.name)) {
          context.report({ node: identifier, message: MESSAGE });
        }
      }
    };
    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
