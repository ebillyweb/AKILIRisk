'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateDownloadUrl, headDocumentObject } from '@/lib/documents/s3';
import {
  getDocumentRequirementForSessionUser,
  keyMatchesDocumentRequirement,
} from '@/lib/documents/requirement-access';

export async function getClientDocumentRequirements() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const requirements = await prisma.documentRequirement.findMany({
      where: {
        clientId: session.user.id,
      },
      include: {
        advisor: {
          select: {
            firmName: true,
            logoUrl: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [
        { fulfilled: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Group by advisor
    const grouped = requirements.reduce((acc, requirement) => {
      const advisorKey = requirement.advisorId;
      if (!acc[advisorKey]) {
        acc[advisorKey] = {
          advisor: requirement.advisor,
          requirements: [],
        };
      }
      acc[advisorKey].requirements.push(requirement);
      return acc;
    }, {} as Record<string, { advisor: any; requirements: any[] }>);

    return {
      success: true,
      data: Object.values(grouped),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get document requirements';
    return { success: false, error: message };
  }
}

// `fileSize` and `fileMimeType` were previously trusted from the client
// here. We now re-derive both from S3's HEAD response in the action body
// (matches the /api/documents/confirm route). The schema keeps them
// optional for back-compat with callers that still send them; the values
// are ignored.
const confirmUploadSchema = z.object({
  requirementId: z.string().min(1).max(64),
  fileMetadata: z.object({
    key: z.string().min(1),
    fileName: z.string().min(1).max(255),
    fileSize: z.coerce.number().positive().optional(),
    fileMimeType: z.string().min(1).optional(),
  }),
});

export async function confirmDocumentUpload(data: unknown) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const validatedFields = confirmUploadSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { requirementId, fileMetadata } = validatedFields.data;

    const requirement = await getDocumentRequirementForSessionUser(
      session.user.id,
      session.user.role,
      requirementId,
    );

    if (!requirement) {
      return {
        success: false,
        error: 'Document requirement not found or not assigned to you',
      };
    }

    if (!keyMatchesDocumentRequirement(fileMetadata.key, requirement.clientId, requirementId)) {
      return { success: false, error: 'Invalid upload key for this requirement' };
    }

    // Re-derive content-type and size from S3 (authoritative) instead of
    // trusting the client's confirm payload.
    const head = await headDocumentObject(fileMetadata.key);
    if (!head) {
      return {
        success: false,
        error: 'Uploaded object not found in storage',
      };
    }

    // Update the requirement with file metadata
    const updatedRequirement = await prisma.documentRequirement.update({
      where: { id: requirementId },
      data: {
        fulfilled: true,
        fulfilledAt: new Date(),
        fileKey: fileMetadata.key,
        fileName: fileMetadata.fileName,
        fileSize: head.contentLength ?? 0,
        fileMimeType: head.contentType ?? 'application/octet-stream',
      },
    });

    revalidatePath('/documents');
    revalidatePath('/advisor/pipeline');
    revalidatePath(`/advisor/pipeline/${requirement.clientId}`);
    return {
      success: true,
      data: updatedRequirement,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to confirm document upload';
    return { success: false, error: message };
  }
}

export async function getDocumentDownloadUrl(requirementId: string) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const validatedFields = z
      .object({
        requirementId: z.string().min(1).max(64),
      })
      .safeParse({ requirementId });

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Invalid requirement ID',
      };
    }

    const requirement = await getDocumentRequirementForSessionUser(
      session.user.id,
      session.user.role,
      requirementId,
    );

    if (!requirement || !requirement.fulfilled || !requirement.fileKey) {
      return {
        success: false,
        error: 'Document not found or no file uploaded',
      };
    }

    // Generate presigned download URL
    const downloadUrl = await generateDownloadUrl(requirement.fileKey);

    return {
      success: true,
      data: {
        downloadUrl,
        fileName: requirement.fileName,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate download URL';
    return { success: false, error: message };
  }
}