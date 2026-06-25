import { describe, expect, it } from "vitest";
import {
  computePillarRecommendations,
  strongRecommendationPillarIds,
} from "@/lib/intake/pillar-recommendations";
import { starterPillarCatalog } from "@/lib/methodology/pillar-catalog";

const catalog = starterPillarCatalog();

describe("computePillarRecommendations", () => {
  it("returns low strength when no tagged questions match", () => {
    const result = computePillarRecommendations({
      questions: [{ id: "q1", questionText: "Tell us about travel." }],
      responses: [{ questionId: "q1", transcription: "We travel often." }],
    }, catalog);
    expect(result.every((r) => r.strength === "low")).toBe(true);
  });

  it("ranks pillars from tagged answers", () => {
    const result = computePillarRecommendations({
      questions: [
        {
          id: "q1",
          questionText: "Cyber hygiene?",
          relatedPillarIds: ["cyber-digital"],
          recommendedActions: "Review password manager adoption.",
        },
        {
          id: "q2",
          questionText: "Governance structure?",
          relatedPillarIds: ["governance"],
        },
        {
          id: "q3",
          questionText: "More cyber concerns?",
          relatedPillarIds: ["cyber-digital"],
        },
      ],
      responses: [
        { questionId: "q1", transcription: "Shared passwords are a problem." },
        { questionId: "q2", transcription: "Family council meets yearly." },
        { questionId: "q3", transcription: "Phishing attempts last month." },
      ],
    }, catalog);

    const cyber = result.find((r) => r.pillarId === "cyber-digital");
    const gov = result.find((r) => r.pillarId === "governance");

    expect(cyber?.strength).toBe("strong");
    expect(cyber?.suggestedAction).toContain("password manager");
    expect(cyber?.reasons).toHaveLength(2);
    expect(gov?.strength).toBe("moderate");
  });

  it("strongRecommendationPillarIds returns strong rows only", () => {
    const recs = computePillarRecommendations({
      questions: [
        {
          id: "q1",
          questionText: "A",
          relatedPillarIds: ["governance", "cyber-digital", "insurance"],
        },
        { id: "q2", questionText: "B", relatedPillarIds: ["governance"] },
        { id: "q3", questionText: "C", relatedPillarIds: ["governance"] },
      ],
      responses: [
        { questionId: "q1", transcription: "x" },
        { questionId: "q2", transcription: "y" },
        { questionId: "q3", transcription: "z" },
      ],
    }, catalog);
    expect(strongRecommendationPillarIds(recs)).toContain("governance");
  });
});
