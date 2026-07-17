import type { VendorCandidate, VerificationVerdict } from "@continuim/contracts";
import { explainVerdictWithBedrock } from "./bedrock.ts";
import { explainVerdictWithClaudeOAuth } from "./claude.ts";
import { explainVerdictWithCodexOAuth } from "./codex.ts";
import { explainVerdictWithOpenRouter } from "./openrouter.ts";

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
 * 1. OpenRouter, for a low-cost/free hosted model when configured.
 * 2. Bedrock, for the AWS sponsor path when the account/model is usable.
 * 3. Codex OAuth, for a local ChatGPT/Codex account fallback.
 * 4. Claude Code OAuth, for a local Claude account fallback.
 */
export async function explainVerdict(
  vendor: VendorCandidate,
  verdict: VerificationVerdict,
  env: NodeJS.ProcessEnv = process.env,
): Promise<VerdictExplanation | undefined> {
  const failures: string[] = [];

  const openrouter = await attempt("openrouter", () => explainVerdictWithOpenRouter(vendor, verdict, env));
  if (openrouter.ok && openrouter.value) return openrouter.value;
  if (!openrouter.ok) failures.push(openrouter.error);

  const bedrock = await attempt("amazon-bedrock", () => explainVerdictWithBedrock(vendor, verdict, env));
  if (bedrock.ok && bedrock.value) return bedrock.value;
  if (!bedrock.ok) failures.push(bedrock.error);

  const codex = await attempt("codex-oauth", () => explainVerdictWithCodexOAuth(vendor, verdict, env));
  if (codex.ok && codex.value) {
    return {
      ...codex.value,
      ...(failures.length ? { fallbackFor: failures[0].split(":")[0] } : {}),
    };
  }
  if (!codex.ok) failures.push(codex.error);

  const claude = await attempt("claude-code-oauth", () => explainVerdictWithClaudeOAuth(vendor, verdict, env));
  if (claude.ok && claude.value) {
    return {
      ...claude.value,
      ...(failures.length ? { fallbackFor: failures[failures.length - 1].split(":")[0] } : {}),
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
