import { NextResponse } from 'next/server';
import { requireAdvisorRole, isAdvisorAuthError } from '@/lib/advisor/auth';
import { prisma } from '@/lib/db';
import { getBrandingLogoObjectBytes } from '@/lib/s3/branding-uploads';

/**
 * Authenticated logo image for UI preview (private S3 objects).
 */
export async function GET() {
  try {
    const { userId } = await requireAdvisorRole();

    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        logoS3Key: true,
        logoContentType: true,
      },
    });

    if (!advisor?.logoS3Key) {
      return new NextResponse(null, { status: 404 });
    }

    const prefix = `advisors/${advisor.id}/`;
    if (!advisor.logoS3Key.startsWith(prefix)) {
      return new NextResponse(null, { status: 404 });
    }

    const { data, contentType } = await getBrandingLogoObjectBytes(advisor.logoS3Key);

    return new NextResponse(Buffer.from(data), {
      headers: {
        'Content-Type': advisor.logoContentType || contentType,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (isAdvisorAuthError(error)) {
      return new NextResponse(null, { status: 401 });
    }
    console.error('Advisor logo view error:', error);
    return new NextResponse(null, { status: 500 });
  }
}
