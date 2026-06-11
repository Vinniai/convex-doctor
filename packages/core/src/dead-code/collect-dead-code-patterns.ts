import fs from "node:fs";
import path from "node:path";
import type { ReactDoctorConfig } from "../types/index.js";
import { collectIgnorePatterns } from "../collect-ignore-patterns.js";
import { readIgnoreFile } from "../read-ignore-file.js";

interface KnipWorkspaceConfig {
  readonly entry?: unknown;
  readonly ignore?: unknown;
}

interface KnipConfig {
  readonly entry?: unknown;
  readonly ignore?: unknown;
  readonly workspaces?: unknown;
}

const KNIP_JSON_FILENAME = "knip.json";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJsonFileSafe = (filePath: string): unknown | null => {
  let rawContents: string;
  try {
    rawContents = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(rawContents);
  } catch {
    return null;
  }
};

const readKnipConfig = (rootDirectory: string): KnipConfig | null => {
  const knipJson = readJsonFileSafe(path.join(rootDirectory, KNIP_JSON_FILENAME));
  if (isRecord(knipJson)) return knipJson;

  const packageJson = readJsonFileSafe(path.join(rootDirectory, "package.json"));
  const packageKnipConfig = isRecord(packageJson) ? packageJson.knip : null;
  return isRecord(packageKnipConfig) ? packageKnipConfig : null;
};

const normalizePatternList = (value: unknown): string[] => {
  if (typeof value === "string" && value.length > 0) return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
};

const prefixWorkspacePatterns = (
  workspacePattern: string,
  patterns: ReadonlyArray<string>,
): string[] => {
  const normalizedWorkspacePattern = workspacePattern.replace(/\/+$/, "");
  return patterns.map((pattern) =>
    pattern.startsWith("!")
      ? `!${normalizedWorkspacePattern}/${pattern.slice(1)}`
      : `${normalizedWorkspacePattern}/${pattern}`,
  );
};

const collectKnipWorkspacePatterns = (
  workspaces: unknown,
  settingName: keyof KnipWorkspaceConfig,
): string[] => {
  if (!isRecord(workspaces)) return [];
  const patterns: string[] = [];
  for (const [workspacePattern, workspaceConfig] of Object.entries(workspaces)) {
    if (!isRecord(workspaceConfig)) continue;
    patterns.push(
      ...prefixWorkspacePatterns(
        workspacePattern,
        normalizePatternList(workspaceConfig[settingName]),
      ),
    );
  }
  return patterns;
};

const collectKnipPatterns = (
  rootDirectory: string,
  settingName: keyof Pick<KnipConfig, "entry" | "ignore">,
): string[] => {
  const config = readKnipConfig(rootDirectory);
  if (!config) return [];
  return [
    ...normalizePatternList(config[settingName]),
    ...collectKnipWorkspacePatterns(config.workspaces, settingName),
  ];
};

export const collectDeadCodeIgnorePatterns = (
  rootDirectory: string,
  userConfig: ReactDoctorConfig | null | undefined,
): string[] => {
  const seen = new Set<string>();
  const sources = [
    readIgnoreFile(path.join(rootDirectory, ".gitignore")),
    collectIgnorePatterns(rootDirectory),
    userConfig?.ignore?.files ?? [],
    collectKnipPatterns(rootDirectory, "ignore"),
  ];
  for (const source of sources) {
    for (const pattern of source) seen.add(pattern);
  }
  return [...seen].filter((pattern) => pattern.length > 0);
};

const CONVEX_JSON_FILENAME = "convex.json";

// Convex functions are deploy-time entry points: the Convex CLI pushes
// every module in the functions directory and clients invoke them through
// the generated `api` object, so nothing in the repo imports them. Without
// this, every `convex/` module (and the `_generated/` runtime it pulls in)
// reports as an unused file. Honors `convex.json`'s `functions` override
// (e.g. `"functions": "functions"`).
const collectConvexEntryPatterns = (rootDirectory: string): string[] => {
  const convexJson = readJsonFileSafe(path.join(rootDirectory, CONVEX_JSON_FILENAME));
  const configuredFunctionsDirectory =
    isRecord(convexJson) &&
    typeof convexJson.functions === "string" &&
    convexJson.functions.length > 0
      ? convexJson.functions.replace(/\/+$/, "")
      : "convex";
  if (!fs.existsSync(path.join(rootDirectory, configuredFunctionsDirectory))) return [];
  return [`${configuredFunctionsDirectory}/**/*.{js,jsx,ts,tsx,mjs,mts}`];
};

export const collectDeadCodeEntryPatterns = (rootDirectory: string): string[] =>
  [
    ...new Set([
      ...collectKnipPatterns(rootDirectory, "entry"),
      ...collectConvexEntryPatterns(rootDirectory),
    ]),
  ].filter((pattern) => pattern.length > 0);
