import type { VendorCandidate, VerificationVerdict } from "@continuim/contracts";
import { explainVerdictWithBedrock } from "./bedrock.ts";
import { explainVerdictWithClaudeOAuth } from "./claude.ts";
import { explainVerdictWithCodexOAuth } from "./codex.ts";

export interface VerdictExplanation {
  provider: string;
  modelId: string;
  region: string;
  text: string;
  fallbackFor?: string;
}

/**
 * Single explainer entrypoint. The deterministic policy remains authoritative;
 * this function only produces dashboard copy. Order is intentional:
 *
 * 1. Bedrock, for the AWS sponsor path when the account/model is usable.
 * 2. Codex OAuth, for a local ChatGPT/Codex account fallback.
 * 3. Claude Code OAuth, for a local Claude account fallback.
 */
export async function explainVerdict(
  vendor: VendorCandidate,
  verdict: VerificationVerdict,
  env: NodeJS.ProcessEnv = process.env,
): Promise<VerdictExplanation | undefined> {
  const failures: string[] = [];

  const bedrock = await attempt("amazon-bedrock", () => explainVerdictWithBedrock(vendor, verdict, env));
  if (bedrock.ok && bedrock.value) return bedrock.value;
  if (!bedrock.ok) failures.push(bedrock.error);

  const codex = await attempt("codex-oauth", () => explainVerdictWithCodexOAuth(vendor, verdict, env));
  if (codex.ok && codex.value) {
    return {
      ...codex.value,
      ...(failures.length ? { fallbackFor: "amazon-bedrock" } : {}),
    };
  }
  if (!codex.ok) failures.push(codex.error);

  const claude = await attempt("claude-code-oauth", () => explainVerdictWithClaudeOAuth(vendor, verdict, env));
  if (claude.ok && claude.value) {
    return {
      ...claude.value,
      ...(failures.length ? { fallbackFor: failures.some((failure) => failure.startsWith("codex-oauth:")) ? "codex-oauth" : "amazon-bedrock" } : {}),
    };
  }
  if (!claude.ok) failures.push(claude.error);

  if (failures.length) {
    throw new Error(failures.join(" | "));
  }
  return undefined;
}

async function attempt<T>(
  label: string,
  run: () => Promise<T | undefined>,
): Promise<{ ok: true; value?: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return {
      ok: false,
      error: `${label}: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}
