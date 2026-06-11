import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoHardcodedSecrets } from "./convex-no-hardcoded-secrets.js";

describe("convex-no-hardcoded-secrets", () => {
  it("flags an OpenAI-style key literal in a Convex file", () => {
    const code = `
      import { action } from "./_generated/server";
      export const complete = action({
        args: {},
        handler: async () => {
          const apiKey = "sk-proj4bCdEfGhIjKlMnOpQrStUvWxYz12";
          await fetch("https://api.openai.com/v1/chat/completions", {
            headers: { Authorization: "Bearer " + apiKey },
          });
        },
      });
    `;
    const result = runRule(convexNoHardcodedSecrets, code, {
      filename: "/proj/convex/payments.ts",
    });
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags Stripe, AWS, GitHub, and Slack key shapes in a Convex file", () => {
    const code = `
      const stripe = "sk_live_4eC39HqLyjWDarjtT1zd";
      const aws = "AKIAIOSFODNN7EXAMPLE";
      const github = "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
      const slack = "xoxb-1234567890-abcdef";
    `;
    const result = runRule(convexNoHardcodedSecrets, code, {
      filename: "/proj/convex/payments.ts",
    });
    expect(result.diagnostics).toHaveLength(4);
  });

  it("does NOT flag innocuous strings in a Convex file", () => {
    const code = `
      const tableName = "messages";
      const url = "https://example.com/callback";
      const skater = "sk-8 grind";
      const envVar = process.env.STRIPE_SECRET_KEY;
    `;
    const result = runRule(convexNoHardcodedSecrets, code, {
      filename: "/proj/convex/payments.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag the same secret outside a convex/ directory", () => {
    const code = `
      const apiKey = "sk-proj4bCdEfGhIjKlMnOpQrStUvWxYz12";
    `;
    const result = runRule(convexNoHardcodedSecrets, code, {
      filename: "/proj/src/payments.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when the host provides no filename", () => {
    const code = `
      const apiKey = "sk-proj4bCdEfGhIjKlMnOpQrStUvWxYz12";
    `;
    const result = runRule(convexNoHardcodedSecrets, code, { filename: undefined });
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag generated Convex files", () => {
    const code = `
      const apiKey = "sk-proj4bCdEfGhIjKlMnOpQrStUvWxYz12";
    `;
    const result = runRule(convexNoHardcodedSecrets, code, {
      filename: "/proj/convex/_generated/api.ts",
    });
    expect(result.diagnostics).toHaveLength(0);
  });
});
