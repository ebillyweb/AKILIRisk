import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmLogoUploadAction } from '@/lib/actions/advisor-branding-actions';
import { requireAdvisorRole, isAdvisorAuthError } from '@/lib/advisor/auth';
import { auditLogoUpload } from '@/lib/audit/branding-audit';

const confirmUploadSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
  s3Key: z.string().min(1, 'S3 key is required'),
  originalFileName: z.string().min(1, 'Original file name is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Verify advisor authentication
    const { userId } = await requireAdvisorRole();

    // Parse and validate request body
    const body = await request.json();
    const validatedData = confirmUploadSchema.parse(body);
    const { uploadId, s3Key, originalFileName } = validatedData;

    // Confirm the upload
    const result = await confirmLogoUploadAction(uploadId, s3Key, originalFileName);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Get advisor ID for audit logging
    const { prisma } = await import('@/lib/db');
    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        logoContentType: true,
        logoFileSize: true,
      }
    });

    if (advisor) {
      // Audit the successful upload
      await auditLogoUpload(
        advisor.id,
        userId,
        {
          s3Key,
          fileName: originalFileName,
          fileSize: advisor.logoFileSize || 0,
          contentType: advisor.logoContentType || 'unknown',
        },
        {
          uploadId,
          userAgent: request.headers.get('user-agent') || 'unknown',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (isAdvisorAuthError(error)) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.message },
        { status: 400 }
      );
    }

    console.error('Logo upload confirmation error:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to confirm upload' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}