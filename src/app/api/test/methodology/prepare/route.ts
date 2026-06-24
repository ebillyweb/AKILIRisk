import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import {
  ensureAssessmentWithSnapshot,
  getPinnedPillarNarratives,
  getSnapshottedIntakeScriptForClient,
  patchAdvisorIntakeQuestionByEmail,
  patchAdvisorNarrativeByEmail,
  resetClientIntake,
  startIntakeSnapshotForClient,
  createCustomIntakeQuestionForAdvisor,
  hideAdvisorIntakeQuestion,
  tryDeleteAdvisorIntakeQuestion,
  createCustomRecommendationRuleForAdvisor,
  deactivateAdvisorRecommendationRule,
  tryDeleteAdvisorRecommendationRule,
  getSnapshottedRecRulesForClient,
} from "@/lib/test/methodology-snapshot-prepare";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reset-intake"),
    clientEmail: z.string().email(),
  }),
  z.object({
    action: z.literal("start-intake-snapshot"),
    clientEmail: z.string().email(),
  }),
  z.object({
    action: z.literal("get-intake-script"),
    clientEmail: z.string().email(),
  }),
  z.object({
    action: z.literal("patch-advisor-intake"),
    advisorEmail: z.string().email(),
    questionId: z.string(),
    questionText: z.string().min(1),
  }),
  z.object({
    action: z.literal("ensure-scored-pillar"),
    clientEmail: z.string().email(),
    pillar: z.string().optional().default("governance"),
  }),
  z.object({
    action: z.literal("get-pillar-narratives"),
    assessmentId: z.string(),
    pillar: z.string().optional().default("governance"),
  }),
  z.object({
    action: z.literal("patch-advisor-narrative"),
    advisorEmail: z.string().email(),
    pillar: z.string(),
    allNegative: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal("create-custom-intake"),
    advisorEmail: z.string().email(),
    questionText: z.string().min(1),
  }),
  z.object({
    action: z.literal("hide-advisor-intake"),
    advisorEmail: z.string().email(),
    questionId: z.string(),
  }),
  z.object({
    action: z.literal("try-delete-advisor-intake"),
    advisorEmail: z.string().email(),
    questionId: z.string(),
  }),
  z.object({
    action: z.literal("create-custom-rec-rule"),
    advisorEmail: z.string().email(),
    pillar: z.string().default("governance"),
    name: z.string().min(1),
    serviceRecommendationId: z.string().optional(),
  }),
  z.object({
    action: z.literal("deactivate-advisor-rec-rule"),
    advisorEmail: z.string().email(),
    ruleId: z.string(),
  }),
  z.object({
    action: z.literal("try-delete-advisor-rec-rule"),
    advisorEmail: z.string().email(),
    ruleId: z.string(),
  }),
  z.object({
    action: z.literal("get-snapshot-rec-rules"),
    clientEmail: z.string().email(),
  }),
]);

/**
 * POST /api/test/methodology/prepare
 * Test-only snapshot integrity fixtures (ENABLE_TEST_AUTH=1).
 */
export async function POST(req: NextRequest) {
  if (!isTestAuthEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    switch (parsed.data.action) {
      case "reset-intake":
        await resetClientIntake(parsed.data.clientEmail);
        return NextResponse.json({ ok: true });
      case "start-intake-snapshot": {
        const result = await startIntakeSnapshotForClient(parsed.data.clientEmail);
        return NextResponse.json(result);
      }
      case "get-intake-script": {
        const result = await getSnapshottedIntakeScriptForClient(parsed.data.clientEmail);
        return NextResponse.json(result);
      }
      case "patch-advisor-intake":
        await patchAdvisorIntakeQuestionByEmail(
          parsed.data.advisorEmail,
          parsed.data.questionId,
          parsed.data.questionText,
        );
        return NextResponse.json({ ok: true });
      case "ensure-scored-pillar": {
        const result = await ensureAssessmentWithSnapshot(
          parsed.data.clientEmail,
          parsed.data.pillar,
        );
        return NextResponse.json(result);
      }
      case "get-pillar-narratives": {
        const narratives = await getPinnedPillarNarratives(
          parsed.data.assessmentId,
          parsed.data.pillar,
        );
        return NextResponse.json({ narratives });
      }
      case "patch-advisor-narrative":
        await patchAdvisorNarrativeByEmail(
          parsed.data.advisorEmail,
          parsed.data.pillar,
          parsed.data.allNegative,
        );
        return NextResponse.json({ ok: true });
      case "create-custom-intake": {
        const result = await createCustomIntakeQuestionForAdvisor(
          parsed.data.advisorEmail,
          parsed.data.questionText,
        );
        return NextResponse.json(result);
      }
      case "hide-advisor-intake":
        await hideAdvisorIntakeQuestion(
          parsed.data.advisorEmail,
          parsed.data.questionId,
        );
        return NextResponse.json({ ok: true });
      case "try-delete-advisor-intake": {
        const result = await tryDeleteAdvisorIntakeQuestion(
          parsed.data.advisorEmail,
          parsed.data.questionId,
        );
        return NextResponse.json(result);
      }
      case "create-custom-rec-rule": {
        const result = await createCustomRecommendationRuleForAdvisor(
          parsed.data.advisorEmail,
          parsed.data.pillar,
          parsed.data.name,
          parsed.data.serviceRecommendationId,
        );
        return NextResponse.json(result);
      }
      case "deactivate-advisor-rec-rule":
        await deactivateAdvisorRecommendationRule(
          parsed.data.advisorEmail,
          parsed.data.ruleId,
        );
        return NextResponse.json({ ok: true });
      case "try-delete-advisor-rec-rule": {
        const result = await tryDeleteAdvisorRecommendationRule(
          parsed.data.advisorEmail,
          parsed.data.ruleId,
        );
        return NextResponse.json(result);
      }
      case "get-snapshot-rec-rules": {
        const result = await getSnapshottedRecRulesForClient(parsed.data.clientEmail);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prepare failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
