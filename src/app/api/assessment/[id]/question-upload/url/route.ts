import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateAssessmentQuestionUploadUrl } from "@/lib/documents/s3";
import { validateFileUpload } from "@/lib/documents/validation";

const uploadUrlSchema = z.object({
  questionId: z.string().min(1).max(64),
  fileName: z.string().min(1).max(255),
  fileType: z.string().optional().default(""),
  fileSize: z.coerce.number().positive(),
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
    const parsed = uploadUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { questionId, fileName, fileType, fileSize } = parsed.data;

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { userId: true },
    });

    if (!assessment || assessment.userId !== session.user.id) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    const validation = validateFileUpload(fileName, fileType, fileSize);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { signedUrl, key } = await generateAssessmentQuestionUploadUrl(
      session.user.id,
      assessmentId,
      questionId,
      fileName,
      validation.mimeType
    );

    return NextResponse.json({
      signedUrl,
      key,
      contentType: validation.mimeType,
    });
  } catch (error) {
    console.error("Assessment question upload URL error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
