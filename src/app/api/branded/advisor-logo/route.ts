import { NextRequest, NextResponse } from 'next/server';
import { getAdvisorBySubdomain } from '@/lib/advisor/subdomain';
import { extractTenantSubdomainLabel } from '@/lib/advisor/platform-subdomain';
import {
  isS3ObjectNotFound,
  resolveBrandingLogoS3Key,
} from '@/lib/branding/advisor-logo-display';
import { prisma } from '@/lib/db';
import { getBrandingLogoObjectBytes } from '@/lib/s3/branding-uploads';

export const runtime = 'nodejs';

/**
 * Public logo bytes for an active tenant subdomain (no session).
 * Resolves advisor from the request Host header because /api/* skips proxy rewrites.
 */
export async function GET(request: NextRequest) {
  try {
    const host = request.headers.get('host') ?? '';
    const canonicalSlug = extractTenantSubdomainLabel(host);

    if (!canonicalSlug) {
      return new NextResponse(null, { status: 404 });
    }

    const advisorSubdomain = await getAdvisorBySubdomain(canonicalSlug);
    if (!advisorSubdomain?.isActive || !advisorSubdomain.dnsVerified) {
      return new NextResponse(null, { status: 404 });
    }

    const advisor = await prisma.advisorProfile.findUnique({
      where: { id: advisorSubdomain.advisorId },
      select: {
        id: true,
        brandingEnabled: true,
        logoS3Key: true,
        logoUrl: true,
        logoContentType: true,
      },
    });

    if (!advisor?.brandingEnabled) {
      return new NextResponse(null, { status: 404 });
    }

    const logoS3Key = resolveBrandingLogoS3Key(advisor);
    if (!logoS3Key) {
      return new NextResponse(null, { status: 404 });
    }

    const prefix = `advisors/${advisor.id}/`;
    if (!logoS3Key.startsWith(prefix)) {
      return new NextResponse(null, { status: 404 });
    }

    const { data, contentType } = await getBrandingLogoObjectBytes(logoS3Key);

    return new NextResponse(Buffer.from(data), {
      headers: {
        'Content-Type': advisor.logoContentType || contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    if (isS3ObjectNotFound(error)) {
      return new NextResponse(null, { status: 404 });
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error('Branded advisor logo error:', message);
    return new NextResponse(null, { status: 500 });
  }
}
