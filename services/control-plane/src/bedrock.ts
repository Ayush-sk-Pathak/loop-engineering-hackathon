import type { VendorCandidate, VerificationVerdict } from "@continuim/contracts";

export interface BedrockExplanation {
  provider: "amazon-bedrock";
  modelId: string;
  region: string;
  text: string;
}

export async function explainVerdictWithBedrock(
  vendor: VendorCandidate,
  verdict: VerificationVerdict,
  env: NodeJS.ProcessEnv = process.env,
): Promise<BedrockExplanation | undefined> {
  if (env.BEDROCK_EXPLAINER_ENABLED !== "1") return undefined;

  const token = env.AWS_BEARER_TOKEN_BEDROCK ?? env.BEDROCK_API_KEY;
  const region = env.BEDROCK_REGION ?? env.AWS_REGION ?? "ap-south-1";
  const modelId = env.BEDROCK_MODEL_ID ?? "apac.amazon.nova-micro-v1:0";
  if (!token) {
    throw new Error("BEDROCK_EXPLAINER_ENABLED=1 requires AWS_BEARER_TOKEN_BEDROCK");
  }

  const url = new URL(
    `/model/${encodeURIComponent(modelId)}/converse`,
    `https://bedrock-runtime.${region}.amazonaws.com`,
  );
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      system: [
        {
          text: [
            "You explain procurement verification outcomes for an operations dashboard.",
            "The deterministic policy is authoritative; do not override the verdict.",
            "Use one concise sentence. Do not call a vendor fraudulent; say risk, eligible, or ineligible.",
          ].join(" "),
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              text: JSON.stringify({
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
        },
      ],
      inferenceConfig: {
        maxTokens: 120,
        temperature: 0.2,
      },
    }),
    signal: AbortSignal.timeout(Number(env.BEDROCK_TIMEOUT_MS ?? 20_000)),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json() as { message?: unknown; Message?: unknown; __type?: unknown };
      detail = String(body.message ?? body.Message ?? body.__type ?? "");
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(`Bedrock Converse failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  const body = await response.json() as {
    output?: { message?: { content?: { text?: string }[] } };
  };
  const text = body.output?.message?.content?.find((item) => item.text)?.text?.trim();
  if (!text) throw new Error("Bedrock Converse returned no text");
  return { provider: "amazon-bedrock", modelId, region, text };
}
