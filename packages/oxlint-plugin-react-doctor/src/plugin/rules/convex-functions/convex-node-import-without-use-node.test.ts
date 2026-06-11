import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNodeImportWithoutUseNode } from "./convex-node-import-without-use-node.js";

describe("convex-node-import-without-use-node", () => {
  it('flags a bare Node builtin import in a convex/ file without "use node"', () => {
    const code = `
      import fs from "fs";
      export const read = () => fs.readFileSync("data.json", "utf8");
    `;
    const result = runRule(convexNodeImportWithoutUseNode, code, {
      filename: "/proj/convex/foo.ts",
    });
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a node:-prefixed import too", () => {
    const code = `
      import { randomUUID } from "node:crypto";
      export const id = () => randomUUID();
    `;
    const result = runRule(convexNodeImportWithoutUseNode, code, {
      filename: "/proj/convex/foo.ts",
    });
    expect(result.diagnostics).toHaveLength(1);
  });

  it('does NOT flag when the file has the "use node" directive', () => {
    const code = `
      "use node";
      import fs from "fs";
      export const read = () => fs.readFileSync("data.json", "utf8");
    `;
    const result = runRule(convexNodeImportWithoutUseNode, code, {
      filename: "/proj/convex/foo.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag client files outside convex/", () => {
    const code = `
      import fs from "fs";
      export const read = () => fs.readFileSync("data.json", "utf8");
    `;
    const result = runRule(convexNodeImportWithoutUseNode, code, {
      filename: "/proj/src/x.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag non-builtin imports in convex/ files", () => {
    const code = `
      import { v } from "convex/values";
      import { helper } from "./helpers";
    `;
    const result = runRule(convexNodeImportWithoutUseNode, code, {
      filename: "/proj/convex/foo.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when the filename is unknown", () => {
    const code = `
      import fs from "fs";
      export const read = () => fs.readFileSync("data.json", "utf8");
    `;
    const result = runRule(convexNodeImportWithoutUseNode, code, { filename: undefined });
    expect(result.diagnostics).toHaveLength(0);
  });
});
