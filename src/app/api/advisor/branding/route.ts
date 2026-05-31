import { NextRequest, NextResponse } from 'next/server';
import { getAdvisorBrandingAction, updateAdvisorBrandingAction } from '@/lib/actions/advisor-branding-actions';
import { requireAdvisorRole } from '@/lib/advisor/auth';

/**
 * Map `requireAdvisorRole()` thrown errors to a real HTTP status. The role
 * helper throws plain `Error` objects with one of two messages:
 *   - "Not authenticated"            -> session missing
 *   - "Unauthorized: ..."            -> wrong role / portal disabled
 * Anything else from the catch is an unexpected server error (500).
 */
function isAuthError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message;
  return m === 'Not authenticated' || m.startsWith('Unauthorized');
}

export async function GET(request: NextRequest) {
  try {
    // Verify advisor authentication
    await requireAdvisorRole();

    // Get branding data
    const result = await getAdvisorBrandingAction();

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 401 }
      );
    }
    console.error('Get branding error:', error);

    const message = error instanceof Error ? error.message : 'Failed to fetch branding data';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify advisor authentication
    await requireAdvisorRole();

    // Parse request body
    const body = await request.json();

    // Convert JSON to FormData for compatibility with existing action
    const formData = new FormData();

    // Add all branding fields to FormData
    const brandingFields = [
      'brandName', 'tagline', 'primaryColor', 'secondaryColor', 'accentColor',
      'websiteUrl', 'emailFooterText', 'supportEmail', 'supportPhone', 'logoUrl'
    ];

    brandingFields.forEach(field => {
      if (body[field] !== undefined) {
        formData.append(field, body[field] || '');
      }
    });

    // Update branding
    const result = await updateAdvisorBrandingAction(formData);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 401 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    console.error('Update branding error:', error);

    const message = error instanceof Error ? error.message : 'Failed to update branding';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

