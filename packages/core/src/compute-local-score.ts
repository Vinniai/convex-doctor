import { PERFECT_SCORE, SCORE_GOOD_THRESHOLD, SCORE_OK_THRESHOLD } from "./constants.js";
import type { Diagnostic, ScoreResult } from "./types/index.js";

// Deterministic, fully offline 0-100 score for runs that must not call
// the hosted score API (`--local-score`). Severity-weighted finding
// density with exponential decay: a clean project scores 100 and the
// score halves roughly every ~4.6 weighted findings per file. The
// constants were tuned against the hosted API on a large real-world
// backend (22 errors + 4,628 warnings over 1,067 files → local 51 vs
// hosted 49) so the two scales are comparable, though not identical —
// the hosted model also weighs per-rule priorities this fallback
// doesn't know about.
const ERROR_WEIGHT = 4;
const WARNING_WEIGHT = 1;
const DECAY_RATE = 0.15;

const SCORE_NEEDS_WORK_THRESHOLD = 25;

const labelForScore = (score: number): string => {
  if (score >= SCORE_GOOD_THRESHOLD) return "Good";
  if (score >= SCORE_OK_THRESHOLD) return "OK";
  if (score >= SCORE_NEEDS_WORK_THRESHOLD) return "Needs work";
  return "Critical";
};

export const computeLocalScore = (
  diagnostics: ReadonlyArray<Diagnostic>,
  sourceFileCount: number | undefined,
): ScoreResult => {
  let weightedFindings = 0;
  for (const diagnostic of diagnostics) {
    weightedFindings += diagnostic.severity === "error" ? ERROR_WEIGHT : WARNING_WEIGHT;
  }
  const fileCount = Math.max(sourceFileCount ?? 0, 1);
  const findingDensity = weightedFindings / fileCount;
  const score = Math.max(
    0,
    Math.min(PERFECT_SCORE, Math.round(PERFECT_SCORE * Math.exp(-DECAY_RATE * findingDensity))),
  );
  return { score, label: labelForScore(score) };
};
