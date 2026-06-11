import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  const [channel] = useState("general");
  // convex-usequery-skip-pattern: undefined instead of "skip".
  const messages = useQuery(api.messages.list, channel ? {} : undefined);
  const send = useMutation(api.messages.send);

  return (
    <div>
      {/* convex-usequery-undefined-check: no loading guard before .map */}
      {messages.map((message: { _id: string; body: string }) => (
        <p key={message._id}>{message.body}</p>
      ))}
      <button
        onClick={() => {
          // convex-mutation-floating-promise: dropped promise.
          send({ body: "hi", userId: "u1" });
        }}
      >
        Send
      </button>
    </div>
  );
}
