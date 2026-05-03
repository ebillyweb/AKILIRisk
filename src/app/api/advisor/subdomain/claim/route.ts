import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdvisorRole } from '@/lib/advisor/auth';
import { requireSubdomainAccess, checkRateLimit } from '@/lib/subscription/validation';
import { validateSubdomainFormat, isSubdomainReserved } from '@/lib/advisor/subdomain';
import { auditSubdomainClaim } from '@/lib/audit/branding-audit';
import { prisma } from '@/lib/db';

const subdomainClaimSchema = z.object({
  subdomain: z.string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(20, 'Subdomain must be less than 20 characters')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Invalid subdomain format'),
});

export async function POST(request: NextRequest) {
  try {
    // Fail fast on missing config before we mutate any DB rows. Without
    // PRODUCTION_DOMAIN we cannot return valid DNS instructions, and silently
    // falling back to a placeholder domain (the previous behavior) handed
    // advisors records pointing at a domain we don't own.
    if (!process.env.PRODUCTION_DOMAIN?.trim()) {
      console.error(
        'PRODUCTION_DOMAIN environment variable is not configured; refusing to claim subdomain'
      );
      return NextResponse.json(
        { success: false, error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    // Verify advisor authentication and subdomain access
    const { userId } = await requireAdvisorRole();
    const { advisorId } = await requireSubdomainAccess(userId);

    // Parse and validate request body
    const body = await request.json();
    const validatedData = subdomainClaimSchema.parse(body);
    const { subdomain: requestedSubdomain } = validatedData;

    const cleanSubdomain = requestedSubdomain.toLowerCase().trim();

    // Check rate limits (3 subdomain changes per day)
    const rateLimit = await checkRateLimit(advisorId, 'subdomain_change', 24);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. You can only change subdomains 3 times per day.',
          retryAfter: rateLimit.resetTime,
          remaining: rateLimit.remaining
        },
        { status: 429 }
      );
    }

    // Validate format
    const formatValidation = validateSubdomainFormat(cleanSubdomain);
    if (!formatValidation.valid) {
      return NextResponse.json(
        { success: false, error: formatValidation.error },
        { status: 400 }
      );
    }

    // Check if reserved
    const reservedCheck = await isSubdomainReserved(cleanSubdomain);
    if (reservedCheck.reserved) {
      return NextResponse.json(
        {
          success: false,
          error: `Subdomain '${cleanSubdomain}' is reserved: ${reservedCheck.reason}`
        },
        { status: 400 }
      );
    }

    // Use a database transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Double-check availability within transaction
      const existing = await tx.advisorSubdomain.findUnique({
        where: { subdomain: cleanSubdomain }
      });

      if (existing) {
        throw new Error(`Subdomain '${cleanSubdomain}' is already taken`);
      }

      // Check if advisor already has a subdomain
      const currentSubdomain = await tx.advisorSubdomain.findUnique({
        where: { advisorId }
      });

      if (currentSubdomain) {
        // Update existing subdomain
        const updatedSubdomain = await tx.advisorSubdomain.update({
          where: { advisorId },
          data: {
            subdomain: cleanSubdomain,
            isActive: false, // Deactivate until DNS verification
            dnsVerified: false,
            sslProvisioned: false,
            updatedAt: new Date()
          }
        });

        return { action: 'updated', subdomain: updatedSubdomain };
      } else {
        // Create new subdomain
        const newSubdomain = await tx.advisorSubdomain.create({
          data: {
            advisorId,
            subdomain: cleanSubdomain,
            isActive: false, // Will be activated after DNS verification
            dnsVerified: false,
            sslProvisioned: false
          }
        });

        return { action: 'created', subdomain: newSubdomain };
      }
    });

    // Audit the action
    await auditSubdomainClaim(advisorId, userId, cleanSubdomain, {
      action: result.action,
      userAgent: request.headers.get('user-agent') || 'Unknown',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown'
    });

    // Generate DNS verification instructions
    const verificationInstructions = generateDNSInstructions(cleanSubdomain);

    return NextResponse.json({
      success: true,
      data: {
        subdomain: cleanSubdomain,
        status: 'pending_verification',
        dnsVerified: false,
        sslProvisioned: false,
        verificationInstructions
      }
    });

  } catch (error) {
    console.error('Subdomain claim error:', error);

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Invalid subdomain format' },
          { status: 400 }
        );
      }

      if (error.message.includes('not available on your current plan')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 403 }
        );
      }

      if (error.message.includes('already taken')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 409 }
        );
      }
    }

    const message = error instanceof Error ? error.message : 'Failed to claim subdomain';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify advisor authentication and subdomain access
    const { userId } = await requireAdvisorRole();
    const { advisorId } = await requireSubdomainAccess(userId);

    // Release the advisor's subdomain
    const deletedSubdomain = await prisma.advisorSubdomain.delete({
      where: { advisorId }
    });

    // Audit the release
    await auditSubdomainClaim(advisorId, userId, deletedSubdomain.subdomain, {
      action: 'released',
      userAgent: request.headers.get('user-agent') || 'Unknown',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown'
    });

    return NextResponse.json({
      success: true,
      message: 'Subdomain released successfully'
    });

  } catch (error) {
    console.error('Subdomain release error:', error);

    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json(
        { success: false, error: 'No subdomain found to release' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to release subdomain';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * Sentinel error class so the POST handler can distinguish missing-env
 * misconfiguration from user-input errors and return 500 instead of 4xx.
 */
class ServerMisconfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerMisconfigurationError';
  }
}

/**
 * Generate DNS setup instructions.
 *
 * Throws ServerMisconfigurationError if PRODUCTION_DOMAIN is unset — silently
 * falling back to a placeholder domain would hand advisors DNS records that
 * point at a domain we don't own, which is the original bug that motivated
 * this guard. LOAD_BALANCER_IP is no longer consulted (we issue CNAME records,
 * not A records), so it has been removed entirely.
 */
function generateDNSInstructions(subdomain: string): {
  type: string;
  record: string;
  value: string;
  instructions: string;
} {
  const productionDomain = process.env.PRODUCTION_DOMAIN?.trim();
  if (!productionDomain) {
    console.error(
      'PRODUCTION_DOMAIN environment variable is not configured; refusing to emit DNS instructions'
    );
    throw new ServerMisconfigurationError('Server misconfiguration');
  }

  return {
    type: 'CNAME',
    record: `${subdomain}.${productionDomain}`,
    value: `app.${productionDomain}`,
    instructions: `Create a CNAME record pointing ${subdomain}.${productionDomain} to app.${productionDomain}. This will automatically be verified within 15 minutes.`
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
