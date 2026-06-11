import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexMutationFloatingPromise } from "./convex-mutation-floating-promise.js";

describe("convex-mutation-floating-promise", () => {
  it("flags a bare mutation call inside an onClick handler", () => {
    const code = `
      import { useMutation } from "convex/react";
      import { api } from "../convex/_generated/api";
      function SendButton() {
        const send = useMutation(api.messages.send);
        return (
          <button
            onClick={() => {
              send({ body: "hi" });
            }}
          >
            Send
          </button>
        );
      }
    `;
    const result = runRule(convexMutationFloatingPromise, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags a bare useAction call too", () => {
    const code = `
      import { useAction } from "convex/react";
      import { api } from "../convex/_generated/api";
      function Embed() {
        const embed = useAction(api.ai.embed);
        const onPress = () => {
          embed({ text: "hello" });
        };
        return onPress;
      }
    `;
    const result = runRule(convexMutationFloatingPromise, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does NOT flag an awaited mutation call", () => {
    const code = `
      import { useMutation } from "convex/react";
      import { api } from "../convex/_generated/api";
      function SendButton() {
        const send = useMutation(api.messages.send);
        const onClick = async () => {
          await send({ body: "hi" });
        };
        return onClick;
      }
    `;
    const result = runRule(convexMutationFloatingPromise, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a mutation call with a .catch chain", () => {
    const code = `
      import { useMutation } from "convex/react";
      import { api } from "../convex/_generated/api";
      function SendButton() {
        const send = useMutation(api.messages.send);
        const onClick = () => {
          send({ body: "hi" }).catch((error) => console.error(error));
        };
        return onClick;
      }
    `;
    const result = runRule(convexMutationFloatingPromise, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a void-ed mutation call", () => {
    const code = `
      import { useMutation } from "convex/react";
      import { api } from "../convex/_generated/api";
      function SendButton() {
        const send = useMutation(api.messages.send);
        const onClick = () => {
          void send({ body: "hi" });
        };
        return onClick;
      }
    `;
    const result = runRule(convexMutationFloatingPromise, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a bare call to a non-mutation function", () => {
    const code = `
      import { useMutation } from "convex/react";
      import { api } from "../convex/_generated/api";
      function SendButton() {
        const send = useMutation(api.messages.send);
        const log = (body) => console.log(body);
        const onClick = async () => {
          log("clicked");
          await send({ body: "hi" });
        };
        return onClick;
      }
    `;
    const result = runRule(convexMutationFloatingPromise, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
