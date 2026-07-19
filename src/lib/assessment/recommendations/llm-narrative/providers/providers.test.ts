import { describe, it, expect, vi } from "vitest";
import { GOLDEN_CASES } from "../eval/golden-set";
import { buildJudgeSchema } from "../eval/rubric";
import { mapJudgeResult, parseNarrativeJson } from "./shared";
import {
  makeOpenAIGenerate,
  makeOpenAIJudge,
  type OpenAILike,
} from "./openai-provider";

const aiCase = GOLDEN_CASES.find((c) => c.id === "ai-critical-two-services")!;

const judgeJson = JSON.stringify({
  faithfulness_score: 5,
  faithfulness_reason: "accurate",
  specificity_score: 4,
  specificity_reason: "tailored",
  tone_score: 5,
  tone_reason: "measured",
  actionability_score: 4,
  actionability_reason: "concrete",
});

// ─────────────────────────────────────────────────────────────────────────────
// shared helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("shared parsing helpers", () => {
  it("parses plain and code-fenced narrative JSON", () => {
    const plain = parseNarrativeJson(JSON.stringify(aiCase.referenceGood));
    expect(plain.recommendations).toHaveLength(2);
    const fenced = parseNarrativeJson("```json\n" + JSON.stringify(aiCase.referenceGood) + "\n```");
    expect(fenced.pillarSummary).toBe(aiCase.referenceGood.pillarSummary);
  });

  it("throws on non-JSON and on JSON missing required keys", () => {
    expect(() => parseNarrativeJson("not json")).toThrow(/valid JSON/);
    expect(() => parseNarrativeJson(JSON.stringify({ pillarSummary: "x" }))).toThrow(
      /missing pillarSummary\/recommendations/i,
    );
  });

  it("flattens judge fields into JudgeScores", () => {
    const scores = mapJudgeResult(judgeJson);
    expect(scores.scores).toEqual({
      faithfulness: 5,
      specificity: 4,
      tone: 5,
      actionability: 4,
    });
    expect(scores.reasons.faithfulness).toBe("accurate");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI provider
// ─────────────────────────────────────────────────────────────────────────────

describe("OpenAI provider", () => {
  it("generates via structured outputs with the enum pinned to selected services", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(aiCase.referenceGood) } }],
    });
    const client: OpenAILike = { chat: { completions: { create } } };

    const generate = makeOpenAIGenerate({ client, model: "gpt-4o" });
    const out = await generate(aiCase.input);

    expect(out.recommendations.map((r) => r.serviceId)).toEqual([
      "ai_impersonation_defense",
      "ai_data_governance",
    ]);
    const args = create.mock.calls[0][0] as {
      model: string;
      response_format: { type: string; json_schema: { schema: { properties: { recommendations: { items: { properties: { serviceId: { enum: string[] } } } } } } } };
      messages: Array<{ role: string }>;
    };
    expect(args.model).toBe("gpt-4o");
    expect(args.response_format.type).toBe("json_schema");
    expect(
      args.response_format.json_schema.schema.properties.recommendations.items.properties.serviceId.enum,
    ).toEqual(["ai_impersonation_defense", "ai_data_governance"]);
    expect(args.messages.map((m) => m.role)).toEqual(["system", "user"]);
  });

  it("throws on an empty completion", async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: null } }] });
    const generate = makeOpenAIGenerate({ client: { chat: { completions: { create } } } });
    await expect(generate(aiCase.input)).rejects.toThrow(/empty completion/i);
  });

  it("judges and maps scores", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: judgeJson } }],
    });
    const judge = makeOpenAIJudge({ client: { chat: { completions: { create } } } });
    const scores = await judge({ system: "s", user: "u", schema: buildJudgeSchema() });
    expect(scores.scores.tone).toBe(5);
  });
});
