import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { isConvexDirectoryFile } from "../../utils/convex/convex-ast.js";

// Shape-based detectors for vendor credentials that are unambiguous in
// a string literal. Narrower than `no-secrets-in-client-code`'s
// variable-name heuristics on purpose: Convex backend files legitimately
// hold lots of string config, so only flag literals whose FORMAT marks
// them as real keys.
const SECRET_LITERAL_PATTERNS: ReadonlyArray<RegExp> = [
  /^sk-[A-Za-z0-9_-]{16,}$/, // OpenAI-style secret key
  /^(sk|pk)_(live|test)_[A-Za-z0-9]{16,}$/, // Stripe secret / restricted key
  /^AKIA[0-9A-Z]{16}$/, // AWS access key ID
  /^gh[pousr]_[A-Za-z0-9]{30,}$/, // GitHub token (ghp_/gho_/ghu_/ghs_/ghr_)
  /^xox[bap]-/, // Slack token
];

const MESSAGE =
  "This string literal matches the format of a real vendor credential — anyone with repo access (and your version history) can read it.";

export const convexNoHardcodedSecrets = defineRule<Rule>({
  id: "convex-no-hardcoded-secrets",
  title: "Hardcoded secret in Convex function",
  severity: "warn",
  // Test fixtures legitimately hold fake vendor-shaped keys
  // (`sk-test...`); the test-noise tag auto-skips testlike files.
  tags: ["test-noise"],
  recommendation:
    "Move secrets to deployment environment variables and read them with `process.env`, set them per-deployment in the Convex dashboard. See https://docs.convex.dev/production/environment-variables",
  create: (context: RuleContext) => {
    // Only Convex backend files are in scope; with no filename we can't
    // tell, so never flag.
    const isInScope = isConvexDirectoryFile(context.filename);
    return {
      Literal(node: EsTreeNodeOfType<"Literal">) {
        if (!isInScope) return;
        if (typeof node.value !== "string") return;
        const literalValue = node.value;
        if (!SECRET_LITERAL_PATTERNS.some((pattern) => pattern.test(literalValue))) return;
        context.report({ node, message: MESSAGE });
      },
    };
  },
});
