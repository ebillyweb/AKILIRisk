import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeUserRoleString } from "@/lib/auth-roles";
import {
  runNarrativeSmokeProbe,
  SMOKE_NARRATIVE_INPUT,
} from "@/lib/assessment/recommendations/llm-narrative/smoke-probe";

export const runtime = "nodejs";
/** gpt-4o structured narrative; keep headroom for cold starts + retries. */
export const maxDuration = 60;

type OpenAiLikeError = {
  status?: number;
  code?: string | null;
  message?: string;
};

function asOpenAiLikeError(error: unknown): OpenAiLikeError | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as OpenAiLikeError;
  if (typeof candidate.status !== "number") return null;
  return candidate;
}

function mapProbeError(error: unknown): { status: number; error: string } {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { status: 503, error: "OPENAI_API_KEY is not configured" };
  }

  const openAi = asOpenAiLikeError(error);
  if (openAi?.status === 429) {
    return {
      status: 503,
      error:
        "OpenAI rate limit or quota exhausted while generating AI recommendation narratives",
    };
  }
  if (openAi?.status === 401 || openAi?.status === 403) {
    return {
      status: 503,
      error: "OpenAI rejected credentials for AI recommendation narratives",
    };
  }

  const message =
    error instanceof Error ? error.message.slice(0, 240) : "Unknown error";
  return {
    status: 500,
    error: `AI recommendation narrative probe failed: ${message}`,
  };
}

/**
 * POST /api/ai-narratives/smoke-probe
 *
 * Staff-only canary: one structured OpenAI call against a fixed synthetic
 * input. No assessment reads, no DB writes. Used by scheduled `@smoke` tests.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = normalizeUserRoleString(session.user.role);
  if (role !== "ADVISOR" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 },
    );
  }

  try {
    const result = await runNarrativeSmokeProbe();
    const expectedIds = SMOKE_NARRATIVE_INPUT.selectedServices.map(
      (s) => s.serviceId,
    );
    const idsMatch =
      result.serviceIds.length === expectedIds.length &&
      expectedIds.every((id) => result.serviceIds.includes(id));

    if (!result.pillarSummary || !idsMatch) {
      return NextResponse.json(
        {
          error: "AI recommendation narrative probe returned incomplete output",
          result,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ...result,
      expectedServiceIds: expectedIds,
    });
  } catch (error) {
    console.error("AI narrative smoke probe failed:", error);
    const mapped = mapProbeError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
