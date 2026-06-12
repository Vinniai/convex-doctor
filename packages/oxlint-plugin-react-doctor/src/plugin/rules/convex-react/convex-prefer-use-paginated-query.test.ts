import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexPreferUsePaginatedQuery } from "./convex-prefer-use-paginated-query.js";

describe("convex-prefer-use-paginated-query", () => {
  it("flags useQuery called with manual paginationOpts", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      export const Messages = () => {
        const page = useQuery(api.messages.list, {
          paginationOpts: { numItems: 10, cursor: null },
        });
        return null;
      };
    `;
    const result = runRule(convexPreferUsePaginatedQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a renamed convex/react useQuery import", () => {
    const code = `
      import { useQuery as useConvexQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      export const Messages = ({ cursor }) => {
        const page = useConvexQuery(api.messages.list, {
          paginationOpts: { numItems: 10, cursor },
        });
        return null;
      };
    `;
    const result = runRule(convexPreferUsePaginatedQuery, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag usePaginatedQuery", () => {
    const code = `
      import { usePaginatedQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      export const Messages = () => {
        const { results } = usePaginatedQuery(api.messages.list, {}, { initialNumItems: 10 });
        return null;
      };
    `;
    const result = runRule(convexPreferUsePaginatedQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag useQuery with ordinary args", () => {
    const code = `
      import { useQuery } from "convex/react";
      import { api } from "../convex/_generated/api";
      export const Messages = ({ channel }) => {
        const messages = useQuery(api.messages.list, { channel });
        return null;
      };
    `;
    const result = runRule(convexPreferUsePaginatedQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a same-named useQuery from another library", () => {
    const code = `
      import { useQuery } from "@tanstack/react-query";
      export const Messages = () => {
        const page = useQuery({ queryKey: ["m"], paginationOpts: { numItems: 10 } });
        return null;
      };
    `;
    const result = runRule(convexPreferUsePaginatedQuery, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
