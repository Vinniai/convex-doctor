import type { EsTreeNode } from "../es-tree-node.js";
import type { EsTreeNodeOfType } from "../es-tree-node-of-type.js";
import { findProgramRoot } from "../find-program-root.js";
import { isImportedFromModule } from "../find-import-source-for-name.js";
import { isNodeOfType } from "../is-node-of-type.js";
import { stripParenExpression } from "../strip-paren-expression.js";
import { walkAst } from "../walk-ast.js";

// Shared AST helpers for the `convex-*` rule buckets. Convex functions
// are registered by calling builders imported from the deployment's
// codegen output (`convex/_generated/server`) — `query`, `mutation`,
// `action`, their `internal*` variants, and `httpAction`:
//
//   import { query } from "./_generated/server";
//   export const list = query({
//     args: { channel: v.id("channels") },
//     handler: async (ctx, args) => { ... },
//   });
//
// Everything here keys off those imports (never bare identifier names)
// so a homegrown `query()` helper in a non-Convex file can't false-fire.

/** The Convex runtime a registered function executes in. */
export type ConvexRuntime = "query" | "mutation" | "action" | "http";

export interface ConvexRegistrarInfo {
  /** The builder's exported name, e.g. `"internalMutation"`. */
  registrarName: string;
  runtime: ConvexRuntime;
  /** `internalQuery` / `internalMutation` / `internalAction` — not part of the public API. */
  isInternal: boolean;
}

const CONVEX_REGISTRARS: ReadonlyMap<string, ConvexRegistrarInfo> = new Map(
  (
    [
      { registrarName: "query", runtime: "query", isInternal: false },
      { registrarName: "internalQuery", runtime: "query", isInternal: true },
      { registrarName: "mutation", runtime: "mutation", isInternal: false },
      { registrarName: "internalMutation", runtime: "mutation", isInternal: true },
      { registrarName: "action", runtime: "action", isInternal: false },
      { registrarName: "internalAction", runtime: "action", isInternal: true },
      { registrarName: "httpAction", runtime: "http", isInternal: false },
    ] satisfies ConvexRegistrarInfo[]
  ).map((info) => [info.registrarName, info]),
);

// `convex/_generated/server` is imported via a relative path whose depth
// depends on the importing file (`./_generated/server`,
// `../_generated/server`, …) and may carry an explicit `.js` extension
// under `"type": "module"` setups.
const GENERATED_SERVER_SOURCE_PATTERN = /(?:^|\/)_generated\/server(?:\.js|\.ts)?$/;

export const isGeneratedServerSource = (source: string): boolean =>
  GENERATED_SERVER_SOURCE_PATTERN.test(source);

const GENERATED_API_SOURCE_PATTERN = /(?:^|\/)_generated\/api(?:\.js|\.ts)?$/;

export const isGeneratedApiSource = (source: string): boolean =>
  GENERATED_API_SOURCE_PATTERN.test(source);

const findImportSourceMatching = (
  contextNode: EsTreeNode,
  localName: string,
  sourceMatches: (source: string) => boolean,
): boolean => {
  const programRoot = findProgramRoot(contextNode);
  if (!programRoot) return false;
  for (const statement of programRoot.body as ReadonlyArray<EsTreeNode>) {
    if (!isNodeOfType(statement, "ImportDeclaration")) continue;
    const source = (statement.source as { value?: unknown } | undefined)?.value;
    if (typeof source !== "string" || !sourceMatches(source)) continue;
    const specifiers = (statement as { specifiers?: ReadonlyArray<EsTreeNode> }).specifiers ?? [];
    for (const specifier of specifiers) {
      const local = (specifier as { local?: { name?: unknown } }).local;
      if (local?.name === localName) return true;
    }
  }
  return false;
};

/**
 * When `call` registers a Convex function — its callee is an identifier
 * imported from a `_generated/server` module and named one of the
 * registrar builders — returns the registrar's info. `null` otherwise.
 */
export const getConvexRegistrarInfo = (
  call: EsTreeNodeOfType<"CallExpression">,
): ConvexRegistrarInfo | null => {
  const callee = stripParenExpression(call.callee as EsTreeNode);
  if (!isNodeOfType(callee, "Identifier")) return null;
  const info = CONVEX_REGISTRARS.get(callee.name);
  if (!info) return null;
  if (!findImportSourceMatching(call, callee.name, isGeneratedServerSource)) return null;
  return info;
};

const isFunctionNode = (
  node: EsTreeNode | null | undefined,
): node is
  | EsTreeNodeOfType<"FunctionExpression">
  | EsTreeNodeOfType<"ArrowFunctionExpression">
  | EsTreeNodeOfType<"FunctionDeclaration"> =>
  isNodeOfType(node, "FunctionExpression") ||
  isNodeOfType(node, "ArrowFunctionExpression") ||
  isNodeOfType(node, "FunctionDeclaration");

