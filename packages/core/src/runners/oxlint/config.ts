import * as fs from "node:fs";
import reactDoctorPlugin, {
  CONVEX_RULE_KEYS,
  REACT_COMPILER_RULES,
  REACT_DOCTOR_RULES,
} from "oxlint-plugin-react-doctor";
import type { OxlintRuleSeverity, Rule } from "oxlint-plugin-react-doctor";
import type { ProjectInfo, RuleSeverityControls } from "../../types/index.js";
import { resolveRuleSeverityOverride } from "../../resolve-rule-severity-override.js";
import { COMPILER_CLEANUP_BUCKET, COMPILER_CLEANUP_RULE_KEYS } from "../../constants.js";
import { buildCapabilities, shouldEnableRule } from "./capabilities.js";
import { filterRulesToAvailable, resolveReactHooksJsPlugin } from "./plugin-resolution.js";
import type { JsPluginEntry, ResolvedUserPlugin } from "./plugin-resolution.js";

export interface OxlintConfigOptions {
  pluginPath: string;
  project: ProjectInfo;
  customRulesOnly?: boolean;
  /**
   * Re-enables the React-runtime rule families on a Convex project.
   * Mirrors `ReactDoctorConfig.reactRules`: when the project has a
   * `convex` dependency and this is not `true`, the scan is
   * Convex-first — `convex-*` rules plus framework-agnostic rules
   * only, with every React-scoped rule (and the React Compiler
   * plugin) skipped. Ignored on non-Convex projects.
   */
  reactRules?: boolean;
  extendsPaths?: string[];
  ignoredTags?: ReadonlySet<string>;
  serverAuthFunctionNames?: ReadonlyArray<string>;
  severityControls?: RuleSeverityControls;
  /**
   * User-declared plugins from `react-doctor.config.json`'s
   * `plugins: [...]`, already resolved + introspected via
   * `resolveUserPlugins`. Each plugin's rules are opt-in: they don't
   * run unless `severityControls.rules["<plugin-name>/<rule>"]` is
   * set to `"warn"` or `"error"`.
   */
  userPlugins?: ReadonlyArray<ResolvedUserPlugin>;
}

const resolveSettingsRootDirectory = (rootDirectory: string): string => {
  if (!fs.existsSync(rootDirectory)) return rootDirectory;
  return fs.realpathSync(rootDirectory);
};

// The `compiler-cleanup` bucket override applies to its rule family only when
// the user hasn't pinned that exact rule individually (a per-rule override
// always wins). Returns `undefined` when the rule isn't in the family or no
// bucket override is configured.
const resolveCompilerCleanupBucketSeverity = (
  ruleKey: string,
  severityControls: RuleSeverityControls | undefined,
): "error" | "warn" | "off" | undefined => {
  if (!COMPILER_CLEANUP_RULE_KEYS.has(ruleKey)) return undefined;
  return severityControls?.buckets?.[COMPILER_CLEANUP_BUCKET];
};

const applyRuleSeverityControls = (
  rules: Record<string, OxlintRuleSeverity>,
  severityControls: RuleSeverityControls | undefined,
): Record<string, OxlintRuleSeverity> => {
  const enabledRules: Record<string, OxlintRuleSeverity> = {};
  for (const [ruleKey, defaultSeverity] of Object.entries(rules)) {
    const severity =
      resolveRuleSeverityOverride({ ruleKey }, severityControls) ??
      resolveCompilerCleanupBucketSeverity(ruleKey, severityControls) ??
      defaultSeverity;
    if (severity === "off") continue;
    enabledRules[ruleKey] = severity;
  }
  return enabledRules;
};

/**
 * Builds the `rules` entries for one user-declared plugin. Rules are
 * opt-in: a rule never registers unless `severityControls.rules`
 * explicitly sets it to `"warn"` or `"error"`. This mirrors the
 * built-in plugin's `defaultEnabled: false` behavior so installing
 * a third-party plugin doesn't surprise the user with a flood of
 * new diagnostics on the first scan.
 */
const buildUserPluginRules = (
  userPlugin: ResolvedUserPlugin,
  severityControls: RuleSeverityControls | undefined,
): Record<string, OxlintRuleSeverity> => {
  const enabled: Record<string, OxlintRuleSeverity> = {};
  for (const ruleName of userPlugin.availableRuleNames) {
    const ruleKey = `${userPlugin.entry.name}/${ruleName}`;
    const explicitSeverity = resolveRuleSeverityOverride({ ruleKey }, severityControls);
    if (explicitSeverity === undefined || explicitSeverity === "off") continue;
    enabled[ruleKey] = explicitSeverity;
  }
  return enabled;
};

// A rule is "React-scoped" when it only makes sense on a React (or
// React-framework) codebase: it belongs to a framework bucket, requires
// a React/Preact capability, or applies React-flavored JSX semantics.
// These are the rules the Convex-first mode turns off by default —
// framework-agnostic rules (security, correctness, architecture,
// js-performance, zod, …) keep running on the Convex backend code.
const isReactScopedRule = (rule: Rule): boolean =>
  rule.framework !== "global" ||
  (rule.requires?.some(
    (capability) =>
      capability === "react" ||
      capability.startsWith("react:") ||
      capability === "react-compiler" ||
      capability === "preact" ||
      capability.startsWith("preact:") ||
      capability === "pure-preact",
  ) ??
    false) ||
  (rule.tags?.includes("react-jsx-only") ?? false);

