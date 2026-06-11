import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexNoConditionalConvexHooks } from "./convex-no-conditional-convex-hooks.js";

describe("convex-no-conditional-convex-hooks", () => {
  it("flags useQuery inside an if statement", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages({ channelId }) {
        if (channelId) {
          const messages = useQuery(api.messages.list, { channelId });
          return messages;
        }
        return null;
      }
    `;
    const result = runRule(convexNoConditionalConvexHooks, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags useQuery inside a ternary", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages({ channelId }) {
        const messages = channelId ? useQuery(api.messages.list, { channelId }) : undefined;
        return messages;
      }
    `;
    const result = runRule(convexNoConditionalConvexHooks, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags useMutation inside an onClick callback", () => {
    const code = `
      import { useMutation } from "convex/react";
      import { api } from "../convex/_generated/api";
      function SendButton() {
        return (
          <button
            onClick={() => {
              const send = useMutation(api.messages.send);
              send({ body: "hi" });
            }}
          >
            Send
          </button>
        );
      }
    `;
    const result = runRule(convexNoConditionalConvexHooks, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags useQuery inside a loop", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Channels({ channelIds }) {
        const results = [];
        for (const channelId of channelIds) {
          results.push(useQuery(api.messages.list, { channelId }));
        }
        return results;
      }
    `;
    const result = runRule(convexNoConditionalConvexHooks, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag useQuery at the top level of a component", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Messages({ channelId }) {
        const messages = useQuery(api.messages.list, channelId ? { channelId } : "skip");
        return messages ?? null;
      }
    `;
    const result = runRule(convexNoConditionalConvexHooks, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag useQuery at the top level of a custom hook", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      function useMessages(channelId) {
        const messages = useQuery(api.messages.list, { channelId });
        return messages;
      }
    `;
    const result = runRule(convexNoConditionalConvexHooks, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a conditional useQuery imported from another package", () => {
    const code = `
      import { useQuery } from "@tanstack/react-query";
      function Messages({ channelId }) {
        if (channelId) {
          return useQuery({ queryKey: ["messages", channelId] });
        }
        return null;
      }
    `;
    const result = runRule(convexNoConditionalConvexHooks, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