export interface ConvexFunctionConfig extends ConvexRegistrarInfo {
  /** The registrar `CallExpression` itself. */
  call: EsTreeNodeOfType<"CallExpression">;
  /**
   * The handler function: the `handler` property of the object-syntax
   * config, or the function passed directly in the legacy shorthand
   * `query(async (ctx) => ...)`. `null` when neither shape matches
   * (e.g. the handler is a referenced identifier).
   */
  handler: EsTreeNode | null;
  /** `true` for the legacy `query(async (ctx) => ...)` function shorthand. */
  usesLegacyFunctionSyntax: boolean;
  /** The `args:` property's value in object syntax, `null` when absent. */
  argsValidator: EsTreeNode | null;
  /** The `returns:` property's value in object syntax, `null` when absent. */
  returnsValidator: EsTreeNode | null;
}

const getStaticPropertyValue = (
  objectExpression: EsTreeNodeOfType<"ObjectExpression">,
  propertyName: string,
): EsTreeNode | null => {
  for (const property of objectExpression.properties as ReadonlyArray<EsTreeNode>) {
    if (!isNodeOfType(property, "Property")) continue;
    const key = property.key as EsTreeNode;
    const name = isNodeOfType(key, "Identifier")
      ? key.name
      : isNodeOfType(key, "Literal") && typeof key.value === "string"
        ? key.value
        : null;
    if (name === propertyName) return property.value as EsTreeNode;
  }
  return null;
};

/**
 * Full shape of a Convex function registration. Returns `null` when
 * `call` isn't a registrar call (see {@link getConvexRegistrarInfo}).
 */
export const getConvexFunctionConfig = (
  call: EsTreeNodeOfType<"CallExpression">,
): ConvexFunctionConfig | null => {
  const info = getConvexRegistrarInfo(call);
  if (!info) return null;
  const firstArgument = call.arguments.length
    ? stripParenExpression(call.arguments[0] as EsTreeNode)
    : null;
  if (firstArgument && isFunctionNode(firstArgument)) {
    return {
      ...info,
      call,
      handler: firstArgument,
      usesLegacyFunctionSyntax: true,
      argsValidator: null,
      returnsValidator: null,
    };
  }
  if (firstArgument && isNodeOfType(firstArgument, "ObjectExpression")) {
    const handlerValue = getStaticPropertyValue(firstArgument, "handler");
    const handler =
      handlerValue && isFunctionNode(stripParenExpression(handlerValue))
        ? stripParenExpression(handlerValue)
        : null;
    return {
      ...info,
      call,
      handler,
      usesLegacyFunctionSyntax: false,
      argsValidator: getStaticPropertyValue(firstArgument, "args"),
      returnsValidator: getStaticPropertyValue(firstArgument, "returns"),
    };
  }
  return {
    ...info,
    call,
    handler: null,
    usesLegacyFunctionSyntax: false,
    argsValidator: null,
    returnsValidator: null,
  };
};

/**
 * Walks the `parent` chain from `node` to find the Convex function
 * registration whose handler (transitively) contains it. Nested
 * closures inside the handler still resolve to the registration —
 * a `.map(async (x) => ctx.db.get(x))` callback inside an action
 * handler reports the action. Returns `null` outside any handler.
 */
export const findEnclosingConvexFunction = (node: EsTreeNode): ConvexFunctionConfig | null => {
  let cursor: EsTreeNode | null | undefined = node;
  while (cursor) {
    if (isFunctionNode(cursor)) {
      const config = getConvexConfigForHandlerFunction(cursor);
      if (config) return config;
    }
    cursor = cursor.parent ?? null;
  }
  return null;
};

/**
 * When `functionNode` IS the handler of a Convex registration (directly
 * passed in the legacy shorthand, or the `handler:` property value),
 * returns that registration. `null` otherwise.
 */
export const getConvexConfigForHandlerFunction = (
  functionNode: EsTreeNode,
): ConvexFunctionConfig | null => {
  let parent: EsTreeNode | null | undefined = functionNode.parent;
  // Unwrap parenthesised / TS-asserted wrappers between the function
  // and its structural parent. Compared as plain strings because
  // `ParenthesizedExpression` isn't part of the EsTreeNodeType union.
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
  if (!parent) return null;
  // Legacy shorthand: query(async (ctx) => ...)
  if (isNodeOfType(parent, "CallExpression")) {
    const config = getConvexFunctionConfig(parent);
    if (config && config.handler && stripParenExpression(config.handler) !== functionNode) {
      return null;
    }
    return config;
  }
  // Object syntax: the function is the `handler` property's value.
  if (isNodeOfType(parent, "Property")) {
    const objectExpression = parent.parent;
    if (!isNodeOfType(objectExpression, "ObjectExpression")) return null;
    const call = objectExpression.parent;
    if (!isNodeOfType(call, "CallExpression")) return null;
    const config = getConvexFunctionConfig(call);
    if (!config || !config.handler) return null;
    return stripParenExpression(config.handler) === functionNode ? config : null;
  }
  return null;
};

