import { NextRequest, NextResponse } from 'next/server';
import { requireAdvisorRole, isAdvisorAuthError } from '@/lib/advisor/auth';
import { uploadLogoDirectAction } from '@/lib/actions/advisor-branding-actions';
import { auditLogoUpload } from '@/lib/audit/branding-audit';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAdvisorRole();

    const formData = await request.formData();
    const entry = formData.get('file');
    if (!entry || !(entry instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Missing file' },
        { status: 400 }
      );
    }

    const buffer = new Uint8Array(await entry.arrayBuffer());
    const result = await uploadLogoDirectAction(entry.name, entry.type, buffer);

    if (!result.success) {
      const status = result.error?.includes('Rate limit') ? 429 : 400;
      return NextResponse.json(result, { status });
    }

    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (advisor && result.data) {
      await auditLogoUpload(
        advisor.id,
        userId,
        {
          s3Key: result.data.s3Key,
          fileName: entry.name,
          fileSize: buffer.byteLength,
          contentType: entry.type || 'application/octet-stream',
        },
        {
          uploadMethod: 'direct',
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
    console.error('Direct logo upload error:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}
