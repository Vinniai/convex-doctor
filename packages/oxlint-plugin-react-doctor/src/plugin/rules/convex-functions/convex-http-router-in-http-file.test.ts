import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexHttpRouterInHttpFile } from "./convex-http-router-in-http-file.js";

describe("convex-http-router-in-http-file", () => {
  it("flags httpRouter() in a convex/ file that is not http.ts", () => {
    const code = `
      import { httpRouter } from "convex/server";
      const http = httpRouter();
      export default http;
    `;
    const result = runRule(convexHttpRouterInHttpFile, code, {
      filename: "/proj/convex/routes.ts",
    });
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag httpRouter() in convex/http.ts", () => {
    const code = `
      import { httpRouter } from "convex/server";
      const http = httpRouter();
      export default http;
    `;
    const result = runRule(convexHttpRouterInHttpFile, code, {
      filename: "/proj/convex/http.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag an httpRouter imported from another module", () => {
    const code = `
      import { httpRouter } from "./my-router-library";
      const router = httpRouter();
      export default router;
    `;
    const result = runRule(convexHttpRouterInHttpFile, code, {
      filename: "/proj/convex/routes.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag files outside convex/", () => {
    const code = `
      import { httpRouter } from "convex/server";
      const router = httpRouter();
    `;
    const result = runRule(convexHttpRouterInHttpFile, code, {
      filename: "/proj/src/router.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when the filename is unknown", () => {
    const code = `
      import { httpRouter } from "convex/server";
      const router = httpRouter();
    `;
    const result = runRule(convexHttpRouterInHttpFile, code, { filename: undefined });
    expect(result.diagnostics).toHaveLength(0);
  });
});
