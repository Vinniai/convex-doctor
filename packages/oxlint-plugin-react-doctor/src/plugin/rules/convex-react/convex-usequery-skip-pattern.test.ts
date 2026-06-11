import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexUseQuerySkipPattern } from "./convex-usequery-skip-pattern.js";

describe("convex-usequery-skip-pattern", () => {
  it("flags a ternary args argument with an undefined branch", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages({ channelId }) {
        const messages = useQuery(api.messages.list, channelId ? { channelId } : undefined);
        return messages;
      }
    `;
    const result = runRule(convexUseQuerySkipPattern, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags the inverted ternary (undefined in the consequent)", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages({ loading, channelId }) {
        const messages = useQuery(api.messages.list, loading ? undefined : { channelId });
        return messages;
      }
    `;
    const result = runRule(convexUseQuerySkipPattern, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a null branch in usePaginatedQuery args", () => {
    const code = `
      import { usePaginatedQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Feed({ channelId }) {
        const feed = usePaginatedQuery(
          api.messages.feed,
          channelId ? { channelId } : null,
          { initialNumItems: 10 },
        );
        return feed;
      }
    `;
    const result = runRule(convexUseQuerySkipPattern, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it('does NOT flag a ternary that uses "skip"', () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages({ channelId }) {
        const messages = useQuery(api.messages.list, channelId ? { channelId } : "skip");
        return messages;
      }
    `;
    const result = runRule(convexUseQuerySkipPattern, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a plain args object", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages({ channelId }) {
        const messages = useQuery(api.messages.list, { channelId });
        return messages;
      }
    `;
    const result = runRule(convexUseQuerySkipPattern, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag useQuery imported from another package", () => {
    const code = `
      import { useQuery } from "@tanstack/react-query";
      function Messages({ channelId }) {
        const messages = useQuery("messages", channelId ? { channelId } : undefined);
        return messages;
      }
    `;
    const result = runRule(convexUseQuerySkipPattern, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
