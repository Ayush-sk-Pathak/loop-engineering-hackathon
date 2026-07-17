import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { VendorCandidate, VerificationVerdict } from "@continuim/contracts";

const execFileAsync = promisify(execFile);

export interface CodexExplanation {
  provider: "codex-oauth";
  modelId: string;
  region: "local-cli";
  text: string;
}

export async function explainVerdictWithCodexOAuth(
  vendor: VendorCandidate,
  verdict: VerificationVerdict,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CodexExplanation | undefined> {
  if (env.CODEX_EXPLAINER_ENABLED !== "1") return undefined;

  const modelId = env.CODEX_MODEL ?? "gpt-5.6-luna";
  const prompt = [
    "Reply with one concise sentence for an operations dashboard.",
    "Explain the deterministic procurement verification outcome.",
    "Do not override the verdict. Do not call a vendor fraudulent; say risk, eligible, or ineligible.",
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

  const workdir = await mkdtemp(join(tmpdir(), "continuim-codex-explainer-"));
  const outputPath = join(workdir, "last-message.txt");
  try {
    await execFileAsync("codex", [
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--sandbox",
      "read-only",
      "--color",
      "never",
      "--model",
      modelId,
      "--output-last-message",
      outputPath,
      prompt,
    ], {
      cwd: process.cwd(),
      timeout: Number(env.CODEX_TIMEOUT_MS ?? 30_000),
      maxBuffer: 64 * 1024,
    });
    const text = (await readFile(outputPath, "utf8")).trim().replace(/\s+/g, " ");
    if (!text) throw new Error("Codex OAuth explainer returned no text");
    return { provider: "codex-oauth", modelId, region: "local-cli", text };
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}
