import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isAssessmentDocumentUploadAnswer,
  keyMatchesAssessmentQuestionUpload,
} from "@/lib/assessment/question-upload";
import { headDocumentObject } from "@/lib/documents/s3";
import { validateStoredDocumentMime } from "@/lib/documents/validation";

const confirmSchema = z.object({
  questionId: z.string().min(1).max(64),
  key: z.string().min(1),
  fileName: z.string().min(1).max(255),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: assessmentId } = await params;
    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { questionId, key, fileName } = parsed.data;

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { userId: true },
    });

    if (!assessment || assessment.userId !== session.user.id) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (
      !keyMatchesAssessmentQuestionUpload(
        key,
        session.user.id,
        assessmentId,
        questionId
      )
    ) {
      return NextResponse.json({ error: "Invalid upload key for this question" }, { status: 400 });
    }

    const head = await headDocumentObject(key);
    if (!head) {
      return NextResponse.json({ error: "Uploaded object not found in storage" }, { status: 400 });
    }

    const mimeCheck = validateStoredDocumentMime(head.contentType);
    if (!mimeCheck.valid) {
      return NextResponse.json({ error: mimeCheck.error }, { status: 400 });
    }

    const answer = {
      fileKey: key,
      fileName,
      fileSize: head.contentLength ?? 0,
      fileMimeType: mimeCheck.mimeType,
    };

    if (!isAssessmentDocumentUploadAnswer(answer)) {
      return NextResponse.json({ error: "Invalid upload metadata" }, { status: 400 });
    }

    return NextResponse.json(answer);
  } catch (error) {
    console.error("Assessment question upload confirm error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
