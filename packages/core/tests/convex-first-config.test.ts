import { describe, expect, it } from "vite-plus/test";
import type { ProjectInfo } from "../src/index.js";
import { createOxlintConfig } from "../src/runners/oxlint/config.js";
import { buildCapabilities } from "../src/runners/oxlint/capabilities.js";

const buildProject = (overrides: Partial<ProjectInfo> = {}): ProjectInfo => ({
  rootDirectory: "/tmp/project",
  projectName: "project",
  reactVersion: "^19.0.0",
  reactMajorVersion: 19,
  tailwindVersion: null,
  zodVersion: null,
  zodMajorVersion: null,
  convexVersion: null,
  framework: "vite",
  hasTypeScript: true,
  hasReactCompiler: false,
  hasTanStackQuery: false,
  nextjsVersion: null,
  nextjsMajorVersion: null,
  hasReactNativeWorkspace: false,
  expoVersion: null,
  shopifyFlashListVersion: null,
  shopifyFlashListMajorVersion: null,
  hasReanimated: false,
  isPreES2023Target: false,
  preactVersion: null,
  preactMajorVersion: null,
  sourceFileCount: 0,
  ...overrides,
});

const ruleKeys = (project: ProjectInfo, reactRules?: boolean): string[] =>
  Object.keys(
    createOxlintConfig({
      pluginPath: "/tmp/plugin.js",
      project,
      ...(reactRules === undefined ? {} : { reactRules }),
    }).rules,
  );

describe("convex capability", () => {
  it("adds the convex capability when the dependency is declared", () => {
    expect(buildCapabilities(buildProject({ convexVersion: "^1.17.0" })).has("convex")).toBe(true);
    expect(buildCapabilities(buildProject()).has("convex")).toBe(false);
  });
});

describe("convex-first rule gating", () => {
  it("enables convex-* rules only on Convex projects", () => {
    const withConvex = ruleKeys(buildProject({ convexVersion: "^1.17.0" }));
    const withoutConvex = ruleKeys(buildProject());
    expect(withConvex.some((key) => key.startsWith("react-doctor/convex-"))).toBe(true);
    expect(withoutConvex.some((key) => key.startsWith("react-doctor/convex-"))).toBe(false);
  });

  it("turns React-scoped rules off by default on a Convex project", () => {
    const keys = ruleKeys(buildProject({ convexVersion: "^1.17.0" }));
    // A representative React-runtime rule family member must be absent…
    expect(keys.some((key) => key.startsWith("react-hooks-js/"))).toBe(false);
    expect(keys).not.toContain("react-doctor/no-derived-state");
    // …including JSX/design/RSC rules from framework-agnostic buckets
    // (suppressed by id — they carry no react capability gate)…
    expect(keys).not.toContain("react-doctor/no-array-index-as-key");
    expect(keys).not.toContain("react-doctor/no-inline-bounce-easing");
    expect(keys).not.toContain("react-doctor/server-auth-actions");
    // …while framework-agnostic rules keep running…
    expect(keys).toContain("react-doctor/no-eval");
    // …and convex rules are on.
    expect(keys).toContain("react-doctor/convex-no-ctx-db-in-action");
  });

  it("keeps the full React rule set on non-Convex projects", () => {
    const keys = ruleKeys(buildProject());
    expect(keys).toContain("react-doctor/no-derived-state");
    expect(keys).toContain("react-doctor/no-eval");
  });

  it("restores React rules on a Convex project with reactRules: true", () => {
    const keys = ruleKeys(buildProject({ convexVersion: "^1.17.0" }), true);
    expect(keys).toContain("react-doctor/no-derived-state");
    expect(keys).toContain("react-doctor/convex-no-ctx-db-in-action");
  });

  it("honors a per-rule severity override even in convex-first mode", () => {
    const config = createOxlintConfig({
      pluginPath: "/tmp/plugin.js",
      project: buildProject({ convexVersion: "^1.17.0" }),
      severityControls: { rules: { "react-doctor/no-derived-state": "error" } },
    });
    expect(config.rules["react-doctor/no-derived-state"]).toBe("error");
  });
});
