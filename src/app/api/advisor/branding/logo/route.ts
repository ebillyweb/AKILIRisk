import { NextRequest, NextResponse } from 'next/server';
import { deleteLogoAction } from '@/lib/actions/advisor-branding-actions';
import { requireAdvisorRole, isAdvisorAuthError } from '@/lib/advisor/auth';
import { auditLogoDelete } from '@/lib/audit/branding-audit';

export async function DELETE(request: NextRequest) {
  try {
    // Verify advisor authentication
    const { userId } = await requireAdvisorRole();

    // Get current logo info for audit logging
    const { prisma } = await import('@/lib/db');
    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        logoS3Key: true,
      }
    });

    if (!advisor) {
      return NextResponse.json(
        { success: false, error: 'Advisor profile not found' },
        { status: 404 }
      );
    }

    const logoS3Key = advisor.logoS3Key;

    // Delete the logo
    const result = await deleteLogoAction();

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Audit the deletion if there was a logo to delete
    if (logoS3Key) {
      await auditLogoDelete(
        advisor.id,
        userId,
        {
          s3Key: logoS3Key,
        },
        {
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
    console.error('Logo deletion error:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to delete logo' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}