export interface CtxBinding {
  /** The handler's first parameter name (`ctx` in `(ctx, args) => ...`), or `null` when destructured. */
  identifierName: string | null;
  /**
   * For a destructured first parameter (`({ db, auth }) => ...`):
   * local binding name → ctx property name (handles renames like
   * `({ db: database })`). Empty when the parameter is an identifier.
   */
  destructuredProperties: ReadonlyMap<string, string>;
}

/** The handler's `ctx` binding (first parameter), or `null` when absent. */
export const getCtxBinding = (handlerFunction: EsTreeNode): CtxBinding | null => {
  const params = (handlerFunction as { params?: ReadonlyArray<EsTreeNode> }).params;
  if (!params || params.length === 0) return null;
  let first: EsTreeNode = params[0] as EsTreeNode;
  if (first.type === "TSParameterProperty") {
    first = (first as { parameter?: EsTreeNode }).parameter ?? first;
  }
  if (isNodeOfType(first, "AssignmentPattern")) first = first.left as EsTreeNode;
  if (isNodeOfType(first, "Identifier")) {
    return { identifierName: first.name, destructuredProperties: new Map() };
  }
  if (isNodeOfType(first, "ObjectPattern")) {
    const destructured = new Map<string, string>();
    for (const property of first.properties as ReadonlyArray<EsTreeNode>) {
      if (!isNodeOfType(property, "Property")) continue;
      const key = property.key as EsTreeNode;
      const value = property.value as EsTreeNode;
      if (!isNodeOfType(key, "Identifier")) continue;
      const localTarget = isNodeOfType(value, "AssignmentPattern")
        ? (value.left as EsTreeNode)
        : value;
      if (!isNodeOfType(localTarget, "Identifier")) continue;
      destructured.set(localTarget.name, key.name);
    }
    return { identifierName: null, destructuredProperties: destructured };
  }
  return null;
};

const getStaticMemberName = (member: EsTreeNodeOfType<"MemberExpression">): string | null => {
  if (member.computed) {
    const property = member.property as EsTreeNode;
    return isNodeOfType(property, "Literal") && typeof property.value === "string"
      ? property.value
      : null;
  }
  const property = member.property as EsTreeNode;
  return isNodeOfType(property, "Identifier") ? property.name : null;
};

/**
 * When `node` is an access to `<ctx>.<property>` for the given handler's
 * ctx binding — either `ctx.db` member access or a use of a destructured
 * `db` binding — returns the ctx property name (e.g. `"db"`,
 * `"scheduler"`). `null` otherwise. Name-based (no scope analysis), so
 * a shadowed `ctx` in a nested closure can in principle false-match;
 * Convex handlers conventionally never shadow `ctx`.
 */
export const getCtxPropertyAccess = (node: EsTreeNode, ctxBinding: CtxBinding): string | null => {
  if (isNodeOfType(node, "MemberExpression")) {
    const object = stripParenExpression(node.object as EsTreeNode);
    if (
      ctxBinding.identifierName !== null &&
      isNodeOfType(object, "Identifier") &&
      object.name === ctxBinding.identifierName
    ) {
      return getStaticMemberName(node);
    }
    return null;
  }
  if (isNodeOfType(node, "Identifier")) {
    return ctxBinding.destructuredProperties.get(node.name) ?? null;
  }
  return null;
};

/**
 * True when the handler's body (including nested closures) touches
 * `<ctx>.<property>` — e.g. `referencesCtxProperty(handler, "auth")`
 * for auth-check detection. Also `true` when the handler forwards the
 * whole `ctx` object to another function (`helper(ctx, ...)`), since
 * the callee may perform the access on the handler's behalf.
 */
