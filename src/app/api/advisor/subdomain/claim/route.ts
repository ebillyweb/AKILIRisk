import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdvisorRole, isAdvisorAuthError } from '@/lib/advisor/auth';
import { requireSubdomainAccess, checkRateLimit } from '@/lib/subscription/validation';
import { assertCanMutateAdvisorBranding } from '@/lib/enterprise/branding-access';
import {
  validateSubdomainFormat,
  isSubdomainReserved,
  clearSubdomainCache,
} from '@/lib/advisor/subdomain';
import {
  getSubdomainActivationData,
  isSubdomainAutoActivateEnabled,
} from '@/lib/advisor/platform-subdomain';
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
    // Fail fast on missing config before we mutate any DB rows.
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
    await assertCanMutateAdvisorBranding(userId);
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

    const activation = getSubdomainActivationData();

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
        clearSubdomainCache(currentSubdomain.subdomain);

        const updatedSubdomain = await tx.advisorSubdomain.update({
          where: { advisorId },
          data: {
            subdomain: cleanSubdomain,
            isActive: activation.isActive,
            dnsVerified: activation.dnsVerified,
            sslProvisioned: activation.sslProvisioned,
            verifiedAt: activation.verifiedAt,
            updatedAt: new Date(),
          },
        });

        return { action: 'updated', subdomain: updatedSubdomain, previousSubdomain: currentSubdomain.subdomain };
      }

      const newSubdomain = await tx.advisorSubdomain.create({
        data: {
          advisorId,
          subdomain: cleanSubdomain,
          isActive: activation.isActive,
          dnsVerified: activation.dnsVerified,
          sslProvisioned: activation.sslProvisioned,
          verifiedAt: activation.verifiedAt,
        },
      });

      return { action: 'created', subdomain: newSubdomain, previousSubdomain: null as string | null };
    });

    clearSubdomainCache(cleanSubdomain);
    if (result.previousSubdomain && result.previousSubdomain !== cleanSubdomain) {
      clearSubdomainCache(result.previousSubdomain);
    }

    // Audit the action
    await auditSubdomainClaim(advisorId, userId, cleanSubdomain, {
      action: result.action,
      userAgent: request.headers.get('user-agent') || 'Unknown',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown'
    });

    const autoActivated = isSubdomainAutoActivateEnabled();

    return NextResponse.json({
      success: true,
      data: {
        subdomain: cleanSubdomain,
        status: autoActivated ? 'active' : 'pending_verification',
        dnsVerified: activation.dnsVerified,
        sslProvisioned: activation.sslProvisioned,
        isActive: activation.isActive,
        autoActivated,
      },
    });

  } catch (error) {
    if (isAdvisorAuthError(error)) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 401 }
      );
    }
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

    console.error('Subdomain claim error:', error);

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
    await assertCanMutateAdvisorBranding(userId);
    const { advisorId } = await requireSubdomainAccess(userId);

    const deletedSubdomain = await prisma.advisorSubdomain.delete({
      where: { advisorId },
    });

    clearSubdomainCache(deletedSubdomain.subdomain);

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
    if (isAdvisorAuthError(error)) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json(
        { success: false, error: 'No subdomain found to release' },
        { status: 404 }
      );
    }

    console.error('Subdomain release error:', error);

    const message = error instanceof Error ? error.message : 'Failed to release subdomain';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

