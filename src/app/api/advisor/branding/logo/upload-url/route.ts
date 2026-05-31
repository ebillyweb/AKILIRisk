import { NextRequest, NextResponse } from 'next/server';
import { logoUploadSchema } from '@/lib/validation/branding';
import { generateLogoUploadUrlAction } from '@/lib/actions/advisor-branding-actions';
import { checkRateLimit } from '@/lib/subscription/validation';
import { requireAdvisorRole, isAdvisorAuthError } from '@/lib/advisor/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify advisor authentication
    const { userId } = await requireAdvisorRole();

    // Parse request body
    const body = await request.json();

    // Validate input
    const validatedData = logoUploadSchema.parse(body);
    const { fileName, fileType, fileSize } = validatedData;

    // Get advisor ID for rate limiting
    const { prisma } = await import('@/lib/db');
    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!advisor) {
      return NextResponse.json(
        { success: false, error: 'Advisor profile not found' },
        { status: 404 }
      );
    }

    // Check rate limits (10 uploads per hour for most tiers)
    const rateLimit = await checkRateLimit(advisor.id, 'logo_upload', 1);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateLimit.resetTime,
        },
        { status: 429 }
      );
    }

    // Generate upload URL
    const result = await generateLogoUploadUrlAction(fileName, fileType, fileSize);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
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

    console.error('Logo upload URL generation error:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}

// Add CORS headers for file uploads
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