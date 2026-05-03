"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PillarCategoryKind } from "@prisma/client";

import { requireAdminRole } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

function revalidateIntakeQuestionContent() {
  revalidatePath("/admin/intake/questions");
  revalidatePath("/admin/intake/questions", "layout");
  revalidatePath("/admin/intake");
  revalidatePath("/intake");
  revalidatePath("/intake/interview");
}

function optionalTrimmed(raw: FormDataEntryValue | null): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

function formatActionError(e: unknown): string {
  if (e instanceof z.ZodError) {
    return e.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; ");
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

async function findIntakePillarQuestionOrThrow(questionId: string) {
  const row = await prisma.pillarQuestion.findFirst({
    where: {
      id: questionId,
      section: { category: { kind: PillarCategoryKind.INTAKE } },
    },
    include: { section: { include: { category: true } } },
  });
  if (!row) {
    throw new Error("Intake script question not found.");
  }
  return row;
}

export async function setIntakePillarQuestionVisibility(formData: FormData) {
  await requireAdminRole();
  const questionId = z.string().uuid().parse(formData.get("questionId"));
  const raw = formData.get("setVisible");
  const isVisible = raw === "1" || raw === "true";

  await findIntakePillarQuestionOrThrow(questionId);

  await prisma.pillarQuestion.update({
    where: { id: questionId },
    data: { isVisible },
  });

  revalidateIntakeQuestionContent();
  // Same `?saved=1` redirect target the edit form uses. The query param
  // gives Next.js's client router a different cache key from the page that
  // submitted the form, which forces a fresh server render so the visibility
  // change is visible immediately. Without it, the prefetched RSC payload
  // for /admin/intake/questions sticks around and the user has to manually
  // refresh to see the updated badges and counts.
  redirect("/admin/intake/questions?saved=1");
}

export async function updateIntakePillarQuestionContent(formData: FormData) {
  await requireAdminRole();
  const questionId = z.string().uuid().parse(formData.get("questionId"));

  try {
    const questionText = z.string().min(1).parse(formData.get("questionText"));
    const whyThisMatters = optionalTrimmed(formData.get("whyThisMatters"));
    const recommendedActions = optionalTrimmed(formData.get("recordingTips"));
    const displayOrder = z.coerce.number().int().min(0).parse(formData.get("displayOrder"));
    const isVisible = formData.has("isVisible");

    await findIntakePillarQuestionOrThrow(questionId);

    await prisma.pillarQuestion.update({
      where: { id: questionId },
      data: {
        questionText,
        whyThisMatters,
        recommendedActions,
        displayOrder,
        isVisible,
      },
    });

    revalidateIntakeQuestionContent();
  } catch (e: unknown) {
    redirect(
      `/admin/intake/questions/${questionId}/edit?err=${encodeURIComponent(formatActionError(e))}`
    );
  }

  redirect("/admin/intake/questions?saved=1");
}
