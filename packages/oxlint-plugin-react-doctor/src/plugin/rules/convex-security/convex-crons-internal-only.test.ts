import { describe, expect, it } from "vite-plus/test";
import { runRule } from "../../../test-utils/run-rule.js";
import { convexCronsInternalOnly } from "./convex-crons-internal-only.js";

describe("convex-crons-internal-only", () => {
  it("flags crons.interval registering an api.* function", () => {
    const code = `
      import { cronJobs } from "convex/server";
      import { api } from "./_generated/api";
      const crons = cronJobs();
      crons.interval("clear messages", { hours: 1 }, api.messages.clearAll, {});
      export default crons;
    `;
    const result = runRule(convexCronsInternalOnly, code);
    expect(result.diagnostics).toHaveLength(1);
  });

  it("flags the other cron registration methods with api.* references", () => {
    const code = `
      import { cronJobs } from "convex/server";
      import { api } from "./_generated/api";
      const crons = cronJobs();
      crons.cron("nightly", "0 0 * * *", api.reports.build, {});
      crons.daily("digest", { hourUTC: 8, minuteUTC: 0 }, api.digest.send, {});
      crons.weekly("cleanup", { dayOfWeek: "monday", hourUTC: 0, minuteUTC: 0 }, api.logs.purge, {});
      crons.monthly("billing", { day: 1, hourUTC: 0, minuteUTC: 0 }, api.billing.run, {});
      export default crons;
    `;
    const result = runRule(convexCronsInternalOnly, code);
    expect(result.diagnostics).toHaveLength(4);
  });

  it("does NOT flag crons registering internal.* functions", () => {
    const code = `
      import { cronJobs } from "convex/server";
      import { internal } from "./_generated/api";
      const crons = cronJobs();
      crons.interval("clear messages", { hours: 1 }, internal.messages.clearAll, {});
      crons.daily("digest", { hourUTC: 8, minuteUTC: 0 }, internal.digest.send, {});
      export default crons;
    `;
    const result = runRule(convexCronsInternalOnly, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag an unrelated obj.daily(...) in a file without a cronJobs import", () => {
    const code = `
      import { api } from "./_generated/api";
      import { makePlanner } from "./planner";
      const planner = makePlanner();
      planner.daily("standup", api.meetings.schedule, {});
    `;
    const result = runRule(convexCronsInternalOnly, code);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does NOT flag a homegrown cronJobs() from a non-Convex module", () => {
    const code = `
      import { cronJobs } from "./my-cron-library";
      import { api } from "./_generated/api";
      const crons = cronJobs();
      crons.interval("clear messages", { hours: 1 }, api.messages.clearAll, {});
    `;
    const result = runRule(convexCronsInternalOnly, code);
    expect(result.diagnostics).toHaveLength(0);
  });
});
