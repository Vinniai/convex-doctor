import type { PackageJson } from "../types/index.js";
import { hasReactDependency } from "./has-react-dependency.js";

/**
 * True when the package declares `convex` in any dependency section. Key
 * presence (not version) is what matters — catalog-backed declarations
 * (`"convex": "catalog:"`) and workspace protocols count. Used alongside
 * `hasReactDependency` so Convex backend packages and Convex components
 * (which often declare no React at all) surface in monorepo subproject
 * discovery and the interactive picker.
 */
export const hasConvexDependency = (packageJson: PackageJson): boolean =>
  Boolean(
    packageJson.dependencies?.convex ??
    packageJson.devDependencies?.convex ??
    packageJson.peerDependencies?.convex,
  );

/** A workspace is scannable when it ships React-family or Convex code. */
export const isDiscoverableSubproject = (packageJson: PackageJson): boolean =>
  hasReactDependency(packageJson) || hasConvexDependency(packageJson);
