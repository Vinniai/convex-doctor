import { describe, expect, it } from "vite-plus/test";
import { computeLocalScore } from "../src/compute-local-score.js";
import type { Diagnostic } from "../src/index.js";

const diagnostic = (severity: "error" | "warning"): Diagnostic =>
  ({
    severity,
    message: "x",
    filePath: "/tmp/a.ts",
    category: "Bugs",
    rule: "convex-no-ctx-db-in-action",
    plugin: "react-doctor",
  }) as unknown as Diagnostic;

describe("computeLocalScore", () => {
  it("scores a clean project 100 / Good", () => {
    expect(computeLocalScore([], 50)).toEqual({ score: 100, label: "Good" });
  });

  it("weights errors heavier than warnings", () => {
    const errors = computeLocalScore(
      Array.from({ length: 10 }, () => diagnostic("error")),
      10,
    );
    const warnings = computeLocalScore(
      Array.from({ length: 10 }, () => diagnostic("warning")),
      10,
    );
    expect(errors.score).toBeLessThan(warnings.score);
  });

  it("is monotonic in finding density and clamps to [0, 100]", () => {
    const small = computeLocalScore(
      Array.from({ length: 5 }, () => diagnostic("warning")),
      100,
    );
    const large = computeLocalScore(
      Array.from({ length: 5000 }, () => diagnostic("warning")),
      100,
    );
    expect(small.score).toBeGreaterThan(large.score);
    expect(large.score).toBeGreaterThanOrEqual(0);
    expect(small.score).toBeLessThanOrEqual(100);
  });

  it("treats a missing source file count as a single file", () => {
    const withUndefined = computeLocalScore([diagnostic("warning")], undefined);
    const withOne = computeLocalScore([diagnostic("warning")], 1);
    expect(withUndefined).toEqual(withOne);
  });

  it("lands near the hosted score on the calibration project shape", () => {
    // 22 errors + 4,628 warnings over 1,067 files scored 49 via the
    // hosted API; the local model should stay in the same band.
    const diagnostics = [
      ...Array.from({ length: 22 }, () => diagnostic("error")),
      ...Array.from({ length: 4628 }, () => diagnostic("warning")),
    ];
    const result = computeLocalScore(diagnostics, 1067);
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThanOrEqual(60);
  });
});
