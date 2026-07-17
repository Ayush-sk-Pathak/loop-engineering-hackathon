import type { VendorCandidate, VerificationVerdict } from "@continuim/contracts";

export interface OpenRouterExplanation {
  provider: "openrouter";
  modelId: string;
  region: "openrouter";
  text: string;
}

export async function explainVerdictWithOpenRouter(
  vendor: VendorCandidate,
  verdict: VerificationVerdict,
  env: NodeJS.ProcessEnv = process.env,
): Promise<OpenRouterExplanation | undefined> {
  if (env.OPENROUTER_EXPLAINER_ENABLED !== "1") return undefined;

  const token = env.OPENROUTER_API_KEY;
  const modelId = env.OPENROUTER_MODEL ?? "google/gemma-4-26b-a4b-it:free";
  if (!token) {
    throw new Error("OPENROUTER_EXPLAINER_ENABLED=1 requires OPENROUTER_API_KEY");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(env.OPENROUTER_SITE_URL ? { "http-referer": env.OPENROUTER_SITE_URL } : {}),
      ...(env.OPENROUTER_APP_NAME ? { "x-title": env.OPENROUTER_APP_NAME } : {}),
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: "system",
          content: "You explain procurement verification outcomes for an operations dashboard. The deterministic policy is authoritative; do not override the verdict. Use one concise sentence. Do not call a vendor fraudulent; say risk, eligible, or ineligible.",
        },
        {
          role: "user",
          content: JSON.stringify({
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
        },
      ],
      max_tokens: 120,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(Number(env.OPENROUTER_TIMEOUT_MS ?? 20_000)),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json() as { error?: { message?: unknown } };
      detail = String(body.error?.message ?? "");
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(`OpenRouter chat completion failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const body = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content?.trim().replace(/\s+/g, " ");
  if (!text) throw new Error("OpenRouter returned no text");
  return { provider: "openrouter", modelId, region: "openrouter", text };
}