export const referencesCtxProperty = (
  handlerFunction: EsTreeNode,
  propertyName: string,
  options: { countCtxEscapes?: boolean } = {},
): boolean => {
  const countCtxEscapes = options.countCtxEscapes ?? true;
  const ctxBinding = getCtxBinding(handlerFunction);
  if (!ctxBinding) return false;
  const body = (handlerFunction as { body?: EsTreeNode }).body;
  if (!body) return false;
  let found = false;
  walkAst(body, (node) => {
    if (found) return false;
    if (isNodeOfType(node, "MemberExpression")) {
      if (getCtxPropertyAccess(node, ctxBinding) === propertyName) {
        found = true;
        return false;
      }
      return;
    }
    if (!isNodeOfType(node, "Identifier")) return;
    if (ctxBinding.destructuredProperties.get(node.name) === propertyName) {
      found = true;
      return false;
    }
    if (
      countCtxEscapes &&
      ctxBinding.identifierName !== null &&
      node.name === ctxBinding.identifierName
    ) {
      // A bare `ctx` reference that is NOT the object of a member
      // expression means ctx escapes into a helper — assume the helper
      // may touch the property.
      const parent = node.parent;
      const isMemberObject =
        parent !== undefined &&
        isNodeOfType(parent, "MemberExpression") &&
        stripParenExpression(parent.object as EsTreeNode) === node;
      const isOwnParameter = parent !== undefined && isFunctionNode(parent);
      if (!isMemberObject && !isOwnParameter) {
        found = true;
        return false;
      }
    }
  });
  return found;
};

/**
 * Resolves a member/call chain like
 * `ctx.db.query("messages").withIndex(...).filter(...).collect()` into
 * the ordered method names AFTER `ctx.db.query(...)` — for the example,
 * `["withIndex", "filter", "collect"]`. Returns `null` when `call` is
 * not rooted at a `<ctx>.db.query(...)` chain. Pass the innermost
 * handler's binding via `ctxBinding`.
 *
 * `call` may be any CallExpression in the chain; the result always
 * describes the full chain from the `query(...)` root up to `call`.
 */
export const getDbQueryChain = (
  call: EsTreeNodeOfType<"CallExpression">,
  ctxBinding: CtxBinding,
): string[] | null => {
  const methodNames: string[] = [];
  let cursor: EsTreeNode = call;
  for (;;) {
    if (!isNodeOfType(cursor, "CallExpression")) return null;
    const callee = stripParenExpression(cursor.callee as EsTreeNode);
    if (!isNodeOfType(callee, "MemberExpression")) return null;
    const methodName = getStaticMemberName(callee);
    if (methodName === null) return null;
    const receiver = stripParenExpression(callee.object as EsTreeNode);
    if (methodName === "query") {
      // The chain root must be `<ctx>.db.query(...)` or a destructured
      // `db.query(...)`.
      const dbProperty = getCtxPropertyAccess(receiver, ctxBinding);
      return dbProperty === "db" ? methodNames : null;
    }
    methodNames.unshift(methodName);
    cursor = receiver;
  }
};

/** True when `filename` (any separator style) lives under a `convex/` directory. */
export const isConvexDirectoryFile = (filename: string | undefined): boolean => {
  if (!filename) return false;
  const normalized = filename.replaceAll("\\", "/");
  return /(^|\/)convex\//.test(normalized) && !normalized.includes("/_generated/");
};

/**
 * The module name a file registers under in the generated `api` object:
 * `convex/messages.ts` → `"messages"`, `convex/users/profile.ts` →
 * `"users/profile"`. `null` for files outside `convex/`.
 */
export const getConvexModulePath = (filename: string | undefined): string | null => {
  if (!filename) return null;
  const normalized = filename.replaceAll("\\", "/");
  const match = normalized.match(/(?:^|\/)convex\/(.+?)\.(?:ts|tsx|js|jsx|mts|mjs)$/);
  if (!match) return null;
  if (match[1].startsWith("_generated/")) return null;
  return match[1];
};

/** True when the file opens with a `"use node"` directive prologue. */
export const hasUseNodeDirective = (program: EsTreeNodeOfType<"Program">): boolean => {
  for (const statement of program.body as ReadonlyArray<EsTreeNode>) {
    if (!isNodeOfType(statement, "ExpressionStatement")) break;
    const expression = statement.expression as EsTreeNode;
    if (!isNodeOfType(expression, "Literal") || typeof expression.value !== "string") break;
    if (expression.value === "use node") return true;
  }
  return false;
};

/**
 * True when `localName` was imported from `convex/values` (the `v`
 * validator builder namespace).
 */
export const isConvexValuesImport = (contextNode: EsTreeNode, localName: string): boolean =>
  isImportedFromModule(contextNode, localName, "convex/values");

/**
 * True when `localName` was imported from `convex/server` (e.g.
 * `cronJobs`, `defineSchema`, `defineTable`, `httpRouter`).
 */
export const isConvexServerImport = (contextNode: EsTreeNode, localName: string): boolean =>
  isImportedFromModule(contextNode, localName, "convex/server");
