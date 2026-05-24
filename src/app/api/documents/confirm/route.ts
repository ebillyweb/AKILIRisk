import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getDocumentRequirementForSessionUser,
  keyMatchesDocumentRequirement,
} from "@/lib/documents/requirement-access";
import { headDocumentObject } from "@/lib/documents/s3";
import { triggerDocumentUploadNotification } from "@/lib/notifications/triggers";
import { z } from "zod";

// `fileMimeType` and `fileSize` were previously taken from the body and
// trusted. We now re-derive both from S3's HEAD response after upload, so
// the client-supplied values are advisory at most. We still accept
// `fileName` from the body since it's display metadata that doesn't
// affect MIME-confusion or size-display attacks at any consumer.
const confirmUploadSchema = z.object({
  requirementId: z.string().min(1).max(64),
  key: z.string().min(1),
  fileName: z.string().min(1).max(255),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedFields = confirmUploadSchema.safeParse(body);

    if (!validatedFields.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validatedFields.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { requirementId, key, fileName } = validatedFields.data;

    const requirement = await getDocumentRequirementForSessionUser(
      session.user.id,
      session.user.role,
      requirementId,
    );

    if (!requirement) {
      return NextResponse.json(
        { error: "Document requirement not found or not assigned to you" },
        { status: 404 }
      );
    }

    if (!keyMatchesDocumentRequirement(key, requirement.clientId, requirementId)) {
      return NextResponse.json(
        { error: "Invalid upload key for this requirement" },
        { status: 400 }
      );
    }

    // Pull MIME type + size straight from S3's metadata. The presigned
    // PUT was signed with a server-validated MIME and S3 recorded the
    // actual byte count; both are immune to client tampering at confirm
    // time. If the object isn't there, the client is claiming an upload
    // that never happened.
    const head = await headDocumentObject(key);
    if (!head) {
      return NextResponse.json(
        { error: "Uploaded object not found in storage" },
        { status: 400 }
      );
    }

    // Update the requirement with file metadata. fileMimeType + fileSize
    // come from S3, fileName from the request (display-only).
    const updatedRequirement = await prisma.documentRequirement.update({
      where: { id: requirementId },
      data: {
        fulfilled: true,
        fulfilledAt: new Date(),
        fileKey: key,
        fileName,
        fileSize: head.contentLength ?? 0,
        fileMimeType: head.contentType ?? "application/octet-stream",
      },
    });

    const roleUpper = (session.user.role ?? "USER").toString().toUpperCase();
    if (roleUpper === "USER") {
      void triggerDocumentUploadNotification(
        session.user.id,
        updatedRequirement.name,
      );
    }

    return NextResponse.json(updatedRequirement);
  } catch (error) {
    console.error("Error confirming upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}