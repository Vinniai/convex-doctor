import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoStringFunctionRefs } from "./convex-no-string-function-refs.js";

describe("convex-no-string-function-refs", () => {
  it("flags useQuery called with a string function path", () => {
    const code = `
      import { useQuery } from "convex/react";
      function Messages() {
        const messages = useQuery("messages:list");
        return messages;
      }
    `;
    const result = runRule(convexNoStringFunctionRefs, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags useMutation called with a string function path", () => {
    const code = `
      import { useMutation } from "convex/react";
      function SendButton() {
        const send = useMutation("messages:send");
        return send;
      }
    `;
    const result = runRule(convexNoStringFunctionRefs, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag useQuery called with a generated api reference", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages() {
        const messages = useQuery(api.messages.list);
        return messages;
      }
    `;
    const result = runRule(convexNoStringFunctionRefs, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a string argument to another package's useQuery", () => {
    const code = `
      import { useQuery } from "@tanstack/react-query";
      function Messages() {
        const messages = useQuery("key");
        return messages;
      }
    `;
    const result = runRule(convexNoStringFunctionRefs, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
