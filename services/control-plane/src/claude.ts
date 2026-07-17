import type { PlannerAdvice, PlannerContext, PlannerPort } from "@continuim/agent";

/**
 * Injected transport seam. Real transports call AWS Bedrock (Converse) or the
 * Anthropic Messages API; unit tests inject a fake. `complete` returns the
 * model's raw text output.
 */
export interface ClaudeTransport {
  complete(request: ClaudeRequest): Promise<string>;
}

export interface ClaudeRequest {
  system: string;
  user: string;
  maxTokens: number;
}

// A bare model id (e.g. anthropic.claude-haiku-4-5-*) throws an on-demand
// throughput error on Bedrock for this model — the cross-region inference
// profile id (us.anthropic.*) is required (decision 0014).
const DEFAULT_BEDROCK_MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const DEFAULT_ANTHROPIC_MODEL_ID = "claude-haiku-4-5";

export function createBedrockTransport(
  options: { modelId?: string; region?: string } = {},
): ClaudeTransport {
  const modelId = options.modelId ?? DEFAULT_BEDROCK_MODEL_ID;
  const region = options.region ?? process.env.AWS_REGION ?? "us-east-1";
  return {
    async complete(request) {
      // Lazy-load the AWS SDK so the default PLANNER_MODE=off path never pays for it.
      const { BedrockRuntimeClient, ConverseCommand } = await import(
        "@aws-sdk/client-bedrock-runtime"
      );
      const client = new BedrockRuntimeClient({ region });
      const response = await client.send(
        new ConverseCommand({
          modelId,
          system: [{ text: request.system }],
          messages: [{ role: "user", content: [{ text: request.user }] }],
          inferenceConfig: { maxTokens: request.maxTokens, temperature: 0 },
        }),
      );
      const text = (response.output?.message?.content ?? [])
        .map((block) => block.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("Bedrock Converse returned no text content");
      return text;
    },
  };
}

export function createAnthropicTransport(
  options: { apiKey?: string; modelId?: string } = {},
): ClaudeTransport {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const modelId = options.modelId ?? DEFAULT_ANTHROPIC_MODEL_ID;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for the Anthropic planner transport");
  }
  return {
    async complete(request) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Anthropic API error ${response.status}: ${await response.text()}`,
        );
      }
      const body = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = (body.content ?? [])
        .map((block) => (block.type === "text" ? block.text ?? "" : ""))
        .join("")
        .trim();
      if (!text) throw new Error("Anthropic API returned no text content");
      return text;
    },
  };
}

type PlannerMode = "off" | "bedrock" | "anthropic" | "auto";

function readMode(env: Record<string, string | undefined>): PlannerMode {
  const raw = (env.PLANNER_MODE ?? "off").toLowerCase();
  if (raw === "bedrock" || raw === "anthropic" || raw === "auto") return raw;
  return "off";
}

/**
 * Select a transport from the environment. Returns `null` when PLANNER_MODE is
 * off (the default). Fails closed when a mode is enabled but no credentials are
 * configured — never a silent fixture fallback (decision 0010).
 */
export function resolvePlannerTransport(
  env: Record<string, string | undefined> = process.env,
): ClaudeTransport | null {
  const mode = readMode(env);
  if (mode === "off") return null;
  if (mode === "bedrock") {
    return createBedrockTransport({ modelId: env.BEDROCK_MODEL_ID, region: env.AWS_REGION });
  }
  if (mode === "anthropic") {
    return createAnthropicTransport({
      apiKey: env.ANTHROPIC_API_KEY,
      modelId: env.ANTHROPIC_MODEL_ID,
    });
  }
  // auto: prefer Bedrock when AWS is configured, else the Anthropic key.
  if (env.AWS_REGION || env.AWS_ACCESS_KEY_ID || env.AWS_PROFILE) {
    return createBedrockTransport({ modelId: env.BEDROCK_MODEL_ID, region: env.AWS_REGION });
  }
  if (env.ANTHROPIC_API_KEY) {
    return createAnthropicTransport({
      apiKey: env.ANTHROPIC_API_KEY,
      modelId: env.ANTHROPIC_MODEL_ID,
    });
  }
  throw new Error(
    "PLANNER_MODE is enabled but no transport is configured: set AWS credentials for Bedrock or ANTHROPIC_API_KEY for the fallback",
  );
}

const PLANNER_SYSTEM =
  "You are an advisory procurement analyst for Continuim. A deterministic policy " +
  "decides vendor eligibility, authorizes purchases, and mints credentials — you never " +
  "do any of those. You only (a) suggest a preferred order for the candidates you are " +
  "given and (b) explain, in one or two sentences, the evidence a human should weigh. " +
  'Reply ONLY with compact JSON of the form {"preferredVendorIds":["id",...],"rationale":"..."} ' +
  "using ids from the candidate list.";

function buildPrompt(context: PlannerContext): string {
  const candidates = context.rankedCandidates.map((vendor) => ({
    id: vendor.id,
    tradingName: vendor.tradingName,
    domain: vendor.domain,
    unitPriceCents: vendor.quote.unitPriceCents,
    leadTimeDays: vendor.quote.leadTimeDays,
  }));
  return [
    `Stockout: sku=${context.stockout.sku} requestedQty=${context.stockout.requestedQty}.`,
    `Candidates (already in the policy's preferred order): ${JSON.stringify(candidates)}.`,
    "Return the preferred order and a short evidence rationale as JSON.",
  ].join("\n");
}

function parseAdvice(text: string): PlannerAdvice {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return { rationale: text.trim() || undefined };
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      preferredVendorIds?: unknown;
      rationale?: unknown;
    };
    const preferredVendorIds = Array.isArray(parsed.preferredVendorIds)
      ? parsed.preferredVendorIds.filter((id): id is string => typeof id === "string")
      : undefined;
    const rationale = typeof parsed.rationale === "string" ? parsed.rationale : undefined;
    return { preferredVendorIds, rationale };
  } catch {
    return { rationale: text.trim() || undefined };
  }
}

export function createClaudePlanner(transport: ClaudeTransport): PlannerPort {
  return {
    async advise(context) {
      const text = await transport.complete({
        system: PLANNER_SYSTEM,
        user: buildPrompt(context),
        maxTokens: 512,
      });
      return parseAdvice(text);
    },
  };
}

/**
 * Build the planner wired into the loop. Returns `undefined` when PLANNER_MODE
 * is off (the default), keeping the loop byte-identical to the no-planner run.
 */
export function createPlannerFromEnv(
  env: Record<string, string | undefined> = process.env,
): PlannerPort | undefined {
  const transport = resolvePlannerTransport(env);
  return transport ? createClaudePlanner(transport) : undefined;
}
