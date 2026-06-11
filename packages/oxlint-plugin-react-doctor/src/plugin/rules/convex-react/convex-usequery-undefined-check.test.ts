import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexUseQueryUndefinedCheck } from "./convex-usequery-undefined-check.js";

describe("convex-usequery-undefined-check", () => {
  it("flags a dereference with no loading guard", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages() {
        const msgs = useQuery(api.messages.list, {});
        return msgs.map((message) => message.body);
      }
    `;
    const result = runRule(convexUseQueryUndefinedCheck, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags only the first unguarded dereference", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages() {
        const msgs = useQuery(api.messages.list, {});
        const count = msgs.length;
        return msgs.map((message) => message.body);
      }
    `;
    const result = runRule(convexUseQueryUndefinedCheck, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag when guarded by an explicit undefined check", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages() {
        const msgs = useQuery(api.messages.list, {});
        if (msgs === undefined) return null;
        return msgs.map((message) => message.body);
      }
    `;
    const result = runRule(convexUseQueryUndefinedCheck, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag an optional-chained dereference", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages() {
        const msgs = useQuery(api.messages.list, {});
        return msgs?.map((message) => message.body);
      }
    `;
    const result = runRule(convexUseQueryUndefinedCheck, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a logical-AND guarded dereference", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages() {
        const msgs = useQuery(api.messages.list, {});
        return msgs && msgs.map((message) => message.body);
      }
    `;
    const result = runRule(convexUseQueryUndefinedCheck, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag when guarded by a negation early-return", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages() {
        const msgs = useQuery(api.messages.list, {});
        if (!msgs) return null;
        return msgs.map((message) => message.body);
      }
    `;
    const result = runRule(convexUseQueryUndefinedCheck, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a result from another package's useQuery", () => {
    const code = `
      import { useQuery } from "@tanstack/react-query";
      function Messages() {
        const msgs = useQuery({ queryKey: ["messages"] });
        return msgs.data;
      }
    `;
    const result = runRule(convexUseQueryUndefinedCheck, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
