import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { VendorCandidate, VerificationVerdict } from "@continuim/contracts";

const execFileAsync = promisify(execFile);

export interface ClaudeExplanation {
  provider: "claude-code-oauth";
  modelId: string;
  region: "local-cli";
  text: string;
}

export async function explainVerdictWithClaudeOAuth(
  vendor: VendorCandidate,
  verdict: VerificationVerdict,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ClaudeExplanation | undefined> {
  if (env.CLAUDE_EXPLAINER_ENABLED !== "1") return undefined;

  const modelId = env.CLAUDE_MODEL ?? "sonnet";
  const prompt = [
    "You explain procurement verification outcomes for an operations dashboard.",
    "The deterministic policy is authoritative; do not override the verdict.",
    "Use one concise sentence. Do not call a vendor fraudulent; say risk, eligible, or ineligible.",
    "",
    JSON.stringify({
      vendor: {
        id: vendor.id,
        tradingName: vendor.tradingName,
        domain: vendor.domain,
        synthetic: vendor.synthetic,
        quote: {
          sku: vendor.quote.sku,
          unitPriceCents: vendor.quote.unitPriceCents,
          availableQty: vendor.quote.availableQty,
        },
      },
      verdict: {
        status: verdict.status,
        riskScore: verdict.riskScore,
        reasons: verdict.reasons,
        evidenceMode: verdict.evidenceMode,
        totalCostCents: verdict.totalCostCents,
        signalSummary: verdict.signals.map((signal) => ({
          kind: signal.kind,
          outcome: signal.outcome,
          detail: signal.detail,
          provider: signal.source.provider,
          mode: signal.source.mode,
        })),
      },
    }),
  ].join("\n");

  const { stdout } = await execFileAsync("claude", [
    "--print",
    prompt,
    "--model",
    modelId,
    "--output-format",
    "text",
    "--no-session-persistence",
    "--max-budget-usd",
    env.CLAUDE_MAX_BUDGET_USD ?? "0.02",
  ], {
    timeout: Number(env.CLAUDE_TIMEOUT_MS ?? 20_000),
    maxBuffer: 32 * 1024,
  });
  const text = stdout.trim().replace(/\s+/g, " ");
  if (!text) throw new Error("Claude OAuth explainer returned no text");
  return { provider: "claude-code-oauth", modelId, region: "local-cli", text };
}