export const createOxlintConfig = ({
  pluginPath,
  project,
  customRulesOnly = false,
  reactRules = false,
  extendsPaths = [],
  ignoredTags = new Set<string>(),
  serverAuthFunctionNames,
  severityControls,
  userPlugins = [],
}: OxlintConfigOptions) => {
  const capabilities = buildCapabilities(project);
  // Convex-first mode: on a Convex project the default scan runs only
  // the `convex-*` buckets plus framework-agnostic rules. The React
  // rule families stay registered (per-rule `severityControls`
  // overrides re-enable them individually) but are skipped wholesale
  // unless the user opts back in via `reactRules: true`.
  const convexFirst = capabilities.has("convex") && !reactRules;

  const reactHooksJsPlugin = convexFirst
    ? null
    : resolveReactHooksJsPlugin(project.hasReactCompiler, customRulesOnly);
  const reactCompilerRules = reactHooksJsPlugin
    ? applyRuleSeverityControls(
        filterRulesToAvailable(
          REACT_COMPILER_RULES,
          "react-hooks-js",
          reactHooksJsPlugin.availableRuleNames,
        ),
        severityControls,
      )
    : {};

  const jsPlugins: JsPluginEntry[] = [];
  if (reactHooksJsPlugin) jsPlugins.push(reactHooksJsPlugin.entry);

  const enabledReactDoctorRules: Record<string, OxlintRuleSeverity> = {};
  for (const registryEntry of REACT_DOCTOR_RULES) {
    const rule = reactDoctorPlugin.rules[registryEntry.id];
    if (!rule) continue;
    // `customRulesOnly` mirrors the historical behavior of the pre-port
    // builtin-react / builtin-a11y gate — skip everything ported 1:1
    // from upstream OXC plugins.
    if (customRulesOnly && registryEntry.originallyExternal) continue;
    if (rule.framework !== "global" && !rule.requires) continue;
    if (!shouldEnableRule(rule.requires, rule.tags, capabilities, ignoredTags, rule.disabledBy))
      continue;
    const explicitSeverity = resolveRuleSeverityOverride(
      { ruleKey: registryEntry.key, category: rule.category },
      severityControls,
    );
    // Convex-first: skip React-scoped rules unless the user pinned this
    // exact rule via `severityControls` (a per-rule override always
    // wins, mirroring the `defaultEnabled: false` contract below).
    if (
      convexFirst &&
      !CONVEX_RULE_KEYS.has(registryEntry.key) &&
      isReactScopedRule(rule) &&
      explicitSeverity === undefined
    ) {
      continue;
    }
    // `defaultEnabled: false` opts a rule out of the default config —
    // it ships in the plugin but only activates when a user explicitly
    // turns it on via `severityControls`. Users can still get the rule
    // by setting its severity to `"warn"` or `"error"` in config.
    if (rule.defaultEnabled === false && explicitSeverity === undefined) continue;
    const severity =
      explicitSeverity ??
      resolveCompilerCleanupBucketSeverity(registryEntry.key, severityControls) ??
      rule.severity;
    if (severity === "off") continue;
    enabledReactDoctorRules[registryEntry.key] = severity;
  }

  // Fold every user-declared plugin's enabled rules + add its
  // resolved specifier to `jsPlugins` so oxlint loads it alongside
  // the built-in react-doctor plugin. Order: react-hooks-js (when
  // present) → user plugins → react-doctor itself. The react-doctor
  // plugin stays last so its rules can reference earlier plugins'
  // settings if a future composition pattern needs that hook.
  const userPluginRules: Record<string, OxlintRuleSeverity> = {};
  for (const userPlugin of userPlugins) {
    Object.assign(userPluginRules, buildUserPluginRules(userPlugin, severityControls));
    jsPlugins.push(userPlugin.entry);
  }

  return {
    ...(extendsPaths.length > 0 ? { extends: extendsPaths } : {}),
    categories: {
      correctness: "off",
      suspicious: "off",
      pedantic: "off",
      perf: "off",
      restriction: "off",
      style: "off",
      nursery: "off",
    },
    // We don't load any OXC built-in plugins anymore — every `react/*`
    // and `jsx-a11y/*` rule has been ported into `react-doctor/*`. The
    // empty `plugins:` array is intentional; rules come exclusively
    // from our codegen-built registry plus configured npm-shipped
    // plugins (react-hooks-js for the React Compiler frontend etc.)
    // and any user-declared plugins from `config.plugins`.
    plugins: [],
    jsPlugins: [...jsPlugins, pluginPath],
    settings: {
      "react-doctor": {
        framework: project.framework,
        rootDirectory: resolveSettingsRootDirectory(project.rootDirectory),
        ...(project.shopifyFlashListMajorVersion !== null
          ? { shopifyFlashListMajorVersion: project.shopifyFlashListMajorVersion }
          : {}),
        ...(serverAuthFunctionNames && serverAuthFunctionNames.length > 0
          ? { serverAuthFunctionNames: [...serverAuthFunctionNames] }
          : {}),
      },
    },
    rules: {
      ...reactCompilerRules,
      ...enabledReactDoctorRules,
      ...userPluginRules,
    },
  };
};
