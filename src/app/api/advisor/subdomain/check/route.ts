import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkSubdomainAvailabilityAction } from '@/lib/actions/advisor-branding-actions';
import { requireAdvisorRole, isAdvisorAuthError } from '@/lib/advisor/auth';
import { requireSubdomainAccess } from '@/lib/subscription/validation';

const subdomainCheckSchema = z.object({
  subdomain: z.string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(20, 'Subdomain must be less than 20 characters')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Invalid subdomain format'),
});

export async function POST(request: NextRequest) {
  try {
    // Verify advisor authentication and subdomain access
    const { userId } = await requireAdvisorRole();
    await requireSubdomainAccess(userId);

    // Parse and validate request body
    const body = await request.json();
    const validatedData = subdomainCheckSchema.parse(body);
    const { subdomain } = validatedData;

    // Check subdomain availability
    const result = await checkSubdomainAvailabilityAction(subdomain);

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
        { success: false, error: 'Invalid subdomain format', details: error.message },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('not available on your current plan')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    console.error('Subdomain check error:', error);

    const message = error instanceof Error ? error.message : 'Failed to check subdomain availability';
    return NextResponse.json(
      { success: false, error: message },
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